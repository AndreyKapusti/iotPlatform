package mqtt

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	paho "github.com/eclipse/paho.mqtt.golang"
)

type deviceRequest struct {
	DeviceID int    `json:"device_id"`
	APIKey   string `json:"api_key"`
	Nonce    string `json:"nonce"`
	ID       int64  `json:"id"`
	Value    *bool  `json:"value"`
}

func (c *Client) request(msg paho.Message) (deviceRequest, bool) {
	var p deviceRequest
	id, err := parseTopicDeviceID(msg.Topic())
	if err != nil || json.Unmarshal(msg.Payload(), &p) != nil || id <= 0 || p.DeviceID != id || p.APIKey == "" {
		return p, false
	}
	if err := c.store.ValidateDeviceAPIKey(context.Background(), id, p.APIKey); err != nil {
		c.logger.Warn("mqtt command request authentication failed", "device_id", id)
		return p, false
	}
	return p, true
}

func (c *Client) onPoll(client paho.Client, msg paho.Message) {
	p, ok := c.request(msg)
	if !ok || len(p.Nonce) == 0 || len(p.Nonce) > 80 {
		return
	}
	commands, err := c.store.PendingCommands(context.Background(), p.DeviceID)
	if err != nil {
		c.logger.Error("mqtt pending commands failed", "device_id", p.DeviceID, "error", err)
		return
	}
	items := make([]map[string]interface{}, 0, len(commands))
	for _, cmd := range commands {
		remaining := time.Until(cmd.ExpiresAt).Milliseconds()
		if remaining > 0 {
			items = append(items, map[string]interface{}{"id": cmd.ID, "metric": cmd.Metric, "value": cmd.Value, "remaining_ms": remaining})
		}
	}
	if len(items) == 0 {
		return
	}
	body, err := json.Marshal(map[string]interface{}{"nonce": p.Nonce, "commands": items})
	if err != nil {
		return
	}
	// Clean sessions, QoS 0 and retain=false prevent offline command delivery.
	client.Publish(fmt.Sprintf("devices/%d/command", p.DeviceID), 0, false, body)
}

func (c *Client) onAck(_ paho.Client, msg paho.Message) {
	p, ok := c.request(msg)
	if !ok || p.ID <= 0 || p.Value == nil {
		return
	}
	command, err := c.store.AcknowledgeCommand(context.Background(), p.DeviceID, p.ID, *p.Value)
	if err != nil {
		c.logger.Warn("mqtt command acknowledgement rejected", "device_id", p.DeviceID, "command_id", p.ID, "error", err)
		return
	}
	c.logger.Info("command acknowledged", "transport", "mqtt", "device_id", p.DeviceID, "command_id", p.ID, "metric", command.Metric)
}

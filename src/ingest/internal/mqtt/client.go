package mqtt

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	paho "github.com/eclipse/paho.mqtt.golang"

	"signaldeck/ingest/internal/hub"
	"signaldeck/ingest/internal/store"
)

type Client struct {
	store  *store.Store
	hub    *hub.Hub
	logger *slog.Logger
}

func NewClient(st *store.Store, h *hub.Hub, logger *slog.Logger) *Client {
	if logger == nil {
		logger = slog.Default()
	}
	return &Client{store: st, hub: h, logger: logger}
}

func (c *Client) Connect(ctx context.Context, brokerURL string) (paho.Client, error) {
	opts := paho.NewClientOptions()
	opts.AddBroker(brokerURL)
	opts.SetClientID(fmt.Sprintf("signaldeck-ingest-%d", time.Now().UnixNano()))
	opts.SetAutoReconnect(true)
	opts.SetConnectRetry(true)
	opts.SetConnectRetryInterval(5 * time.Second)
	opts.SetKeepAlive(30 * time.Second)

	client := paho.NewClient(opts)
	token := client.Connect()
	if !token.WaitTimeout(10 * time.Second) {
		return nil, fmt.Errorf("mqtt connect timeout")
	}
	if err := token.Error(); err != nil {
		return nil, fmt.Errorf("mqtt connect: %w", err)
	}

	if token := client.Subscribe("devices/+/announce", 1, c.onAnnounce); token.Wait() && token.Error() != nil {
		client.Disconnect(250)
		return nil, fmt.Errorf("subscribe announce: %w", token.Error())
	}
	if token := client.Subscribe("devices/+/telemetry", 1, c.onTelemetry); token.Wait() && token.Error() != nil {
		client.Disconnect(250)
		return nil, fmt.Errorf("subscribe telemetry: %w", token.Error())
	}

	c.logger.Info("mqtt connected", "broker", brokerURL)
	return client, nil
}

func parseTopicDeviceID(topic string) (int, error) {
	parts := strings.Split(topic, "/")
	if len(parts) != 3 || parts[0] != "devices" {
		return 0, fmt.Errorf("invalid topic %q", topic)
	}
	id, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, fmt.Errorf("invalid device id in topic %q: %w", topic, err)
	}
	return id, nil
}

func (c *Client) onAnnounce(_ paho.Client, msg paho.Message) {
	ctx := context.Background()
	topicDeviceID, err := parseTopicDeviceID(msg.Topic())
	if err != nil {
		c.logger.Warn("announce topic parse failed", "topic", msg.Topic(), "error", err)
		return
	}

	var payload store.AnnouncePayload
	if err := json.Unmarshal(msg.Payload(), &payload); err != nil {
		c.logger.Warn("announce json invalid", "topic", msg.Topic(), "error", err)
		return
	}

	if payload.DeviceID != topicDeviceID {
		c.logger.Warn("announce device_id mismatch",
			"topic_device_id", topicDeviceID, "payload_device_id", payload.DeviceID)
		return
	}

	if payload.APIKey == "" {
		c.logger.Warn("announce missing api_key", "device_id", payload.DeviceID)
		return
	}

	if err := c.store.ValidateDeviceAPIKey(ctx, payload.DeviceID, payload.APIKey); err != nil {
		c.logger.Warn("announce auth failed", "device_id", payload.DeviceID, "error", err)
		return
	}

	if payload.SchemaVersion <= 0 {
		payload.SchemaVersion = 1
	}

	if err := c.store.SaveAnnounce(ctx, payload); err != nil {
		c.logger.Error("announce save failed", "device_id", payload.DeviceID, "error", err)
		return
	}

	c.logger.Info("announce saved", "device_id", payload.DeviceID, "capabilities", len(payload.Capabilities))
}

func (c *Client) onTelemetry(_ paho.Client, msg paho.Message) {
	ctx := context.Background()
	topicDeviceID, err := parseTopicDeviceID(msg.Topic())
	if err != nil {
		c.logger.Warn("telemetry topic parse failed", "topic", msg.Topic(), "error", err)
		return
	}

	var payload store.TelemetryPayload
	if err := json.Unmarshal(msg.Payload(), &payload); err != nil {
		c.logger.Warn("telemetry json invalid", "topic", msg.Topic(), "error", err)
		return
	}

	if payload.DeviceID != topicDeviceID {
		c.logger.Warn("telemetry device_id mismatch",
			"topic_device_id", topicDeviceID, "payload_device_id", payload.DeviceID)
		return
	}

	if payload.APIKey == "" {
		c.logger.Warn("telemetry missing api_key", "device_id", payload.DeviceID)
		return
	}

	if err := c.store.ValidateDeviceAPIKey(ctx, payload.DeviceID, payload.APIKey); err != nil {
		c.logger.Warn("telemetry auth failed", "device_id", payload.DeviceID, "error", err)
		return
	}

	if len(payload.Readings) == 0 {
		c.logger.Warn("telemetry empty readings", "device_id", payload.DeviceID)
		return
	}

	classified, receivedAt, err := c.store.SaveTelemetry(ctx, payload)
	if err != nil {
		c.logger.Error("telemetry save failed", "device_id", payload.DeviceID, "error", err)
		return
	}

	for _, reading := range classified {
		c.hub.Broadcast(hub.ReadingEvent{
			DeviceID:   payload.DeviceID,
			Metric:     reading.Name,
			Value:      store.ReadingValue(reading),
			Type:       reading.Kind,
			ReceivedAt: receivedAt,
		})
	}
}

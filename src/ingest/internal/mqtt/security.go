package mqtt

// Dynamic Security is reconciled from the device registry. Each device logs in
// with its numeric ID and API key and can access only its own MQTT topics.
import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	paho "github.com/eclipse/paho.mqtt.golang"
	"signaldeck/ingest/internal/store"
)

const securityTopic = "$CONTROL/dynamic-security/v1"

type securityReply struct {
	Responses []struct {
		Command     string `json:"command"`
		Correlation string `json:"correlationData"`
		Error       string `json:"error"`
		Data        struct {
			Clients []string `json:"clients"`
		} `json:"data"`
	} `json:"responses"`
}

type securityManager struct {
	client                     paho.Client
	replies                    chan securityReply
	connected                  chan struct{}
	store                      *store.Store
	logger                     *slog.Logger
	ingestUser, ingestPassword string
	sequence                   uint64
}

func StartSecurity(ctx context.Context, st *store.Store, broker, adminPassword, ingestUser, ingestPassword string, logger *slog.Logger) error {
	if adminPassword == "" {
		return fmt.Errorf("MQTT_ADMIN_PASSWORD is required")
	}
	m := &securityManager{store: st, logger: logger, replies: make(chan securityReply, 8), connected: make(chan struct{}, 1), ingestUser: ingestUser, ingestPassword: ingestPassword}
	opts := brokerOptions(broker, "admin", adminPassword)
	opts.SetOrderMatters(false)
	opts.SetOnConnectHandler(func(c paho.Client) {
		t := c.Subscribe(securityTopic+"/response", 1, func(_ paho.Client, msg paho.Message) {
			var r securityReply
			if json.Unmarshal(msg.Payload(), &r) == nil {
				select {
				case m.replies <- r:
				default:
				}
			}
		})
		if !t.WaitTimeout(5*time.Second) || t.Error() != nil {
			logger.Error("mqtt security response subscribe failed")
			return
		}
		select {
		case m.connected <- struct{}{}:
		default:
		}
	})
	m.client = paho.NewClient(opts)
	t := m.client.Connect()
	if !t.WaitTimeout(10*time.Second) || t.Error() != nil {
		return fmt.Errorf("mqtt security connect failed")
	}
	select {
	case <-m.connected:
	case <-time.After(10 * time.Second):
		return fmt.Errorf("mqtt security subscription timeout")
	}
	known, err := m.bootstrap(ctx)
	if err != nil {
		m.client.Disconnect(0)
		return err
	}
	go m.run(ctx, known)
	return nil
}

func (m *securityManager) command(cmd map[string]interface{}) (securityReply, error) {
	var empty securityReply
	m.sequence++
	correlation := fmt.Sprintf("%d-%d", time.Now().UnixNano(), m.sequence)
	cmd["correlationData"] = correlation
	body, err := json.Marshal(map[string]interface{}{"commands": []interface{}{cmd}})
	if err != nil {
		return empty, err
	}
	t := m.client.Publish(securityTopic, 1, false, body)
	if !t.WaitTimeout(5*time.Second) || t.Error() != nil {
		return empty, fmt.Errorf("mqtt security publish failed")
	}
	deadline := time.NewTimer(5 * time.Second)
	defer deadline.Stop()
	for {
		select {
		case r := <-m.replies:
			if len(r.Responses) != 1 {
				return r, fmt.Errorf("invalid mqtt security response")
			}
			if r.Responses[0].Correlation != correlation {
				continue
			}
			if r.Responses[0].Error != "" {
				return r, fmt.Errorf("%s: %s", cmd["command"], r.Responses[0].Error)
			}
			return r, nil
		case <-deadline.C:
			return empty, fmt.Errorf("mqtt security response timeout")
		}
	}
}

func (m *securityManager) bootstrap(ctx context.Context) (map[string]string, error) {
	// A broker restart resets its ephemeral security database; an ingest restart
	// retains it. Recreate managed accounts to revoke changed/deleted credentials.
	for _, role := range []string{"sd-device", "sd-ingest"} {
		if _, err := m.command(map[string]interface{}{"command": "createRole", "rolename": role}); err != nil && !strings.Contains(strings.ToLower(err.Error()), "already exists") {
			return nil, err
		}
	}
	for _, rule := range []struct{ role, kind, topic string }{
		{"sd-device", "publishClientSend", "devices/%u/announce"}, {"sd-device", "publishClientSend", "devices/%u/telemetry"},
		{"sd-device", "publishClientSend", "devices/%u/poll"}, {"sd-device", "publishClientSend", "devices/%u/ack"},
		{"sd-device", "subscribePattern", "devices/%u/command"}, {"sd-device", "publishClientReceive", "devices/%u/command"},
		{"sd-ingest", "subscribePattern", "devices/+/announce"}, {"sd-ingest", "subscribePattern", "devices/+/telemetry"},
		{"sd-ingest", "subscribePattern", "devices/+/poll"}, {"sd-ingest", "subscribePattern", "devices/+/ack"},
		{"sd-ingest", "publishClientReceive", "devices/+/announce"}, {"sd-ingest", "publishClientReceive", "devices/+/telemetry"},
		{"sd-ingest", "publishClientReceive", "devices/+/poll"}, {"sd-ingest", "publishClientReceive", "devices/+/ack"},
		{"sd-ingest", "publishClientSend", "devices/+/command"},
	} {
		if _, err := m.command(map[string]interface{}{"command": "addRoleACL", "rolename": rule.role, "acltype": rule.kind, "topic": rule.topic, "allow": true}); err != nil && !strings.Contains(strings.ToLower(err.Error()), "already exists") {
			return nil, err
		}
	}
	_, _ = m.command(map[string]interface{}{"command": "deleteClient", "username": m.ingestUser})
	if err := m.create(m.ingestUser, m.ingestPassword, "sd-ingest"); err != nil {
		return nil, err
	}
	reply, err := m.command(map[string]interface{}{"command": "listClients", "verbose": false})
	if err != nil {
		return nil, err
	}
	for _, id := range reply.Responses[0].Data.Clients {
		if _, err := strconv.Atoi(id); err == nil {
			if _, err = m.command(map[string]interface{}{"command": "deleteClient", "username": id}); err != nil {
				return nil, err
			}
		}
	}
	known := map[string]string{}
	if err = m.sync(ctx, known); err != nil {
		return nil, err
	}
	return known, nil
}

func (m *securityManager) create(id, key, role string) error {
	_, err := m.command(map[string]interface{}{"command": "createClient", "username": id, "password": key, "roles": []map[string]interface{}{{"rolename": role}}})
	return err
}

func (m *securityManager) sync(ctx context.Context, known map[string]string) error {
	current, err := m.store.MQTTDevices(ctx)
	if err != nil {
		return err
	}
	for id, old := range known {
		if key, ok := current[id]; !ok || key != old {
			if _, err := m.command(map[string]interface{}{"command": "deleteClient", "username": id}); err != nil {
				return err
			}
			delete(known, id)
		}
	}
	for id, key := range current {
		if _, ok := known[id]; !ok {
			if err := m.create(id, key, "sd-device"); err != nil {
				return err
			}
			known[id] = key
		}
	}
	return nil
}

func (m *securityManager) run(ctx context.Context, known map[string]string) {
	defer m.client.Disconnect(250)
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-m.connected:
			var err error
			known, err = m.bootstrap(ctx)
			if err != nil {
				m.logger.Error("mqtt security bootstrap failed", "error", err)
				known = nil
			}
		case <-ticker.C:
			if !m.client.IsConnectionOpen() {
				continue
			}
			if known == nil {
				var err error
				known, err = m.bootstrap(ctx)
				if err != nil {
					m.logger.Error("mqtt security bootstrap failed", "error", err)
				}
				continue
			}
			if err := m.sync(ctx, known); err != nil {
				m.logger.Error("mqtt security sync failed", "error", err)
				known = nil
			}
		}
	}
}

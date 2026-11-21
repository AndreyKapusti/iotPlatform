package httpapi

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"signaldeck/ingest/internal/config"
	"signaldeck/ingest/internal/hub"
	"signaldeck/ingest/internal/store"
	"strings"
	"testing"
	"time"
)

type fakeCommandStore struct {
	fakeStore
	created int
	command store.Command
}

func (f *fakeCommandStore) CreateCommand(_ context.Context, id int, metric string, value bool) (store.Command, error) {
	f.created++
	f.command = store.Command{ID: 42, DeviceID: id, Metric: metric, Value: value, Status: "pending", CreatedAt: time.Now(), ExpiresAt: time.Now().Add(time.Minute)}
	return f.command, nil
}
func (f *fakeCommandStore) GetCommand(_ context.Context, deviceID int, id int64) (store.Command, error) {
	if deviceID != f.command.DeviceID || id != f.command.ID {
		return store.Command{}, store.ErrCommandNotFound
	}
	return f.command, nil
}
func (f *fakeCommandStore) PendingCommands(_ context.Context, deviceID int) ([]store.Command, error) {
	return []store.Command{f.command}, nil
}
func (f *fakeCommandStore) AcknowledgeCommand(_ context.Context, deviceID int, id int64, value bool) (store.Command, error) {
	if deviceID != f.command.DeviceID || id != f.command.ID || value != f.command.Value {
		return store.Command{}, store.ErrCommandConflict
	}
	f.command.Status = "acknowledged"
	return f.command, nil
}

func TestCommandAuthorizationAndDeviceAcknowledgement(t *testing.T) {
	st := &fakeCommandStore{}
	secret := "test-secret"
	srv := New(st, hub.New(), config.Config{JWTSecret: secret}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	send := func(method, path, body, token, key string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		if key != "" {
			req.Header.Set("X-API-Key", key)
		}
		rec := httptest.NewRecorder()
		srv.Handler().ServeHTTP(rec, req)
		return rec
	}
	path := "/api/v1/commands/7"
	if rec := send(http.MethodPost, path, `{"metric":"relay_1","value":true}`, "", ""); rec.Code != 401 {
		t.Fatalf("unauthenticated create: %d", rec.Code)
	}
	token := signToken(t, secret, "owner")
	if rec := send(http.MethodPost, path, `{"metric":"relay_1"}`, token, ""); rec.Code != 400 {
		t.Fatalf("missing value: %d", rec.Code)
	}
	if rec := send(http.MethodPost, path, `{"metric":"relay_1","value":true}`, token, ""); rec.Code != 201 {
		t.Fatalf("create: %d %s", rec.Code, rec.Body.String())
	}
	if rec := send(http.MethodGet, "/api/v1/ingest/commands?device_id=7", "", "", ""); rec.Code != 401 {
		t.Fatalf("missing device key: %d", rec.Code)
	}
	if rec := send(http.MethodPost, "/api/v1/ingest/commands/42/ack", `{"device_id":7,"value":false}`, "", "key"); rec.Code != 409 {
		t.Fatalf("wrong acknowledgement: %d", rec.Code)
	}
	if rec := send(http.MethodPost, "/api/v1/ingest/commands/42/ack", `{"device_id":7,"value":true}`, "", "key"); rec.Code != 200 {
		t.Fatalf("ack: %d %s", rec.Code, rec.Body.String())
	}
	if rec := send(http.MethodGet, "/api/v1/commands/7/42", "", token, ""); rec.Code != 200 || !strings.Contains(rec.Body.String(), `"acknowledged"`) {
		t.Fatalf("status: %d %s", rec.Code, rec.Body.String())
	}
}

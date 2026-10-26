package httpapi

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"signaldeck/ingest/internal/config"
	"signaldeck/ingest/internal/hub"
	"signaldeck/ingest/internal/store"
)

type fakeStore struct {
	announceCalls  int
	telemetryCalls int
	authCalls      int
	lastTelemetry  store.TelemetryPayload
	keyErr         error
	saveErr        error
	ownerErr       error
	history        []store.HistoryPoint
}

func (f *fakeStore) Ping(context.Context) error { return nil }

func (f *fakeStore) ValidateDeviceAPIKey(context.Context, int, string) error {
	return f.keyErr
}

func (f *fakeStore) SaveAnnounce(context.Context, store.AnnouncePayload) error {
	f.announceCalls++
	return f.saveErr
}

func (f *fakeStore) SaveTelemetry(_ context.Context, payload store.TelemetryPayload) ([]store.SavedReading, time.Time, error) {
	f.telemetryCalls++
	f.lastTelemetry = payload
	if f.saveErr != nil {
		return nil, time.Time{}, f.saveErr
	}
	return []store.SavedReading{store.NumberReading("temperature", 21.5)}, time.Now().UTC(), nil
}

func (f *fakeStore) GetHistory(context.Context, int, string, int) ([]store.HistoryPoint, error) {
	return f.history, nil
}

func (f *fakeStore) GetLatest(context.Context, int) ([]store.LatestReading, error) {
	return nil, nil
}

func (f *fakeStore) AuthorizeDeviceOwner(context.Context, string, int) error {
	f.authCalls++
	return f.ownerErr
}

func newTestServer(st deviceStore) *Server {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return New(st, hub.New(), config.Config{}, logger)
}

func TestHTTPAnnounceAndTelemetryWithAPIKey(t *testing.T) {
	st := &fakeStore{}
	srv := newTestServer(st)

	announce := httptest.NewRequest(http.MethodPost, "/api/v1/ingest/announce", strings.NewReader(`{
		"device_id": 7,
		"capabilities": [{"name": "temperature", "type": "number", "role": "sensor"}]
	}`))
	announce.Header.Set("X-API-Key", "device-key")
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, announce)
	if rec.Code != http.StatusOK {
		t.Fatalf("announce status %d body %s", rec.Code, rec.Body.String())
	}
	if st.announceCalls != 1 {
		t.Fatalf("announce saves = %d", st.announceCalls)
	}

	telemetry := httptest.NewRequest(http.MethodPost, "/api/v1/ingest/telemetry", strings.NewReader(`{
		"device_id": 7,
		"readings": {"temperature": 21.5}
	}`))
	telemetry.Header.Set("X-API-Key", "device-key")
	rec = httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, telemetry)
	if rec.Code != http.StatusOK {
		t.Fatalf("telemetry status %d body %s", rec.Code, rec.Body.String())
	}
	if st.telemetryCalls != 1 {
		t.Fatalf("telemetry saves = %d", st.telemetryCalls)
	}
	if _, ok := st.lastTelemetry.Readings["temperature"]; !ok {
		t.Fatalf("temperature reading was not passed to the store")
	}
}

func TestHTTPMissingAPIKey(t *testing.T) {
	st := &fakeStore{}
	srv := newTestServer(st)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest/telemetry", strings.NewReader(`{
		"device_id": 7,
		"readings": {"temperature": 21.5}
	}`))
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
	if st.telemetryCalls != 0 {
		t.Fatalf("telemetry was saved without a key")
	}
}

func TestHTTPInvalidJSON(t *testing.T) {
	st := &fakeStore{}
	srv := newTestServer(st)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest/announce", strings.NewReader(`{`))
	req.Header.Set("X-API-Key", "device-key")
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	if st.announceCalls != 0 {
		t.Fatalf("announce was saved for invalid json")
	}
}

func TestHTTPInvalidAPIKey(t *testing.T) {
	st := &fakeStore{keyErr: store.ErrInvalidAPIKey}
	srv := newTestServer(st)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest/telemetry", strings.NewReader(`{
		"device_id": 7,
		"readings": {"temperature": 21.5}
	}`))
	req.Header.Set("X-API-Key", "wrong")
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
	if st.telemetryCalls != 0 {
		t.Fatalf("telemetry was saved with an invalid key")
	}
}

func TestTelemetryCapabilityMismatchIs400(t *testing.T) {
	st := &fakeStore{saveErr: store.ErrCapabilityMismatch}
	srv := newTestServer(st)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest/telemetry", strings.NewReader(`{
		"device_id": 7,
		"readings": {"temperature": true}
	}`))
	req.Header.Set("X-API-Key", "device-key")
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestHistoryAndWebSocketRequireOwner(t *testing.T) {
	const secret = "test-secret"
	st := &fakeStore{
		history: []store.HistoryPoint{{
			Metric: "temperature",
			Value:  21.5,
			Type:   "number",
		}},
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := New(st, hub.New(), config.Config{JWTSecret: secret}, logger)

	missing := httptest.NewRequest(http.MethodGet, "/api/v1/telemetry/7/history?metric=temperature", nil)
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, missing)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("missing token status %d", rec.Code)
	}
	if st.authCalls != 0 {
		t.Fatalf("store auth ran without a token")
	}

	stranger := httptest.NewRequest(http.MethodGet, "/api/v1/telemetry/7/latest", nil)
	stranger.Header.Set("Authorization", "Bearer "+signToken(t, secret, "stranger"))
	st.ownerErr = store.ErrDeviceNotFound
	rec = httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, stranger)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("stranger status %d", rec.Code)
	}

	st.ownerErr = nil
	owner := httptest.NewRequest(http.MethodGet, "/api/v1/telemetry/7/history?metric=temperature", nil)
	owner.Header.Set("Authorization", "Bearer "+signToken(t, secret, "owner"))
	rec = httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner history status %d body %s", rec.Code, rec.Body.String())
	}

	ws := httptest.NewRequest(http.MethodGet, "/api/v1/ws?device_id=7&access_token="+signToken(t, secret, "owner"), nil)
	callsBefore := st.authCalls
	rec = httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, ws)
	if st.authCalls != callsBefore+1 {
		t.Fatalf("websocket did not check the owner")
	}
	if rec.Code == http.StatusUnauthorized || rec.Code == http.StatusNotFound {
		t.Fatalf("owner websocket rejected with %d", rec.Code)
	}

	denied := httptest.NewRequest(http.MethodGet, "/api/v1/ws?device_id=7", nil)
	rec = httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, denied)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("websocket without token status %d", rec.Code)
	}
}

func signToken(t *testing.T, secret, username string) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub": username,
		"exp": time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return signed
}

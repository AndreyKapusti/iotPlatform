package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/cors"

	"signaldeck/ingest/internal/config"
	"signaldeck/ingest/internal/hub"
	"signaldeck/ingest/internal/store"
)

type Server struct {
	store  *store.Store
	hub    *hub.Hub
	cfg    config.Config
	logger *slog.Logger
	upgr   websocket.Upgrader
}

func New(st *store.Store, h *hub.Hub, cfg config.Config, logger *slog.Logger) *Server {
	if logger == nil {
		logger = slog.Default()
	}

	allowedOrigins := cfg.CORSOrigins
	s := &Server{
		store:  st,
		hub:    h,
		cfg:    cfg,
		logger: logger,
		upgr: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				if len(allowedOrigins) == 0 {
					return true
				}
				origin := r.Header.Get("Origin")
				if origin == "" {
					return true
				}
				for _, o := range allowedOrigins {
					if o == origin {
						return true
					}
				}
				return false
			},
		},
	}
	return s
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("POST /api/v1/ingest/announce", s.handleAnnounce)
	mux.HandleFunc("POST /api/v1/ingest/telemetry", s.handleTelemetry)
	mux.HandleFunc("GET /api/v1/telemetry/{deviceId}/history", s.handleHistory)
	mux.HandleFunc("GET /api/v1/telemetry/{deviceId}/latest", s.handleLatest)
	mux.HandleFunc("GET /api/v1/ws", s.handleWebSocket)

	c := cors.New(cors.Options{
		AllowedOrigins:   s.cfg.CORSOrigins,
		AllowOriginFunc:  originAllowAllWhenEmpty(s.cfg.CORSOrigins),
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "X-API-Key", "Authorization"},
		AllowCredentials: true,
	})
	return c.Handler(mux)
}

func originAllowAllWhenEmpty(origins []string) func(origin string) bool {
	if len(origins) > 0 {
		return nil
	}
	return func(string) bool { return true }
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	status := "ok"
	code := http.StatusOK
	if err := s.store.Ping(ctx); err != nil {
		status = "degraded"
		code = http.StatusServiceUnavailable
	}

	writeJSON(w, code, map[string]string{"status": status})
}

func (s *Server) handleAnnounce(w http.ResponseWriter, r *http.Request) {
	apiKey := r.Header.Get("X-API-Key")
	if apiKey == "" {
		writeError(w, http.StatusUnauthorized, "missing X-API-Key")
		return
	}

	var payload store.AnnouncePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	if payload.DeviceID <= 0 {
		writeError(w, http.StatusBadRequest, "device_id required")
		return
	}
	if payload.SchemaVersion <= 0 {
		payload.SchemaVersion = 1
	}
	if len(payload.Capabilities) == 0 {
		writeError(w, http.StatusBadRequest, "capabilities required")
		return
	}

	ctx := r.Context()
	if err := s.store.ValidateDeviceAPIKey(ctx, payload.DeviceID, apiKey); err != nil {
		writeStoreAuthError(w, err)
		return
	}

	if err := s.store.SaveAnnounce(ctx, payload); err != nil {
		s.logger.Error("save announce", "device_id", payload.DeviceID, "error", err)
		writeError(w, http.StatusInternalServerError, "failed to save announce")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":        true,
		"device_id": payload.DeviceID,
	})
}

func (s *Server) handleTelemetry(w http.ResponseWriter, r *http.Request) {
	apiKey := r.Header.Get("X-API-Key")
	if apiKey == "" {
		writeError(w, http.StatusUnauthorized, "missing X-API-Key")
		return
	}

	var payload store.TelemetryPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	if payload.DeviceID <= 0 {
		writeError(w, http.StatusBadRequest, "device_id required")
		return
	}
	if len(payload.Readings) == 0 {
		writeError(w, http.StatusBadRequest, "readings required")
		return
	}

	ctx := r.Context()
	if err := s.store.ValidateDeviceAPIKey(ctx, payload.DeviceID, apiKey); err != nil {
		writeStoreAuthError(w, err)
		return
	}

	readings, receivedAt, err := s.store.SaveTelemetry(ctx, payload)
	if err != nil {
		if errors.Is(err, store.ErrUnsupportedValue) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		s.logger.Error("save telemetry", "device_id", payload.DeviceID, "error", err)
		writeError(w, http.StatusInternalServerError, "failed to save telemetry")
		return
	}

	for _, reading := range readings {
		s.hub.Broadcast(hub.ReadingEvent{
			DeviceID:   payload.DeviceID,
			Metric:     reading.Name,
			Value:      store.ReadingValue(reading),
			Type:       reading.Kind,
			ReceivedAt: receivedAt,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":        true,
		"device_id": payload.DeviceID,
		"saved":     len(readings),
	})
}

func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request) {
	deviceID, err := strconv.Atoi(r.PathValue("deviceId"))
	if err != nil || deviceID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid device id")
		return
	}

	metric := strings.TrimSpace(r.URL.Query().Get("metric"))
	if metric == "" {
		writeError(w, http.StatusBadRequest, "metric query parameter required")
		return
	}

	limit := 100
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			writeError(w, http.StatusBadRequest, "invalid limit")
			return
		}
		limit = parsed
	}

	points, err := s.store.GetHistory(r.Context(), deviceID, metric, limit)
	if err != nil {
		if errors.Is(err, store.ErrUnknownMetric) {
			writeError(w, http.StatusNotFound, "metric not found for device")
			return
		}
		s.logger.Error("get history", "device_id", deviceID, "metric", metric, "error", err)
		writeError(w, http.StatusInternalServerError, "failed to load history")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"device_id": deviceID,
		"metric":    metric,
		"points":    points,
	})
}

func (s *Server) handleLatest(w http.ResponseWriter, r *http.Request) {
	deviceID, err := strconv.Atoi(r.PathValue("deviceId"))
	if err != nil || deviceID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid device id")
		return
	}

	readings, err := s.store.GetLatest(r.Context(), deviceID)
	if err != nil {
		s.logger.Error("get latest", "device_id", deviceID, "error", err)
		writeError(w, http.StatusInternalServerError, "failed to load latest readings")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"device_id": deviceID,
		"readings":  readings,
	})
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	deviceID, err := strconv.Atoi(r.URL.Query().Get("device_id"))
	if err != nil || deviceID <= 0 {
		writeError(w, http.StatusBadRequest, "device_id query parameter required")
		return
	}

	conn, err := s.upgr.Upgrade(w, r, nil)
	if err != nil {
		s.logger.Warn("websocket upgrade failed", "error", err)
		return
	}
	defer conn.Close()

	events, unsubscribe := s.hub.Subscribe(deviceID)
	defer unsubscribe()

	conn.SetReadLimit(512)
	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	pingTicker := time.NewTicker(30 * time.Second)
	defer pingTicker.Stop()

	for {
		select {
		case <-done:
			return
		case msg, ok := <-events:
			if !ok {
				return
			}
			_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-pingTicker.C:
			_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeStoreAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrDeviceNotFound):
		writeError(w, http.StatusNotFound, "device not found")
	case errors.Is(err, store.ErrInvalidAPIKey):
		writeError(w, http.StatusUnauthorized, "invalid api key")
	default:
		writeError(w, http.StatusInternalServerError, "auth check failed")
	}
}

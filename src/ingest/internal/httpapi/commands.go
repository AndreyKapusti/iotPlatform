package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"signaldeck/ingest/internal/store"
	"strconv"
	"strings"
)

type commandStore interface {
	CreateCommand(context.Context, int, string, bool) (store.Command, error)
	GetCommand(context.Context, int, int64) (store.Command, error)
	PendingCommands(context.Context, int) ([]store.Command, error)
	AcknowledgeCommand(context.Context, int, int64, bool) (store.Command, error)
}

func (s *Server) commands() commandStore { c, _ := s.store.(commandStore); return c }
func parseID(raw string) (int64, error) {
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("invalid id")
	}
	return id, nil
}
func (s *Server) createCommand(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.PathValue("deviceId"))
	if err != nil {
		writeError(w, 400, "invalid device id")
		return
	}
	if !s.authorizeOwner(w, r, int(id)) {
		return
	}
	var body struct {
		Metric string `json:"metric"`
		Value  *bool  `json:"value"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body) != nil || strings.TrimSpace(body.Metric) == "" || body.Value == nil {
		writeError(w, 400, "metric and boolean value required")
		return
	}
	c := s.commands()
	if c == nil {
		writeError(w, 500, "commands unavailable")
		return
	}
	command, err := c.CreateCommand(r.Context(), int(id), body.Metric, *body.Value)
	if errors.Is(err, store.ErrUnknownMetric) {
		writeError(w, 400, "unknown boolean actuator")
		return
	}
	if errors.Is(err, store.ErrAutomaticMode) {
		writeError(w, http.StatusConflict, "actuator is in automatic mode")
		return
	}
	if err != nil {
		s.logger.Error("create command", "device_id", id, "error", err)
		writeError(w, 500, "failed to create command")
		return
	}
	s.logger.Info("command created", "device_id", id, "command_id", command.ID, "metric", command.Metric)
	writeJSON(w, http.StatusCreated, command)
}
func (s *Server) getCommand(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.PathValue("deviceId"))
	if err != nil {
		writeError(w, 400, "invalid device id")
		return
	}
	if !s.authorizeOwner(w, r, int(id)) {
		return
	}
	cmdID, err := parseID(r.PathValue("commandId"))
	if err != nil {
		writeError(w, 400, "invalid command id")
		return
	}
	c := s.commands()
	if c == nil {
		writeError(w, 500, "commands unavailable")
		return
	}
	command, err := c.GetCommand(r.Context(), int(id), cmdID)
	if errors.Is(err, store.ErrCommandNotFound) {
		writeError(w, 404, "command not found")
		return
	}
	if err != nil {
		s.logger.Error("get command", "error", err)
		writeError(w, 500, "failed to get command")
		return
	}
	writeJSON(w, 200, command)
}
func (s *Server) authorizeCommandDevice(w http.ResponseWriter, r *http.Request, deviceID int) bool {
	key := r.Header.Get("X-API-Key")
	if key == "" {
		writeError(w, 401, "missing X-API-Key")
		return false
	}
	if err := s.store.ValidateDeviceAPIKey(r.Context(), deviceID, key); err != nil {
		writeStoreAuthError(w, err)
		return false
	}
	return true
}
func (s *Server) deviceCommands(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.URL.Query().Get("device_id"))
	if err != nil {
		writeError(w, 400, "invalid device id")
		return
	}
	if !s.authorizeCommandDevice(w, r, int(id)) {
		return
	}
	c := s.commands()
	if c == nil {
		writeError(w, 500, "commands unavailable")
		return
	}
	commands, err := c.PendingCommands(r.Context(), int(id))
	if err != nil {
		s.logger.Error("pending commands", "error", err)
		writeError(w, 500, "failed to get commands")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, map[string]interface{}{"commands": commands})
}
func (s *Server) ackCommand(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r.PathValue("commandId"))
	if err != nil {
		writeError(w, 400, "invalid command id")
		return
	}
	var body struct {
		DeviceID int   `json:"device_id"`
		Value    *bool `json:"value"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body) != nil || body.DeviceID <= 0 || body.Value == nil {
		writeError(w, 400, "device_id and boolean value required")
		return
	}
	if !s.authorizeCommandDevice(w, r, body.DeviceID) {
		return
	}
	c := s.commands()
	if c == nil {
		writeError(w, 500, "commands unavailable")
		return
	}
	command, err := c.AcknowledgeCommand(r.Context(), body.DeviceID, id, *body.Value)
	if errors.Is(err, store.ErrCommandConflict) {
		writeError(w, 409, "command expired, superseded, or value mismatch")
		return
	}
	if err != nil {
		s.logger.Error("ack command", "error", err)
		writeError(w, 500, "failed to acknowledge command")
		return
	}
	s.logger.Info("command acknowledged", "device_id", body.DeviceID, "command_id", id, "metric", command.Metric)
	writeJSON(w, 200, command)
}

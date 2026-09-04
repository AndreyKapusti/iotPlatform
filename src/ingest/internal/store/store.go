package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrDeviceNotFound   = errors.New("device not found")
	ErrInvalidAPIKey    = errors.New("invalid api key")
	ErrUnknownMetric    = errors.New("unknown metric")
	ErrUnsupportedValue = errors.New("unsupported reading value type")
)

type Capability struct {
	Name   string   `json:"name"`
	Type   string   `json:"type"`
	Role   string   `json:"role"`
	Unit   *string  `json:"unit,omitempty"`
	Min    *float64 `json:"min,omitempty"`
	Max    *float64 `json:"max,omitempty"`
}

type AnnouncePayload struct {
	DeviceID      int          `json:"device_id"`
	SchemaVersion int          `json:"schema_version"`
	Firmware      string       `json:"firmware,omitempty"`
	Capabilities  []Capability `json:"capabilities"`
	APIKey        string       `json:"api_key,omitempty"`
}

type TelemetryPayload struct {
	DeviceID  int                    `json:"device_id"`
	Timestamp *time.Time             `json:"timestamp,omitempty"`
	Readings  map[string]interface{} `json:"readings"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	APIKey    string                 `json:"api_key,omitempty"`
}

type HistoryPoint struct {
	Metric     string      `json:"metric"`
	Value      interface{} `json:"value"`
	Type       string      `json:"type"`
	ReceivedAt time.Time   `json:"received_at"`
}

type LatestReading struct {
	Metric     string      `json:"metric"`
	Value      interface{} `json:"value"`
	Type       string      `json:"type"`
	ReceivedAt time.Time   `json:"received_at"`
}

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

func (s *Store) ValidateDeviceAPIKey(ctx context.Context, deviceID int, apiKey string) error {
	var storedKey string
	err := s.pool.QueryRow(ctx,
		`SELECT api_key FROM devices WHERE id = $1 AND is_active = TRUE`,
		deviceID,
	).Scan(&storedKey)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrDeviceNotFound
		}
		return fmt.Errorf("lookup device: %w", err)
	}
	if storedKey != apiKey {
		return ErrInvalidAPIKey
	}
	return nil
}

func (s *Store) SaveAnnounce(ctx context.Context, payload AnnouncePayload) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`DELETE FROM device_capabilities WHERE device_id = $1`,
		payload.DeviceID,
	); err != nil {
		return fmt.Errorf("delete capabilities: %w", err)
	}

	for _, cap := range payload.Capabilities {
		if cap.Name == "" || cap.Type == "" || cap.Role == "" {
			return fmt.Errorf("capability missing required fields")
		}
		if cap.Type != "number" && cap.Type != "boolean" && cap.Type != "string" {
			return fmt.Errorf("invalid capability type %q", cap.Type)
		}
		if cap.Role != "sensor" && cap.Role != "actuator" {
			return fmt.Errorf("invalid capability role %q", cap.Role)
		}

		_, err := tx.Exec(ctx, `
			INSERT INTO device_capabilities
				(device_id, name, data_type, role, unit, min_value, max_value, schema_version, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
			payload.DeviceID,
			cap.Name,
			cap.Type,
			cap.Role,
			cap.Unit,
			cap.Min,
			cap.Max,
			payload.SchemaVersion,
		)
		if err != nil {
			return fmt.Errorf("insert capability %q: %w", cap.Name, err)
		}
	}

	if _, err := tx.Exec(ctx,
		`UPDATE devices SET last_seen_at = NOW() WHERE id = $1`,
		payload.DeviceID,
	); err != nil {
		return fmt.Errorf("update last_seen_at: %w", err)
	}

	return tx.Commit(ctx)
}

type SavedReading struct {
	Name string
	Kind string
	num  *float64
	b    *bool
	text *string
}

func classifyReading(name string, raw json.RawMessage) (SavedReading, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return SavedReading{}, fmt.Errorf("%w for metric %q", ErrUnsupportedValue, name)
	}

	var asBool bool
	if err := json.Unmarshal(raw, &asBool); err == nil {
		return SavedReading{Name: name, Kind: "boolean", b: &asBool}, nil
	}

	var asFloat float64
	if err := json.Unmarshal(raw, &asFloat); err == nil {
		return SavedReading{Name: name, Kind: "number", num: &asFloat}, nil
	}

	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return SavedReading{Name: name, Kind: "string", text: &asString}, nil
	}

	return SavedReading{}, fmt.Errorf("%w for metric %q", ErrUnsupportedValue, name)
}

func classifyFromInterface(name string, value interface{}) (SavedReading, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return SavedReading{}, err
	}
	return classifyReading(name, raw)
}

func (s *Store) SaveTelemetry(ctx context.Context, payload TelemetryPayload) ([]SavedReading, time.Time, error) {
	receivedAt := time.Now().UTC()
	if payload.Timestamp != nil {
		receivedAt = payload.Timestamp.UTC()
	}

	classified := make([]SavedReading, 0, len(payload.Readings))
	for name, value := range payload.Readings {
		cr, err := classifyFromInterface(name, value)
		if err != nil {
			return nil, time.Time{}, err
		}
		classified = append(classified, cr)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	for _, cr := range classified {
		switch cr.Kind {
		case "number":
			_, err = tx.Exec(ctx, `
				INSERT INTO sensor_metrics_numeric (device_id, metric_name, value, received_at)
				VALUES ($1, $2, $3, $4)`,
				payload.DeviceID, cr.Name, *cr.num, receivedAt,
			)
		case "boolean":
			_, err = tx.Exec(ctx, `
				INSERT INTO sensor_metrics_boolean (device_id, metric_name, value, received_at)
				VALUES ($1, $2, $3, $4)`,
				payload.DeviceID, cr.Name, *cr.b, receivedAt,
			)
		case "string":
			_, err = tx.Exec(ctx, `
				INSERT INTO sensor_metrics_text (device_id, metric_name, value, received_at)
				VALUES ($1, $2, $3, $4)`,
				payload.DeviceID, cr.Name, *cr.text, receivedAt,
			)
		default:
			return nil, time.Time{}, fmt.Errorf("%w: %s", ErrUnsupportedValue, cr.Kind)
		}
		if err != nil {
			return nil, time.Time{}, fmt.Errorf("insert metric %q: %w", cr.Name, err)
		}
	}

	if _, err := tx.Exec(ctx,
		`UPDATE devices SET last_seen_at = $2 WHERE id = $1`,
		payload.DeviceID, receivedAt,
	); err != nil {
		return nil, time.Time{}, fmt.Errorf("update last_seen_at: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, time.Time{}, fmt.Errorf("commit tx: %w", err)
	}

	return classified, receivedAt, nil
}

func (s *Store) metricDataType(ctx context.Context, deviceID int, metric string) (string, error) {
	var dataType string
	err := s.pool.QueryRow(ctx, `
		SELECT data_type FROM device_capabilities
		WHERE device_id = $1 AND name = $2`,
		deviceID, metric,
	).Scan(&dataType)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrUnknownMetric
		}
		return "", fmt.Errorf("lookup metric type: %w", err)
	}
	return dataType, nil
}

func (s *Store) GetHistory(ctx context.Context, deviceID int, metric string, limit int) ([]HistoryPoint, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}

	dataType, err := s.metricDataType(ctx, deviceID, metric)
	if err != nil {
		if errors.Is(err, ErrUnknownMetric) {
			// Fallback: try tables in order when capabilities not announced yet.
			if points, ferr := s.historyFromTable(ctx, deviceID, metric, limit, "number"); ferr == nil && len(points) > 0 {
				return points, nil
			}
			if points, ferr := s.historyFromTable(ctx, deviceID, metric, limit, "boolean"); ferr == nil && len(points) > 0 {
				return points, nil
			}
			if points, ferr := s.historyFromTable(ctx, deviceID, metric, limit, "string"); ferr == nil {
				return points, nil
			}
			return []HistoryPoint{}, nil
		}
		return nil, err
	}

	return s.historyFromTable(ctx, deviceID, metric, limit, dataType)
}

func (s *Store) historyFromTable(ctx context.Context, deviceID int, metric string, limit int, dataType string) ([]HistoryPoint, error) {
	points := make([]HistoryPoint, 0, limit)

	switch dataType {
	case "number":
		rows, err := s.pool.Query(ctx, `
			SELECT metric_name, value, received_at
			FROM sensor_metrics_numeric
			WHERE device_id = $1 AND metric_name = $2
			ORDER BY received_at DESC
			LIMIT $3`,
			deviceID, metric, limit,
		)
		if err != nil {
			return nil, fmt.Errorf("query numeric history: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var p HistoryPoint
			var num float64
			if err := rows.Scan(&p.Metric, &num, &p.ReceivedAt); err != nil {
				return nil, fmt.Errorf("scan numeric history: %w", err)
			}
			p.Type = "number"
			p.Value = num
			points = append(points, p)
		}
		return points, rows.Err()

	case "boolean":
		rows, err := s.pool.Query(ctx, `
			SELECT metric_name, value, received_at
			FROM sensor_metrics_boolean
			WHERE device_id = $1 AND metric_name = $2
			ORDER BY received_at DESC
			LIMIT $3`,
			deviceID, metric, limit,
		)
		if err != nil {
			return nil, fmt.Errorf("query boolean history: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var p HistoryPoint
			var val bool
			if err := rows.Scan(&p.Metric, &val, &p.ReceivedAt); err != nil {
				return nil, fmt.Errorf("scan boolean history: %w", err)
			}
			p.Type = "boolean"
			p.Value = val
			points = append(points, p)
		}
		return points, rows.Err()

	case "string":
		rows, err := s.pool.Query(ctx, `
			SELECT metric_name, value, received_at
			FROM sensor_metrics_text
			WHERE device_id = $1 AND metric_name = $2
			ORDER BY received_at DESC
			LIMIT $3`,
			deviceID, metric, limit,
		)
		if err != nil {
			return nil, fmt.Errorf("query text history: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var p HistoryPoint
			var val string
			if err := rows.Scan(&p.Metric, &val, &p.ReceivedAt); err != nil {
				return nil, fmt.Errorf("scan text history: %w", err)
			}
			p.Type = "string"
			p.Value = val
			points = append(points, p)
		}
		return points, rows.Err()

	default:
		return nil, fmt.Errorf("unsupported data type %q", dataType)
	}
}

func (s *Store) GetLatest(ctx context.Context, deviceID int) ([]LatestReading, error) {
	readings := make([]LatestReading, 0)

	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT ON (metric_name) metric_name, value, received_at
		FROM sensor_metrics_numeric
		WHERE device_id = $1
		ORDER BY metric_name, received_at DESC`,
		deviceID,
	)
	if err != nil {
		return nil, fmt.Errorf("query latest numeric: %w", err)
	}
	for rows.Next() {
		var r LatestReading
		var num float64
		if err := rows.Scan(&r.Metric, &num, &r.ReceivedAt); err != nil {
			rows.Close()
			return nil, err
		}
		r.Type = "number"
		r.Value = num
		readings = append(readings, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.pool.Query(ctx, `
		SELECT DISTINCT ON (metric_name) metric_name, value, received_at
		FROM sensor_metrics_boolean
		WHERE device_id = $1
		ORDER BY metric_name, received_at DESC`,
		deviceID,
	)
	if err != nil {
		return nil, fmt.Errorf("query latest boolean: %w", err)
	}
	for rows.Next() {
		var r LatestReading
		var val bool
		if err := rows.Scan(&r.Metric, &val, &r.ReceivedAt); err != nil {
			rows.Close()
			return nil, err
		}
		r.Type = "boolean"
		r.Value = val
		readings = append(readings, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.pool.Query(ctx, `
		SELECT DISTINCT ON (metric_name) metric_name, value, received_at
		FROM sensor_metrics_text
		WHERE device_id = $1
		ORDER BY metric_name, received_at DESC`,
		deviceID,
	)
	if err != nil {
		return nil, fmt.Errorf("query latest text: %w", err)
	}
	for rows.Next() {
		var r LatestReading
		var val string
		if err := rows.Scan(&r.Metric, &val, &r.ReceivedAt); err != nil {
			rows.Close()
			return nil, err
		}
		r.Type = "string"
		r.Value = val
		readings = append(readings, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return readings, nil
}

func ReadingValue(cr SavedReading) interface{} {
	switch cr.Kind {
	case "number":
		return *cr.num
	case "boolean":
		return *cr.b
	case "string":
		return *cr.text
	default:
		return nil
	}
}

package store

import (
	"context"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"time"
)

var ErrCommandNotFound = errors.New("command not found")
var ErrCommandConflict = errors.New("command is not pending or value does not match")
var ErrAutomaticMode = errors.New("actuator is controlled by automation")

type Command struct {
	ID             int64      `json:"id"`
	DeviceID       int        `json:"device_id"`
	Metric         string     `json:"metric"`
	Value          bool       `json:"value"`
	Status         string     `json:"status"`
	CreatedAt      time.Time  `json:"created_at"`
	ExpiresAt      time.Time  `json:"expires_at"`
	AcknowledgedAt *time.Time `json:"acknowledged_at,omitempty"`
}

const commandFields = `id,device_id,metric,value,CASE WHEN status='pending' AND expires_at <= now() THEN 'expired' ELSE status END,created_at,expires_at,acknowledged_at`

func scanCommand(row pgx.Row) (Command, error) {
	var c Command
	err := row.Scan(&c.ID, &c.DeviceID, &c.Metric, &c.Value, &c.Status, &c.CreatedAt, &c.ExpiresAt, &c.AcknowledgedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return c, ErrCommandNotFound
	}
	return c, err
}

func (s *Store) CreateCommand(ctx context.Context, deviceID int, metric string, value bool) (Command, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Command{}, err
	}
	defer tx.Rollback(ctx)
	var ownerID int64
	if err = tx.QueryRow(ctx, `SELECT user_id FROM devices WHERE id=$1`, deviceID).Scan(&ownerID); err != nil {
		return Command{}, err
	}
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, 800000000000+ownerID); err != nil {
		return Command{}, err
	}
	var automatic bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM automation_rule_targets t JOIN automation_rules r ON r.id=t.rule_id WHERE t.device_id=$1 AND t.metric=$2 AND r.enabled AND r.user_id=$3)
	AND NOT EXISTS(SELECT 1 FROM automation_modes m WHERE m.user_id=$3 AND m.mode='manual' AND (m.scope='account' OR (m.scope='device' AND m.device_id=$1) OR (m.scope='actuator' AND m.device_id=$1 AND m.metric=$2)))`, deviceID, metric, ownerID).Scan(&automatic)
	if err != nil {
		return Command{}, err
	}
	if automatic {
		return Command{}, ErrAutomaticMode
	}
	// Serialize concurrent requests for the same device, including the capability check.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, int64(deviceID)); err != nil {
		return Command{}, err
	}
	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM device_capabilities WHERE device_id=$1 AND name=$2 AND data_type='boolean' AND role='actuator')`, deviceID, metric).Scan(&exists); err != nil {
		return Command{}, err
	}
	if !exists {
		return Command{}, ErrUnknownMetric
	}
	if _, err = tx.Exec(ctx, `UPDATE device_commands SET status='superseded' WHERE device_id=$1 AND metric=$2 AND status='pending'`, deviceID, metric); err != nil {
		return Command{}, err
	}
	c, err := scanCommand(tx.QueryRow(ctx, `INSERT INTO device_commands(device_id,metric,value,expires_at) VALUES($1,$2,$3,now()+interval '30 seconds') RETURNING `+commandFields, deviceID, metric, value))
	if err != nil {
		return Command{}, err
	}
	if _, err = tx.Exec(ctx, `SELECT pg_notify('signaldeck_command_wake', $1)`, fmt.Sprint(deviceID)); err != nil {
		return Command{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Command{}, err
	}
	return c, nil
}

func (s *Store) GetCommand(ctx context.Context, deviceID int, id int64) (Command, error) {
	return scanCommand(s.pool.QueryRow(ctx, `SELECT `+commandFields+` FROM device_commands WHERE device_id=$1 AND id=$2`, deviceID, id))
}

func (s *Store) PendingCommands(ctx context.Context, deviceID int) ([]Command, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var ownerID int64
	if err = tx.QueryRow(ctx, `SELECT user_id FROM devices WHERE id=$1 AND is_active`, deviceID).Scan(&ownerID); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, 800000000000+ownerID); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO automation_device_polls(device_id,last_poll_at) VALUES($1,now()) ON CONFLICT(device_id) DO UPDATE SET last_poll_at=excluded.last_poll_at`, deviceID); err != nil {
		return nil, err
	}
	// Invalidate queued automation commands whenever the mode, rule, desired value,
	// or the observations used to compute it are no longer current.
	if _, err = tx.Exec(ctx, `UPDATE device_commands c SET status='superseded'
		WHERE c.device_id=$1 AND c.status='pending' AND c.automation_rule_id IS NOT NULL
		AND NOT EXISTS (SELECT 1 FROM automation_intents i JOIN automation_rules r ON r.id=i.rule_id
		WHERE i.device_id=c.device_id AND i.metric=c.metric AND i.rule_id=c.automation_rule_id
		AND i.value=c.value AND i.valid_until>now() AND r.enabled
		AND NOT EXISTS (SELECT 1 FROM automation_modes m WHERE m.user_id=i.user_id AND m.mode='manual'
		AND (m.scope='account' OR (m.scope='device' AND m.device_id=i.device_id)
		OR (m.scope='actuator' AND m.device_id=i.device_id AND m.metric=i.metric))))`, deviceID); err != nil {
		return nil, err
	}
	// Only materialize an automatic command during an authenticated device poll.
	// This avoids leaving commands for disconnected devices.
	if _, err = tx.Exec(ctx, `INSERT INTO device_commands(device_id,metric,value,expires_at,automation_rule_id)
		SELECT i.device_id,i.metric,i.value,LEAST(i.valid_until,now()+interval '30 seconds'),i.rule_id
		FROM automation_intents i JOIN automation_rules r ON r.id=i.rule_id AND r.enabled
		JOIN device_capabilities cap ON cap.device_id=i.device_id AND cap.name=i.metric AND cap.role='actuator' AND cap.data_type='boolean'
		LEFT JOIN LATERAL (SELECT value,received_at FROM sensor_metrics_boolean b WHERE b.device_id=i.device_id AND b.metric_name=i.metric ORDER BY received_at DESC LIMIT 1) latest ON true
		WHERE i.device_id=$1 AND i.valid_until>now()
		AND (latest.received_at IS NULL OR latest.received_at < now()-interval '30 seconds' OR latest.value<>i.value)
		AND NOT EXISTS (SELECT 1 FROM automation_modes m WHERE m.user_id=i.user_id AND m.mode='manual'
		AND (m.scope='account' OR (m.scope='device' AND m.device_id=i.device_id) OR (m.scope='actuator' AND m.device_id=i.device_id AND m.metric=i.metric)))
		AND NOT EXISTS (SELECT 1 FROM device_commands c WHERE c.device_id=i.device_id AND c.metric=i.metric AND c.status='pending' AND c.expires_at>now())
		AND NOT EXISTS (SELECT 1 FROM device_commands c WHERE c.device_id=i.device_id AND c.metric=i.metric AND c.automation_rule_id IS NOT NULL AND c.created_at>now()-interval '5 seconds')`, deviceID); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `SELECT `+commandFields+` FROM device_commands c WHERE device_id=$1 AND status='pending' AND expires_at>now() AND EXISTS (SELECT 1 FROM device_capabilities cap WHERE cap.device_id=c.device_id AND cap.name=c.metric AND cap.data_type='boolean' AND cap.role='actuator') ORDER BY id LIMIT 32`, deviceID)
	if err != nil {
		return nil, err
	}
	result := make([]Command, 0)
	for rows.Next() {
		c, e := scanCommand(rows)
		if e != nil {
			rows.Close()
			return nil, e
		}
		result = append(result, c)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return result, nil
}

func (s *Store) AcknowledgeCommand(ctx context.Context, deviceID int, id int64, value bool) (Command, error) {
	c, err := scanCommand(s.pool.QueryRow(ctx, `UPDATE device_commands SET status='acknowledged',acknowledged_at=COALESCE(acknowledged_at,now()) WHERE id=$1 AND device_id=$2 AND value=$3 AND (status='pending' AND expires_at>now() OR status='acknowledged') RETURNING `+commandFields, id, deviceID, value))
	if errors.Is(err, ErrCommandNotFound) {
		return Command{}, ErrCommandConflict
	}
	return c, err
}

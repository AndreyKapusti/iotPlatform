package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	if _, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS device_commands (
		id BIGSERIAL PRIMARY KEY, device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
		metric TEXT NOT NULL, value BOOLEAN NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL,
		acknowledged_at TIMESTAMPTZ
	); CREATE INDEX IF NOT EXISTS device_commands_pending_idx ON device_commands(device_id, status, id);
	ALTER TABLE device_commands ADD COLUMN IF NOT EXISTS automation_rule_id BIGINT`); err != nil {
		pool.Close()
		return nil, fmt.Errorf("initialize device commands: %w", err)
	}
	if _, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS device_monitor_samples (
		id BIGSERIAL PRIMARY KEY, device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
		received_at TIMESTAMPTZ NOT NULL, transport TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb
	); CREATE INDEX IF NOT EXISTS device_monitor_samples_device_time_idx ON device_monitor_samples(device_id, received_at DESC);
	CREATE INDEX IF NOT EXISTS device_monitor_samples_time_idx ON device_monitor_samples(received_at)`); err != nil {
		pool.Close()
		return nil, fmt.Errorf("initialize monitoring: %w", err)
	}

	return pool, nil
}

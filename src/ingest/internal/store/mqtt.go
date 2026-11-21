package store

import (
	"context"
	"strconv"
)

// MQTTDevices is used only by the broker credential reconciler. Keys must never
// be logged or returned from an unauthenticated API.
func (s *Store) MQTTDevices(ctx context.Context) (map[string]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text, api_key FROM devices WHERE is_active`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]string)
	for rows.Next() {
		var id, key string
		if err := rows.Scan(&id, &key); err != nil {
			return nil, err
		}
		result[id] = key
	}
	return result, rows.Err()
}

// Notifications are only hints; the device's periodic poll is the fallback.
func (s *Store) ListenCommandWake(ctx context.Context, wake func(int)) error {
	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	if _, err = conn.Exec(ctx, `LISTEN signaldeck_command_wake`); err != nil {
		return err
	}
	for {
		n, err := conn.Conn().WaitForNotification(ctx)
		if err != nil {
			return err
		}
		if id, err := strconv.Atoi(n.Payload); err == nil && id > 0 {
			wake(id)
		}
	}
}

-- Allow multiple dashboards per device
ALTER TABLE dashboards DROP CONSTRAINT IF EXISTS dashboards_user_id_device_id_key;
ALTER TABLE dashboards DROP CONSTRAINT IF EXISTS dashboards_user_id_device_id_name_key;
ALTER TABLE dashboards ADD CONSTRAINT dashboards_user_id_device_id_name_key UNIQUE (user_id, device_id, name);
CREATE INDEX IF NOT EXISTS idx_dashboards_device ON dashboards(user_id, device_id);

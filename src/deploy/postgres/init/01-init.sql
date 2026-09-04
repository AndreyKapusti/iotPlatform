-- SignalDeck MVP schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_name VARCHAR(100),
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    birth_date DATE,
    phone VARCHAR(32),
    organization VARCHAR(200),
    job_title VARCHAR(120),
    timezone VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    api_key VARCHAR(100) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_devices_api_key ON devices(api_key);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

CREATE TABLE IF NOT EXISTS device_capabilities (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('number', 'boolean', 'string')),
    role VARCHAR(20) NOT NULL CHECK (role IN ('sensor', 'actuator')),
    unit VARCHAR(50),
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    schema_version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(device_id, name)
);
CREATE INDEX IF NOT EXISTS idx_capabilities_device ON device_capabilities(device_id);

CREATE TABLE IF NOT EXISTS dashboards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'Dashboard',
    layout_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_id, name)
);
CREATE INDEX IF NOT EXISTS idx_dashboards_device ON dashboards(user_id, device_id);

CREATE TABLE IF NOT EXISTS sensor_metrics_numeric (
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SELECT create_hypertable('sensor_metrics_numeric', 'received_at', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_numeric_device_time ON sensor_metrics_numeric(device_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_numeric_device_metric ON sensor_metrics_numeric(device_id, metric_name, received_at DESC);

CREATE TABLE IF NOT EXISTS sensor_metrics_boolean (
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    value BOOLEAN NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SELECT create_hypertable('sensor_metrics_boolean', 'received_at', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_boolean_device_time ON sensor_metrics_boolean(device_id, received_at DESC);

CREATE TABLE IF NOT EXISTS sensor_metrics_text (
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SELECT create_hypertable('sensor_metrics_text', 'received_at', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_text_device_time ON sensor_metrics_text(device_id, received_at DESC);

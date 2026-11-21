#!/bin/sh
set -eu
if [ -z "${MQTT_ADMIN_PASSWORD:-}" ]; then
  echo "MQTT_ADMIN_PASSWORD is required" >&2
  exit 1
fi
# Broker configuration is rebuilt from the database by ingest after each start.
rm -f /mosquitto/data/dynamic-security.json
mosquitto_ctrl dynsec init /mosquitto/data/dynamic-security.json admin "$MQTT_ADMIN_PASSWORD"
chown mosquitto:mosquitto /mosquitto/data/dynamic-security.json
chmod 600 /mosquitto/data/dynamic-security.json
exec /docker-entrypoint.sh "$@"

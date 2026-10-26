#!/bin/sh
set -eu
ingest_user="${MQTT_INGEST_USER:-ingest}"
device_user="${MQTT_DEVICE_USER:-devices}"
if [ -z "${MQTT_INGEST_PASSWORD:-}" ] || [ -z "${MQTT_DEVICE_PASSWORD:-}" ]; then
  echo "MQTT_INGEST_PASSWORD and MQTT_DEVICE_PASSWORD are required" >&2
  exit 1
fi
rm -f /mosquitto/data/passwd
mosquitto_passwd -b -c /mosquitto/data/passwd "$ingest_user" "$MQTT_INGEST_PASSWORD"
mosquitto_passwd -b /mosquitto/data/passwd "$device_user" "$MQTT_DEVICE_PASSWORD"
chown mosquitto:mosquitto /mosquitto/data/passwd
chmod 640 /mosquitto/data/passwd
exec /docker-entrypoint.sh "$@"

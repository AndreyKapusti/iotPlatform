# MQTT device transport

Devices authenticate with their numeric `device_id` as MQTT username and their device API key as password. The broker's dynamic-security roles allow each device to publish only its own `announce`, `telemetry`, `poll`, and `ack` topics and subscribe only to its own `command` topic. Ingest synchronizes active device credentials with the broker; registration and key rotation can take up to a few seconds to take effect. HTTP remains available for older devices.

MQTT uses port 1883. The ESP32 derives the broker hostname from its stored `SERVER_URL`; its HTTP port is ignored. Telemetry and USB samples are sent every second; DHT22 is read no more often than every two seconds, and its readings are sent only after a new measurement. The existing board configuration remains stored in flash.

Commands are stored in PostgreSQL. A manual command or an automation decision sends a non-retained wake notification; the device immediately requests the current commands using a random session nonce. The server checks the API key, current automation mode, rule, target state and expiry at the time of that request. A one-second periodic MQTT poll provides recovery from missed notifications. The non-retained QoS 0 response includes the nonce and remaining lifetime; the firmware discards retained, unsolicited, obsolete or expired responses. The device publishes a QoS 1 acknowledgement with the command ID and actual output value. Repeated acknowledgements are idempotent. Relay telemetry remains the reported device state, not proof that a physical load switched.

Broker sessions are clean and command messages are not retained. MQTT traffic in this local setup is **not encrypted**; use a trusted network and configure TLS and suitable broker and database credentials before exposing it to an untrusted network. The demo Compose stack uses locally generated `MQTT_ADMIN_PASSWORD` and `MQTT_INGEST_PASSWORD` in `src/deploy/.env` (never commit that file). To create them, run from the repository root:

```sh
python -c "import secrets,pathlib; pathlib.Path('src/deploy/.env').write_text('MQTT_ADMIN_PASSWORD='+secrets.token_hex(32)+'\nMQTT_INGEST_PASSWORD='+secrets.token_hex(32)+'\n')"
```

Do not regenerate those secrets while the stack is running; restart broker and ingest together after changing them. Broker authorization is rebuilt from the device registry on restart.

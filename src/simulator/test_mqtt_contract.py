"""MQTT auth contract: key in the JSON, shared broker user, ACL hides telemetry."""

from __future__ import annotations

import os
import unittest
from pathlib import Path

import main


ACL_PATH = Path(__file__).resolve().parents[1] / "deploy" / "mosquitto" / "acl"


def acl_rules(text: str) -> list[tuple[str, str, str]]:
    user = ""
    rules: list[tuple[str, str, str]] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("user "):
            user = line.split(None, 1)[1]
            continue
        parts = line.split()
        if parts[0] == "topic" and len(parts) == 3:
            rules.append((user, parts[1], parts[2]))
    return rules


class MqttContractTest(unittest.TestCase):
    def test_publish_body_contains_api_key(self) -> None:
        payload = {"device_id": 7, "readings": {"temperature": 21.5}}
        body = main.attach_api_key(payload, "device-key")
        self.assertEqual(body["api_key"], "device-key")
        self.assertEqual(body["device_id"], 7)
        self.assertNotIn("api_key", payload)

    def test_key_refresh_keeps_broker_username(self) -> None:
        self.assertEqual(main.broker_username_after_refresh("devices", "rotated-key"), "devices")

    def test_config_defaults_to_devices_user(self) -> None:
        previous_user = os.environ.pop("MQTT_USERNAME", None)
        previous_password = os.environ.pop("MQTT_PASSWORD", None)
        try:
            cfg = main.Config()
            self.assertEqual(cfg.mqtt_username, "devices")
            self.assertEqual(cfg.mqtt_password, "signaldeck-devices")
        finally:
            if previous_user is not None:
                os.environ["MQTT_USERNAME"] = previous_user
            if previous_password is not None:
                os.environ["MQTT_PASSWORD"] = previous_password

    def test_devices_user_cannot_read_telemetry(self) -> None:
        rules = acl_rules(ACL_PATH.read_text(encoding="utf-8"))
        device_reads = [topic for user, access, topic in rules if user == "devices" and access == "read"]
        self.assertFalse(any("telemetry" in topic for topic in device_reads))
        ingest_reads = [topic for user, access, topic in rules if user == "ingest" and access == "read"]
        self.assertTrue(any(topic.endswith("/telemetry") for topic in ingest_reads))


if __name__ == "__main__":
    unittest.main()

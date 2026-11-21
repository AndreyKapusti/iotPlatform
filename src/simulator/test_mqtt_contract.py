"""The simulator must not execute stale, retained or unsolicited commands."""
import json
import time
import unittest
from types import SimpleNamespace
from unittest.mock import Mock

import main


class MqttContractTest(unittest.TestCase):
    def setUp(self):
        self.sim = main.IngestMqttClient.__new__(main.IngestMqttClient)
        self.sim.device_id = 7
        self.sim.api_key = "test-key"
        self.sim.relay_state = False
        self.sim.nonce = "current"
        self.sim.poll_started = time.monotonic()
        self.sim.client = Mock()

    def deliver(self, nonce="current", remaining_ms=1000, retain=False):
        payload = {"nonce": nonce, "commands": [{"id": 42, "metric": "relay_1", "value": True, "remaining_ms": remaining_ms}]}
        self.sim._on_message(None, None, SimpleNamespace(payload=json.dumps(payload).encode(), retain=retain))

    def test_current_command_applied_and_acknowledged(self):
        self.deliver()
        self.assertTrue(self.sim.relay_state)
        self.sim.client.publish.assert_called_once()

    def test_stale_and_retained_responses_are_ignored(self):
        self.deliver(nonce="old")
        self.deliver(remaining_ms=0)
        self.deliver(retain=True)
        self.assertFalse(self.sim.relay_state)
        self.sim.client.publish.assert_not_called()

    def test_key_is_attached_without_mutating_payload(self):
        payload = {"device_id": 7}
        self.assertEqual(main.attach_api_key(payload, "key"), {"device_id": 7, "api_key": "key"})
        self.assertNotIn("api_key", payload)


if __name__ == "__main__":
    unittest.main()

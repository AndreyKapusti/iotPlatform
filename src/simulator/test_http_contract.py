"""Current HTTP demo contract. No network."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

import main


class HttpContractTest(unittest.TestCase):
    def test_api_key_is_header_not_json(self) -> None:
        client = main.IngestHttpClient("http://ingest:8001", "device-key")
        payload = {
            "device_id": 7,
            "readings": {
                "temperature": 21.5,
                "humidity": 40.0,
                "motion": False,
                "relay_1": False,
            },
        }
        response = MagicMock()
        response.raise_for_status.return_value = None
        with patch("main.requests.post", return_value=response) as post:
            client.telemetry(payload)
        kwargs = post.call_args.kwargs
        self.assertEqual(kwargs["headers"]["X-API-Key"], "device-key")
        self.assertNotIn("api_key", kwargs["json"])
        self.assertEqual(kwargs["json"]["device_id"], 7)

    def test_announce_keeps_key_out_of_body(self) -> None:
        client = main.IngestHttpClient("http://ingest:8001", "device-key")
        payload = {
            "device_id": 7,
            "schema_version": 1,
            "capabilities": main.CAPABILITIES,
        }
        response = MagicMock()
        response.raise_for_status.return_value = None
        with patch("main.requests.post", return_value=response) as post:
            client.announce(payload)
        body = post.call_args.kwargs["json"]
        self.assertNotIn("api_key", body)
        self.assertEqual(post.call_args.kwargs["headers"]["X-API-Key"], "device-key")

    def test_telemetry_build_keeps_simulator_metrics(self) -> None:
        sim = main.DeviceSimulator(main.Config())
        payload = sim.build_telemetry(7)
        self.assertEqual(payload["device_id"], 7)
        self.assertNotIn("api_key", payload)
        self.assertEqual(
            set(payload["readings"]),
            {"temperature", "humidity", "motion", "relay_1"},
        )


if __name__ == "__main__":
    unittest.main()

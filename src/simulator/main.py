#!/usr/bin/env python3
"""SignalDeck device simulator — announce + telemetry loop (HTTP or MQTT)."""

from __future__ import annotations

import json
import os
import random
import signal
import sys
import time
from datetime import datetime, timezone
from typing import Any

import requests

FIRMWARE = "simulator-0.1.0"
SCHEMA_VERSION = 1

CAPABILITIES: list[dict[str, Any]] = [
    {
        "name": "temperature",
        "type": "number",
        "unit": "°C",
        "role": "sensor",
        "min": -40,
        "max": 85,
    },
    {
        "name": "humidity",
        "type": "number",
        "unit": "%",
        "role": "sensor",
        "min": 0,
        "max": 100,
    },
    {
        "name": "motion",
        "type": "boolean",
        "role": "sensor",
    },
    {
        "name": "relay_1",
        "type": "boolean",
        "role": "actuator",
    },
]


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    return float(raw)


class Config:
    control_url: str
    ingest_url: str
    mqtt_broker: str
    device_name: str
    email: str
    username: str
    password: str
    interval_sec: float
    use_mqtt: bool

    def __init__(self) -> None:
        self.control_url = os.getenv("CONTROL_URL", "http://localhost:8000").rstrip("/")
        self.ingest_url = os.getenv("INGEST_HTTP_URL", "http://localhost:8001").rstrip("/")
        self.mqtt_broker = os.getenv("MQTT_BROKER", "localhost:1883")
        self.device_name = os.getenv("DEVICE_NAME", "demo-sensor")
        # Avoid OS USERNAME collision (Windows sets USERNAME to the local account).
        self.email = os.getenv("SIGNALDECK_EMAIL", os.getenv("EMAIL", "admin@example.com"))
        self.username = os.getenv(
            "SIGNALDECK_USERNAME",
            os.getenv("SIGNALDECK_USER", "admin"),
        )
        self.password = os.getenv("SIGNALDECK_PASSWORD", os.getenv("PASSWORD", "admin123"))
        self.interval_sec = env_float("INTERVAL_SEC", 2.0)
        self.use_mqtt = env_bool("USE_MQTT", False)


class ControlClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url
        self.token: str | None = None

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def register(self, email: str, username: str, password: str) -> None:
        url = f"{self.base_url}/api/v1/auth/register"
        payload = {"email": email, "username": username, "password": password}
        response = requests.post(url, json=payload, timeout=15)
        if response.status_code == 201:
            print(f"[control] Registered user {username}")
            return
        if response.status_code in (400, 409, 422):
            detail = _response_detail(response)
            if _looks_like_exists(detail) or response.status_code == 400:
                # 400 = business "already exists"; 422 printed for debug then try login
                if _looks_like_exists(detail) or "уже существует" in detail.lower() or "already" in detail.lower():
                    print(f"[control] User already exists, will login ({detail})")
                    return
                print(f"[control] Register rejected ({response.status_code}): {detail}", file=sys.stderr)
        response.raise_for_status()

    def login(self, username: str, password: str) -> None:
        url = f"{self.base_url}/api/v1/auth/login"
        response = requests.post(
            url,
            data={"username": username, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
        self.token = data["access_token"]
        print(f"[control] Logged in as {username}")

    def list_devices(self) -> list[dict[str, Any]]:
        url = f"{self.base_url}/api/v1/devices/"
        response = requests.get(url, headers=self._headers(), timeout=15)
        response.raise_for_status()
        devices = response.json()
        if isinstance(devices, dict) and "items" in devices:
            return list(devices["items"])
        return list(devices)

    def create_device(self, name: str) -> dict[str, Any]:
        url = f"{self.base_url}/api/v1/devices/"
        response = requests.post(
            url,
            json={"name": name},
            headers=self._headers(),
            timeout=15,
        )
        if response.status_code == 400:
            detail = _response_detail(response)
            if _looks_like_exists(detail):
                print(f"[control] Device '{name}' already exists, reusing")
                return self._find_device_by_name(name)
        response.raise_for_status()
        return response.json()

    def _find_device_by_name(self, name: str) -> dict[str, Any]:
        for device in self.list_devices():
            if device.get("name") == name:
                return device
        raise RuntimeError(f"Device '{name}' reported as existing but not found in list")

    def ensure_device(self, name: str) -> dict[str, Any]:
        for device in self.list_devices():
            if device.get("name") == name:
                print(f"[control] Reusing device '{name}' (id={device.get('id')})")
                return device
        print(f"[control] Creating device '{name}'")
        return self.create_device(name)


class IngestHttpClient:
    def __init__(self, base_url: str, api_key: str) -> None:
        self.base_url = base_url
        self.api_key = api_key

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
        }

    def announce(self, payload: dict[str, Any]) -> None:
        url = f"{self.base_url}/api/v1/ingest/announce"
        response = requests.post(url, json=payload, headers=self._headers(), timeout=15)
        response.raise_for_status()
        print("[ingest] Announce OK (HTTP)")

    def telemetry(self, payload: dict[str, Any]) -> None:
        url = f"{self.base_url}/api/v1/ingest/telemetry"
        response = requests.post(url, json=payload, headers=self._headers(), timeout=15)
        response.raise_for_status()


class IngestMqttClient:
    def __init__(self, broker: str, device_id: int, api_key: str) -> None:
        try:
            import paho.mqtt.client as mqtt
        except ImportError as exc:
            raise RuntimeError(
                "USE_MQTT=true requires paho-mqtt (pip install paho-mqtt)"
            ) from exc

        self._mqtt = mqtt
        host, _, port_str = broker.partition(":")
        port = int(port_str or "1883")
        self.device_id = device_id
        self.relay_state = False

        self.client = mqtt.Client(
            client_id=f"simulator-{device_id}",
            protocol=mqtt.MQTTv311,
        )
        self.client.username_pw_set(username=str(device_id), password=api_key)
        self.client.on_message = self._on_message
        self.client.connect(host, port, keepalive=60)
        self.client.subscribe(f"devices/{device_id}/command")
        self.client.loop_start()
        print(f"[ingest] MQTT connected to {host}:{port}")

    def _on_message(self, _client: Any, _userdata: Any, msg: Any) -> None:
        try:
            data = json.loads(msg.payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            print(f"[ingest] Invalid command payload on {msg.topic}")
            return

        if "relay_1" in data:
            self.relay_state = bool(data["relay_1"])
            print(f"[ingest] Command relay_1 -> {self.relay_state}")

    def announce(self, payload: dict[str, Any]) -> None:
        topic = f"devices/{self.device_id}/announce"
        self.client.publish(topic, json.dumps(payload), qos=1)
        print(f"[ingest] Announce OK (MQTT {topic})")

    def telemetry(self, payload: dict[str, Any]) -> None:
        topic = f"devices/{self.device_id}/telemetry"
        self.client.publish(topic, json.dumps(payload), qos=0)

    def stop(self) -> None:
        self.client.loop_stop()
        self.client.disconnect()


class DeviceSimulator:
    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.relay_state = False
        self.mqtt: IngestMqttClient | None = None
        self._running = True

    def setup(self) -> tuple[int, str]:
        control = ControlClient(self.cfg.control_url)
        control.register(self.cfg.email, self.cfg.username, self.cfg.password)
        control.login(self.cfg.username, self.cfg.password)
        device = control.ensure_device(self.cfg.device_name)

        device_id = int(device["id"])
        api_key = str(device["api_key"])
        print(f"[simulator] device_id={device_id}")
        print(f"[simulator] api_key={api_key}")

        announce_payload = {
            "device_id": device_id,
            "schema_version": SCHEMA_VERSION,
            "firmware": FIRMWARE,
            "capabilities": CAPABILITIES,
        }

        if self.cfg.use_mqtt:
            self.mqtt = IngestMqttClient(self.cfg.mqtt_broker, device_id, api_key)
            self.mqtt.announce(announce_payload)
            return device_id, api_key

        http = IngestHttpClient(self.cfg.ingest_url, api_key)
        http.announce(announce_payload)
        self._http = http
        return device_id, api_key

    def generate_readings(self) -> dict[str, Any]:
        relay = self.mqtt.relay_state if self.mqtt else self.relay_state
        return {
            "temperature": round(random.uniform(18.0, 28.0), 1),
            "humidity": round(random.uniform(40.0, 80.0), 1),
            "motion": random.choice([True, False]),
            "relay_1": relay,
        }

    def build_telemetry(self, device_id: int) -> dict[str, Any]:
        return {
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "readings": self.generate_readings(),
            "metadata": {
                "firmware": FIRMWARE,
                "battery": random.randint(70, 100),
                "rssi": random.randint(-80, -40),
            },
        }

    def run_loop(self, device_id: int) -> None:
        transport = "MQTT" if self.cfg.use_mqtt else "HTTP"
        print(
            f"[simulator] Telemetry loop every {self.cfg.interval_sec}s via {transport}. Ctrl+C to stop."
        )
        tick = 0
        while self._running:
            payload = self.build_telemetry(device_id)
            try:
                if self.mqtt:
                    self.mqtt.telemetry(payload)
                else:
                    self._http.telemetry(payload)
                tick += 1
                readings = payload["readings"]
                print(
                    f"[telemetry #{tick}] "
                    f"T={readings['temperature']}°C "
                    f"H={readings['humidity']}% "
                    f"motion={readings['motion']} "
                    f"relay_1={readings['relay_1']}"
                )
            except requests.RequestException as exc:
                print(f"[simulator] Send failed: {exc}", file=sys.stderr)
            time.sleep(self.cfg.interval_sec)

    def stop(self) -> None:
        self._running = False
        if self.mqtt:
            self.mqtt.stop()


def _response_detail(response: requests.Response) -> str:
    try:
        body = response.json()
        if isinstance(body, dict) and "detail" in body:
            detail = body["detail"]
            if isinstance(detail, list):
                return "; ".join(str(item) for item in detail)
            return str(detail)
        return json.dumps(body)
    except ValueError:
        return response.text


def _looks_like_exists(detail: str) -> bool:
    lowered = detail.lower()
    markers = (
        "already",
        "exist",
        "уже существует",
        "duplicate",
        "unique",
    )
    return any(marker in lowered for marker in markers)


def wait_for_http(url: str, attempts: int = 30, delay_sec: float = 2.0) -> None:
    """Wait until control/ingest accept connections (Compose race)."""
    health = url.rstrip("/") + "/health"
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            response = requests.get(health, timeout=3)
            if response.status_code < 500:
                print(f"[simulator] Ready: {health} (attempt {attempt})")
                return
        except requests.RequestException as exc:
            last_error = exc
        print(f"[simulator] Waiting for {health} ({attempt}/{attempts})...")
        time.sleep(delay_sec)
    raise RuntimeError(f"Service not ready: {health}") from last_error


def main() -> None:
    cfg = Config()
    sim = DeviceSimulator(cfg)

    def handle_signal(_signum: int, _frame: Any) -> None:
        print("\n[simulator] Shutting down...")
        sim.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_signal)

    print("[simulator] SignalDeck device simulator")
    print(f"  CONTROL_URL={cfg.control_url}")
    print(f"  INGEST_HTTP_URL={cfg.ingest_url}")
    print(f"  MQTT_BROKER={cfg.mqtt_broker}")
    print(f"  DEVICE_NAME={cfg.device_name}")
    print(f"  USE_MQTT={cfg.use_mqtt}")

    wait_for_http(cfg.control_url)
    wait_for_http(cfg.ingest_url)

    device_id, _api_key = sim.setup()
    sim.run_loop(device_id)


if __name__ == "__main__":
    main()

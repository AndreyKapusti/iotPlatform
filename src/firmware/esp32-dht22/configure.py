"""Send locally stored settings to the ESP32 over USB."""
import argparse
import json
import time
from pathlib import Path

import serial

parser = argparse.ArgumentParser()
parser.add_argument("--port", default="COM4")
parser.add_argument("--env", type=Path, default=Path(__file__).with_name(".env"))
parser.add_argument("--server", help="Override SERVER_URL for this configuration")
args = parser.parse_args()
config = {}
for line in args.env.read_text(encoding="utf-8-sig").splitlines():
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    key, value = line.split("=", 1)
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    config[key.strip()] = value

for key in ("WIFI_SSID", "SERVER_URL", "DEVICE_ID", "DEVICE_API_KEY"):
    if not config.get(key):
        raise SystemExit(f"Missing {key} in {args.env}")
payload = {
    "ssid": config["WIFI_SSID"],
    "password": config.get("WIFI_PASSWORD", ""),
    "server": args.server or config["SERVER_URL"],
    "device_id": int(config["DEVICE_ID"]),
    "api_key": config["DEVICE_API_KEY"],
}
with serial.Serial(args.port, 115200, timeout=2) as port:
    time.sleep(2)
    port.reset_input_buffer()
    port.write((json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8"))
    reply = port.readline().decode("utf-8", errors="replace").strip()
    if reply != "Configuration saved; restarting":
        raise SystemExit(f"Configuration was not confirmed: {reply or 'no response'}")
    print(reply)

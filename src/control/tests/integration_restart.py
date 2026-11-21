"""Restart test; requires an isolated test database and named test container."""
import os
import subprocess
import time

from integration_automation import CONTROL, INGEST, acknowledge, body, make_device, poll, request, telemetry, user, wait_command

container = os.environ.get("TEST_CONTROL_CONTAINER")
if os.environ.get("SIGNALDECK_TEST_ISOLATED") != "1" or not container:
    raise SystemExit("Set SIGNALDECK_TEST_ISOLATED=1 and TEST_CONTROL_CONTAINER for an isolated test deployment")

token = user()
sensor = make_device(token, "restart sensor", [{"name": "temperature", "type": "number", "role": "sensor"}])
target = make_device(token, "restart actuator", [{"name": "relay", "type": "boolean", "role": "actuator"}])
telemetry(sensor, {"temperature": 70})
telemetry(target, {"relay": False})
rule = body("restart delay", sensor, target, True, delay=4, freshness=120)
request(CONTROL, "POST", "/api/v1/automation/rules", rule, token=token, expected=201)
old = wait_command(target, True, timeout=12)
subprocess.run(["docker", "restart", container], check=True, stdout=subprocess.DEVNULL)
deadline = time.monotonic() + 30
while True:
    try:
        request(CONTROL, "GET", "/health")
        break
    except (OSError, AssertionError):
        if time.monotonic() >= deadline:
            raise
        time.sleep(0.2)
time.sleep(0.4)
assert poll(target) == [], "A pending pre-restart command must not bypass the restarted stability timer"
new = wait_command(target, True, timeout=12)
assert new["id"] != old["id"], "Old pending command should be superseded"
acknowledge(target, new)
print("Restart test passed: stability timer is reset and stale pending command is not replayed")

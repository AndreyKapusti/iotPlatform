"""Integration test for an isolated test deployment; never target live devices."""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

if os.environ.get("SIGNALDECK_TEST_ISOLATED") != "1":
    raise SystemExit("Set SIGNALDECK_TEST_ISOLATED=1 only for an isolated test database")
CONTROL = os.environ.get("TEST_CONTROL_URL", "http://localhost:18000")
INGEST = os.environ.get("TEST_INGEST_URL", "http://localhost:18001")


def request(base, method, path, data=None, token=None, key=None, expected=200):
    headers = {}
    if token:
        headers["Authorization"] = "Bearer " + token
    if key:
        headers["X-API-Key"] = key
    raw = None if data is None else json.dumps(data).encode()
    if raw is not None:
        headers["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(urllib.request.Request(base + path, data=raw, headers=headers, method=method), timeout=10) as response:
            status, body = response.status, json.load(response)
    except urllib.error.HTTPError as exc:
        status, body = exc.code, json.load(exc)
    if status != expected:
        raise AssertionError((method, path, status, body))
    return body


def user():
    name = f"prioritytest{time.time_ns()}"
    request(CONTROL, "POST", "/api/v1/auth/register", {"username": name, "email": name + "@example.com", "password": "testpass123"}, expected=201)
    login = urllib.request.Request(CONTROL + "/api/v1/auth/login", data=urllib.parse.urlencode({"username": name, "password": "testpass123"}).encode())
    with urllib.request.urlopen(login, timeout=10) as response:
        return json.load(response)["access_token"]


def make_device(token, name, caps):
    result = request(CONTROL, "POST", "/api/v1/devices/", {"name": name}, token=token, expected=201)
    request(INGEST, "POST", "/api/v1/ingest/announce", {"device_id": result["id"], "capabilities": caps}, key=result["api_key"])
    return result


def telemetry(device, readings):
    request(INGEST, "POST", "/api/v1/ingest/telemetry", {"device_id": device["id"], "readings": readings}, key=device["api_key"])


def poll(device):
    return request(INGEST, "GET", f"/api/v1/ingest/commands?device_id={device['id']}", key=device["api_key"])["commands"]


def wait_command(device, value, timeout=8):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        commands = poll(device)
        if commands:
            assert commands[0]["value"] == value, commands
            return commands[0]
        time.sleep(0.2)
    raise AssertionError(f"No command {value}")


def acknowledge(device, command):
    request(INGEST, "POST", f"/api/v1/ingest/commands/{command['id']}/ack", {"device_id": device["id"], "value": command["value"]}, key=device["api_key"])
    telemetry(device, {"relay": command["value"]})


def body(name, source, target, value, delay=0, freshness=30):
    return {"name": name, "enabled": True, "freshness_seconds": freshness, "delay_seconds": delay,
            "definition": {"condition": {"op": "all", "children": [{"left": {"device_id": source["id"], "metric": "temperature"},
                "operator": "gt", "right": {"kind": "literal", "value": 50}}]},
                "then": [{"device_id": target["id"], "metric": "relay", "value": value}], "otherwise": []}}


def run():
    token, foreign_token = user(), user()
    sensor = [{"name": "temperature", "type": "number", "role": "sensor"}]
    high = make_device(token, "High source", sensor)
    low = make_device(token, "Low source", sensor)
    target = make_device(token, "Target", [{"name": "relay", "type": "boolean", "role": "actuator"}])
    foreign = make_device(foreign_token, "Foreign", sensor)
    telemetry(low, {"temperature": 70})
    telemetry(target, {"relay": False})
    high_rule = body("high priority", high, target, False)
    low_rule = body("low priority", low, target, True)
    a = request(CONTROL, "POST", "/api/v1/automation/rules", high_rule, token=token, expected=201)
    b = request(CONTROL, "POST", "/api/v1/automation/rules", low_rule, token=token, expected=201)
    time.sleep(1.5)
    assert poll(target) == [], "Unknown high-priority input must block lower priority"
    telemetry(high, {"temperature": 20})
    acknowledge(target, wait_command(target, True))
    telemetry(high, {"temperature": 80})
    acknowledge(target, wait_command(target, False))
    request(CONTROL, "PUT", "/api/v1/automation/rules/order", {"ids": [b["id"], a["id"]]}, token=token)
    acknowledge(target, wait_command(target, True))
    request(CONTROL, "PUT", "/api/v1/automation/rules/order", {"ids": [a["id"], b["id"]]}, token=token)
    high_rule["freshness_seconds"] = 2
    request(CONTROL, "PUT", f"/api/v1/automation/rules/{a['id']}", high_rule, token=token)
    telemetry(high, {"temperature": 80})
    time.sleep(3)
    assert poll(target) == [], "Stale input must not cause an action or allow lower priority"
    share = {"name": "shared test", "layout": [
        {"id": "a", "device_id": high["id"], "metric": "temperature", "type": "line", "title": "High"},
        {"id": "b", "device_id": target["id"], "metric": "relay", "type": "toggle", "title": "Relay"}]}
    dashboard = request(CONTROL, "POST", "/api/v1/shared-dashboards", share, token=token, expected=201)
    assert len(request(CONTROL, "GET", f"/api/v1/shared-dashboards/{dashboard['id']}", token=token)["layout"]) == 2
    request(CONTROL, "GET", f"/api/v1/shared-dashboards/{dashboard['id']}", token=foreign_token, expected=404)
    share["layout"][0]["device_id"] = foreign["id"]
    request(CONTROL, "PUT", f"/api/v1/shared-dashboards/{dashboard['id']}", share, token=token, expected=400)
    delayed = make_device(token, "Delayed target", [{"name": "relay", "type": "boolean", "role": "actuator"}])
    telemetry(delayed, {"relay": False})
    telemetry(low, {"temperature": 70})
    delayed_rule = body("delayed", low, delayed, True, delay=2)
    created = request(CONTROL, "POST", "/api/v1/automation/rules", delayed_rule, token=token, expected=201)
    time.sleep(0.5)
    assert poll(delayed) == [], "Condition delay must prevent immediate actuation"
    acknowledge(delayed, wait_command(delayed, True))
    modes = "/api/v1/automation/modes"
    command_path = f"/api/v1/commands/{delayed['id']}"
    request(INGEST, "POST", command_path, {"metric": "relay", "value": False}, token=token, expected=409)
    request(CONTROL, "PUT", modes, {"scope": "account", "mode": "manual"}, token=token)
    request(INGEST, "POST", command_path, {"metric": "relay", "value": False}, token=token, expected=201)
    request(CONTROL, "PUT", modes, {"scope": "device", "device_id": delayed["id"], "mode": "manual"}, token=token)
    request(CONTROL, "PUT", modes, {"scope": "account", "mode": "auto"}, token=token)
    request(INGEST, "POST", command_path, {"metric": "relay", "value": False}, token=token, expected=201)
    request(CONTROL, "PUT", modes, {"scope": "actuator", "device_id": delayed["id"], "metric": "relay", "mode": "manual"}, token=token)
    request(CONTROL, "PUT", modes, {"scope": "device", "device_id": delayed["id"], "mode": "auto"}, token=token)
    request(INGEST, "POST", command_path, {"metric": "relay", "value": False}, token=token, expected=201)
    request(CONTROL, "PUT", modes, {"scope": "actuator", "device_id": delayed["id"], "metric": "relay", "mode": "auto"}, token=token)
    request(INGEST, "POST", command_path, {"metric": "relay", "value": False}, token=token, expected=409)
    delayed_rule["enabled"] = False
    request(CONTROL, "PUT", f"/api/v1/automation/rules/{created['id']}", delayed_rule, token=token)
    request(INGEST, "POST", command_path, {"metric": "relay", "value": False}, token=token, expected=201)
    else_target = make_device(token, "Else target", [{"name": "relay", "type": "boolean", "role": "actuator"}])
    telemetry(else_target, {"relay": False})
    telemetry(low, {"temperature": 70})
    else_rule = body("then and else", low, else_target, True)
    else_rule["definition"]["otherwise"] = [{"device_id": else_target["id"], "metric": "relay", "value": False}]
    request(CONTROL, "POST", "/api/v1/automation/rules", else_rule, token=token, expected=201)
    acknowledge(else_target, wait_command(else_target, True))
    telemetry(low, {"temperature": 10})
    acknowledge(else_target, wait_command(else_target, False))
    print("Integration passed: priorities, stale inputs, delay, hierarchy, both branches, shared dashboards and isolation")


if __name__ == "__main__":
    run()

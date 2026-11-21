"""Run only against disposable SignalDeck services and an empty test database."""
import json
import queue
import time
import uuid

import paho.mqtt.client as mqtt
import requests

CONTROL = "http://signaldeck_control_mqtt_test:8000"
INGEST = "http://signaldeck_ingest_mqtt_test:8001"
BROKER = "signaldeck_mqtt_test"

def request(method, url, **kwargs):
    response = requests.request(method, url, timeout=5, **kwargs)
    response.raise_for_status()
    return response.json()

name = "mqtt" + uuid.uuid4().hex[:12]
request("POST", CONTROL + "/api/v1/auth/register", json={"email": name + "@example.com", "username": name, "password": "test-password"})
token = request("POST", CONTROL + "/api/v1/auth/login", data={"username": name, "password": "test-password"})["access_token"]
headers = {"Authorization": "Bearer " + token}
devices = [request("POST", CONTROL + "/api/v1/devices/", json={"name": "test-" + str(i)}, headers=headers) for i in range(2)]
device, other = devices
device_id, key = device["id"], device["api_key"]
time.sleep(5)  # device credentials are reconciled asynchronously

events = queue.Queue()
client = mqtt.Client(client_id="mqtt-e2e-" + name, protocol=mqtt.MQTTv311)
client.username_pw_set(str(device_id), key)
client.on_connect = lambda c, _u, _f, rc: events.put(("connect", rc))
client.on_subscribe = lambda c, _u, mid, qos: events.put(("subscribe", mid, qos))
client.on_message = lambda c, _u, msg: events.put(("message", msg.topic, json.loads(msg.payload)))
client.connect(BROKER, 1883, keepalive=20)
client.loop_start()
assert events.get(timeout=5) == ("connect", 0)

def subscribe(topic):
    result, mid = client.subscribe(topic, qos=1)
    assert result == mqtt.MQTT_ERR_SUCCESS
    event = events.get(timeout=5)
    assert event[0] == "subscribe" and event[1] == mid, event
    return event[2][0]

assert subscribe(f"devices/{device_id}/command") != 128
assert subscribe(f"devices/{other['id']}/command") == 128, "device could subscribe to another device"
assert subscribe("devices/+/command") == 128, "wildcard command subscription allowed"

def publish(suffix, body):
    body.update(device_id=device_id, api_key=key)
    result = client.publish(f"devices/{device_id}/{suffix}", json.dumps(body), qos=1)
    result.wait_for_publish(timeout=5)
    assert result.is_published()

publish("announce", {"schema_version": 1, "firmware": "mqtt-e2e", "capabilities": [
    {"name": "motion", "type": "boolean", "role": "sensor"},
    {"name": "relay_1", "type": "boolean", "role": "actuator"},
]})
time.sleep(1)
publish("telemetry", {"readings": {"motion": True, "relay_1": False}})
time.sleep(1)
latest = request("GET", f"{INGEST}/api/v1/telemetry/{device_id}/latest", headers=headers)
assert any(row["metric"] == "motion" and row["value"] is True for row in latest["readings"]), latest

command = request("POST", f"{INGEST}/api/v1/commands/{device_id}", headers=headers, json={"metric": "relay_1", "value": True})
event = events.get(timeout=3)
assert event[0] == "message" and event[2] == {"wake": True}, event
publish("poll", {"nonce": "test-nonce"})
event = events.get(timeout=5)
assert event[0] == "message" and event[2]["nonce"] == "test-nonce", event
item = event[2]["commands"][0]
assert item["id"] == command["id"] and item["value"] is True and item["remaining_ms"] > 0, item
publish("ack", {"id": command["id"], "value": True})
time.sleep(0.5)
status = request("GET", f"{INGEST}/api/v1/commands/{device_id}/{command['id']}", headers=headers)
assert status["status"] == "acknowledged", status
publish("ack", {"id": command["id"], "value": True})
publish("poll", {"nonce": "after-ack"})
try:
    event = events.get(timeout=1)
    raise AssertionError(f"Acknowledged command delivered again: {event}")
except queue.Empty:
    pass

# Rule evaluation, freshness and command generation use the same authoritative
# database paths as HTTP devices. A stale input must not cause another action.
publish("telemetry", {"readings": {"motion": True, "relay_1": True}})
request("POST", CONTROL + "/api/v1/automation/rules", headers=headers, json={
    "name": "test rule", "freshness_seconds": 6,
    "definition": {
        "condition": {"left": {"device_id": device_id, "metric": "motion"}, "operator": "eq", "right": {"kind": "literal", "value": True}},
        "then": [{"device_id": device_id, "metric": "relay_1", "value": False}],
        "otherwise": [],
    },
})
event = events.get(timeout=5)
assert event[0] == "message" and event[2] == {"wake": True}, event
publish("poll", {"nonce": "automatic"})
event = events.get(timeout=5)
assert event[2]["nonce"] == "automatic", event
automatic = event[2]["commands"][0]
assert automatic["metric"] == "relay_1" and automatic["value"] is False, automatic
publish("ack", {"id": automatic["id"], "value": False})
time.sleep(7)
while not events.empty():
    events.get_nowait()  # wake notifications after the rule becomes stale
publish("poll", {"nonce": "stale"})
try:
    event = events.get(timeout=1)
    assert event[2].get("wake") is True, f"stale rule sent a command: {event}"
except queue.Empty:
    pass
client.disconnect()
client.loop_stop()
print("MQTT isolation, telemetry, wake, command, acknowledgement, automation and stale inputs: OK")

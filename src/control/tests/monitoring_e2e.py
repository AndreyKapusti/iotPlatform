"""Exercise the monitoring API against disposable control/ingest/database containers."""
import time
import uuid

import requests

control = 'http://signaldeck_monitor_control_test:8000'
ingest = 'http://signaldeck_monitor_ingest_test:8001'

def req(method, url, **kwargs):
    r = requests.request(method, url, timeout=8, **kwargs)
    r.raise_for_status()
    return r.json()

def user():
    name = 'monitor' + uuid.uuid4().hex[:10]
    req('POST', control + '/api/v1/auth/register', json={'email': name+'@example.com', 'username': name, 'password': 'test-password'})
    token = req('POST', control + '/api/v1/auth/login', data={'username': name, 'password': 'test-password'})['access_token']
    return {'Authorization': 'Bearer ' + token}

owner, other = user(), user()
device = req('POST', control + '/api/v1/devices/', headers=owner, json={'name': 'test sensor'})
device_id, key = device['id'], device['api_key']
assert requests.get(f'{control}/api/v1/devices/{device_id}/monitoring', headers=other, timeout=8).status_code == 404
auth = {'X-API-Key': key}
req('POST', ingest + '/api/v1/ingest/announce', headers=auth, json={'device_id': device_id, 'schema_version': 1,
    'capabilities': [{'name': 'motion', 'type': 'boolean', 'role': 'sensor'}]})
for sequence in (1, 4):
    req('POST', ingest + '/api/v1/ingest/telemetry', headers=auth, json={
        'device_id': device_id, 'readings': {'motion': True},
        'metadata': {'boot_id': 'abc', 'sample_sequence': sequence, 'wifi_rssi': -52,
                     'mqtt_reconnects': 1 if sequence == 1 else 2, 'secret_not_allowed': 'never-store-this'},
    })
    time.sleep(.05)
result = req('GET', f'{control}/api/v1/devices/{device_id}/monitoring?include_events=true', headers=owner)
assert result['latest']['transport'] == 'http'
assert result['latest']['metadata']['sample_sequence'] == 4
assert result['latest']['metadata']['wifi_rssi'] == -52
assert 'secret_not_allowed' not in result['latest']['metadata'] and key not in str(result)
assert len(result['samples']) == 2 and len(result['events']) == 1, result
assert result['events'][0]['previous_metadata']['sample_sequence'] == 1
print('Monitoring ownership, metadata filtering, packet history and reconnect event: OK')

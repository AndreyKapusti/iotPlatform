import importlib.util
import json
import sys
import threading
import time
import types
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest import mock

try:
    from serial.tools import list_ports  # noqa: F401
except ImportError:
    # Parsing and HTTP tests do not require access to a physical serial driver.
    serial_stub = types.ModuleType("serial")
    serial_stub.SerialException = OSError
    tools_stub = types.ModuleType("serial.tools")
    tools_stub.list_ports = types.SimpleNamespace(comports=lambda: [])
    sys.modules["serial"] = serial_stub
    sys.modules["serial.tools"] = tools_stub

spec = importlib.util.spec_from_file_location("usb_monitor", Path(__file__).with_name("app.py"))
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)


class SampleTests(unittest.TestCase):
    def test_valid_sample_and_null(self):
        raw = 'SD_SAMPLE {"kind":"sample","version":1,"device_id":3,"sensors":{"temperature":null,"motion":false},"errors":{"dht22":true}}'
        sample = app.parse_sample(raw)
        self.assertIsNone(sample["sensors"]["temperature"])
        self.assertFalse(sample["sensors"]["motion"])
        self.assertTrue(sample["errors"]["dht22"])

    def test_rejects_malformed_and_nonfinite(self):
        for line in ('noise', 'SD_SAMPLE {', 'SD_SAMPLE {"kind":"sample","version":2}',
                     'SD_SAMPLE {"kind":"sample","version":1,"sensors":{"x":NaN}}',
                     'SD_SAMPLE {"kind":"sample","version":1,"uptime_ms":NaN}'):
            with self.subTest(line=line):
                self.assertIsNone(app.parse_sample(line))

    def test_serial_fragmentation_and_regular_log(self):
        monitor = app.Monitor()

        class FakePort:
            def __init__(self):
                self.chunks = iter([b'DHT ready\n', b'SD_SAMPLE {"kind":"sam',
                    b'ple","version":1,"sensors":{"motion":true}}\n'])
                self.closed = False

            def read_until(self, *_args):
                try:
                    return next(self.chunks)
                except StopIteration:
                    monitor.stop.set()
                    return b''

            def close(self):
                self.closed = True

        fake = FakePort()
        monitor.connection = fake
        monitor._read(fake)
        self.assertTrue(fake.closed)
        self.assertTrue(monitor.state()['sample']['sensors']['motion'])
        self.assertEqual(monitor.state()['lines'], ['DHT ready'])

    def test_connect_reads_without_writing_and_disconnects(self):
        monitor = app.Monitor()

        class FakePort:
            def __init__(self, **_kwargs):
                self.dtr = None
                self.rts = None
                self.port = None
                self.closed = False
                self.chunks = [b'SD_SAMPLE {"kind":"sample","version":1,"sensors":{"temperature":21.5}}\n']

            def open(self):
                assert self.dtr is False and self.rts is False

            def read_until(self, *_args):
                if self.chunks:
                    return self.chunks.pop(0)
                time.sleep(0.01)
                return b''

            def close(self):
                self.closed = True

        fake = FakePort()
        with mock.patch.object(app, 'available_ports', return_value=[{'port': 'COM4', 'description': 'test'}]), \
             mock.patch.object(app.serial, 'Serial', return_value=fake, create=True):
            monitor.connect('COM4', 115200)
            deadline = time.monotonic() + 1
            while monitor.state()['sample'] is None and time.monotonic() < deadline:
                time.sleep(0.01)
            self.assertEqual(monitor.state()['sample']['sensors']['temperature'], 21.5)
            monitor.disconnect()
        self.assertTrue(fake.closed)
        self.assertIsNone(monitor.state()['sample'])


class HttpTests(unittest.TestCase):
    def setUp(self):
        self.server = app.MonitorServer(('127.0.0.1', 0), app.Monitor())
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def test_state_and_local_only_origin(self):
        with urllib.request.urlopen(self.base + '/api/state') as response:
            self.assertFalse(json.load(response)['connected'])
        bad = urllib.request.Request(self.base + '/api/state', headers={'Origin': 'http://example.com'})
        with self.assertRaises(urllib.error.HTTPError) as result:
            urllib.request.urlopen(bad)
        self.assertEqual(result.exception.code, 403)

    def test_unknown_port_is_rejected_without_opening(self):
        request = urllib.request.Request(self.base + '/api/connect', data=b'{"port":"COM404","baudrate":115200}', headers={'Content-Type': 'application/json'})
        with mock.patch.object(app, 'available_ports', return_value=[]), self.assertRaises(urllib.error.HTTPError) as result:
            urllib.request.urlopen(request)
        self.assertEqual(result.exception.code, 400)
        self.assertFalse(self.server.monitor.state()['connected'])


if __name__ == '__main__':
    unittest.main()

"""Local, read-only USB serial monitor for SignalDeck sketches."""
from __future__ import annotations

import argparse
import json
import math
import threading
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

import serial
from serial.tools import list_ports

ROOT = Path(__file__).resolve().parent
PREFIX = "SD_SAMPLE "
MAX_LINE = 8192


def parse_sample(line: str) -> dict | None:
    """Accept only the versioned sample envelope; ordinary serial text is a log."""
    if not line.startswith(PREFIX):
        return None
    try:
        sample = json.loads(line[len(PREFIX):])
    except (ValueError, TypeError):
        return None
    if not isinstance(sample, dict) or sample.get("kind") != "sample" or type(sample.get("version")) is not int or sample["version"] != 1:
        return None
    for field in ("device_id", "uptime_ms"):
        if field in sample and (type(sample[field]) is not int or sample[field] < 0):
            return None
    for field in ("sensors", "actuators", "errors"):
        value = sample.get(field, {})
        if not isinstance(value, dict) or len(value) > 100:
            return None
        for name, item in value.items():
            if not isinstance(name, str) or len(name) > 100:
                return None
            if not (item is None or isinstance(item, (str, bool, int, float))):
                return None
            if isinstance(item, float) and not math.isfinite(item):
                return None
    return {name: sample[name] for name in ("kind", "version", "device_id", "uptime_ms", "sensors", "actuators", "errors") if name in sample}


def available_ports() -> list[dict]:
    return [{"port": p.device, "description": p.description} for p in list_ports.comports()]


class Monitor:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.control_lock = threading.Lock()
        self.stop = threading.Event()
        self.thread: threading.Thread | None = None
        self.connection: serial.Serial | None = None
        self.port: str | None = None
        self.error: str | None = None
        self.sample: dict | None = None
        self.sample_at: float | None = None
        self.lines: deque[str] = deque(maxlen=100)

    def connect(self, port: str, baudrate: int) -> None:
        if port not in {entry["port"] for entry in available_ports()}:
            raise ValueError("Порт не найден. Обновите список устройств.")
        if baudrate not in (9600, 19200, 38400, 57600, 115200, 230400):
            raise ValueError("Неподдерживаемая скорость порта.")
        with self.control_lock:
            self._disconnect()
            connection = serial.Serial(port=None, baudrate=baudrate, timeout=0.5)
            # Configure control lines before opening; do not intentionally reset the board.
            connection.dtr = False
            connection.rts = False
            connection.port = port
            try:
                connection.open()
            except (serial.SerialException, OSError):
                connection.close()
                raise
            with self.lock:
                self.port = port
                self.connection = connection
                self.error = None
                self.sample = None
                self.sample_at = None
                self.lines.clear()
            self.stop.clear()
            self.thread = threading.Thread(target=self._read, args=(connection,), daemon=True)
            self.thread.start()

    def _read(self, connection: serial.Serial) -> None:
        pending = bytearray()
        discarding = False
        try:
            while not self.stop.is_set():
                raw = connection.read_until(b"\n", MAX_LINE)
                if not raw:
                    continue
                if discarding:
                    if raw.endswith(b"\n"):
                        discarding = False
                    continue
                pending.extend(raw)
                if len(pending) > MAX_LINE:
                    pending.clear()
                    discarding = not raw.endswith(b"\n")
                    with self.lock:
                        self.lines.append("Слишком длинная строка пропущена")
                    continue
                if not raw.endswith(b"\n"):
                    continue
                line = pending.decode("utf-8", errors="replace").strip()
                pending.clear()
                if not line:
                    continue
                sample = parse_sample(line)
                with self.lock:
                    if sample is not None:
                        self.sample = sample
                        self.sample_at = time.time()
                    elif not line.startswith(PREFIX):
                        self.lines.append(line[:1000])
                    else:
                        self.lines.append("Некорректное сообщение SD_SAMPLE")
        except (serial.SerialException, OSError) as exc:
            if not self.stop.is_set():
                with self.lock:
                    self.error = f"Соединение с портом потеряно: {exc}"
        finally:
            connection.close()
            with self.lock:
                if self.connection is connection:
                    self.connection = None

    def _disconnect(self) -> None:
        self.stop.set()
        if self.thread:
            self.thread.join(timeout=2)
            if self.thread.is_alive():
                raise RuntimeError("Не удалось закрыть предыдущий порт.")
        with self.lock:
            self.connection = None
            self.port = None
            self.sample = None
            self.sample_at = None
        self.thread = None

    def disconnect(self) -> None:
        with self.control_lock:
            self._disconnect()

    def state(self) -> dict:
        with self.lock:
            return {"connected": self.connection is not None, "port": self.port, "error": self.error,
                    "sample": self.sample, "sample_at": self.sample_at, "lines": list(self.lines)}


class MonitorServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], monitor: Monitor):
        super().__init__(address, Handler)
        self.monitor = monitor


class Handler(BaseHTTPRequestHandler):
    server: MonitorServer

    def log_message(self, *_args) -> None:
        pass

    def _local_request(self) -> bool:
        port = self.server.server_port
        if self.headers.get("Host", "") not in (f"127.0.0.1:{port}", f"localhost:{port}"):
            self.send_error(403)
            return False
        origin = self.headers.get("Origin")
        if origin and origin not in (f"http://127.0.0.1:{port}", f"http://localhost:{port}"):
            self.send_error(403)
            return False
        return True

    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; object-src 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, value: dict) -> None:
        self._send(code, json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8"), "application/json; charset=utf-8")

    def do_GET(self) -> None:
        if not self._local_request():
            return
        path = urlsplit(self.path).path
        if path == "/api/ports":
            self._json(200, {"ports": available_ports()})
        elif path == "/api/state":
            self._json(200, self.server.monitor.state())
        elif path in ("/", "/index.html", "/app.js", "/style.css"):
            filename = "index.html" if path == "/" else path[1:]
            content_type = {"index.html": "text/html", "app.js": "text/javascript", "style.css": "text/css"}[filename]
            self._send(200, (ROOT / filename).read_bytes(), f"{content_type}; charset=utf-8")
        else:
            self.send_error(404)

    def do_POST(self) -> None:
        if not self._local_request():
            return
        if self.headers.get_content_type() != "application/json":
            self._json(415, {"error": "Требуется application/json"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 2 or size > 1024:
                raise ValueError("Некорректный размер запроса")
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError("Ожидается объект JSON")
            if self.path == "/api/connect":
                if not isinstance(body.get("port"), str) or type(body.get("baudrate")) is not int:
                    raise ValueError("Укажите порт и скорость")
                self.server.monitor.connect(body["port"], body["baudrate"])
            elif self.path == "/api/disconnect":
                self.server.monitor.disconnect()
            elif self.path == "/api/shutdown":
                self._json(200, {"ok": True})
                threading.Thread(target=self.server.shutdown, daemon=True).start()
                return
            else:
                self.send_error(404)
                return
        except (ValueError, serial.SerialException, OSError, RuntimeError) as exc:
            self._json(400, {"error": str(exc)})
            return
        self._json(200, {"ok": True})


def main() -> None:
    parser = argparse.ArgumentParser(description="SignalDeck USB monitor (localhost only)")
    parser.add_argument("--port", type=int, default=8765, help="Local HTTP port (default: 8765)")
    args = parser.parse_args()
    monitor = Monitor()
    server = MonitorServer(("127.0.0.1", args.port), monitor)
    print(f"USB monitor: http://127.0.0.1:{server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        monitor.disconnect()


if __name__ == "__main__":
    main()

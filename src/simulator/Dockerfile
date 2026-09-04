FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt paho-mqtt>=2.0.0

COPY main.py .

ENV CONTROL_URL=http://control:8000 \
    INGEST_HTTP_URL=http://ingest:8001 \
    MQTT_BROKER=mosquitto:1883 \
    DEVICE_NAME=demo-sensor \
    SIGNALDECK_EMAIL=admin@example.com \
    SIGNALDECK_USERNAME=admin \
    SIGNALDECK_PASSWORD=admin123 \
    INTERVAL_SEC=2 \
    USE_MQTT=false

CMD ["python", "-u", "main.py"]

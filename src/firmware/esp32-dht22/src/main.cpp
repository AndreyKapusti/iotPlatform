#include <Arduino.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <mqtt_client.h>
#include <Preferences.h>
#include <WiFi.h>

static constexpr int DHT_PIN = 4;
static constexpr int PIR_PIN = 25;
static constexpr int RELAY_1_PIN = 26;
static constexpr int RELAY_2_PIN = 27;
// Common relay modules are active LOW: HIGH holds their inputs inactive.
static constexpr int RELAY_OFF = HIGH;
static constexpr int RELAY_ON = LOW;
static constexpr unsigned long INTERVAL_MS = 1000;
static constexpr unsigned long DHT_INTERVAL_MS = 2000;
DHT dht(DHT_PIN, DHT22);
Preferences settings;
String ssid, password, server, apiKey, serialLine;
int deviceId = 0;
bool relay1 = false, relay2 = false;
unsigned long lastTelemetry = 0, lastPoll = 0, pollStarted = 0;
String mqttURI, mqttUser, mqttClientID, pollNonce;
esp_mqtt_client_handle_t mqtt = nullptr;
bool mqttConnected = false;
uint32_t pollSequence = 0, bootNonce = 0;
uint32_t mqttReconnects = 0, publishErrors = 0, lastDhtRevision = 0;
bool everConnected = false;
struct MqttEvent { int type; char payload[4096]; };
QueueHandle_t mqttEvents;

struct SensorSnapshot {
  float temperature;
  float humidity;
  bool motion;
  bool sampled;
  uint32_t sequence;
  uint32_t dhtRevision;
};

SensorSnapshot sensors = {NAN, NAN, false, false, 0, 0};
portMUX_TYPE sensorLock = portMUX_INITIALIZER_UNLOCKED;

// Sampling is independent of HTTP and Wi-Fi, so USB diagnostics continue even
// if a network request times out. DHT is only accessed from this task.
void sampleSensors(void*) {
  TickType_t lastWake = xTaskGetTickCount();
  unsigned long lastDht = 0;
  SensorSnapshot sample = {NAN, NAN, false, false, 0, 0};
  for (;;) {
    if (!sample.sampled || millis() - lastDht >= DHT_INTERVAL_MS) {
      lastDht = millis();
      sample.temperature = dht.readTemperature();
      sample.humidity = dht.readHumidity();
      sample.dhtRevision++;
    }
    sample.motion = digitalRead(PIR_PIN) == HIGH;
    sample.sampled = true;
    sample.sequence++;
    portENTER_CRITICAL(&sensorLock);
    sensors = sample;
    portEXIT_CRITICAL(&sensorLock);

    JsonDocument message;
    message["kind"] = "sample";
    message["version"] = 1;
    message["device_id"] = deviceId;
    message["uptime_ms"] = millis();
    if (isnan(sample.temperature)) message["sensors"]["temperature"] = nullptr;
    else message["sensors"]["temperature"] = sample.temperature;
    if (isnan(sample.humidity)) message["sensors"]["humidity"] = nullptr;
    else message["sensors"]["humidity"] = sample.humidity;
    message["sensors"]["motion"] = sample.motion;
    message["actuators"]["relay_1"] = digitalRead(RELAY_1_PIN) == RELAY_ON;
    message["actuators"]["relay_2"] = digitalRead(RELAY_2_PIN) == RELAY_ON;
    message["errors"]["dht22"] = isnan(sample.temperature) || isnan(sample.humidity);
    String payload;
    serializeJson(message, payload);
    String line = "SD_SAMPLE " + payload;
    line += '\n';
    Serial.write(reinterpret_cast<const uint8_t*>(line.c_str()), line.length());
    vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(INTERVAL_MS));
  }
}

SensorSnapshot latestSensors() {
  portENTER_CRITICAL(&sensorLock);
  SensorSnapshot sample = sensors;
  portEXIT_CRITICAL(&sensorLock);
  return sample;
}

void loadSettings() {
  settings.begin("signaldeck", true);
  ssid = settings.getString("ssid");
  password = settings.getString("password");
  server = settings.getString("server");
  apiKey = settings.getString("api_key");
  deviceId = settings.getInt("device_id");
  settings.end();
}

void handleSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c != '\n') {
      if (serialLine.length() < 2048) serialLine += c;
      continue;
    }
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, serialLine);
    serialLine = "";
    if (err || !doc["ssid"].is<const char*>() || !doc["password"].is<const char*>() ||
        !doc["server"].is<const char*>() || !doc["api_key"].is<const char*>() ||
        !doc["device_id"].is<int>() || doc["device_id"].as<int>() <= 0 ||
        strlen(doc["ssid"]) == 0 || strlen(doc["server"]) == 0 || strlen(doc["api_key"]) == 0) {
      Serial.println("Invalid configuration JSON");
      continue;
    }
    settings.begin("signaldeck", false);
    settings.putString("ssid", doc["ssid"].as<const char*>());
    settings.putString("password", doc["password"].as<const char*>());
    settings.putString("server", doc["server"].as<const char*>());
    settings.putString("api_key", doc["api_key"].as<const char*>());
    settings.putInt("device_id", doc["device_id"].as<int>());
    settings.end();
    Serial.println("Configuration saved; restarting");
    delay(200);
    ESP.restart();
  }
}

bool publish(const char* suffix, JsonDocument& doc, int qos = 0) {
  if (!mqttConnected) return false;
  doc["device_id"] = deviceId;
  doc["api_key"] = apiKey;
  String body;
  serializeJson(doc, body);
  String topic = "devices/" + String(deviceId) + "/" + suffix;
  bool ok = esp_mqtt_client_publish(mqtt, topic.c_str(), body.c_str(), body.length(), qos, 0) >= 0;
  if (!ok) publishErrors++;
  return ok;
}

bool announce() {
  JsonDocument doc;
  doc["device_id"] = deviceId;
  doc["schema_version"] = 1;
  doc["firmware"] = "esp32-dht22-pir-1.0";
  JsonArray capabilities = doc["capabilities"].to<JsonArray>();
  JsonObject temperature = capabilities.add<JsonObject>();
  temperature["name"] = "temperature";
  temperature["type"] = "number";
  temperature["role"] = "sensor";
  temperature["unit"] = "°C";
  temperature["min"] = -40;
  temperature["max"] = 80;
  JsonObject humidity = capabilities.add<JsonObject>();
  humidity["name"] = "humidity";
  humidity["type"] = "number";
  humidity["role"] = "sensor";
  humidity["unit"] = "%";
  humidity["min"] = 0;
  humidity["max"] = 100;
  JsonObject motion = capabilities.add<JsonObject>();
  motion["name"] = "motion";
  motion["type"] = "boolean";
  motion["role"] = "sensor";
  for (const char* name : {"relay_1", "relay_2"}) {
    JsonObject relay = capabilities.add<JsonObject>();
    relay["name"] = name;
    relay["type"] = "boolean";
    relay["role"] = "actuator";
  }
  return publish("announce", doc, 1);
}

void requestCommands() {
  lastPoll = pollStarted = millis();
  pollNonce = String(bootNonce, HEX) + "-" + String(++pollSequence);
  JsonDocument poll;
  poll["nonce"] = pollNonce;
  publish("poll", poll);
}

void processCommands(const char* payload) {
  JsonDocument result;
  if (deserializeJson(result, payload)) return;
  if (result["wake"] == true) { requestCommands(); return; }
  if (!result["nonce"].is<const char*>() ||
      pollNonce != result["nonce"].as<const char*>() || !result["commands"].is<JsonArray>()) return;
  for (JsonObject command : result["commands"].as<JsonArray>()) {
    if (!command["id"].is<long long>() || !command["metric"].is<const char*>() ||
        !command["value"].is<bool>() || !command["remaining_ms"].is<unsigned long>() ||
        millis() - pollStarted >= command["remaining_ms"].as<unsigned long>()) continue;
    String metric = command["metric"].as<const char*>();
    bool value = command["value"].as<bool>();
    if (metric == "relay_1") {
      digitalWrite(RELAY_1_PIN, value ? RELAY_ON : RELAY_OFF);
      relay1 = value;
    } else if (metric == "relay_2") {
      digitalWrite(RELAY_2_PIN, value ? RELAY_ON : RELAY_OFF);
      relay2 = value;
    } else {
      Serial.println("Unknown actuator command");
      continue;
    }
    int pin = metric == "relay_1" ? RELAY_1_PIN : RELAY_2_PIN;
    if ((digitalRead(pin) == RELAY_ON) != value) {
      Serial.println("Relay GPIO readback mismatch");
      continue;
    }
    JsonDocument ack;
    ack["id"] = command["id"].as<long long>();
    ack["value"] = value;
    bool sent = publish("ack", ack, 1);
    Serial.printf("Relay %s: %s, MQTT ack %s\n", metric.c_str(), value ? "on" : "off", sent ? "queued" : "failed");
  }
  pollNonce = "";
}

void onMqttEvent(void*, esp_event_base_t, int32_t id, void* eventData) {
  auto* event = static_cast<esp_mqtt_event_handle_t>(eventData);
  if (id != MQTT_EVENT_CONNECTED && id != MQTT_EVENT_DISCONNECTED && id != MQTT_EVENT_DATA) return;
  MqttEvent message = {};
  message.type = id;
  if (id == MQTT_EVENT_DATA) {
    // Discard retained, fragmented or oversized messages. Every command must
    // answer the current request and fit in a single bounded message.
    if (event->retain || event->current_data_offset != 0 || event->data_len != event->total_data_len ||
        event->data_len <= 0 || event->data_len >= static_cast<int>(sizeof(message.payload))) return;
    memcpy(message.payload, event->data, event->data_len);
    message.payload[event->data_len] = 0;
  }
  xQueueSend(mqttEvents, &message, 0);
}

void startMqtt() {
  String host = server;
  int scheme = host.indexOf("://");
  if (scheme >= 0) host = host.substring(scheme + 3);
  int slash = host.indexOf('/');
  if (slash >= 0) host = host.substring(0, slash);
  int colon = host.lastIndexOf(':');
  if (colon >= 0) host = host.substring(0, colon);
  if (!host.length()) return;
  mqttURI = "mqtt://" + host + ":1883";
  mqttUser = String(deviceId);
  bootNonce = esp_random();
  mqttClientID = "signaldeck-" + mqttUser + "-" + String(bootNonce, HEX);
  esp_mqtt_client_config_t config = {};
  config.uri = mqttURI.c_str();
  config.username = mqttUser.c_str();
  config.password = apiKey.c_str();
  config.client_id = mqttClientID.c_str();
  config.keepalive = 20;
  config.buffer_size = 4096;
  config.task_stack = 8192;
  mqtt = esp_mqtt_client_init(&config);
  if (!mqtt) { Serial.println("MQTT initialization failed"); return; }
  esp_mqtt_client_register_event(mqtt, MQTT_EVENT_ANY, onMqttEvent, nullptr);
  esp_mqtt_client_start(mqtt);
}

void handleMqtt() {
  MqttEvent event;
  while (xQueueReceive(mqttEvents, &event, 0) == pdTRUE) {
    if (event.type == MQTT_EVENT_CONNECTED) {
      mqttConnected = true;
      if (everConnected) mqttReconnects++;
      everConnected = true;
      String topic = "devices/" + String(deviceId) + "/command";
      esp_mqtt_client_subscribe(mqtt, topic.c_str(), 0);
      announce();
      lastTelemetry = 0;
      lastPoll = 0;
      Serial.println("MQTT connected");
    } else if (event.type == MQTT_EVENT_DISCONNECTED) {
      mqttConnected = false;
      pollNonce = "";
      Serial.println("MQTT disconnected");
    } else if (event.type == MQTT_EVENT_DATA && mqttConnected) {
      processCommands(event.payload);
    }
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(PIR_PIN, INPUT);
  digitalWrite(RELAY_1_PIN, RELAY_OFF);
  digitalWrite(RELAY_2_PIN, RELAY_OFF);
  pinMode(RELAY_1_PIN, OUTPUT);
  pinMode(RELAY_2_PIN, OUTPUT);
  loadSettings();
  mqttEvents = xQueueCreate(4, sizeof(MqttEvent));
  if (!mqttEvents) Serial.println("MQTT event queue allocation failed");
  if (xTaskCreatePinnedToCore(sampleSensors, "sensor-sampler", 6144, nullptr, 1, nullptr, 1) != pdPASS) {
    Serial.println("Sensor sampler failed to start");
  }
  Serial.println("ESP32 DHT22: send configuration as one JSON line over serial");
  if (ssid.length() && server.length() && apiKey.length() && deviceId > 0) {
    WiFi.onEvent([](WiFiEvent_t, WiFiEventInfo_t info) {
      Serial.printf("Wi-Fi disconnected, reason %d\n", info.wifi_sta_disconnected.reason);
    }, ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);
    WiFi.setAutoReconnect(true);
    WiFi.begin(ssid.c_str(), password.c_str());
    if (mqttEvents) startMqtt();
  }
}

void loop() {
  handleSerial();
  if (mqttEvents) handleMqtt();
  if (!ssid.length() || !server.length() || !apiKey.length() || deviceId <= 0) {
    delay(20);
    return;
  }
  if (!mqttConnected || WiFi.status() != WL_CONNECTED) { delay(20); return; }
  if (millis() - lastPoll >= 1000) {
    requestCommands();
  }
  if (millis() - lastTelemetry < INTERVAL_MS) { delay(10); return; }
  lastTelemetry = millis();
  SensorSnapshot sample = latestSensors();
  if (!sample.sampled) return;
  JsonDocument doc;
  doc["device_id"] = deviceId;
  doc["readings"]["motion"] = sample.motion;
  doc["readings"]["relay_1"] = relay1;
  doc["readings"]["relay_2"] = relay2;
  doc["metadata"]["boot_id"] = String(bootNonce, HEX);
  doc["metadata"]["sample_sequence"] = sample.sequence;
  doc["metadata"]["uptime_ms"] = millis();
  doc["metadata"]["wifi_rssi"] = WiFi.RSSI();
  doc["metadata"]["mqtt_reconnects"] = mqttReconnects;
  doc["metadata"]["publish_errors"] = publishErrors;
  if (sample.dhtRevision != lastDhtRevision) {
    if (isnan(sample.temperature) || isnan(sample.humidity)) {
      Serial.println("DHT22 read failed; check wiring");
    } else {
      doc["readings"]["temperature"] = sample.temperature;
      doc["readings"]["humidity"] = sample.humidity;
    }
    lastDhtRevision = sample.dhtRevision;
  }
  publish("telemetry", doc);
}

package config

import (
	"os"
	"strings"
)

type Config struct {
	DatabaseURL string
	MQTTBroker  string
	HTTPAddr    string
	CORSOrigins []string
}

func Load() Config {
	origins := strings.Split(os.Getenv("CORS_ORIGINS"), ",")
	clean := make([]string, 0, len(origins))
	for _, o := range origins {
		o = strings.TrimSpace(o)
		if o != "" {
			clean = append(clean, o)
		}
	}

	httpAddr := os.Getenv("HTTP_ADDR")
	if httpAddr == "" {
		httpAddr = ":8001"
	}

	mqttBroker := os.Getenv("MQTT_BROKER")
	if mqttBroker == "" {
		mqttBroker = "tcp://localhost:1883"
	}

	return Config{
		DatabaseURL: os.Getenv("DATABASE_URL"),
		MQTTBroker:  mqttBroker,
		HTTPAddr:    httpAddr,
		CORSOrigins: clean,
	}
}

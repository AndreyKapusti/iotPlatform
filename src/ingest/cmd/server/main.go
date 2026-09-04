package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	paho "github.com/eclipse/paho.mqtt.golang"

	"signaldeck/ingest/internal/config"
	"signaldeck/ingest/internal/db"
	"signaldeck/ingest/internal/httpapi"
	"signaldeck/ingest/internal/hub"
	mqttclient "signaldeck/ingest/internal/mqtt"
	"signaldeck/ingest/internal/store"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		logger.Error("DATABASE_URL is required")
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database connect failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	st := store.New(pool)
	wsHub := hub.New()
	mqtt := mqttclient.NewClient(st, wsHub, logger)

	var mqttClient paho.Client
	mqttClient, err = mqtt.Connect(ctx, cfg.MQTTBroker)
	if err != nil {
		logger.Error("mqtt connect failed", "error", err)
		os.Exit(1)
	}
	defer mqttClient.Disconnect(250)

	srv := httpapi.New(st, wsHub, cfg, logger)
	httpServer := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      srv.Handler(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info("http listening", "addr", cfg.HTTPAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("http server failed", "error", err)
			cancel()
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	select {
	case <-stop:
		logger.Info("shutdown signal received")
	case <-ctx.Done():
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		logger.Error("http shutdown failed", "error", err)
	}

	logger.Info("shutdown complete")
}

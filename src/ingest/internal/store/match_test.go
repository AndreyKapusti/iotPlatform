package store

import (
	"errors"
	"testing"
	"time"
)

func simulatorCaps() map[string]string {
	return map[string]string{
		"temperature": "number",
		"humidity":    "number",
		"motion":      "boolean",
		"relay_1":     "boolean",
	}
}

func TestMatchSimulatorReadings(t *testing.T) {
	readings := map[string]interface{}{
		"temperature": 21.5,
		"humidity":    55.0,
		"motion":      false,
		"relay_1":     true,
	}
	got, err := MatchReadings(simulatorCaps(), readings)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 4 {
		t.Fatalf("saved %d readings", len(got))
	}
}

func TestMatchUnknownMetric(t *testing.T) {
	_, err := MatchReadings(simulatorCaps(), map[string]interface{}{
		"temperature": 21.5,
		"battery":     90.0,
	})
	if !errors.Is(err, ErrCapabilityMismatch) {
		t.Fatalf("err = %v", err)
	}
}

func TestMatchTypeMismatch(t *testing.T) {
	_, err := MatchReadings(simulatorCaps(), map[string]interface{}{
		"temperature": true,
	})
	if !errors.Is(err, ErrCapabilityMismatch) {
		t.Fatalf("err = %v", err)
	}
}

func TestReceivedAtIgnoresClientClock(t *testing.T) {
	now := time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC)
	future := now.Add(48 * time.Hour)
	if got := ReceivedAt(now, &future); !got.Equal(now) {
		t.Fatalf("got %s", got)
	}
	past := now.Add(-48 * time.Hour)
	if got := ReceivedAt(now, &past); !got.Equal(now) {
		t.Fatalf("past clock got %s", got)
	}
}

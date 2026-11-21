package hub

import (
	"sync"
	"testing"
)

func TestBroadcastReportsFullSubscriberQueue(t *testing.T) {
	h := New()
	_, unsubscribe := h.Subscribe(7)
	defer unsubscribe()
	event := ReadingEvent{DeviceID: 7, Metric: "temperature", Value: 23.0}
	for i := 0; i < 64; i++ {
		result := h.Broadcast(event)
		if result.Subscribers != 1 || result.Queued != 1 || result.Dropped != 0 {
			t.Fatalf("event %d: unexpected result %+v", i, result)
		}
	}
	result := h.Broadcast(event)
	if result.Subscribers != 1 || result.Queued != 0 || result.Dropped != 1 {
		t.Fatalf("full queue: unexpected result %+v", result)
	}
}

func TestConcurrentBroadcastAndUnsubscribe(t *testing.T) {
	h := New()
	for i := 0; i < 100; i++ {
		_, unsubscribe := h.Subscribe(7)
		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			h.Broadcast(ReadingEvent{DeviceID: 7, Metric: "temperature", Value: 23.0})
		}()
		unsubscribe()
		wg.Wait()
	}
}

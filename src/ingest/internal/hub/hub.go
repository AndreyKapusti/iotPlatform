package hub

import (
	"encoding/json"
	"sync"
	"time"
)

type ReadingEvent struct {
	DeviceID   int         `json:"device_id"`
	Metric     string      `json:"metric"`
	Value      interface{} `json:"value"`
	Type       string      `json:"type"`
	ReceivedAt time.Time   `json:"received_at"`
}

type subscriber struct {
	ch chan []byte
}

type Hub struct {
	mu          sync.RWMutex
	subscribers map[int]map[*subscriber]struct{}
}

func New() *Hub {
	return &Hub{
		subscribers: make(map[int]map[*subscriber]struct{}),
	}
}

func (h *Hub) Subscribe(deviceID int) (<-chan []byte, func()) {
	sub := &subscriber{ch: make(chan []byte, 64)}

	h.mu.Lock()
	if h.subscribers[deviceID] == nil {
		h.subscribers[deviceID] = make(map[*subscriber]struct{})
	}
	h.subscribers[deviceID][sub] = struct{}{}
	h.mu.Unlock()

	unsubscribe := func() {
		h.mu.Lock()
		if subs, ok := h.subscribers[deviceID]; ok {
			delete(subs, sub)
			if len(subs) == 0 {
				delete(h.subscribers, deviceID)
			}
		}
		h.mu.Unlock()
		close(sub.ch)
	}

	return sub.ch, unsubscribe
}

func (h *Hub) Broadcast(event ReadingEvent) {
	payload, err := json.Marshal(event)
	if err != nil {
		return
	}

	h.mu.RLock()
	subs := h.subscribers[event.DeviceID]
	targets := make([]*subscriber, 0, len(subs))
	for sub := range subs {
		targets = append(targets, sub)
	}
	h.mu.RUnlock()

	for _, sub := range targets {
		select {
		case sub.ch <- payload:
		default:
		}
	}
}

import type { Capability } from '../../types';

export type FleetEventKind =
  | 'device.online'
  | 'device.offline'
  | 'device.announced'
  | 'device.activity'
  | 'telemetry.spike'
  | 'device.created';

export const CRITICAL_EVENT_KINDS: FleetEventKind[] = ['device.offline', 'telemetry.spike'];

export function isCriticalFleetEvent(kind: FleetEventKind): boolean {
  return CRITICAL_EVENT_KINDS.includes(kind);
}

export interface FleetEventReading {
  metric: string;
  value: string;
}

export interface FleetEvent {
  id: string;
  kind: FleetEventKind;
  deviceId: number;
  deviceName: string;
  timestamp: string;
  metric?: string;
  value?: string;
  readings?: FleetEventReading[];
}

const STORAGE_KEY = 'signaldeck_fleet_events';
const SPIKE_PURGE_KEY = 'signaldeck_events_spike_purged_v2';
const MAX_EVENTS = 100;
const DEDUPE_MS = 30_000;

let events: FleetEvent[] = loadEvents();
const listeners = new Set<() => void>();

function loadEvents(): FleetEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FleetEvent[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_EVENTS) : [];
  } catch {
    return [];
  }
}

function persistEvents() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
  } catch {
    /* ignore */
  }
}

function notify() {
  for (const listener of listeners) listener();
  window.dispatchEvent(new Event('signaldeck:events'));
}

export function subscribeFleetEvents(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFleetEvents(): FleetEvent[] {
  return events;
}

export function getFleetEventsForDevice(deviceId: number, limit = 20): FleetEvent[] {
  return events.filter((e) => e.deviceId === deviceId).slice(0, limit);
}

export function clearFleetEvents() {
  events = [];
  persistEvents();
  notify();
}

/** Remove noisy client-side telemetry.spike entries from older builds. */
export function purgeLegacySpikeEvents() {
  try {
    if (localStorage.getItem(SPIKE_PURGE_KEY)) return;
    const next = events.filter((e) => e.kind !== 'telemetry.spike');
    if (next.length !== events.length) {
      events = next;
      persistEvents();
      notify();
    }
    localStorage.setItem(SPIKE_PURGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function pushFleetEvent(event: Omit<FleetEvent, 'id'>) {
  const ts = new Date(event.timestamp).getTime();
  const duplicate = events.some(
    (e) =>
      e.kind === event.kind &&
      e.deviceId === event.deviceId &&
      e.metric === event.metric &&
      Math.abs(new Date(e.timestamp).getTime() - ts) < DEDUPE_MS,
  );
  if (duplicate) return;

  events = [
    {
      ...event,
      id: `${event.kind}-${event.deviceId}-${event.metric ?? ''}-${ts}-${Math.random().toString(36).slice(2, 7)}`,
    },
    ...events,
  ].slice(0, MAX_EVENTS);

  persistEvents();
  notify();
}

export function capabilityFingerprint(caps: Capability[]): string {
  return caps
    .map((c) => `${c.name}:${c.schema_version}:${c.type}:${c.role}`)
    .sort()
    .join('|');
}

export function detectTelemetrySpike(
  value: number,
  cap: Capability | undefined,
  prevValue: number | undefined,
): boolean {
  if (prevValue == null) return false;

  if (cap?.max != null && value > cap.max && prevValue <= cap.max) return true;
  if (cap?.min != null && value < cap.min && prevValue >= cap.min) return true;

  return false;
}

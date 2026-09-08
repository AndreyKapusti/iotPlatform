import { useEffect, useRef } from 'react';
import { useAppSelector } from '../../app/hooks';
import { store } from '../../app/store';
import { useListDevicesQuery } from '../../features/devices/api/devicesApi';
import { devicesApi } from '../../features/devices/api/devicesApi';
import { telemetryApi } from '../../features/telemetry/api/telemetryApi';
import { selectOfflineThresholdMs } from '../../features/ui/uiSlice';
import type { Capability, Device } from '../../types';
import { formatMetricValue, isDeviceOnline } from '../lib/format';
import {
  capabilityFingerprint,
  getFleetEvents,
  pushFleetEvent,
  purgeLegacySpikeEvents,
  type FleetEventReading,
} from '../lib/fleetEvents';
import { useFleetMeta } from './useFleetMeta';

function getCapabilities(deviceId: number): Capability[] {
  return devicesApi.endpoints.getCapabilities.select(deviceId)(store.getState()).data ?? [];
}

async function recordActivityEvent(device: Device, timestamp: string) {
  const caps = getCapabilities(device.id);
  const capMap = Object.fromEntries(caps.map((c) => [c.name, c]));
  let readings: FleetEventReading[] = [];

  try {
    const result = await store.dispatch(
      telemetryApi.endpoints.getTelemetryLatest.initiate(device.id, { forceRefetch: true }),
    );
    if (result.data?.readings.length) {
      readings = result.data.readings.map((r) => ({
        metric: r.metric,
        value: formatMetricValue(r.value, capMap[r.metric]?.unit),
      }));
    }
  } catch {
    /* ignore */
  }

  pushFleetEvent({
    kind: 'device.activity',
    deviceId: device.id,
    deviceName: device.name,
    timestamp,
    readings,
  });
}

function seedSnapshotEvents(devices: Device[], thresholdMs: number) {
  if (getFleetEvents().length > 0) return;

  const now = new Date().toISOString();

  for (const device of devices) {
    const online = isDeviceOnline(device.last_seen_at, thresholdMs);
    const caps = getCapabilities(device.id);

    pushFleetEvent({
      kind: online ? 'device.online' : 'device.offline',
      deviceId: device.id,
      deviceName: device.name,
      timestamp: device.last_seen_at ?? now,
    });

    if (caps.length > 0) {
      pushFleetEvent({
        kind: 'device.announced',
        deviceId: device.id,
        deviceName: device.name,
        timestamp: device.last_seen_at ?? now,
        value: String(caps.length),
      });
    }
  }
}

export function FleetEventsWatcher() {
  const thresholdMs = useAppSelector(selectOfflineThresholdMs);
  const { data: devices = [] } = useListDevicesQuery(undefined, { pollingInterval: 15_000 });
  useFleetMeta(devices);

  const stateReadyRef = useRef(false);
  const knownDevicesRef = useRef<Set<number>>(new Set());
  const prevOnlineRef = useRef<Map<number, boolean>>(new Map());
  const prevLastSeenRef = useRef<Map<number, string | null>>(new Map());
  const prevCapsRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    purgeLegacySpikeEvents();
  }, []);

  useEffect(() => {
    if (devices.length === 0) return;

    const now = new Date().toISOString();

    if (!stateReadyRef.current) {
      for (const device of devices) {
        knownDevicesRef.current.add(device.id);
        prevOnlineRef.current.set(device.id, isDeviceOnline(device.last_seen_at, thresholdMs));
        prevLastSeenRef.current.set(device.id, device.last_seen_at);
        const caps = getCapabilities(device.id);
        if (caps.length > 0) {
          prevCapsRef.current.set(device.id, capabilityFingerprint(caps));
        }
      }
      stateReadyRef.current = true;
      seedSnapshotEvents(devices, thresholdMs);
      return;
    }

    const activityTasks: Promise<void>[] = [];

    for (const device of devices) {
      if (!knownDevicesRef.current.has(device.id)) {
        knownDevicesRef.current.add(device.id);
        pushFleetEvent({
          kind: 'device.created',
          deviceId: device.id,
          deviceName: device.name,
          timestamp: device.created_at ?? now,
        });
        prevOnlineRef.current.set(device.id, isDeviceOnline(device.last_seen_at, thresholdMs));
        prevLastSeenRef.current.set(device.id, device.last_seen_at);
      }

      const online = isDeviceOnline(device.last_seen_at, thresholdMs);
      const wasOnline = prevOnlineRef.current.get(device.id);

      if (wasOnline === false && online) {
        pushFleetEvent({
          kind: 'device.online',
          deviceId: device.id,
          deviceName: device.name,
          timestamp: device.last_seen_at ?? now,
        });
      } else if (wasOnline === true && !online) {
        pushFleetEvent({
          kind: 'device.offline',
          deviceId: device.id,
          deviceName: device.name,
          timestamp: now,
        });
      }
      prevOnlineRef.current.set(device.id, online);

      const prevSeen = prevLastSeenRef.current.get(device.id);
      if (
        device.last_seen_at &&
        prevSeen &&
        device.last_seen_at !== prevSeen &&
        new Date(device.last_seen_at).getTime() > new Date(prevSeen).getTime()
      ) {
        activityTasks.push(recordActivityEvent(device, device.last_seen_at));
      }
      if (device.last_seen_at) {
        prevLastSeenRef.current.set(device.id, device.last_seen_at);
      }

      const caps = getCapabilities(device.id);
      const fp = capabilityFingerprint(caps);
      const prevFp = prevCapsRef.current.get(device.id);
      if (prevFp !== undefined && prevFp !== fp && caps.length > 0) {
        pushFleetEvent({
          kind: 'device.announced',
          deviceId: device.id,
          deviceName: device.name,
          timestamp: device.last_seen_at ?? now,
          value: String(caps.length),
        });
      }
      if (caps.length > 0) {
        prevCapsRef.current.set(device.id, fp);
      }
    }

    if (activityTasks.length > 0) {
      void Promise.all(activityTasks);
    }

    if (getFleetEvents().length === 0) {
      seedSnapshotEvents(devices, thresholdMs);
    }
  }, [devices, thresholdMs]);

  return null;
}

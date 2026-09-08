import { isDeviceOnline } from './format';
import type { Device } from '../../types';

export interface FleetHealth {
  onlinePct: number;
  avgLagMs: number | null;
  score: number;
}

export function computeFleetHealth(devices: Device[], thresholdMs: number): FleetHealth {
  if (devices.length === 0) {
    return { onlinePct: 100, avgLagMs: null, score: 100 };
  }

  const now = Date.now();
  let online = 0;
  let lagSum = 0;
  let lagCount = 0;

  for (const device of devices) {
    if (isDeviceOnline(device.last_seen_at, thresholdMs)) online += 1;
    if (device.last_seen_at) {
      lagSum += now - new Date(device.last_seen_at).getTime();
      lagCount += 1;
    }
  }

  const onlinePct = Math.round((online / devices.length) * 100);
  const avgLagMs = lagCount > 0 ? lagSum / lagCount : null;

  let lagScore = 0;
  if (avgLagMs != null) {
    lagScore = Math.max(0, Math.min(100, 100 - (avgLagMs / thresholdMs) * 40));
  }

  const score = Math.round(onlinePct * 0.65 + lagScore * 0.35);

  return { onlinePct, avgLagMs, score: Math.max(0, Math.min(100, score)) };
}

export function healthScoreColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

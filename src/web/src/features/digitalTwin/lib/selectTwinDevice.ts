import type { Device } from '../../../types';
import { isDeviceOnline } from '../../../shared/lib/format';

/**
 * Pick a single primary device to drive the Overview digital twin.
 * Prefer: first pinned online → pinned any → demo-named → most recently seen online → first device.
 */
export function selectTwinDevice(
  devices: Device[],
  pinnedIds: number[],
  offlineThresholdMs: number,
): Device | null {
  if (devices.length === 0) return null;

  const byId = new Map(devices.map((d) => [d.id, d]));

  for (const id of pinnedIds) {
    const d = byId.get(id);
    if (d && isDeviceOnline(d.last_seen_at, offlineThresholdMs)) return d;
  }
  for (const id of pinnedIds) {
    const d = byId.get(id);
    if (d) return d;
  }

  const demo = devices.find((d) => /demo|simulat|twin|house|home/i.test(d.name));
  if (demo) return demo;

  const online = devices
    .filter((d) => isDeviceOnline(d.last_seen_at, offlineThresholdMs))
    .sort((a, b) => {
      const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
      const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
      return tb - ta;
    });
  if (online[0]) return online[0];

  return [...devices].sort((a, b) => {
    const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
    const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
    return tb - ta;
  })[0];
}

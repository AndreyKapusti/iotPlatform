import { PINNED_DEVICES_KEY } from './constants';

export function readPinnedDevices(): number[] {
  try {
    const raw = localStorage.getItem(PINNED_DEVICES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : [];
  } catch {
    return [];
  }
}

export function writePinnedDevices(ids: number[]) {
  localStorage.setItem(PINNED_DEVICES_KEY, JSON.stringify([...new Set(ids)]));
}

export function togglePinnedDevice(deviceId: number): number[] {
  const current = readPinnedDevices();
  const next = current.includes(deviceId)
    ? current.filter((id) => id !== deviceId)
    : [...current, deviceId];
  writePinnedDevices(next);
  return next;
}

export function isDevicePinned(deviceId: number): boolean {
  return readPinnedDevices().includes(deviceId);
}

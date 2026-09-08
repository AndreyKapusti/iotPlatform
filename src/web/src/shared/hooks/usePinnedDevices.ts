import { useCallback, useEffect, useState } from 'react';
import { readPinnedDevices, togglePinnedDevice, writePinnedDevices } from '../lib/devicePrefs';

export function usePinnedDevices() {
  const [pinned, setPinned] = useState<number[]>(() => readPinnedDevices());

  useEffect(() => {
    const sync = () => setPinned(readPinnedDevices());
    window.addEventListener('storage', sync);
    window.addEventListener('signaldeck:pinned', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('signaldeck:pinned', sync);
    };
  }, []);

  const toggle = useCallback((deviceId: number) => {
    const next = togglePinnedDevice(deviceId);
    setPinned(next);
    window.dispatchEvent(new Event('signaldeck:pinned'));
  }, []);

  const isPinned = useCallback((deviceId: number) => pinned.includes(deviceId), [pinned]);

  return { pinned, toggle, isPinned };
}

export function sortWithPinnedFirst<T extends { id: number }>(items: T[], pinned: number[]): T[] {
  const pinSet = new Set(pinned);
  return [...items].sort((a, b) => {
    const aPin = pinSet.has(a.id) ? 0 : 1;
    const bPin = pinSet.has(b.id) ? 0 : 1;
    if (aPin !== bPin) return aPin - bPin;
    return pinned.indexOf(a.id) - pinned.indexOf(b.id);
  });
}

export { writePinnedDevices };

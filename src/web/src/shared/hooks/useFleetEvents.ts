import { useEffect, useState } from 'react';
import { getFleetEvents, getFleetEventsForDevice, subscribeFleetEvents } from '../lib/fleetEvents';

export function useFleetEvents(limit?: number) {
  const [events, setEvents] = useState(() => getFleetEvents());

  useEffect(() => {
    const sync = () => setEvents([...getFleetEvents()]);
    sync();
    const unsub = subscribeFleetEvents(sync);
    window.addEventListener('signaldeck:events', sync);
    const poll = window.setInterval(sync, 5_000);
    return () => {
      unsub();
      window.removeEventListener('signaldeck:events', sync);
      window.clearInterval(poll);
    };
  }, []);

  return limit != null ? events.slice(0, limit) : events;
}

export function useDeviceEvents(deviceId: number, limit = 20) {
  const all = useFleetEvents();
  return all.filter((e) => e.deviceId === deviceId).slice(0, limit);
}

export { getFleetEventsForDevice };

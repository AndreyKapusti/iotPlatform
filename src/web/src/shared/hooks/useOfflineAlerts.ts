import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../app/hooks';
import { useListDevicesQuery } from '../../features/devices/api/devicesApi';
import {
  selectOfflineAlertsEnabled,
  selectOfflineThresholdMs,
} from '../../features/ui/uiSlice';
import { isDeviceOnline } from '../lib/format';

export function OfflineAlertsWatcher() {
  const { t } = useTranslation();
  const enabled = useAppSelector(selectOfflineAlertsEnabled);
  const thresholdMs = useAppSelector(selectOfflineThresholdMs);
  const { data: devices = [] } = useListDevicesQuery(undefined, {
    pollingInterval: enabled ? 30_000 : 0,
    skip: !enabled,
  });
  const prevOnlineRef = useRef<Map<number, boolean>>(new Map());

  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') return;

    for (const device of devices) {
      const online = isDeviceOnline(device.last_seen_at, thresholdMs);
      const wasOnline = prevOnlineRef.current.get(device.id);

      if (wasOnline === true && !online && Notification.permission === 'granted') {
        new Notification(t('alerts.offlineTitle'), {
          body: t('alerts.offlineBody', { name: device.name }),
          tag: `device-offline-${device.id}`,
        });
      }

      prevOnlineRef.current.set(device.id, online);
    }
  }, [devices, enabled, thresholdMs, t]);

  return null;
}

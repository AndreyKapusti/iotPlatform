import { useEffect, useMemo, useState } from 'react';
import { store } from '../../app/store';
import { dashboardsApi } from '../../features/dashboards/api/dashboardsApi';
import { devicesApi } from '../../features/devices/api/devicesApi';
import type { DashboardSummary, Device } from '../../types';

export interface FleetDashboardItem extends DashboardSummary {
  deviceName: string;
}

export interface DeviceMeta {
  capabilityCount: number;
  dashboardCount: number;
}

export function useFleetMeta(devices: Device[]) {
  const deviceKey = devices.map((d) => d.id).join(',');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (devices.length === 0) return;

    let cancelled = false;

    void (async () => {
      await Promise.all(
        devices.flatMap((device) => [
          store.dispatch(devicesApi.endpoints.getCapabilities.initiate(device.id)),
          store.dispatch(dashboardsApi.endpoints.listDashboards.initiate(device.id)),
        ]),
      );
      if (!cancelled) setVersion((v) => v + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, [deviceKey]);

  return useMemo(() => {
    const state = store.getState();
    const meta: Record<number, DeviceMeta> = {};
    const dashboards: FleetDashboardItem[] = [];
    let loading = false;

    for (const device of devices) {
      const capsQuery = devicesApi.endpoints.getCapabilities.select(device.id)(state);
      const dashQuery = dashboardsApi.endpoints.listDashboards.select(device.id)(state);

      if (capsQuery.isLoading || dashQuery.isLoading) loading = true;

      const capabilityCount = capsQuery.data?.length ?? 0;
      const deviceDashboards = dashQuery.data ?? [];

      meta[device.id] = {
        capabilityCount,
        dashboardCount: deviceDashboards.length,
      };

      for (const dash of deviceDashboards) {
        dashboards.push({ ...dash, deviceName: device.name });
      }
    }

    dashboards.sort((a, b) => {
      const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
      return tb - ta;
    });

    return { meta, dashboards, loading };
  }, [devices, version]);
}

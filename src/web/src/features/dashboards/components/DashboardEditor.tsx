import { useCallback, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useGetDeviceQuery } from '../../devices/api/devicesApi';
import { useSaveDashboardMutation } from '../api/dashboardsApi';
import { buildPalette, clampGrid, clampWidgetSize, createWidgetFromPalette } from '../../../shared/lib/dashboard';
import { extractErrorMessage } from '../../../shared/api/baseApi';
import type { ChartHistoryLimit } from '../../../shared/lib/constants';
import { TelemetryProvider } from '../../telemetry/hooks/useTelemetry';
import { DashboardCanvas } from './DashboardCanvas';
import { DashboardToolbar, type DashboardMode } from './DashboardToolbar';
import { PropertiesPanel } from './PropertiesPanel';
import { WidgetPalette } from './WidgetPalette';
import type { Capability, Device, ReadingEvent, WidgetLayout } from '../../../types';

interface DashboardEditorProps {
  device: Device;
  capabilities: Capability[];
  dashboardId: number;
  dashboardName: string;
  initialLayout: WidgetLayout[];
}

export function DashboardEditor({
  device: initialDevice,
  capabilities,
  dashboardId,
  dashboardName,
  initialLayout,
}: DashboardEditorProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { data: liveDevice } = useGetDeviceQuery(initialDevice.id, { pollingInterval: 8000 });
  const device = liveDevice ?? initialDevice;

  const [saveDashboard, { isLoading: saving }] = useSaveDashboardMutation();

  const [mode, setMode] = useState<DashboardMode>('view');
  const [layout, setLayout] = useState<WidgetLayout[]>(initialLayout);
  const [savedLayout, setSavedLayout] = useState<WidgetLayout[]>(initialLayout);
  const [name, setName] = useState(dashboardName);
  const [savedName, setSavedName] = useState(dashboardName);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState(device.last_seen_at);
  const [historyLimit, setHistoryLimit] = useState<ChartHistoryLimit>(50);

  const deviceWithSeen = useMemo(
    () => ({ ...device, last_seen_at: lastSeen ?? device.last_seen_at }),
    [device, lastSeen],
  );

  const palette = useMemo(() => buildPalette(capabilities), [capabilities]);
  const metrics = useMemo(() => [...new Set(layout.map((w) => w.metric))], [layout]);
  const selected = layout.find((w) => w.id === selectedId) ?? null;
  const editing = mode === 'edit';

  const handleReading = useCallback((event: ReadingEvent) => {
    setLastSeen(event.received_at);
  }, []);

  const addWidget = (item: ReturnType<typeof buildPalette>[number]) => {
    const widget = createWidgetFromPalette(item, layout);
    setLayout((prev) => [...prev, widget]);
    setSelectedId(widget.id);
  };

  const updateWidget = (id: string, patch: Partial<WidgetLayout>) => {
    setLayout((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const next = { ...w, ...patch };
        next.x = clampGrid(next.x, 0, 12 - next.w);
        const size = clampWidgetSize(next.w, next.h, next.x);
        next.w = size.w;
        next.h = size.h;
        return next;
      }),
    );
  };

  const handleSave = async () => {
    setError(null);
    try {
      const result = await saveDashboard({
        dashboardId,
        name: name.trim() || 'Dashboard',
        layout,
      }).unwrap();
      setSavedLayout(result.layout);
      setLayout(result.layout);
      setName(result.name);
      setSavedName(result.name);
      enqueueSnackbar(t('dashboards.savedSuccess'), { variant: 'success' });
    } catch (err) {
      setError(extractErrorMessage(err as Parameters<typeof extractErrorMessage>[0]));
    }
  };

  const handleReset = () => {
    setLayout(savedLayout);
    setName(savedName);
    setSelectedId(null);
  };

  const handleModeChange = (next: DashboardMode) => {
    setMode(next);
    if (next === 'view') setSelectedId(null);
  };

  return (
    <TelemetryProvider deviceId={device.id} metrics={metrics} historyLimit={historyLimit} onReading={handleReading}>
      <DashboardToolbar
        device={deviceWithSeen}
        title={name}
        name={name}
        onNameChange={setName}
        mode={mode}
        saving={saving}
        error={error}
        metrics={metrics}
        historyLimit={historyLimit}
        onHistoryLimitChange={setHistoryLimit}
        onSave={() => void handleSave()}
        onReset={handleReset}
        onModeChange={handleModeChange}
      />

      <div className={`dashboard-layout ${editing ? '' : 'dashboard-layout--view'}`}>
        {editing && <WidgetPalette items={palette} onAdd={addWidget} />}

        <DashboardCanvas
          layout={layout}
          capabilities={capabilities}
          selectedId={selectedId}
          editable={editing}
          onSelect={setSelectedId}
          onRemove={(id) => {
            setLayout((prev) => prev.filter((w) => w.id !== id));
            if (selectedId === id) setSelectedId(null);
          }}
          onMove={(id, x, y) =>
            setLayout((prev) => prev.map((w) => (w.id === id ? { ...w, x, y } : w)))
          }
          onResize={(id, w, h) => updateWidget(id, { w, h })}
          onEdit={() => handleModeChange('edit')}
        />

        {editing && (
          <PropertiesPanel
            widget={selected}
            onChange={(patch) => selected && updateWidget(selected.id, patch)}
            onDelete={() => {
              if (!selected) return;
              setLayout((prev) => prev.filter((w) => w.id !== selected.id));
              setSelectedId(null);
            }}
          />
        )}
      </div>
    </TelemetryProvider>
  );
}

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Paper, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useGetDeviceQuery } from '../../devices/api/devicesApi';
import { useSaveDashboardMutation } from '../api/dashboardsApi';
import {
  buildPalette,
  clampGrid,
  clampWidgetSize,
  createWidgetFromPalette,
  DEFAULT_SIZES,
  findNextPosition,
} from '../../../shared/lib/dashboard';
import { extractErrorMessage } from '../../../shared/api/baseApi';
import type { ChartHistoryRangeId } from '../../../shared/lib/constants';
import { GRID_COLS, ROW_HEIGHT, getChartHistoryRange } from '../../../shared/lib/constants';
import { TelemetryProvider } from '../../telemetry/hooks/useTelemetry';
import { DashboardCanvas, CANVAS_DROPPABLE_ID, type DashboardCanvasHandle } from './DashboardCanvas';
import { DashboardToolbar, type DashboardMode } from './DashboardToolbar';
import { PropertiesPanel } from './PropertiesPanel';
import { PaletteDragOverlay, WidgetPalette } from './WidgetPalette';
import { WidgetPreviewDialog } from './WidgetPreviewDialog';
import type { Capability, Device, PaletteItem, ReadingEvent, WidgetLayout } from '../../../types';

interface DashboardEditorProps {
  device: Device;
  capabilities: Capability[];
  dashboardId: number;
  dashboardName: string;
  initialLayout: WidgetLayout[];
}

type ActiveDrag =
  | { kind: 'palette'; item: PaletteItem }
  | { kind: 'widget'; widget: WidgetLayout }
  | null;

function pointerToGridPos(
  grid: HTMLDivElement,
  clientX: number,
  clientY: number,
  w: number,
): { x: number; y: number } {
  const rect = grid.getBoundingClientRect();
  const cellW = rect.width / GRID_COLS || 1;
  const x = clampGrid(Math.floor((clientX - rect.left) / cellW), 0, GRID_COLS - w);
  const y = Math.max(0, Math.floor((clientY - rect.top) / ROW_HEIGHT));
  return { x, y };
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
  const [historyRangeId, setHistoryRangeId] = useState<ChartHistoryRangeId>('5m');
  const [previewItem, setPreviewItem] = useState<PaletteItem | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null);
  const [dropPreview, setDropPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );

  const canvasRef = useRef<DashboardCanvasHandle>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const historyRange = getChartHistoryRange(historyRangeId);

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

  const addWidget = (item: PaletteItem, position?: { x: number; y: number }) => {
    const widget = createWidgetFromPalette(item, layout, position);
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

  const resolvePaletteDropPos = (item: PaletteItem, clientX?: number, clientY?: number) => {
    const size = DEFAULT_SIZES[item.type];
    const grid = canvasRef.current?.getGridElement();
    if (grid && clientX != null && clientY != null) {
      return { ...pointerToGridPos(grid, clientX, clientY, size.w), ...size };
    }
    return { ...findNextPosition(layout), ...size };
  };

  const onDragStart = (event: DragStartEvent) => {
    if (!editing) return;
    const data = event.active.data.current;
    if (data?.source === 'palette' && data.item) {
      setActiveDrag({ kind: 'palette', item: data.item as PaletteItem });
      setPreviewItem(null);
      return;
    }
    if (data?.source === 'widget' && data.widget) {
      const widget = data.widget as WidgetLayout;
      setActiveDrag({ kind: 'widget', widget });
      setSelectedId(widget.id);
    }
  };

  const onDragMove = (event: DragMoveEvent) => {
    if (!editing) return;
    const data = event.active.data.current;
    if (data?.source !== 'palette' || !data.item) return;
    const translated = event.active.rect.current.translated;
    if (!translated) return;
    const next = resolvePaletteDropPos(
      data.item as PaletteItem,
      translated.left + translated.width / 2,
      translated.top + translated.height / 2,
    );
    setDropPreview(next);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const current = activeDrag;
    const preview = dropPreview;
    setActiveDrag(null);
    setDropPreview(null);
    if (!editing || !current) return;

    if (current.kind === 'palette') {
      const overCanvas = event.over?.id === CANVAS_DROPPABLE_ID;
      if (!preview && !overCanvas) return;
      const translated = event.active.rect.current.translated;
      const pos =
        preview ??
        resolvePaletteDropPos(
          current.item,
          translated ? translated.left + translated.width / 2 : undefined,
          translated ? translated.top + translated.height / 2 : undefined,
        );
      addWidget(current.item, { x: pos.x, y: pos.y });
      return;
    }

    if (!event.delta) return;
    const grid = canvasRef.current?.getGridElement();
    if (!grid) return;
    const widget = layout.find((w) => w.id === current.widget.id);
    if (!widget) return;
    const cellW = grid.clientWidth / GRID_COLS;
    const dx = Math.round(event.delta.x / cellW);
    const dy = Math.round(event.delta.y / ROW_HEIGHT);
    const x = clampGrid(widget.x + dx, 0, GRID_COLS - widget.w);
    const y = Math.max(0, widget.y + dy);
    setLayout((prev) => prev.map((w) => (w.id === widget.id ? { ...w, x, y } : w)));
  };

  const onDragCancel = () => {
    setActiveDrag(null);
    setDropPreview(null);
  };

  return (
    <TelemetryProvider
      deviceId={device.id}
      metrics={metrics}
      historyRangeMs={historyRange.ms}
      historyFetchLimit={historyRange.fetchLimit}
      onReading={handleReading}
    >
      <DashboardToolbar
        device={deviceWithSeen}
        title={name}
        name={name}
        onNameChange={setName}
        mode={mode}
        saving={saving}
        error={error}
        metrics={metrics}
        historyRangeId={historyRangeId}
        onHistoryRangeChange={setHistoryRangeId}
        onSave={() => void handleSave()}
        onReset={handleReset}
        onModeChange={handleModeChange}
      />

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className={`dashboard-layout ${editing ? '' : 'dashboard-layout--view'}`}>
          {editing && <WidgetPalette items={palette} onPreview={setPreviewItem} />}

          <DashboardCanvas
            ref={canvasRef}
            layout={layout}
            capabilities={capabilities}
            selectedId={selectedId}
            editable={editing}
            dropPreview={dropPreview}
            paletteDragging={activeDrag?.kind === 'palette'}
            onSelect={setSelectedId}
            onRemove={(id) => {
              setLayout((prev) => prev.filter((w) => w.id !== id));
              if (selectedId === id) setSelectedId(null);
            }}
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

        <DragOverlay dropAnimation={null}>
          {activeDrag?.kind === 'palette' ? (
            <PaletteDragOverlay item={activeDrag.item} />
          ) : activeDrag?.kind === 'widget' ? (
            <Paper variant="outlined" sx={{ width: 220, height: 120, p: 1.5, opacity: 0.92, boxShadow: 6 }}>
              <Typography variant="body2" fontWeight={500}>
                {activeDrag.widget.title ?? activeDrag.widget.metric}
              </Typography>
            </Paper>
          ) : null}
        </DragOverlay>
      </DndContext>

      <WidgetPreviewDialog
        item={previewItem}
        open={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        onAdd={(item) => addWidget(item)}
      />
    </TelemetryProvider>
  );
}

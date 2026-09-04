import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type RefObject } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ApiError,
  GRID_COLS,
  ROW_HEIGHT,
  buildPalette,
  createWidgetId,
  findNextPosition,
  formatRelativeTime,
  getCapabilities,
  getDashboard,
  getDevice,
  isDeviceOnline,
  saveDashboard,
} from '../api/client';
import {
  BooleanIndicatorWidget,
  KpiGaugeWidget,
  LineChartWidget,
  ToggleWidget,
} from '../components/widgets';
import { useToast } from '../hooks/useToast';
import { TelemetryProvider, useTelemetryControls } from '../hooks/useTelemetry';
import type { Capability, Device, PaletteItem, ReadingEvent, WidgetAccent, WidgetLayout, WidgetType } from '../types';

type DashboardMode = 'view' | 'edit';

const WIDGET_ACCENTS: { value: WidgetAccent; label: string }[] = [
  { value: 'default', label: 'По умолчанию' },
  { value: 'blue', label: 'Синий' },
  { value: 'amber', label: 'Янтарный' },
  { value: 'rose', label: 'Розовый' },
  { value: 'green', label: 'Зелёный' },
  { value: 'slate', label: 'Серый' },
];

const DEFAULT_SIZES: Record<WidgetType, { w: number; h: number }> = {
  line: { w: 6, h: 4 },
  gauge: { w: 3, h: 3 },
  indicator: { w: 3, h: 2 },
  toggle: { w: 3, h: 2 },
};

function clampGrid(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

type ResizeAxis = 'e' | 's' | 'se';

function clampWidgetSize(w: number, h: number, x: number) {
  return {
    w: clampGrid(w, 2, GRID_COLS - x),
    h: clampGrid(h, 2, 12),
  };
}

const VIEW_GRID_MIN_WIDTH = 720;

function useViewGridScale(
  wrapRef: RefObject<HTMLDivElement>,
  gridRef: RefObject<HTMLDivElement>,
  enabled: boolean,
  layoutLength: number,
) {
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setScale(1);
      setScaledHeight(null);
      return;
    }

    const wrap = wrapRef.current;
    const grid = gridRef.current;
    if (!wrap || !grid) return;

    const update = () => {
      const nextScale = Math.min(1, wrap.clientWidth / VIEW_GRID_MIN_WIDTH);
      setScale(nextScale);
      setScaledHeight(nextScale < 1 ? grid.offsetHeight * nextScale : null);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [enabled, wrapRef, gridRef, layoutLength]);

  return { scale, scaledHeight };
}

function DashboardToolbar({
  device,
  title,
  mode,
  saving,
  error,
  onSave,
  onReset,
  onModeChange,
  name,
  onNameChange,
}: {
  device: Device;
  title: string;
  mode: DashboardMode;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onReset: () => void;
  onModeChange: (mode: DashboardMode) => void;
  name: string;
  onNameChange: (name: string) => void;
}) {
  const { connected, live, setLive } = useTelemetryControls();
  const editing = mode === 'edit';
  const deviceOnline = isDeviceOnline(device.last_seen_at);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="dashboard-toolbar">
      <div style={{ flex: 1, minWidth: 200 }}>
        {editing ? (
          <input
            className="input"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            aria-label="Название дашборда"
            style={{ fontSize: 18, fontWeight: 600, maxWidth: 420 }}
          />
        ) : (
          <h2 style={{ marginBottom: 4 }}>{title}</h2>
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <span className={`badge ${deviceOnline ? 'badge--online' : 'badge--offline'}`}>
            <span className="badge-dot" />
            {deviceOnline ? 'Online' : 'Offline'}
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            обновлено {formatRelativeTime(device.last_seen_at)}
          </span>
          <span className={`badge ${connected ? 'badge--online' : 'badge--offline'}`}>
            <span className="badge-dot" />
            {connected ? 'Live' : 'Нет связи'}
          </span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            Live mode
          </label>
        </div>
      </div>

      <div className="page-header-actions">
        <div className="mode-toggle" role="group" aria-label="Режим дашборда">
          <button
            type="button"
            className={`mode-toggle-btn ${mode === 'view' ? 'mode-toggle-btn--active' : ''}`}
            onClick={() => onModeChange('view')}
          >
            Просмотр
          </button>
          <button
            type="button"
            className={`mode-toggle-btn ${mode === 'edit' ? 'mode-toggle-btn--active' : ''}`}
            onClick={() => onModeChange('edit')}
          >
            Редактирование
          </button>
        </div>
        {editing && (
          <>
            <button type="button" className="btn btn-secondary" onClick={onReset}>
              Сбросить
            </button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={onSave}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </>
        )}
      </div>
      {error && (
        <div className="alert alert-error" style={{ width: '100%' }}>
          {error}
        </div>
      )}
    </div>
  );
}

function GridWidget({
  widget,
  capability,
  selected,
  editable,
  cellWidth,
  onSelect,
  onRemove,
  onResize,
}: {
  widget: WidgetLayout;
  capability?: Capability;
  selected: boolean;
  editable: boolean;
  cellWidth: number;
  onSelect: () => void;
  onRemove: () => void;
  onResize: (w: number, h: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: widget.id,
    data: { widget },
    disabled: !editable,
  });

  const style: CSSProperties = {
    gridColumn: `${widget.x + 1} / span ${widget.w}`,
    gridRow: `${widget.y + 1} / span ${widget.h}`,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    zIndex: isDragging ? 20 : selected ? 5 : 1,
    touchAction: 'none',
  };

  const common = {
    metric: widget.metric,
    capability,
  };

  let body = null;
  if (widget.type === 'line') body = <LineChartWidget {...common} />;
  else if (widget.type === 'gauge') body = <KpiGaugeWidget {...common} />;
  else if (widget.type === 'indicator') body = <BooleanIndicatorWidget {...common} />;
  else if (widget.type === 'toggle') body = <ToggleWidget {...common} />;

  const handleSelect = (e: MouseEvent) => {
    if (!editable) return;
    e.stopPropagation();
    onSelect();
  };

  const handleResizeStart = (e: MouseEvent, axis: ResizeAxis) => {
    if (!editable || cellWidth <= 0) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect();

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = widget.w;
    const startH = widget.h;

    const onMove = (ev: globalThis.MouseEvent) => {
      const dw = Math.round((ev.clientX - startX) / cellWidth);
      const dh = Math.round((ev.clientY - startY) / ROW_HEIGHT);
      let nextW = startW;
      let nextH = startH;
      if (axis === 'e' || axis === 'se') nextW = startW + dw;
      if (axis === 's' || axis === 'se') nextH = startH + dh;
      const { w, h } = clampWidgetSize(nextW, nextH, widget.x);
      onResize(w, h);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const showResizeHandles = editable && selected;

  return (
    <div
      ref={setNodeRef}
      className={`widget-shell ${selected && editable ? 'widget-shell--selected' : ''} ${
        isDragging ? 'widget-shell--dragging' : ''
      }`}
      data-widget-accent={widget.accent ?? 'default'}
      style={style}
      onClick={handleSelect}
    >
      <div className="widget-header">
        {editable ? (
          <span className="widget-drag-handle" {...listeners} {...attributes}>
            ⋮⋮
          </span>
        ) : (
          <span className="widget-drag-handle" style={{ visibility: 'hidden' }}>
            ⋮⋮
          </span>
        )}
        <span className="widget-title">{widget.title ?? widget.metric}</span>
        {editable && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ minHeight: 28, padding: '0 8px' }}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            ×
          </button>
        )}
      </div>
      <div className={`widget-body${widget.type === 'line' ? ' widget-body--chart' : ''}`}>{body}</div>
      {showResizeHandles && (
        <>
          <div
            className="widget-resize-handle widget-resize-handle--e"
            onMouseDown={(e) => handleResizeStart(e, 'e')}
            onClick={(e) => e.stopPropagation()}
          />
          <div
            className="widget-resize-handle widget-resize-handle--s"
            onMouseDown={(e) => handleResizeStart(e, 's')}
            onClick={(e) => e.stopPropagation()}
          />
          <div
            className="widget-resize-handle widget-resize-handle--se"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
            onClick={(e) => e.stopPropagation()}
          />
        </>
      )}
    </div>
  );
}

function DashboardEmptyState({
  editable,
  onEdit,
}: {
  editable: boolean;
  onEdit?: () => void;
}) {
  return (
    <div className="card empty-state dashboard-empty">
      <h3>Пустой дашборд</h3>
      {editable ? (
        <p>Добавьте виджет из палитры слева</p>
      ) : (
        <>
          <p>Настройте виджеты для мониторинга устройства</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }} onClick={onEdit}>
            Перейти в редактирование
          </button>
        </>
      )}
    </div>
  );
}

function DashboardCanvas({
  layout,
  capabilities,
  selectedId,
  editable,
  onSelect,
  onRemove,
  onMove,
  onResize,
  onEdit,
}: {
  layout: WidgetLayout[];
  capabilities: Capability[];
  selectedId: string | null;
  editable: boolean;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onEdit?: () => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cellWidth, setCellWidth] = useState(0);
  const { scale, scaledHeight } = useViewGridScale(wrapRef, gridRef, !editable, layout.length);
  const isScaled = !editable && scale < 1;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const capMap = useMemo(
    () => Object.fromEntries(capabilities.map((c) => [c.name, c])),
    [capabilities],
  );
  const activeWidget = layout.find((w) => w.id === activeId) ?? null;

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const update = () => setCellWidth(grid.clientWidth / GRID_COLS);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [editable, layout.length]);

  const onDragStart = (event: DragStartEvent) => {
    if (!editable) return;
    const id = String(event.active.id);
    setActiveId(id);
    onSelect(id);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (!editable || !event.delta || !gridRef.current) return;
    const widget = layout.find((w) => w.id === event.active.id);
    if (!widget) return;
    const cellW = gridRef.current.clientWidth / GRID_COLS;
    const dx = Math.round(event.delta.x / cellW);
    const dy = Math.round(event.delta.y / ROW_HEIGHT);
    const x = clampGrid(widget.x + dx, 0, GRID_COLS - widget.w);
    const y = Math.max(0, widget.y + dy);
    onMove(widget.id, x, y);
  };

  if (layout.length === 0) {
    return (
      <section className="dashboard-canvas-wrap">
        <DashboardEmptyState editable={editable} onEdit={onEdit} />
      </section>
    );
  }

  return (
    <section
      ref={wrapRef}
      className={`dashboard-canvas-wrap${isScaled ? ' dashboard-canvas-wrap--scaled' : ''}`}
      style={isScaled && scaledHeight ? { height: scaledHeight } : undefined}
    >
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div
          className={isScaled ? 'dashboard-grid-scale' : undefined}
          style={
            isScaled
              ? {
                  transform: `scale(${scale})`,
                  width: `${100 / scale}%`,
                }
              : undefined
          }
        >
          <div
            ref={gridRef}
            className={`dashboard-grid ${editable ? '' : 'dashboard-grid--view'}`}
            onClick={(e) => {
              if (editable && e.target === e.currentTarget) onSelect(null);
            }}
          >
            {layout.map((widget) => (
              <GridWidget
                key={widget.id}
                widget={widget}
                capability={capMap[widget.metric]}
                selected={selectedId === widget.id}
                editable={editable}
                cellWidth={cellWidth}
                onSelect={() => onSelect(widget.id)}
                onRemove={() => onRemove(widget.id)}
                onResize={(w, h) => onResize(widget.id, w, h)}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeWidget ? (
            <div
              className="widget-shell widget-shell--dragging"
              data-widget-accent={activeWidget.accent ?? 'default'}
              style={{ width: 220, height: 120 }}
            >
              <div className="widget-header">
                <span className="widget-title">{activeWidget.title ?? activeWidget.metric}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}

function PropertiesPanel({
  widget,
  onChange,
  onDelete,
}: {
  widget: WidgetLayout | null;
  onChange: (patch: Partial<WidgetLayout>) => void;
  onDelete: () => void;
}) {
  if (!widget) {
    return (
      <div className="card dashboard-props">
        <h3 style={{ marginBottom: 8 }}>Свойства</h3>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Выберите виджет на холсте
        </p>
      </div>
    );
  }

  const currentAccent = widget.accent ?? 'default';

  return (
    <div className="card dashboard-props">
      <h3 style={{ marginBottom: 12 }}>Свойства</h3>
      <div className="props-form">
        <label>
          <span className="meta-label">Заголовок</span>
          <input
            className="input"
            value={widget.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </label>
        <div>
          <span className="meta-label">Цвет</span>
          <div className="accent-swatch-row" role="group" aria-label="Цвет виджета">
            {WIDGET_ACCENTS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`accent-swatch${currentAccent === value ? ' accent-swatch--selected' : ''}`}
                data-widget-accent={value}
                aria-label={label}
                aria-pressed={currentAccent === value}
                onClick={() => onChange({ accent: value })}
              />
            ))}
          </div>
        </div>
        <label>
          <span className="meta-label">Ширина (колонки)</span>
          <input
            className="input"
            type="number"
            min={2}
            max={12}
            value={widget.w}
            onChange={(e) => onChange({ w: Number(e.target.value) })}
          />
        </label>
        <label>
          <span className="meta-label">Высота (ряды)</span>
          <input
            className="input"
            type="number"
            min={2}
            max={12}
            value={widget.h}
            onChange={(e) => onChange({ h: Number(e.target.value) })}
          />
        </label>
        <button type="button" className="btn btn-secondary" onClick={onDelete}>
          Удалить виджет
        </button>
      </div>
    </div>
  );
}

function DashboardInner({
  device,
  capabilities,
  dashboardId,
  dashboardName,
  initialLayout,
}: {
  device: Device;
  capabilities: Capability[];
  dashboardId: number;
  dashboardName: string;
  initialLayout: WidgetLayout[];
}) {
  const toast = useToast();
  const [mode, setMode] = useState<DashboardMode>('view');
  const [deviceState, setDeviceState] = useState(device);
  const [layout, setLayout] = useState<WidgetLayout[]>(initialLayout);
  const [savedLayout, setSavedLayout] = useState<WidgetLayout[]>(initialLayout);
  const [name, setName] = useState(dashboardName);
  const [savedName, setSavedName] = useState(dashboardName);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDeviceState(device);
  }, [device]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void getDevice(device.id)
        .then(setDeviceState)
        .catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(id);
  }, [device.id]);

  const handleReading = useCallback((event: ReadingEvent) => {
    setDeviceState((prev) => ({ ...prev, last_seen_at: event.received_at }));
  }, []);

  const palette = useMemo(() => buildPalette(capabilities), [capabilities]);
  const metrics = useMemo(() => [...new Set(layout.map((w) => w.metric))], [layout]);
  const selected = layout.find((w) => w.id === selectedId) ?? null;
  const editing = mode === 'edit';

  const addWidget = (item: PaletteItem) => {
    const size = DEFAULT_SIZES[item.type];
    const pos = findNextPosition(layout);
    const widget: WidgetLayout = {
      id: createWidgetId(),
      type: item.type,
      metric: item.metric,
      title: item.capability.name,
      x: pos.x,
      y: pos.y,
      w: size.w,
      h: size.h,
    };
    setLayout((prev) => [...prev, widget]);
    setSelectedId(widget.id);
  };

  const updateWidget = (id: string, patch: Partial<WidgetLayout>) => {
    setLayout((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const next = { ...w, ...patch };
        next.x = clampGrid(next.x, 0, GRID_COLS - next.w);
        const size = clampWidgetSize(next.w, next.h, next.x);
        next.w = size.w;
        next.h = size.h;
        return next;
      }),
    );
  };

  const moveWidget = (id: string, x: number, y: number) => {
    setLayout((prev) => prev.map((w) => (w.id === id ? { ...w, x, y } : w)));
  };

  const removeWidget = (id: string) => {
    setLayout((prev) => prev.filter((w) => w.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await saveDashboard(dashboardId, name.trim() || 'Dashboard', layout);
      setSavedLayout(result.layout);
      setLayout(result.layout);
      setName(result.name);
      setSavedName(result.name);
      toast.success('Дашборд сохранён');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLayout(savedLayout);
    setName(savedName);
    setSelectedId(null);
  };

  const handleModeChange = (next: DashboardMode) => {
    setMode(next);
    if (next === 'view') {
      setSelectedId(null);
    }
  };

  return (
    <TelemetryProvider deviceId={device.id} metrics={metrics} onReading={handleReading}>
      <DashboardToolbar
        device={deviceState}
        title={name}
        name={name}
        onNameChange={setName}
        mode={mode}
        saving={saving}
        error={error}
        onSave={() => void handleSave()}
        onReset={handleReset}
        onModeChange={handleModeChange}
      />

      <div className={`dashboard-layout ${editing ? '' : 'dashboard-layout--view'}`}>
        {editing && (
          <aside className="card dashboard-sidebar">
            <h3 style={{ marginBottom: 'var(--space-3)' }}>Виджеты</h3>
            {palette.length === 0 ? (
              <div className="empty-state empty-state--compact">
                <h3>Нет виджетов</h3>
                <p>Capabilities ещё не объявлены. Запустите симулятор или дождитесь announce от устройства.</p>
              </div>
            ) : (
              <div className="palette-list">
                {palette.map((item) => (
                  <button
                    key={`${item.type}-${item.metric}`}
                    type="button"
                    className="palette-item"
                    onClick={() => addWidget(item)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}

        <DashboardCanvas
          layout={layout}
          capabilities={capabilities}
          selectedId={selectedId}
          editable={editing}
          onSelect={setSelectedId}
          onRemove={removeWidget}
          onMove={moveWidget}
          onResize={(id, w, h) => updateWidget(id, { w, h })}
          onEdit={() => handleModeChange('edit')}
        />

        {editing && (
          <PropertiesPanel
            widget={selected}
            onChange={(patch) => selected && updateWidget(selected.id, patch)}
            onDelete={() => selected && removeWidget(selected.id)}
          />
        )}
      </div>
    </TelemetryProvider>
  );
}

export function DashboardPage() {
  const { id, dashboardId: dashboardIdParam } = useParams<{
    id: string;
    dashboardId: string;
  }>();
  const deviceId = Number(id);
  const dashboardId = Number(dashboardIdParam);
  const [device, setDevice] = useState<Device | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [dashboardName, setDashboardName] = useState('Dashboard');
  const [initialLayout, setInitialLayout] = useState<WidgetLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId || !dashboardId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [dev, caps, dash] = await Promise.all([
          getDevice(deviceId),
          getCapabilities(deviceId),
          getDashboard(dashboardId),
        ]);
        if (dash.device_id !== deviceId) {
          throw new ApiError(404, 'Дашборд не принадлежит этому устройству');
        }
        setDevice(dev);
        setCapabilities(caps);
        setDashboardName(dash.name);
        setInitialLayout(dash.layout);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить дашборд');
      } finally {
        setLoading(false);
      }
    })();
  }, [deviceId, dashboardId]);

  if (!deviceId || !dashboardId) {
    return <Navigate to="/devices" replace />;
  }

  if (loading) {
    return <p style={{ color: 'var(--text-muted)' }}>Загрузка дашборда…</p>;
  }

  if (error || !device) {
    return <div className="alert alert-error">{error ?? 'Устройство не найдено'}</div>;
  }

  return (
    <>
      <p style={{ marginBottom: 'var(--space-3)' }}>
        <Link to={`/devices/${device.id}/dashboards`}>← Дашборды · {device.name}</Link>
      </p>
      <DashboardInner
        key={`${dashboardId}-${initialLayout.length}-${dashboardName}`}
        device={device}
        capabilities={capabilities}
        dashboardId={dashboardId}
        dashboardName={dashboardName}
        initialLayout={initialLayout}
      />
    </>
  );
}

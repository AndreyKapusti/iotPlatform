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
import { Box, Button, Card, CardContent, IconButton, Paper, Typography, useTheme } from '@mui/material';
import { Close as CloseIcon, DragIndicator as DragIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type RefObject,
} from 'react';
import {
  GRID_COLS,
  ROW_HEIGHT,
  VIEW_GRID_MIN_WIDTH,
} from '../../../shared/lib/constants';
import { clampGrid, clampWidgetSize } from '../../../shared/lib/dashboard';
import {
  BooleanIndicatorWidget,
  KpiGaugeWidget,
  LineChartWidget,
  ToggleWidget,
} from '../../../components/widgets';
import type { Capability, WidgetLayout } from '../../../types';

type ResizeAxis = 'e' | 's' | 'se';

const ACCENT_MAP: Record<string, string> = {
  default: '#0f766e',
  blue: '#1e40af',
  amber: '#b45309',
  rose: '#be123c',
  green: '#047857',
  slate: '#475569',
};

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
  const theme = useTheme();
  const accent = ACCENT_MAP[widget.accent ?? 'default'] ?? theme.palette.primary.main;
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
  };

  const common = { metric: widget.metric, capability, accent };

  let body = null;
  if (widget.type === 'line') body = <LineChartWidget {...common} />;
  else if (widget.type === 'gauge') body = <KpiGaugeWidget {...common} />;
  else if (widget.type === 'indicator') body = <BooleanIndicatorWidget {...common} />;
  else if (widget.type === 'toggle') body = <ToggleWidget {...common} />;

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

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      className={`widget-shell ${selected && editable ? 'widget-shell--selected' : ''} ${isDragging ? 'widget-shell--dragging' : ''}`}
      style={{ ...style, '--widget-accent': accent } as CSSProperties}
      onClick={(e) => {
        if (!editable) return;
        e.stopPropagation();
        onSelect();
      }}
      sx={{ bgcolor: 'background.paper' }}
    >
      <Box className="widget-header" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
        {editable ? (
          <Box component="span" className="widget-drag-handle" {...listeners} {...attributes}>
            <DragIcon sx={{ fontSize: 16 }} />
          </Box>
        ) : (
          <Box sx={{ width: 16 }} />
        )}
        <Typography className="widget-title" variant="body2" fontWeight={500}>
          {widget.title ?? widget.metric}
        </Typography>
        {editable && (
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Box className={`widget-body${widget.type === 'line' ? ' widget-body--chart' : ''}`}>{body}</Box>
      {editable && selected && (
        <>
          <div className="widget-resize-handle widget-resize-handle--e" onMouseDown={(e) => handleResizeStart(e, 'e')} />
          <div className="widget-resize-handle widget-resize-handle--s" onMouseDown={(e) => handleResizeStart(e, 's')} />
          <div className="widget-resize-handle widget-resize-handle--se" onMouseDown={(e) => handleResizeStart(e, 'se')} />
        </>
      )}
    </Paper>
  );
}

function DashboardEmptyState({ editable, onEdit }: { editable: boolean; onEdit?: () => void }) {
  const { t } = useTranslation();

  return (
    <Card sx={{ maxWidth: 420, mx: 'auto', my: 4 }}>
      <CardContent sx={{ textAlign: 'center', py: 5 }}>
        <Typography variant="h3" gutterBottom>
          {t('dashboards.emptyCanvasTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: editable ? 0 : 2 }}>
          {editable ? t('dashboards.emptyCanvasEdit') : t('dashboards.emptyCanvasView')}
        </Typography>
        {!editable && onEdit && (
          <Button variant="contained" sx={{ mt: 2 }} onClick={onEdit}>
            {t('dashboards.goToEdit')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardCanvas({
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
  const theme = useTheme();
  const gridRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cellWidth, setCellWidth] = useState(0);
  const { scale, scaledHeight } = useViewGridScale(wrapRef, gridRef, !editable, layout.length);
  const isScaled = !editable && scale < 1;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const capMap = Object.fromEntries(capabilities.map((c) => [c.name, c]));
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

  if (layout.length === 0) {
    return <DashboardEmptyState editable={editable} onEdit={onEdit} />;
  }

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

  return (
    <Box
      ref={wrapRef}
      className={isScaled ? 'dashboard-canvas-wrap--scaled' : undefined}
      sx={{
        overflow: isScaled ? 'hidden' : undefined,
        height: isScaled && scaledHeight ? scaledHeight : undefined,
        '--dashboard-grid-bg': theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        '--dashboard-grid-line': theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }}
    >
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <Box
          className={isScaled ? 'dashboard-grid-scale' : undefined}
          sx={
            isScaled
              ? { transform: `scale(${scale})`, width: `${100 / scale}%`, transformOrigin: 'top left' }
              : undefined
          }
        >
          <Box
            ref={gridRef}
            className={`dashboard-grid${editable ? '' : ' dashboard-grid--view'}`}
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
          </Box>
        </Box>
        <DragOverlay>
          {activeWidget ? (
            <Paper variant="outlined" sx={{ width: 220, height: 120, p: 1.5, opacity: 0.9 }}>
              <Typography variant="body2" fontWeight={500}>
                {activeWidget.title ?? activeWidget.metric}
              </Typography>
            </Paper>
          ) : null}
        </DragOverlay>
      </DndContext>
    </Box>
  );
}

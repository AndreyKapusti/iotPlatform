import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Box, Button, Card, CardContent, IconButton, Paper, Typography, useTheme } from '@mui/material';
import { Close as CloseIcon, DragIndicator as DragIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
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
import { clampWidgetSize } from '../../../shared/lib/dashboard';
import {
  BooleanIndicatorWidget,
  KpiGaugeWidget,
  LineChartWidget,
  ToggleWidget,
} from '../../../components/widgets';
import type { Capability, WidgetLayout } from '../../../types';

export const CANVAS_DROPPABLE_ID = 'dashboard-canvas';

export interface DashboardCanvasHandle {
  getGridElement: () => HTMLDivElement | null;
}

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
  wrapRef: RefObject<HTMLDivElement | null>,
  gridRef: RefObject<HTMLDivElement | null>,
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
    data: { source: 'widget', widget },
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

function DashboardEmptyState({
  editable,
  dropActive,
  onEdit,
}: {
  editable: boolean;
  dropActive: boolean;
  onEdit?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card
      className={dropActive ? 'dashboard-empty--drop-active' : undefined}
      sx={{
        maxWidth: 420,
        mx: 'auto',
        my: 4,
        borderStyle: dropActive ? 'dashed' : undefined,
        borderColor: dropActive ? 'primary.main' : undefined,
        bgcolor: dropActive ? 'action.selected' : undefined,
      }}
    >
      <CardContent sx={{ textAlign: 'center', py: 5 }}>
        <Typography variant="h3" gutterBottom>
          {dropActive ? t('dashboards.dropHere') : t('dashboards.emptyCanvasTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: editable ? 0 : 2 }}>
          {editable
            ? dropActive
              ? t('dashboards.dropHereHint')
              : t('dashboards.emptyCanvasEdit')
            : t('dashboards.emptyCanvasView')}
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

export const DashboardCanvas = forwardRef<
  DashboardCanvasHandle,
  {
    layout: WidgetLayout[];
    capabilities: Capability[];
    selectedId: string | null;
    editable: boolean;
    dropPreview: { x: number; y: number; w: number; h: number } | null;
    paletteDragging: boolean;
    onSelect: (id: string | null) => void;
    onRemove: (id: string) => void;
    onResize: (id: string, w: number, h: number) => void;
    onEdit?: () => void;
  }
>(function DashboardCanvas(
  {
    layout,
    capabilities,
    selectedId,
    editable,
    dropPreview,
    paletteDragging,
    onSelect,
    onRemove,
    onResize,
    onEdit,
  },
  ref,
) {
  const theme = useTheme();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [cellWidth, setCellWidth] = useState(0);
  const { scale, scaledHeight } = useViewGridScale(wrapRef, gridRef, !editable, layout.length);
  const isScaled = !editable && scale < 1;
  const capMap = Object.fromEntries(capabilities.map((c) => [c.name, c]));
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: CANVAS_DROPPABLE_ID,
    disabled: !editable,
  });

  useImperativeHandle(ref, () => ({
    getGridElement: () => gridRef.current,
  }));

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const update = () => setCellWidth(grid.clientWidth / GRID_COLS);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [editable, layout.length]);

  const dropActive = editable && paletteDragging && (isOver || Boolean(dropPreview));
  const showEmpty = layout.length === 0 && !dropPreview;

  return (
    <Box
      ref={(node: HTMLDivElement | null) => {
        wrapRef.current = node;
        setDroppableRef(node);
      }}
      className={[
        isScaled ? 'dashboard-canvas-wrap--scaled' : '',
        dropActive ? 'dashboard-canvas--drop-active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      sx={{
        position: 'relative',
        overflow: isScaled ? 'hidden' : undefined,
        height: isScaled && scaledHeight ? scaledHeight : undefined,
        minHeight: editable ? 480 : undefined,
        borderRadius: 1,
        outline: dropActive ? `2px dashed ${theme.palette.primary.main}` : '2px solid transparent',
        outlineOffset: 2,
        transition: 'outline-color 0.15s, background-color 0.15s',
        bgcolor: dropActive ? 'action.hover' : undefined,
        '--dashboard-grid-bg': theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        '--dashboard-grid-line': theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }}
    >
      {showEmpty ? (
        <DashboardEmptyState editable={editable} dropActive={dropActive} onEdit={onEdit} />
      ) : (
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
            className={`dashboard-grid${editable ? '' : ' dashboard-grid--view'}${dropActive ? ' dashboard-grid--drop-active' : ''}`}
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
            {dropPreview && (
              <Box
                className="dashboard-drop-preview"
                sx={{
                  gridColumn: `${dropPreview.x + 1} / span ${dropPreview.w}`,
                  gridRow: `${dropPreview.y + 1} / span ${dropPreview.h}`,
                }}
              />
            )}
          </Box>
        </Box>
      )}
      {/* Keep a hidden grid mounted while empty so drop coordinates still resolve */}
      {showEmpty && (
        <Box
          ref={gridRef}
          className="dashboard-grid"
          sx={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none', minHeight: 480 }}
          aria-hidden
        />
      )}
    </Box>
  );
});

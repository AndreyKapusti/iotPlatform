import i18n from '../../features/i18n/config';
import type { Capability, PaletteItem, WidgetLayout, WidgetType } from '../../types';

const DEFAULT_SIZES: Record<WidgetType, { w: number; h: number }> = {
  line: { w: 6, h: 4 },
  gauge: { w: 3, h: 3 },
  indicator: { w: 3, h: 2 },
  toggle: { w: 3, h: 2 },
};

export function buildPalette(capabilities: Capability[]): PaletteItem[] {
  const items: PaletteItem[] = [];

  for (const cap of capabilities) {
    if (cap.type === 'number' && cap.role === 'sensor') {
      items.push(
        { type: 'line', metric: cap.name, label: i18n.t('dashboards.paletteLine', { name: cap.name }), capability: cap },
        { type: 'gauge', metric: cap.name, label: i18n.t('dashboards.paletteGauge', { name: cap.name }), capability: cap },
      );
    } else if (cap.type === 'boolean' && cap.role === 'sensor') {
      items.push({
        type: 'indicator',
        metric: cap.name,
        label: i18n.t('dashboards.paletteIndicator', { name: cap.name }),
        capability: cap,
      });
    } else if (cap.type === 'boolean' && cap.role === 'actuator') {
      items.push({
        type: 'toggle',
        metric: cap.name,
        label: i18n.t('dashboards.paletteToggle', { name: cap.name }),
        capability: cap,
      });
    }
  }

  return items;
}

export function createWidgetId(): string {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function findNextPosition(layout: WidgetLayout[]): { x: number; y: number } {
  if (layout.length === 0) return { x: 0, y: 0 };
  const maxY = Math.max(...layout.map((w) => w.y + w.h));
  return { x: 0, y: maxY };
}

export function createWidgetFromPalette(
  item: PaletteItem,
  layout: WidgetLayout[],
  position?: { x: number; y: number },
): WidgetLayout {
  const size = DEFAULT_SIZES[item.type];
  const pos = position ?? findNextPosition(layout);
  return {
    id: createWidgetId(),
    type: item.type,
    metric: item.metric,
    title: item.capability.name,
    x: clampGrid(pos.x, 0, 12 - size.w),
    y: Math.max(0, pos.y),
    w: size.w,
    h: size.h,
  };
}

export function paletteDragId(item: PaletteItem): string {
  return `palette:${item.type}:${item.metric}`;
}

export function parsePaletteDragId(id: string): { type: WidgetType; metric: string } | null {
  if (!id.startsWith('palette:')) return null;
  const [, type, metric] = id.split(':');
  if (!type || !metric) return null;
  return { type: type as WidgetType, metric };
}

export function clampGrid(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampWidgetSize(w: number, h: number, x: number, gridCols = 12) {
  return {
    w: clampGrid(w, 2, gridCols - x),
    h: clampGrid(h, 2, 12),
  };
}

export { DEFAULT_SIZES };

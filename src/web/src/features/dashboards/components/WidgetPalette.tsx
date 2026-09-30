import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import {
  ShowChart as ChartIcon,
  DragIndicator as DragIcon,
  Speed as GaugeIcon,
  ToggleOn as ToggleIcon,
  Circle as IndicatorIcon,
} from '@mui/icons-material';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { paletteDragId } from '../../../shared/lib/dashboard';
import type { PaletteItem, WidgetType } from '../../../types';

const TYPE_ICONS: Record<WidgetType, typeof ChartIcon> = {
  line: ChartIcon,
  gauge: GaugeIcon,
  indicator: IndicatorIcon,
  toggle: ToggleIcon,
};

interface WidgetPaletteProps {
  items: PaletteItem[];
  onPreview: (item: PaletteItem) => void;
}

function PaletteChip({ item, onPreview }: { item: PaletteItem; onPreview: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: paletteDragId(item),
    data: { source: 'palette', item },
  });

  const Icon = TYPE_ICONS[item.type];
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      onClick={() => {
        if (!isDragging) onPreview();
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.75,
        borderRadius: 1,
        border: 1,
        borderColor: isDragging ? 'primary.main' : 'divider',
        bgcolor: 'background.paper',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s, background-color 0.15s',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'action.hover',
          boxShadow: 1,
        },
      }}
    >
      <Box
        component="span"
        className="palette-drag-handle"
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        sx={{
          display: 'inline-flex',
          cursor: 'grab',
          color: 'text.disabled',
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <DragIcon sx={{ fontSize: 16 }} />
      </Box>
      <Icon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
      <Typography variant="body2" sx={{ flex: 1, textAlign: 'left', lineHeight: 1.3 }}>
        {item.label}
      </Typography>
    </Box>
  );
}

export function WidgetPalette({ items, onPreview }: WidgetPaletteProps) {
  const { t } = useTranslation();

  return (
    <Card sx={{ position: { lg: 'sticky' }, top: 16 }}>
      <CardContent>
        <Typography variant="h3" gutterBottom>
          {t('dashboards.widgets')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {t('dashboards.paletteHint')}
        </Typography>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('dashboards.widgetsEmpty')}
          </Typography>
        ) : (
          <Stack spacing={0.75} className="dashboard-palette-scroll">
            {items.map((item) => (
              <PaletteChip
                key={`${item.type}-${item.metric}`}
                item={item}
                onPreview={() => onPreview(item)}
              />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export function PaletteDragOverlay({ item }: { item: PaletteItem }) {
  const Icon = TYPE_ICONS[item.type];
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 1,
        borderRadius: 1,
        border: 1,
        borderColor: 'primary.main',
        bgcolor: 'background.paper',
        boxShadow: 4,
        minWidth: 180,
        cursor: 'grabbing',
      }}
    >
      <Icon sx={{ fontSize: 16, color: 'primary.main' }} />
      <Typography variant="body2" fontWeight={500}>
        {item.label}
      </Typography>
    </Box>
  );
}

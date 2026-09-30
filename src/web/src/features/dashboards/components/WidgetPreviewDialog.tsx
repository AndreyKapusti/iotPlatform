import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import {
  ShowChart as ChartIcon,
  DragIndicator as DragIcon,
  Speed as GaugeIcon,
  ToggleOn as ToggleIcon,
  Circle as IndicatorIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { PaletteItem, WidgetType } from '../../../types';

const TYPE_ICONS: Record<WidgetType, typeof ChartIcon> = {
  line: ChartIcon,
  gauge: GaugeIcon,
  indicator: IndicatorIcon,
  toggle: ToggleIcon,
};

function PreviewMock({ type }: { type: WidgetType }) {
  if (type === 'line') {
    return (
      <Box
        sx={{
          height: 140,
          borderRadius: 1,
          bgcolor: 'action.hover',
          position: 'relative',
          overflow: 'hidden',
          px: 1.5,
          py: 1,
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 280 120" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            opacity={0.75}
            points="0,90 40,70 80,85 120,40 160,55 200,30 240,45 280,20"
          />
          <polyline
            fill="url(#previewFill)"
            stroke="none"
            points="0,120 0,90 40,70 80,85 120,40 160,55 200,30 240,45 280,20 280,120"
            opacity={0.15}
          />
        </svg>
      </Box>
    );
  }

  if (type === 'gauge') {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: 140 }}>
        <Box
          sx={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: 'conic-gradient(#0f766e 68%, rgba(128,128,128,0.25) 68%)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              bgcolor: 'background.paper',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Typography variant="h3" color="primary.main">
              68
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  if (type === 'indicator') {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: 140 }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: 999,
            bgcolor: 'success.main',
            color: 'success.contrastText',
          }}
        >
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'currentColor' }} />
          <Typography variant="body2" fontWeight={600}>
            ON
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', height: 140 }}>
      <Box
        sx={{
          width: 44,
          height: 26,
          borderRadius: 13,
          bgcolor: 'primary.main',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 3,
            right: 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            bgcolor: 'common.white',
          }}
        />
      </Box>
    </Box>
  );
}

interface WidgetPreviewDialogProps {
  item: PaletteItem | null;
  open: boolean;
  onClose: () => void;
  onAdd: (item: PaletteItem) => void;
}

export function WidgetPreviewDialog({ item, open, onClose, onAdd }: WidgetPreviewDialogProps) {
  const { t } = useTranslation();
  if (!item) return null;

  const Icon = TYPE_ICONS[item.type];
  const typeLabel = t(`dashboards.widgetType.${item.type}`);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Icon fontSize="small" color="primary" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3" noWrap>
              {item.capability.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {typeLabel}
              {item.capability.unit ? ` · ${item.capability.unit}` : ''}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
            mb: 1.5,
          }}
        >
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="body2" fontWeight={500}>
              {item.capability.name}
            </Typography>
          </Box>
          <Box sx={{ p: 1.5, color: 'primary.main' }}>
            <PreviewMock type={item.type} />
          </Box>
        </Box>
        <Stack direction="row" spacing={0.75} alignItems="center" color="text.secondary">
          <DragIcon sx={{ fontSize: 16 }} />
          <Typography variant="caption">{t('dashboards.previewDragHint')}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          onClick={() => {
            onAdd(item);
            onClose();
          }}
        >
          {t('dashboards.addToDashboard')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

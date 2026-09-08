import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { WidgetAccent, WidgetLayout } from '../../../types';

const ACCENT_LABEL_KEYS: Record<WidgetAccent, string> = {
  default: 'dashboards.accentDefault',
  blue: 'dashboards.accentBlue',
  amber: 'dashboards.accentAmber',
  rose: 'dashboards.accentRose',
  green: 'dashboards.accentGreen',
  slate: 'dashboards.accentSlate',
};
const ACCENT_COLORS: Record<WidgetAccent, string> = {
  default: '#0f766e',
  blue: '#1e40af',
  amber: '#b45309',
  rose: '#be123c',
  green: '#047857',
  slate: '#475569',
};

interface PropertiesPanelProps {
  widget: WidgetLayout | null;
  onChange: (patch: Partial<WidgetLayout>) => void;
  onDelete: () => void;
}

export function PropertiesPanel({ widget, onChange, onDelete }: PropertiesPanelProps) {
  const { t } = useTranslation();

  const accentOptions = useMemo(
    () =>
      (Object.keys(ACCENT_COLORS) as WidgetAccent[]).map((value) => ({
        value,
        label: t(ACCENT_LABEL_KEYS[value]),
        color: ACCENT_COLORS[value],
      })),
    [t],
  );

  return (
    <Card sx={{ position: { lg: 'sticky' }, top: 16 }}>
      <CardContent>
        <Typography variant="h3" gutterBottom>
          {t('dashboards.properties')}
        </Typography>
        {!widget ? (
          <Typography variant="body2" color="text.secondary">
            {t('dashboards.selectWidget')}
          </Typography>
        ) : (
          <Stack spacing={2}>
            <TextField
              label={t('dashboards.widgetTitle')}
              value={widget.title ?? ''}
              onChange={(e) => onChange({ title: e.target.value })}
            />
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                {t('dashboards.widgetColor')}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {accentOptions.map(({ value, label, color }) => (
                  <Box
                    key={value}
                    component="button"
                    type="button"
                    aria-label={label}
                    aria-pressed={(widget.accent ?? 'default') === value}
                    onClick={() => onChange({ accent: value })}
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: 2,
                      borderColor: (widget.accent ?? 'default') === value ? 'text.primary' : 'divider',
                      bgcolor: color,
                      cursor: 'pointer',
                      p: 0,
                    }}
                  />
                ))}
              </Stack>
            </Box>
            <TextField
              label={t('dashboards.widgetWidth')}
              type="number"
              inputProps={{ min: 2, max: 12 }}
              value={widget.w}
              onChange={(e) => onChange({ w: Number(e.target.value) })}
            />
            <TextField
              label={t('dashboards.widgetHeight')}
              type="number"
              inputProps={{ min: 2, max: 12 }}
              value={widget.h}
              onChange={(e) => onChange({ h: Number(e.target.value) })}
            />
            <Button color="error" variant="outlined" onClick={onDelete}>
              {t('dashboards.deleteWidget')}
            </Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

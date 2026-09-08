import { Button, Card, CardContent, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { PaletteItem } from '../../../types';

interface WidgetPaletteProps {
  items: PaletteItem[];
  onAdd: (item: PaletteItem) => void;
}

export function WidgetPalette({ items, onAdd }: WidgetPaletteProps) {
  const { t } = useTranslation();

  return (
    <Card sx={{ position: { lg: 'sticky' }, top: 16 }}>
      <CardContent>
        <Typography variant="h3" gutterBottom>
          {t('dashboards.widgets')}
        </Typography>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('dashboards.widgetsEmpty')}
          </Typography>
        ) : (
          <div className="dashboard-palette-scroll">
            {items.map((item) => (
              <Button
                key={`${item.type}-${item.metric}`}
                variant="outlined"
                size="small"
                onClick={() => onAdd(item)}
                sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                {item.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../app/hooks';
import { selectOfflineThresholdMs } from '../../features/ui/uiSlice';
import { isDeviceOnline } from '../lib/format';

interface DeviceStatusChipProps {
  lastSeenAt: string | null;
  size?: 'small' | 'medium';
}

export function DeviceStatusChip({ lastSeenAt, size = 'small' }: DeviceStatusChipProps) {
  const { t } = useTranslation();
  const thresholdMs = useAppSelector(selectOfflineThresholdMs);
  const online = isDeviceOnline(lastSeenAt, thresholdMs);
  return (
    <Chip
      size={size}
      label={online ? t('common.online') : t('common.offline')}
      color={online ? 'success' : 'default'}
      variant={online ? 'filled' : 'outlined'}
      sx={{
        alignSelf: 'flex-start',
        '& .MuiChip-label': {
          display: 'flex',
          alignItems: 'center',
          lineHeight: 1.2,
        },
      }}
    />
  );
}

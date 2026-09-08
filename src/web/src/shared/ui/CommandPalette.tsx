import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  DevicesOther as DevicesIcon,
  History as EventsIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useListDevicesQuery } from '../../features/devices/api/devicesApi';
import { useFleetMeta } from '../hooks/useFleetMeta';
import { usePinnedDevices } from '../hooks/usePinnedDevices';
import { isDeviceOnline } from '../lib/format';
import { useAppSelector } from '../../app/hooks';
import { selectOfflineThresholdMs } from '../../features/ui/uiSlice';

interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  to: string;
  icon: ReactNode;
  keywords?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const thresholdMs = useAppSelector(selectOfflineThresholdMs);
  const { data: devices = [] } = useListDevicesQuery(undefined, { skip: !open });
  const { dashboards } = useFleetMeta(devices);
  const { pinned } = usePinnedDevices();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const navItems: CommandItem[] = useMemo(
    () => [
      { id: 'nav-overview', label: t('nav.overview'), to: '/', icon: <HomeIcon fontSize="small" /> },
      { id: 'nav-events', label: t('nav.events'), to: '/events', icon: <EventsIcon fontSize="small" /> },
      { id: 'nav-devices', label: t('nav.devices'), to: '/devices', icon: <DevicesIcon fontSize="small" /> },
      { id: 'nav-profile', label: t('nav.profile'), to: '/profile', icon: <PersonIcon fontSize="small" /> },
      { id: 'nav-settings', label: t('nav.settings'), to: '/settings', icon: <SettingsIcon fontSize="small" /> },
    ],
    [t],
  );

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result: CommandItem[] = [...navItems];

    const pinnedSet = new Set(pinned);
    const sortedDevices = [...devices].sort((a, b) => {
      const aPin = pinnedSet.has(a.id) ? 0 : 1;
      const bPin = pinnedSet.has(b.id) ? 0 : 1;
      return aPin - bPin || a.name.localeCompare(b.name);
    });

    for (const device of sortedDevices) {
      const online = isDeviceOnline(device.last_seen_at, thresholdMs);
      result.push({
        id: `device-${device.id}`,
        label: device.name,
        subtitle: online ? t('common.online') : t('common.offline'),
        to: `/devices/${device.id}`,
        icon: <DevicesIcon fontSize="small" color={online ? 'success' : 'disabled'} />,
        keywords: `${device.id}`,
      });
    }

    for (const dash of dashboards) {
      result.push({
        id: `dash-${dash.id}`,
        label: dash.name,
        subtitle: dash.deviceName,
        to: `/devices/${dash.device_id}/dashboards/${dash.id}`,
        icon: <DashboardIcon fontSize="small" />,
        keywords: `${dash.device_id}`,
      });
    }

    if (!q) return result;

    return result.filter((item) => {
      const hay = `${item.label} ${item.subtitle ?? ''} ${item.keywords ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [navItems, devices, dashboards, pinned, query, thresholdMs, t]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && items[activeIndex]) {
      e.preventDefault();
      go(items[activeIndex].to);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
          <TextField
            inputRef={inputRef}
            fullWidth
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {t('search.hint')}
          </Typography>
        </Box>
        <List dense sx={{ maxHeight: 360, overflow: 'auto', pb: 1 }}>
          {items.length === 0 ? (
            <Box sx={{ px: 2, py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t('search.noResults')}
              </Typography>
            </Box>
          ) : (
            items.map((item, index) => (
              <ListItemButton
                key={item.id}
                selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => go(item.to)}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} secondary={item.subtitle} />
              </ListItemButton>
            ))
          )}
        </List>
      </DialogContent>
    </Dialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return { open, setOpen };
}

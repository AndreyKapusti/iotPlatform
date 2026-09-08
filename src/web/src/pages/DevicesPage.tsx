import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Dashboard as DashboardIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../app/hooks';
import { DeviceSparkline } from '../features/devices/components/DeviceSparkline';
import {
  useCreateDeviceMutation,
  useDeleteDeviceMutation,
  useListDevicesQuery,
} from '../features/devices/api/devicesApi';
import { selectOfflineThresholdMs } from '../features/ui/uiSlice';
import { extractErrorMessage } from '../shared/api/baseApi';
import { useFleetMeta } from '../shared/hooks/useFleetMeta';
import { sortWithPinnedFirst, usePinnedDevices } from '../shared/hooks/usePinnedDevices';
import { formatDate, formatRelativeTime, isDeviceOnline, isStaleLastSeen } from '../shared/lib/format';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { DeviceStatusChip } from '../shared/ui/DeviceStatusChip';
import { EmptyStateCard } from '../shared/ui/EmptyState';
import { FilterPanel } from '../shared/ui/FilterPanel';
import { TableSkeleton } from '../shared/ui/LoadingState';
import { PageHeader } from '../shared/ui/PageHeader';
import type { Device } from '../types';

type StatusFilter = 'all' | 'online' | 'offline';
type QuickFilter = 'all' | 'stale24h' | 'noDashboard' | 'noAnnounce';
type SortKey = 'name' | 'activity' | 'created';

const STALE_24H_MS = 24 * 60 * 60 * 1000;

export function DevicesPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const thresholdMs = useAppSelector(selectOfflineThresholdMs);
  const { pinned, toggle, isPinned } = usePinnedDevices();
  const { data: devices = [], isLoading, isError, error, refetch } = useListDevicesQuery(undefined, {
    pollingInterval: 15_000,
  });
  const { meta: fleetMeta } = useFleetMeta(devices);
  const [createDevice, { isLoading: creating }] = useCreateDeviceMutation();
  const [deleteDevice, { isLoading: deleting }] = useDeleteDeviceMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('activity');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuDeviceId, setMenuDeviceId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = devices.filter((device) => {
      if (q) {
        const hay = `${device.name} ${device.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter === 'online') return isDeviceOnline(device.last_seen_at, thresholdMs);
      if (statusFilter === 'offline') return !isDeviceOnline(device.last_seen_at, thresholdMs);

      const deviceMeta = fleetMeta[device.id];
      if (quickFilter === 'stale24h') return isStaleLastSeen(device.last_seen_at, STALE_24H_MS);
      if (quickFilter === 'noDashboard') return (deviceMeta?.dashboardCount ?? 0) === 0;
      if (quickFilter === 'noAnnounce') return (deviceMeta?.capabilityCount ?? 0) === 0;

      return true;
    });

    list = sortWithPinnedFirst(list, pinned);

    const pinnedSet = new Set(pinned);
    const sortFn = (a: Device, b: Device) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'created') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
      const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
      return tb - ta;
    };

    const pinnedItems = list.filter((d) => pinnedSet.has(d.id)).sort(sortFn);
    const rest = list.filter((d) => !pinnedSet.has(d.id)).sort(sortFn);
    return [...pinnedItems, ...rest];
  }, [devices, search, statusFilter, quickFilter, sortKey, pinned, thresholdMs, fleetMeta]);

  const openMenu = (event: React.MouseEvent<HTMLElement>, deviceId: number) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuDeviceId(deviceId);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuDeviceId(null);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const device = await createDevice({ name }).unwrap();
      setCreateOpen(false);
      setNewName('');
      enqueueSnackbar(t('devices.createdSuccess'), { variant: 'success' });
      navigate(`/devices/${device.id}`);
    } catch (err) {
      enqueueSnackbar(extractErrorMessage(err as Parameters<typeof extractErrorMessage>[0]), {
        variant: 'error',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDevice(deleteTarget.id).unwrap();
      enqueueSnackbar(t('devices.deletedSuccess'), { variant: 'success' });
      setDeleteTarget(null);
    } catch (err) {
      enqueueSnackbar(extractErrorMessage(err as Parameters<typeof extractErrorMessage>[0]), {
        variant: 'error',
      });
    }
  };

  return (
    <>
      <PageHeader
        title={t('devices.title')}
        subtitle={t('devices.subtitle')}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            {t('devices.add')}
          </Button>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={() => void refetch()}>{t('common.retry')}</Button>}>
          {extractErrorMessage(error as Parameters<typeof extractErrorMessage>[0])}
        </Alert>
      )}

      {!isLoading && devices.length > 0 && (
        <FilterPanel>
          <TextField
            placeholder={t('devices.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            flexWrap="wrap"
            useFlexGap
          >
            <ToggleButtonGroup
              size="small"
              exclusive
              value={statusFilter}
              onChange={(_, value: StatusFilter | null) => value && setStatusFilter(value)}
              sx={{ flexShrink: 0 }}
            >
              <ToggleButton value="all">{t('devices.filterAll')}</ToggleButton>
              <ToggleButton value="online">{t('common.online')}</ToggleButton>
              <ToggleButton value="offline">{t('common.offline')}</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={sortKey}
              onChange={(_, value: SortKey | null) => value && setSortKey(value)}
              sx={{ ml: { sm: 'auto' }, flexShrink: 0 }}
            >
              <ToggleButton value="activity">{t('devices.sortActivity')}</ToggleButton>
              <ToggleButton value="name">{t('devices.sortName')}</ToggleButton>
              <ToggleButton value="created">{t('devices.sortCreated')}</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              {t('devices.quickFilters')}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {(
                [
                  ['all', t('devices.filterAll')],
                  ['stale24h', t('devices.filterStale24h')],
                  ['noDashboard', t('devices.filterNoDashboard')],
                  ['noAnnounce', t('devices.filterNoAnnounce')],
                ] as const
              ).map(([value, label]) => (
                <Chip
                  key={value}
                  label={label}
                  size="small"
                  variant={quickFilter === value ? 'filled' : 'outlined'}
                  color={quickFilter === value ? 'primary' : 'default'}
                  onClick={() => setQuickFilter(value)}
                />
              ))}
            </Stack>
          </Box>
        </FilterPanel>
      )}

      {isLoading ? (
        <Card>
          <TableSkeleton />
        </Card>
      ) : devices.length === 0 ? (
        <EmptyStateCard
          icon={<DashboardIcon />}
          title={t('devices.emptyTitle')}
          description={t('devices.emptyDesc')}
          actionLabel={t('devices.add')}
          onAction={() => setCreateOpen(true)}
        />
      ) : filteredDevices.length === 0 ? (
        <Card sx={{ p: 3 }}>
          <Typography color="text.secondary">{t('devices.noResults')}</Typography>
        </Card>
      ) : (
        <Card>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 720, tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ width: 48 }} />
                  <TableCell sx={{ width: '22%' }}>{t('common.name')}</TableCell>
                  <TableCell sx={{ width: 72 }}>ID</TableCell>
                  <TableCell sx={{ width: 110 }}>{t('common.status')}</TableCell>
                  {!isCompact && (
                    <TableCell sx={{ width: 96 }}>{t('devices.sparkline')}</TableCell>
                  )}
                  <TableCell sx={{ width: '18%' }}>{t('devices.lastActivity')}</TableCell>
                  {!isCompact && (
                    <TableCell sx={{ width: 120 }}>{t('common.created')}</TableCell>
                  )}
                  <TableCell align="right" sx={{ width: isCompact ? 56 : 140 }}>
                    {t('common.actions')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDevices.map((device) => (
                  <TableRow
                    key={device.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/devices/${device.id}`)}
                  >
                    <TableCell padding="checkbox">
                      <Tooltip title={isPinned(device.id) ? t('devices.unpin') : t('devices.pin')}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(device.id);
                          }}
                          color={isPinned(device.id) ? 'warning' : 'default'}
                        >
                          {isPinned(device.id) ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ overflow: 'hidden' }}>
                      <Typography fontWeight={500} noWrap title={device.name}>
                        {device.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {device.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <DeviceStatusChip lastSeenAt={device.last_seen_at} />
                    </TableCell>
                    {!isCompact && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DeviceSparkline deviceId={device.id} />
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {formatRelativeTime(device.last_seen_at)}
                      </Typography>
                      {!isCompact && (
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {formatDate(device.last_seen_at)}
                        </Typography>
                      )}
                    </TableCell>
                    {!isCompact && (
                      <TableCell>
                        <Typography variant="body2" noWrap>
                          {formatDate(device.created_at)}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                        {!isCompact && (
                          <Button
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/devices/${device.id}/dashboards`);
                            }}
                          >
                            {t('devices.dashboards')}
                          </Button>
                        )}
                        <IconButton size="small" onClick={(e) => openMenu(e, device.id)}>
                          <MoreVertIcon />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            if (menuDeviceId != null) navigate(`/devices/${menuDeviceId}`);
            closeMenu();
          }}
        >
          {t('common.open')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuDeviceId != null) navigate(`/devices/${menuDeviceId}/dashboards`);
            closeMenu();
          }}
        >
          {t('devices.dashboards')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuDeviceId != null) toggle(menuDeviceId);
            closeMenu();
          }}
        >
          {menuDeviceId != null && isPinned(menuDeviceId) ? t('devices.unpin') : t('devices.pin')}
        </MenuItem>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            const device = devices.find((d) => d.id === menuDeviceId);
            if (device) setDeleteTarget({ id: device.id, name: device.name });
            closeMenu();
          }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          {t('common.delete')}
        </MenuItem>
      </Menu>

      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('devices.newTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t('devices.namePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            sx={{ mt: 1 }}
            onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={() => void handleCreate()} disabled={creating || !newName.trim()}>
            {creating ? t('common.creating') : t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('devices.deleteTitle')}
        description={t('devices.deleteDesc', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, FileCopy as DuplicateIcon, OpenInNew as OpenIcon } from '@mui/icons-material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useCreateDashboardMutation,
  useDeleteDashboardMutation,
  useLazyGetDashboardQuery,
  useListDashboardsQuery,
  useSaveDashboardMutation,
} from '../features/dashboards/api/dashboardsApi';
import { useGetDeviceQuery } from '../features/devices/api/devicesApi';
import { extractErrorMessage } from '../shared/api/baseApi';
import { formatDate } from '../shared/lib/format';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { EmptyStateCard } from '../shared/ui/EmptyState';
import { LoadingState } from '../shared/ui/LoadingState';
import { PageHeader } from '../shared/ui/PageHeader';

export function DashboardsListPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const deviceId = Number(id);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const { data: device } = useGetDeviceQuery(deviceId, { skip: !deviceId });
  const { data: items = [], isLoading, isError, error, refetch } = useListDashboardsQuery(deviceId, {
    skip: !deviceId,
  });
  const [createDashboard, { isLoading: creating }] = useCreateDashboardMutation();
  const [deleteDashboard, { isLoading: deleting }] = useDeleteDashboardMutation();
  const [saveDashboard] = useSaveDashboardMutation();
  const [fetchDashboard] = useLazyGetDashboardQuery();

  const [name, setName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  const onCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || !deviceId) return;
    try {
      const dash = await createDashboard({ deviceId, name: trimmed }).unwrap();
      navigate(`/devices/${deviceId}/dashboards/${dash.id}`);
    } catch (err) {
      enqueueSnackbar(extractErrorMessage(err as Parameters<typeof extractErrorMessage>[0]), {
        variant: 'error',
      });
    }
  };

  const onDelete = async () => {
    if (!deleteTarget || !deviceId) return;
    try {
      await deleteDashboard({ dashboardId: deleteTarget.id, deviceId }).unwrap();
      enqueueSnackbar(t('dashboards.deletedSuccess'), { variant: 'success' });
      setDeleteTarget(null);
    } catch (err) {
      enqueueSnackbar(extractErrorMessage(err as Parameters<typeof extractErrorMessage>[0]), {
        variant: 'error',
      });
    }
  };

  const onDuplicate = async (item: { id: number; name: string }) => {
    if (!deviceId) return;
    setDuplicatingId(item.id);
    try {
      const source = await fetchDashboard(item.id).unwrap();
      const created = await createDashboard({
        deviceId,
        name: t('dashboards.duplicateName', { name: item.name }),
      }).unwrap();
      await saveDashboard({
        dashboardId: created.id,
        name: created.name,
        layout: source.layout,
      }).unwrap();
      enqueueSnackbar(t('dashboards.duplicatedSuccess'), { variant: 'success' });
      navigate(`/devices/${deviceId}/dashboards/${created.id}`);
    } catch (err) {
      enqueueSnackbar(extractErrorMessage(err as Parameters<typeof extractErrorMessage>[0]), {
        variant: 'error',
      });
    } finally {
      setDuplicatingId(null);
    }
  };

  if (!deviceId) {
    return <Alert severity="error">{t('device.invalidId')}</Alert>;
  }

  return (
    <>
      <PageHeader
        title={t('dashboards.title')}
        subtitle={device ? t('dashboards.deviceSubtitle', { name: device.name }) : undefined}
        breadcrumbs={[
          { label: t('devices.title'), to: '/devices' },
          { label: device?.name ?? '…', to: `/devices/${deviceId}` },
          { label: t('dashboards.title') },
        ]}
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={() => void refetch()}>{t('common.retry')}</Button>}>
          {extractErrorMessage(error as Parameters<typeof extractErrorMessage>[0])}
        </Alert>
      )}

      <Card sx={{ p: 3, mb: 3 }}>
        <Typography variant="h3" gutterBottom>
          {t('dashboards.new')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            placeholder={t('dashboards.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ maxLength: 100 }}
            onKeyDown={(e) => e.key === 'Enter' && void onCreate()}
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={creating || !name.trim()}
            onClick={() => void onCreate()}
            sx={{ flexShrink: 0 }}
          >
            {creating ? t('common.creating') : t('common.create')}
          </Button>
        </Stack>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyStateCard
          title={t('dashboards.emptyTitle')}
          description={t('dashboards.emptyDesc')}
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('common.name')}</TableCell>
                  <TableCell>{t('common.updated')}</TableCell>
                  <TableCell align="right">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography
                        component={RouterLink}
                        to={`/devices/${deviceId}/dashboards/${item.id}`}
                        color="primary"
                        fontWeight={500}
                        sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {item.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatDate(item.updated_at ?? item.created_at ?? null)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button
                          size="small"
                          disabled={duplicatingId === item.id}
                          startIcon={<DuplicateIcon />}
                          onClick={() => void onDuplicate(item)}
                        >
                          {duplicatingId === item.id ? t('common.creating') : t('dashboards.duplicate')}
                        </Button>
                        <Button
                          size="small"
                          component={RouterLink}
                          to={`/devices/${deviceId}/dashboards/${item.id}`}
                          startIcon={<OpenIcon />}
                        >
                          {t('common.open')}
                        </Button>
                        <IconButton
                          size="small"
                          color="error"
                          aria-label={t('common.delete')}
                          onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                        >
                          <DeleteIcon fontSize="small" />
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('dashboards.deleteTitle')}
        description={t('dashboards.deleteDesc', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void onDelete()}
      />
    </>
  );
}

import { useState } from 'react';
import { Alert, Box, Button, Card, Stack, TextField, Typography } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { extractErrorMessage } from '../shared/api/baseApi';
import { useCreateSharedDashboardMutation, useDeleteSharedDashboardMutation, useListSharedDashboardsQuery } from '../features/dashboards/api/sharedDashboardApi';

export function SharedDashboardsPage() {
  const { i18n } = useTranslation(); const ru = i18n.language.startsWith('ru');
  const { data: items = [], isLoading } = useListSharedDashboardsQuery();
  const [create, { isLoading: creating }] = useCreateSharedDashboardMutation(); const [remove] = useDeleteSharedDashboardMutation();
  const [name, setName] = useState(''); const [error, setError] = useState(''); const navigate = useNavigate();
  return <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 3 } }}>
    <Typography variant="h1" gutterBottom>{ru ? 'Общие дашборды' : 'Shared dashboards'}</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>{ru ? 'Показания и управление устройств вашего аккаунта на одном экране.' : 'Readings and controls from your devices on one screen.'}</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    <Card variant="outlined" sx={{ p: 2, mb: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <TextField fullWidth label={ru ? 'Название' : 'Name'} value={name} onChange={(e) => setName(e.target.value)} />
      <Button variant="contained" disabled={creating || !name.trim()} onClick={() => void (async () => { try { const d = await create({ name: name.trim(), layout: [] }).unwrap(); navigate(`/shared-dashboards/${d.id}`); } catch (e) { setError(extractErrorMessage(e)); } })()}>{ru ? 'Создать' : 'Create'}</Button>
    </Stack></Card>
    {isLoading && <Typography>{ru ? 'Загрузка…' : 'Loading…'}</Typography>}
    {!isLoading && !items.length && <Typography color="text.secondary">{ru ? 'Пока нет общих дашбордов.' : 'No shared dashboards yet.'}</Typography>}
    {items.map((item) => <Card variant="outlined" key={item.id} sx={{ p: 2, mb: 1 }}><Stack direction="row" alignItems="center" spacing={1}>
      <Typography sx={{ flex: 1 }}>{item.name}</Typography><Button component={Link} to={`/shared-dashboards/${item.id}`}>{ru ? 'Открыть' : 'Open'}</Button>
      <Button color="error" onClick={() => { if (window.confirm(ru ? 'Удалить дашборд?' : 'Delete dashboard?')) void remove(item.id).unwrap().catch((e) => setError(extractErrorMessage(e))); }}>{ru ? 'Удалить' : 'Delete'}</Button>
    </Stack></Card>)}
  </Box>;
}

import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, Grid, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { ArrowDownward, ArrowUpward, Delete } from '@mui/icons-material';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BooleanIndicatorWidget, KpiGaugeWidget, LineChartWidget, ToggleWidget } from '../components/widgets';
import { useGetAutomationCapabilitiesQuery, type CapabilityRef } from '../features/automation/api';
import { useGetSharedDashboardQuery, useSaveSharedDashboardMutation, type SharedWidget } from '../features/dashboards/api/sharedDashboardApi';
import { TelemetryProvider } from '../features/telemetry/hooks/useTelemetry';
import { extractErrorMessage } from '../shared/api/baseApi';
import type { Capability, WidgetType } from '../types';

function widgetTypes(cap: CapabilityRef): WidgetType[] {
  if (cap.type === 'number' && cap.role === 'sensor') return ['line', 'gauge'];
  if (cap.type === 'boolean' && cap.role === 'sensor') return ['indicator'];
  if (cap.type === 'boolean' && cap.role === 'actuator') return ['toggle'];
  return [];
}

function WidgetGroup({ deviceId, widgets, caps, editing, onRemove, onMove }: { deviceId: number; widgets: SharedWidget[]; caps: CapabilityRef[]; editing: boolean; onRemove: (id: string) => void; onMove: (id: string, direction: number) => void }) {
  const metrics = useMemo(() => [...new Set(widgets.map((w) => w.metric))], [widgets]);
  return <TelemetryProvider deviceId={deviceId} metrics={metrics}><Grid container spacing={2}>{widgets.map((w) => {
    const cap = caps.find((c) => c.device_id === w.device_id && c.name === w.metric);
    const capability = cap ? { ...cap, schema_version: 1 } as Capability : undefined;
    const common = { metric: w.metric, capability };
    return <Grid item xs={12} md={w.type === 'line' ? 6 : 3} key={w.id}><Card variant="outlined" sx={{ p: 2, height: 250 }}>
      <Stack direction="row" alignItems="center"><Typography sx={{ flex: 1 }} variant="subtitle1">{w.title || w.metric}</Typography>
        {editing && <><IconButton size="small" onClick={() => onMove(w.id, -1)}><ArrowUpward /></IconButton><IconButton size="small" onClick={() => onMove(w.id, 1)}><ArrowDownward /></IconButton><IconButton size="small" onClick={() => onRemove(w.id)}><Delete /></IconButton></>}
      </Stack><Box sx={{ height: 190, display: 'grid', placeItems: 'center', '& > *': { width: '100%' } }}>
        {!cap ? <Alert severity="warning">Capability unavailable</Alert> : w.type === 'line' ? <LineChartWidget {...common} /> : w.type === 'gauge' ? <KpiGaugeWidget {...common} /> : w.type === 'indicator' ? <BooleanIndicatorWidget metric={w.metric} /> : <ToggleWidget {...common} />}
      </Box></Card></Grid>;
  })}</Grid></TelemetryProvider>;
}

export function SharedDashboardPage() {
  const { i18n } = useTranslation(); const ru = i18n.language.startsWith('ru'); const { dashboardId } = useParams(); const id = Number(dashboardId);
  const { data, isLoading, error: loadError } = useGetSharedDashboardQuery(id, { skip: !id });
  const { data: caps = [] } = useGetAutomationCapabilitiesQuery(); const [save, saveState] = useSaveSharedDashboardMutation();
  const [name, setName] = useState(''); const [layout, setLayout] = useState<SharedWidget[]>([]); const [editing, setEditing] = useState(false); const [error, setError] = useState('');
  const [selected, setSelected] = useState(''); const [type, setType] = useState<WidgetType>('line');
  useEffect(() => { if (data && !editing) { setName(data.name); setLayout(data.layout); } }, [data, editing]);
  const available = caps.filter((c) => widgetTypes(c).length); const cap = available.find((c) => JSON.stringify([c.device_id, c.name]) === selected);
  const groups = useMemo(() => [...new Set(layout.map((w) => w.device_id))], [layout]);
  if (isLoading) return <Typography>Loading…</Typography>;
  if (loadError || !data) return <Alert severity="error">{loadError ? extractErrorMessage(loadError) : 'Dashboard not found'}</Alert>;
  const onMove = (widgetId: string, direction: number) => setLayout((old) => {
    const index = old.findIndex((w) => w.id === widgetId); const target = index + direction;
    if (index < 0 || target < 0 || target >= old.length || old[index].device_id !== old[target].device_id) return old;
    const next = [...old]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  return <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 3 } }}>
    <Button component={Link} to="/shared-dashboards">← {ru ? 'Общие дашборды' : 'Shared dashboards'}</Button>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ my: 2 }}>
      {editing ? <TextField value={name} onChange={(e) => setName(e.target.value)} label={ru ? 'Название' : 'Name'} /> : <Typography variant="h1" sx={{ flex: 1 }}>{name}</Typography>}
      {editing ? <><Button variant="contained" disabled={saveState.isLoading || !name.trim()} onClick={() => void (async () => { try { await save({ id, name: name.trim(), layout }).unwrap(); setEditing(false); setError(''); } catch (e) { setError(extractErrorMessage(e)); } })()}>{ru ? 'Сохранить' : 'Save'}</Button>
        <Button onClick={() => { setLayout(data.layout); setName(data.name); setEditing(false); }}>{ru ? 'Отмена' : 'Cancel'}</Button></> : <Button variant="outlined" onClick={() => setEditing(true)}>{ru ? 'Изменить' : 'Edit'}</Button>}
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {editing && <Card variant="outlined" sx={{ p: 2, mb: 2 }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
      <TextField select fullWidth label={ru ? 'Устройство и метрика' : 'Device and metric'} value={selected} onChange={(e) => { const value = e.target.value; setSelected(value); const next = available.find((c) => JSON.stringify([c.device_id, c.name]) === value); if (next) setType(widgetTypes(next)[0]); }}>
        {available.map((c) => <MenuItem key={JSON.stringify([c.device_id, c.name])} value={JSON.stringify([c.device_id, c.name])}>{c.device_name} · {c.name}</MenuItem>)}
      </TextField>
      <TextField select label={ru ? 'Виджет' : 'Widget'} value={cap ? type : ''} sx={{ minWidth: 150 }} onChange={(e) => setType(e.target.value as WidgetType)}>{cap && widgetTypes(cap).map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</TextField>
      <Button variant="outlined" disabled={!cap} onClick={() => cap && setLayout((old) => [...old, { id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, device_id: cap.device_id, metric: cap.name, title: cap.name, type }])}>{ru ? 'Добавить' : 'Add'}</Button>
    </Stack></Card>}
    {!layout.length && <Alert severity="info">{ru ? 'Добавьте виджеты с нужных устройств.' : 'Add widgets from your devices.'}</Alert>}
    {groups.map((deviceId) => <Box key={deviceId} sx={{ mb: 3 }}><Typography variant="h3" sx={{ mb: 1 }}>{caps.find((c) => c.device_id === deviceId)?.device_name ?? `Device ${deviceId}`}</Typography>
      <WidgetGroup deviceId={deviceId} widgets={layout.filter((w) => w.device_id === deviceId)} caps={caps} editing={editing} onRemove={(widgetId) => setLayout((old) => old.filter((w) => w.id !== widgetId))} onMove={onMove} />
    </Box>)}
  </Box>;
}

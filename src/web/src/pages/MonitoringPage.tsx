import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { useListDevicesQuery } from '../features/devices/api/devicesApi';
import { useGetMonitoringQuery, useGetMonitoringEventsQuery, type MonitorEvent } from '../features/monitoring/api';
import { getWebSocketUrl } from '../shared/lib/format';
import { PageHeader } from '../shared/ui/PageHeader';

const clock = (raw: string) => new Date(raw).toLocaleTimeString();
const duration = (sec: number) => sec >= 60 ? `${Math.floor(sec / 60)}м ${Math.round(sec % 60)}с` : `${sec.toFixed(1)}с`;

function describe(event: MonitorEvent, ru: boolean): string {
  const details: string[] = [];
  const gap = Number(event.gap_seconds);
  if (gap > 5) details.push(ru ? `Пауза ${duration(gap)}` : `Gap ${gap.toFixed(1)} s`);
  const previous = event.previous_metadata;
  if (previous?.boot_id && event.metadata.boot_id && previous.boot_id !== event.metadata.boot_id) details.push(ru ? 'Перезапуск устройства' : 'Device restarted');
  if (previous?.boot_id && previous.boot_id === event.metadata.boot_id) {
    const reconnects = (event.metadata.mqtt_reconnects ?? 0) - (previous.mqtt_reconnects ?? 0);
    if (reconnects > 0) details.push(ru ? `Переподключений MQTT: ${reconnects}` : `MQTT reconnects: ${reconnects}`);
  }
  return details.join(' · ') || (ru ? 'Изменение состояния' : 'State changed');
}

export function MonitoringPage() {
  const { t, i18n } = useTranslation();
  const ru = !i18n.language.startsWith('en');
  const { data: devices = [], isLoading: devicesLoading, isError: devicesError } = useListDevicesQuery();
  const [deviceId, setDeviceId] = useState<number>(0);
  const { currentData: data, isFetching, isError, refetch } = useGetMonitoringQuery(deviceId, { skip: !deviceId, pollingInterval: 3000 });
  const { currentData: history, isError: historyError } = useGetMonitoringEventsQuery(deviceId, { skip: !deviceId, pollingInterval: 30000 });
  const [now, setNow] = useState(Date.now());
  const [receivedAt, setReceivedAt] = useState(Date.now());
  const [wsState, setWsState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [browserEventAt, setBrowserEventAt] = useState<number | null>(null);
  const [browserDelay, setBrowserDelay] = useState<number | null>(null);

  useEffect(() => { if (!deviceId && devices.length) setDeviceId(devices[0].id); }, [deviceId, devices]);
  useEffect(() => { if (data) setReceivedAt(Date.now()); }, [data]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!deviceId) return;
    let stopped = false; let timer: number | undefined; let socket: WebSocket | undefined;
    setBrowserEventAt(null);
    setBrowserDelay(null);
    const connect = () => {
      setWsState('connecting');
      socket = new WebSocket(getWebSocketUrl(deviceId));
      socket.onopen = () => { if (!stopped) setWsState('connected'); };
      socket.onmessage = (event) => {
        if (stopped) return;
        const arrived = Date.now();
        setBrowserEventAt(arrived);
        try {
          const reading = JSON.parse(String(event.data)) as { received_at?: string };
          const delay = arrived - Date.parse(reading.received_at ?? '');
          setBrowserDelay(Number.isFinite(delay) && delay >= 0 ? delay : null);
        } catch { setBrowserDelay(null); }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => { if (!stopped) { setWsState('disconnected'); setBrowserDelay(null); timer = window.setTimeout(connect, 3000); } };
    };
    connect();
    return () => { stopped = true; if (timer) window.clearTimeout(timer); socket?.close(); };
  }, [deviceId]);

  const points = useMemo(() => (data?.samples ?? []).map((sample, index, samples) => ({
    time: new Date(sample.received_at).getTime(),
    interval: index ? Math.max(0, (Date.parse(sample.received_at) - Date.parse(samples[index - 1].received_at)) / 1000) : null,
    signal: sample.metadata.wifi_rssi ?? null,
  })), [data]);
  const latest = data?.latest;
  const age = latest && data ? Math.max(0, (Date.parse(data.server_time) - Date.parse(latest.received_at) + now - receivedAt) / 1000) : null;
  const health = age === null ? 'none' : age < 5 ? 'ok' : age < 10 ? 'late' : 'offline';
  const status = health === 'ok' ? (ru ? 'Данные свежие' : 'Receiving') : health === 'late' ? (ru ? 'Задержка' : 'Delayed') : health === 'offline' ? (ru ? 'Данные не поступают' : 'No recent data') : (ru ? 'Нет данных' : 'No data');
  const stat = (label: string, value: string) => <Paper variant="outlined" sx={{ p: 2, flex: '1 1 180px' }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h6" sx={{ mt: 0.5 }}>{value}</Typography></Paper>;

  return <>
    <PageHeader title={t('nav.monitoring')} subtitle={ru ? 'Поступление данных, состояние браузера и история перерывов' : 'Telemetry delivery, browser connection and interruptions'} />
    {devicesError && <Alert severity="error">{ru ? 'Не удалось загрузить устройства' : 'Could not load devices'}</Alert>}
    {!devicesLoading && !devices.length && !devicesError && <Alert severity="info">{ru ? 'Добавьте устройство, чтобы открыть мониторинг.' : 'Add a device to view monitoring.'}</Alert>}
    {devices.length > 0 && <Stack spacing={3}>
      <FormControl fullWidth size="small" sx={{ maxWidth: 420 }}>
        <InputLabel id="monitor-device-label">{ru ? 'Устройство' : 'Device'}</InputLabel>
        <Select labelId="monitor-device-label" label={ru ? 'Устройство' : 'Device'} value={deviceId || ''} onChange={(e) => setDeviceId(Number(e.target.value))}>
          {devices.map((d) => <MenuItem key={d.id} value={d.id}>{d.name} · #{d.id}</MenuItem>)}
        </Select>
      </FormControl>
      {isError && <Alert severity="error" action={<Box component="button" onClick={() => refetch()}>{ru ? 'Повторить' : 'Retry'}</Box>}>{ru ? 'Не удалось получить диагностику' : 'Could not load diagnostics'}</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
        <Paper variant="outlined" sx={{ p: 2, flex: '1 1 180px' }}><Typography variant="body2" color="text.secondary">{ru ? 'Телеметрия' : 'Telemetry'}</Typography><Box sx={{ mt: 1 }}><Chip size="small" label={status} color={health === 'ok' ? 'success' : health === 'late' ? 'warning' : 'default'} /></Box></Paper>
        {stat(ru ? 'Последний пакет' : 'Last packet', age === null ? '—' : `${Math.floor(age)} ${ru ? 'сек. назад' : 's ago'}`)}
        {stat(ru ? 'Транспорт' : 'Transport', latest?.transport?.toUpperCase() ?? '—')}
        {stat(ru ? 'Wi-Fi устройства' : 'Device Wi-Fi', latest?.metadata.wifi_rssi !== undefined ? `${latest.metadata.wifi_rssi} dBm` : '—')}
        {stat(ru ? 'MQTT переподключения' : 'MQTT reconnects', latest?.metadata.mqtt_reconnects?.toString() ?? '—')}
        {stat(ru ? 'Ошибки отправки' : 'Publish errors', latest?.metadata.publish_errors?.toString() ?? '—')}
        {stat(ru ? 'Сервер → браузер' : 'Server → browser', browserDelay === null ? '—' : `~${browserDelay} ms`)}
      </Stack>
      <Alert severity={wsState === 'connected' ? 'success' : 'warning'}>
        {ru ? 'WebSocket браузера: ' : 'Browser WebSocket: '}{wsState === 'connected' ? (ru ? 'подключён' : 'connected') : wsState === 'connecting' ? (ru ? 'подключается' : 'connecting') : (ru ? 'отключён' : 'disconnected')}
        {browserEventAt && ` · ${ru ? 'последнее событие' : 'last event'} ${new Date(browserEventAt).toLocaleTimeString()}`}
      </Alert>
      <Typography variant="body2" color="text.secondary">{ru ? 'Задержка сервера и браузера приблизительна и зависит от совпадения их часов; включает обработку на сервере.' : 'Server-to-browser delay is approximate, depends on clock alignment and includes server processing.'}</Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6">{ru ? 'Интервал между пакетами' : 'Time between packets'}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{ru ? 'Последние 30 минут; скачки показывают задержки получения на сервере.' : 'Last 30 minutes; spikes show delayed server reception.'}</Typography>
        {points.length < 2 ? <Typography color="text.secondary">{isFetching ? '…' : (ru ? 'Ожидаем данные для графика' : 'Waiting for data')}</Typography> : <Box sx={{ width: '100%', height: 240 }}><ResponsiveContainer><LineChart data={points}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => new Date(v).toLocaleTimeString()} /><YAxis unit=" s" width={48} /><Tooltip labelFormatter={(v) => new Date(Number(v)).toLocaleTimeString()} /><Line type="stepAfter" dataKey="interval" name={ru ? 'Интервал, с' : 'Interval, s'} stroke="#1976d2" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></Box>}
      </Paper>
      <Paper variant="outlined" sx={{ p: 2, overflowX: 'auto' }}>
        <Typography variant="h6">{ru ? 'Перерывы и события за 24 часа' : 'Interruptions and events in the last 24 hours'}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{ru ? 'Событие фиксируется после следующего принятого пакета.' : 'Events appear after the next received packet.'}</Typography>
        {historyError ? <Alert severity="error">{ru ? 'Не удалось загрузить историю' : 'Could not load history'}</Alert> : !history ? <Typography color="text.secondary">{ru ? 'Загрузка…' : 'Loading…'}</Typography> : !history.events.length ? <Typography color="text.secondary">{ru ? 'Событий пока нет' : 'No events yet'}</Typography> : <Table size="small"><TableHead><TableRow><TableCell>{ru ? 'Время восстановления' : 'Time received'}</TableCell><TableCell>{ru ? 'Событие' : 'Event'}</TableCell></TableRow></TableHead><TableBody>{history.events.map((event, index) => <TableRow key={`${event.received_at}-${index}`}><TableCell>{clock(event.received_at)}</TableCell><TableCell>{describe(event, ru)}</TableCell></TableRow>)}</TableBody></Table>}
      </Paper>
      <Typography variant="body2" color="text.secondary">{ru ? 'Диагностика собирается с момента включения мониторинга и хранится до 7 дней. Данные Wi-Fi и счётчики доступны, если их передаёт прошивка.' : 'Diagnostics are collected from activation and retained for up to 7 days. Wi-Fi and counters require firmware support.'}</Typography>
    </Stack>}
  </>;
}

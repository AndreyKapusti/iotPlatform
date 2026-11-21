import { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, Divider, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import { ArrowDownward, ArrowUpward, Delete } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { extractErrorMessage } from '../shared/api/baseApi';
import { isAutomatic, useCreateRuleMutation, useDeleteRuleMutation, useGetAutomationCapabilitiesQuery, useGetAutomationEventsQuery,
  useGetModesQuery, useGetRulesQuery, useReorderRulesMutation, useSetModeMutation, useUpdateRuleMutation,
  type Action, type CapabilityRef, type Condition, type ConditionGroup, type Mode, type Ref, type Rule, type RuleInput } from '../features/automation/api';

function refKey(ref: Ref): string { return JSON.stringify([ref.device_id, ref.metric]); }
function parseRef(value: string): Ref { const [device_id, metric] = JSON.parse(value) as [number, string]; return { device_id, metric }; }
function capLabel(cap: CapabilityRef): string { return `${cap.device_name} · ${cap.name}${cap.unit ? ` (${cap.unit})` : ''}`; }
function blankCondition(cap: CapabilityRef): Condition {
  return { left: { device_id: cap.device_id, metric: cap.name }, operator: 'eq',
    right: { kind: 'literal', value: cap.type === 'boolean' ? false : cap.type === 'number' ? 0 : '' } };
}
function isGroup(node: Condition | ConditionGroup): node is ConditionGroup { return 'children' in node; }

function ConditionEditor({ group, caps, onChange, depth = 0, ru }: { group: ConditionGroup; caps: CapabilityRef[]; onChange: (v: ConditionGroup) => void; depth?: number; ru: boolean }) {
  const update = (index: number, node: Condition | ConditionGroup) => onChange({ ...group, children: group.children.map((old, i) => i === index ? node : old) });
  const remove = (index: number) => onChange({ ...group, children: group.children.filter((_, i) => i !== index) });
  return <Card variant="outlined" sx={{ p: 1.5, my: 1, ml: depth ? 1 : 0 }}>
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      <Typography variant="body2">{ru ? 'Группа:' : 'Group:'}</Typography>
      <TextField select size="small" value={group.op} onChange={(e) => onChange({ ...group, op: e.target.value as 'all' | 'any' })}>
        <MenuItem value="all">{ru ? 'Все условия (И)' : 'All conditions (AND)'}</MenuItem>
        <MenuItem value="any">{ru ? 'Любое условие (ИЛИ)' : 'Any condition (OR)'}</MenuItem>
      </TextField>
    </Stack>
    {group.children.map((node, index) => {
      if (isGroup(node)) return <Box key={index}><ConditionEditor group={node} caps={caps} onChange={(v) => update(index, v)} depth={depth + 1} ru={ru} />
        <Button size="small" color="error" onClick={() => remove(index)}>{ru ? 'Удалить группу' : 'Remove group'}</Button></Box>;
      const cap = caps.find((c) => c.device_id === node.left.device_id && c.name === node.left.metric);
      const numeric = cap?.type === 'number';
      const compatible = caps.filter((c) => c.type === cap?.type);
      return <Stack key={index} direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1 }} alignItems={{ md: 'center' }}>
        <TextField select size="small" label={ru ? 'Источник' : 'Source'} value={refKey(node.left)} sx={{ minWidth: 190 }} onChange={(e) => {
          const next = parseRef(e.target.value); const chosen = caps.find((c) => c.device_id === next.device_id && c.name === next.metric);
          if (chosen) update(index, blankCondition(chosen));
        }}>{caps.map((c) => <MenuItem key={refKey(c)} value={refKey(c)}>{capLabel(c)}</MenuItem>)}</TextField>
        <TextField select size="small" label={ru ? 'Сравнение' : 'Compare'} value={node.operator} sx={{ minWidth: 110 }} onChange={(e) => update(index, { ...node, operator: e.target.value as Condition['operator'] })}>
          <MenuItem value="eq">=</MenuItem><MenuItem value="ne">≠</MenuItem>
          {numeric && [<MenuItem key="gt" value="gt">&gt;</MenuItem>, <MenuItem key="gte" value="gte">≥</MenuItem>, <MenuItem key="lt" value="lt">&lt;</MenuItem>, <MenuItem key="lte" value="lte">≤</MenuItem>]}
        </TextField>
        <TextField select size="small" label={ru ? 'С чем' : 'Against'} value={node.right.kind} sx={{ minWidth: 140 }} onChange={(e) => {
          if (e.target.value === 'reference' && compatible[0]) update(index, { ...node, right: { kind: 'reference', device_id: compatible[0].device_id, metric: compatible[0].name } });
          else if (cap) update(index, { ...node, right: blankCondition(cap).right });
        }}><MenuItem value="literal">{ru ? 'Значение' : 'Value'}</MenuItem><MenuItem value="reference">{ru ? 'Датчик / статус' : 'Sensor / state'}</MenuItem></TextField>
        {node.right.kind === 'reference' ? <TextField select size="small" label={ru ? 'Источник сравнения' : 'Comparison source'} value={refKey(node.right)} sx={{ minWidth: 190 }} onChange={(e) => update(index, { ...node, right: { kind: 'reference', ...parseRef(e.target.value) } })}>
          {compatible.map((c) => <MenuItem key={refKey(c)} value={refKey(c)}>{capLabel(c)}</MenuItem>)}</TextField> : cap?.type === 'boolean' ?
          <TextField select size="small" label={ru ? 'Значение' : 'Value'} value={String(node.right.value)} onChange={(e) => update(index, { ...node, right: { kind: 'literal', value: e.target.value === 'true' } })}>
            <MenuItem value="true">{ru ? 'Включено / да' : 'On / true'}</MenuItem><MenuItem value="false">{ru ? 'Выключено / нет' : 'Off / false'}</MenuItem></TextField> :
          <TextField size="small" type={numeric ? 'number' : 'text'} label={ru ? 'Значение' : 'Value'} value={node.right.value} onChange={(e) => update(index, { ...node, right: { kind: 'literal', value: numeric ? Number(e.target.value) : e.target.value } })} />}
        <IconButton aria-label={ru ? 'Удалить условие' : 'Remove condition'} disabled={group.children.length === 1} onClick={() => remove(index)}><Delete /></IconButton>
      </Stack>;
    })}
    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
      <Button size="small" disabled={!caps.length} onClick={() => caps[0] && onChange({ ...group, children: [...group.children, blankCondition(caps[0])] })}>{ru ? '+ Условие' : '+ Condition'}</Button>
      <Button size="small" disabled={!caps.length || depth >= 4} onClick={() => caps[0] && onChange({ ...group, children: [...group.children, { op: 'all', children: [blankCondition(caps[0])] }] })}>{ru ? '+ Группа' : '+ Group'}</Button>
    </Stack>
  </Card>;
}

function ActionEditor({ title, values, caps, onChange, ru }: { title: string; values: Action[]; caps: CapabilityRef[]; onChange: (v: Action[]) => void; ru: boolean }) {
  const actuators = caps.filter((c) => c.role === 'actuator' && c.type === 'boolean');
  return <Box sx={{ my: 1.5 }}><Typography variant="subtitle1">{title}</Typography>
    {values.map((action, index) => <Stack key={index} direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
      <TextField select size="small" label={ru ? 'Исполнитель' : 'Actuator'} value={refKey(action)} sx={{ minWidth: 200 }} onChange={(e) => onChange(values.map((a, i) => i === index ? { ...a, ...parseRef(e.target.value) } : a))}>
        {actuators.map((c) => <MenuItem key={refKey(c)} value={refKey(c)}>{capLabel(c)}</MenuItem>)}</TextField>
      <TextField select size="small" label={ru ? 'Действие' : 'Action'} value={String(action.value)} onChange={(e) => onChange(values.map((a, i) => i === index ? { ...a, value: e.target.value === 'true' } : a))}>
        <MenuItem value="true">{ru ? 'Включить' : 'Turn on'}</MenuItem><MenuItem value="false">{ru ? 'Выключить' : 'Turn off'}</MenuItem></TextField>
      <IconButton aria-label={ru ? 'Удалить действие' : 'Remove action'} onClick={() => onChange(values.filter((_, i) => i !== index))}><Delete /></IconButton>
    </Stack>)}
    <Button size="small" disabled={!actuators.some((c) => !values.some((a) => refKey(a) === refKey(c)))} onClick={() => {
      const cap = actuators.find((c) => !values.some((a) => refKey(a) === refKey(c)));
      if (cap) onChange([...values, { device_id: cap.device_id, metric: cap.name, value: true }]);
    }}>{ru ? '+ Действие' : '+ Action'}</Button>
  </Box>;
}

function RuleEditor({ initial, caps, onCancel, onSave, busy, ru }: { initial?: Rule; caps: CapabilityRef[]; onCancel: () => void; onSave: (body: RuleInput) => void; busy: boolean; ru: boolean }) {
  const first = caps[0];
  const firstActuator = caps.find((c) => c.role === 'actuator' && c.type === 'boolean');
  const [body, setBody] = useState<RuleInput>(() => initial ? { name: initial.name, enabled: initial.enabled, freshness_seconds: initial.freshness_seconds, delay_seconds: initial.delay_seconds, definition: initial.definition } : {
    name: '', enabled: true, freshness_seconds: 30, delay_seconds: 0,
    definition: { condition: { op: 'all', children: first ? [blankCondition(first)] : [] }, then: firstActuator ? [{ device_id: firstActuator.device_id, metric: firstActuator.name, value: true }] : [], otherwise: [] },
  });
  return <Card variant="outlined" sx={{ p: 2, my: 2 }}>
    <Stack spacing={1.5}>
      <TextField label={ru ? 'Название правила' : 'Rule name'} value={body.name} onChange={(e) => setBody({ ...body, name: e.target.value })} />
      <FormControlLabel control={<Switch checked={body.enabled} onChange={(_, enabled) => setBody({ ...body, enabled })} />} label={ru ? 'Правило включено' : 'Rule enabled'} />
      <Typography variant="subtitle1">{ru ? 'Если' : 'If'}</Typography>
      <ConditionEditor group={body.definition.condition} caps={caps} ru={ru} onChange={(condition) => setBody({ ...body, definition: { ...body.definition, condition } })} />
      <ActionEditor title={ru ? 'То' : 'Then'} values={body.definition.then} caps={caps} ru={ru} onChange={(then) => setBody({ ...body, definition: { ...body.definition, then } })} />
      <ActionEditor title={ru ? 'Иначе (необязательно)' : 'Else (optional)'} values={body.definition.otherwise} caps={caps} ru={ru} onChange={(otherwise) => setBody({ ...body, definition: { ...body.definition, otherwise } })} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField type="number" label={ru ? 'Данные свежие, сек.' : 'Freshness, seconds'} value={body.freshness_seconds} inputProps={{ min: 1, max: 86400 }} onChange={(e) => setBody({ ...body, freshness_seconds: Number(e.target.value) })} />
        <TextField type="number" label={ru ? 'Устойчивость условия, сек.' : 'Condition delay, seconds'} value={body.delay_seconds} inputProps={{ min: 0, max: 86400 }} onChange={(e) => setBody({ ...body, delay_seconds: Number(e.target.value) })} />
      </Stack>
      <Alert severity="info">{ru ? 'Включённое правило начнёт действовать сразу после сохранения, если данные свежие.' : 'An enabled rule starts acting immediately after saving when its inputs are fresh.'}</Alert>
      <Stack direction="row" spacing={1}><Button variant="contained" disabled={busy || !body.name.trim() || !body.definition.condition.children.length} onClick={() => onSave(body)}>{ru ? 'Сохранить' : 'Save'}</Button><Button onClick={onCancel}>{ru ? 'Отмена' : 'Cancel'}</Button></Stack>
    </Stack>
  </Card>;
}

export function AutomationPage() {
  const { i18n } = useTranslation(); const ru = i18n.language.startsWith('ru');
  const { data: caps = [] } = useGetAutomationCapabilitiesQuery();
  const { data: rules = [], isLoading, error: rulesError } = useGetRulesQuery(undefined, { pollingInterval: 3000 });
  const { data: modes } = useGetModesQuery(undefined, { pollingInterval: 3000 });
  const { data: events = [] } = useGetAutomationEventsQuery(undefined, { pollingInterval: 5000 });
  const [create, createState] = useCreateRuleMutation(); const [update, updateState] = useUpdateRuleMutation();
  const [remove] = useDeleteRuleMutation(); const [reorder] = useReorderRulesMutation(); const [setMode] = useSetModeMutation();
  const [editing, setEditing] = useState<number | 'new' | null>(null); const [error, setError] = useState('');
  const actuators = useMemo(() => caps.filter((c) => c.role === 'actuator' && c.type === 'boolean'), [caps]);
  const devices = useMemo(() => [...new Map(actuators.map((c) => [c.device_id, c.device_name])).entries()], [actuators]);
  const modeValue = (scope: Mode['scope'], device_id = 0, metric = '') => modes?.modes.find((m) => m.scope === scope && m.device_id === device_id && m.metric === metric)?.mode ?? 'auto';
  const changeMode = async (mode: Mode) => { try { await setMode(mode).unwrap(); setError(''); } catch (e) { setError(extractErrorMessage(e)); } };
  const save = async (body: RuleInput) => { try { if (editing === 'new') await create(body).unwrap(); else if (typeof editing === 'number') await update({ id: editing, body }).unwrap(); setEditing(null); setError(''); } catch (e) { setError(extractErrorMessage(e)); } };
  const move = async (index: number, delta: number) => { const ids = rules.map((r) => r.id); const next = index + delta; if (next < 0 || next >= ids.length) return; [ids[index], ids[next]] = [ids[next], ids[index]]; try { await reorder(ids).unwrap(); } catch (e) { setError(extractErrorMessage(e)); } };
  const stateLabel = (state: string) => ({ active: ru ? 'Активно' : 'Active', waiting: ru ? 'Ожидание' : 'Waiting', waiting_data: ru ? 'Нет свежих данных' : 'Waiting for fresh data', waiting_delay: ru ? 'Ожидание устойчивости' : 'Waiting for stability', waiting_device: ru ? 'Ожидание связи с исполнителем' : 'Waiting for actuator connection', paused_manual: ru ? 'Приостановлено: ручной режим' : 'Paused: manual mode', partial_manual: ru ? 'Часть действий приостановлена' : 'Some actions paused', invalid: ru ? 'Недоступные данные или ошибка' : 'Invalid or unavailable' } as Record<string, string>)[state] ?? state;
  const eventLabel = (event: { event: string; details: Record<string, unknown> }) => {
    const value = event.details.value === true ? (ru ? 'включить' : 'turn on') : (ru ? 'выключить' : 'turn off');
    if (event.event === 'desired_changed') return `${ru ? 'Задано' : 'Desired'}: ${value}`;
    if (event.event === 'suspended') return ru ? 'Управление приостановлено' : 'Control suspended';
    if (event.event === 'command') {
      const status = String(event.details.status);
      const label = ({ pending: ru ? 'ожидание' : 'pending', acknowledged: ru ? 'подтверждено устройством' : 'acknowledged', expired: ru ? 'истёк срок' : 'expired', superseded: ru ? 'заменена' : 'superseded' } as Record<string, string>)[status] ?? status;
      return `${ru ? 'Команда' : 'Command'}: ${value} · ${label}`;
    }
    return event.event;
  };
  return <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
    <Typography variant="h1" gutterBottom>{ru ? 'Автоматизация' : 'Automation'}</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>{ru ? 'Правила работают на сервере, даже когда браузер закрыт.' : 'Rules run on the server even when the browser is closed.'}</Typography>
    {(error || rulesError) && <Alert severity="error" sx={{ mb: 2 }}>{error || extractErrorMessage(rulesError)}</Alert>}
    <Card variant="outlined" sx={{ p: 2, mb: 2 }}><Typography variant="h3" gutterBottom>{ru ? 'Режим управления' : 'Control mode'}</Typography>
      <Typography variant="body2" color="text.secondary">{ru ? 'Ручной режим на уровне аккаунта или устройства приостанавливает автоматику ниже. Без включённых правил исполнитель доступен вручную.' : 'Manual mode at account or device level pauses automation below it. Actuators without enabled rules remain manual.'}</Typography>
      <FormControlLabel control={<Switch checked={modeValue('account') === 'auto'} onChange={(_, checked) => void changeMode({ scope: 'account', device_id: 0, metric: '', mode: checked ? 'auto' : 'manual' })} />} label={ru ? 'Весь аккаунт: авто' : 'Account: automatic'} />
      {devices.map(([id, name]) => <Box key={id} sx={{ mt: 1 }}><Divider /><FormControlLabel control={<Switch checked={modeValue('device', id) === 'auto'} onChange={(_, checked) => void changeMode({ scope: 'device', device_id: id, metric: '', mode: checked ? 'auto' : 'manual' })} />} label={`${name}: ${ru ? 'авто' : 'auto'}`} />
        {actuators.filter((a) => a.device_id === id).map((a) => <Box key={refKey(a)} sx={{ ml: 3 }}><FormControlLabel control={<Switch checked={modeValue('actuator', id, a.name) === 'auto'} onChange={(_, checked) => void changeMode({ scope: 'actuator', device_id: id, metric: a.name, mode: checked ? 'auto' : 'manual' })} />} label={a.name} />
          <Typography component="span" variant="caption" color="text.secondary">{modes && isAutomatic(modes, id, a.name) ? (ru ? 'Автоматически' : 'Automatic') : (ru ? 'Вручную' : 'Manual')}</Typography></Box>)}
      </Box>)}
    </Card>
    <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h3">{ru ? 'Правила' : 'Rules'}</Typography><Button variant="contained" disabled={editing !== null || !caps.length} onClick={() => setEditing('new')}>{ru ? 'Создать правило' : 'Create rule'}</Button></Stack>
    {!caps.length && <Alert severity="info" sx={{ mt: 2 }}>{ru ? 'Сначала подключите устройства с датчиками и исполнителями.' : 'Connect devices with sensors and actuators first.'}</Alert>}
    {editing === 'new' && <RuleEditor key="new" caps={caps} onCancel={() => setEditing(null)} onSave={(body) => void save(body)} busy={createState.isLoading} ru={ru} />}
    {isLoading && <Typography>{ru ? 'Загрузка…' : 'Loading…'}</Typography>}
    {rules.map((rule, index) => <Box key={rule.id} sx={{ mt: 1 }}><Card variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
      <Typography sx={{ flex: 1 }}><b>{index + 1}. {rule.name}</b> · {rule.enabled ? stateLabel(rule.state) : (ru ? 'выключено' : 'disabled')}{rule.error ? ` · ${rule.error}` : ''}</Typography>
      <IconButton aria-label={ru ? 'Выше' : 'Move up'} disabled={index === 0} onClick={() => void move(index, -1)}><ArrowUpward /></IconButton>
      <IconButton aria-label={ru ? 'Ниже' : 'Move down'} disabled={index === rules.length - 1} onClick={() => void move(index, 1)}><ArrowDownward /></IconButton>
      <Button onClick={() => setEditing(rule.id)}>{ru ? 'Изменить' : 'Edit'}</Button>
      <Button onClick={() => void saveToggle(rule, update, setError)}>{rule.enabled ? (ru ? 'Выключить' : 'Disable') : (ru ? 'Включить' : 'Enable')}</Button>
      <IconButton aria-label={ru ? 'Удалить правило' : 'Delete rule'} onClick={() => { if (window.confirm(ru ? 'Удалить правило?' : 'Delete rule?')) void remove(rule.id).unwrap().catch((e) => setError(extractErrorMessage(e))); }}><Delete /></IconButton>
    </Stack></Card>{editing === rule.id && <RuleEditor key={rule.id} initial={rule} caps={caps} onCancel={() => setEditing(null)} onSave={(body) => void save(body)} busy={updateState.isLoading} ru={ru} />}</Box>)}
    <Typography variant="h3" sx={{ mt: 3 }}>{ru ? 'Последние события' : 'Recent events'}</Typography>
    {events.slice(0, 30).map((event) => <Typography key={`${event.event}-${event.id}`} variant="body2" sx={{ mt: 0.5 }}>{new Date(event.created_at).toLocaleString()} · {caps.find((c) => c.device_id === event.device_id)?.device_name ?? event.device_id} / {event.metric} · {eventLabel(event)}</Typography>)}
  </Box>;
}

async function saveToggle(rule: Rule, update: ReturnType<typeof useUpdateRuleMutation>[0], setError: (value: string) => void) {
  const body: RuleInput = { name: rule.name, enabled: !rule.enabled, freshness_seconds: rule.freshness_seconds, delay_seconds: rule.delay_seconds, definition: rule.definition };
  try { await update({ id: rule.id, body }).unwrap(); } catch (e) { setError(extractErrorMessage(e)); }
}

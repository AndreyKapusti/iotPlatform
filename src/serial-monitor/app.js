const ports = document.querySelector('#ports');
const baud = document.querySelector('#baud');
const status = document.querySelector('#status');
const message = document.querySelector('#message');
const connectButton = document.querySelector('#connect');
const disconnectButton = document.querySelector('#disconnect');
const sensorCards = document.querySelector('#sensor-cards');
const actuatorCards = document.querySelector('#actuator-cards');
const updated = document.querySelector('#updated');
const freshness = document.querySelector('#freshness');
const sensorErrors = document.querySelector('#sensor-errors');
const logs = document.querySelector('#logs');

const labels = {
  temperature: ['Температура', '°C'], humidity: ['Влажность', '%'], motion: ['Движение', ''],
  relay_1: ['Реле 1', ''], relay_2: ['Реле 2', ''],
};

async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function refreshPorts() {
  try {
    const previous = ports.value;
    const result = await api('/api/ports');
    ports.replaceChildren();
    if (!result.ports.length) {
      ports.add(new Option('Порты не найдены', ''));
      return;
    }
    for (const item of result.ports) ports.add(new Option(`${item.port} — ${item.description}`, item.port));
    if (result.ports.some((item) => item.port === previous)) ports.value = previous;
  } catch (error) { message.textContent = `Не удалось получить список портов: ${error.message}`; }
}

function renderCards(container, values, kind) {
  const entries = Object.entries(values || {});
  container.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement('div'); empty.className = 'empty';
    empty.textContent = kind === 'sensor' ? 'Ожидание показаний датчиков.' : 'Нет данных о выходах.';
    container.append(empty); return;
  }
  for (const [key, value] of entries) {
    const card = document.createElement('article'); card.className = 'metric';
    const title = document.createElement('div'); title.className = 'metric-name'; title.textContent = labels[key]?.[0] || key;
    const display = document.createElement('div'); display.className = 'metric-value';
    if (value === null) { display.textContent = 'Нет данных'; display.classList.add('missing'); }
    else if (typeof value === 'boolean') display.textContent = key === 'motion' ? (value ? 'Есть' : 'Нет') : (value ? 'ВКЛ' : 'ВЫКЛ');
    else if (typeof value === 'number') display.textContent = `${Number(value.toFixed(2))}${labels[key]?.[1] ? ` ${labels[key][1]}` : ''}`;
    else display.textContent = String(value);
    card.append(title, display); container.append(card);
  }
}

let lastSampleAt = null;
let actionError = '';
let lastLogText = '';
async function refreshState() {
  try {
    const state = await api('/api/state');
    status.textContent = state.connected ? `Подключено · ${state.port}` : 'Не подключено';
    status.className = `status${state.connected ? ' online' : state.error ? ' error' : ''}`;
    connectButton.disabled = state.connected;
    disconnectButton.disabled = !state.connected;
    ports.disabled = state.connected; baud.disabled = state.connected;
    if (state.error || actionError) message.textContent = state.error || actionError;
    else if (state.connected) message.textContent = 'Порт открыт для чтения. Для прошивки или настройки сначала отключите монитор.';
    else message.textContent = 'Подключите плату по USB и выберите её порт.';
    if (state.sample && state.sample_at) {
      if (lastSampleAt !== state.sample_at) {
        renderCards(sensorCards, state.sample.sensors, 'sensor');
        renderCards(actuatorCards, state.sample.actuators, 'actuator');
        const errors = Object.entries(state.sample.errors || {}).filter(([, active]) => active === true).map(([name]) => name);
        sensorErrors.hidden = errors.length === 0;
        sensorErrors.textContent = errors.length ? `Ошибка чтения: ${errors.join(', ')}. Проверьте датчик и подключение.` : '';
        lastSampleAt = state.sample_at;
      }
      const elapsed = Math.max(0, Date.now() / 1000 - state.sample_at);
      const age = Math.floor(elapsed);
      updated.textContent = `Последнее измерение: ${new Date(state.sample_at * 1000).toLocaleTimeString()} · ${age} сек. назад`;
      freshness.textContent = elapsed <= 6 ? 'Данные поступают' : 'Данные устарели';
      freshness.className = `freshness ${elapsed <= 6 ? 'fresh' : 'stale'}`;
    } else {
      if (lastSampleAt !== null) { renderCards(sensorCards, {}, 'sensor'); renderCards(actuatorCards, {}, 'actuator'); }
      lastSampleAt = null;
      updated.textContent = state.connected ? 'Ожидание совместимой прошивки или первого измерения' : 'Ожидание данных';
      freshness.textContent = ''; freshness.className = 'freshness'; sensorErrors.hidden = true;
    }
    const text = state.lines.length ? state.lines.join('\n') : 'Сообщений пока нет.';
    if (text !== lastLogText) { logs.textContent = text; logs.scrollTop = logs.scrollHeight; lastLogText = text; }
  } catch (error) {
    status.textContent = 'Сервис недоступен'; status.className = 'status error';
    message.textContent = 'Проверьте, что локальный USB-монитор запущен.';
    freshness.textContent = 'Нет связи с сервисом'; freshness.className = 'freshness stale';
  }
}

async function command(path, body) {
  actionError = '';
  try {
    await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    await refreshState();
  } catch (error) { actionError = error.message; message.textContent = actionError; }
}

document.querySelector('#refresh').addEventListener('click', refreshPorts);
connectButton.addEventListener('click', () => {
  if (ports.value) void command('/api/connect', { port: ports.value, baudrate: Number(baud.value) });
});
disconnectButton.addEventListener('click', () => void command('/api/disconnect', {}));
document.querySelector('#shutdown').addEventListener('click', async () => {
  try {
    await api('/api/shutdown', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    status.textContent = 'Монитор остановлен'; status.className = 'status';
    message.textContent = 'Чтобы снова просматривать данные, запустите USB-монитор.';
    clearInterval(timer);
    connectButton.disabled = true; disconnectButton.disabled = true;
  } catch (error) { actionError = error.message; message.textContent = actionError; }
});
void refreshPorts();
void refreshState();
const timer = setInterval(refreshState, 1000);

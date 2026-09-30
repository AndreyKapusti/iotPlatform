import type { Capability, HistoryPoint } from '../../../types';

export type HeatLevel = 'cool' | 'mild' | 'warm' | 'hot' | 'fire';

/** Visual state derived from live capability readings for the studio house twin. */
export interface TwinVisualState {
  temperature: number | null;
  temperatureUnit: string | null;
  heatLevel: HeatLevel;
  /** 0 cool → 1 extreme heat (for glow intensity). */
  heatNorm: number;

  humidity: number | null;
  humidityUnit: string | null;
  /** Soft fog mist when humidity is high. */
  misty: boolean;
  /** Visible falling / condensing droplets (elevated humidity). */
  droplets: boolean;
  humidityNorm: number;

  /** Window / facade lights (light / lux / boolean light). */
  lightsOn: boolean;
  lightNorm: number;

  /**
   * Path / gate presence: motion=true, or distance below near threshold.
   * distance metrics invert (smaller = nearer).
   */
  presence: boolean;
  presenceNorm: number;
  /** Motion / PIR trip (visitor on path). */
  motionActive: boolean;
  /** 0 far → 1 near from distance / proximity sensor. */
  nearNorm: number;

  /** Door / gate leaf open (relay / boolean actuator). */
  doorOpen: boolean;

  /** Garden irrigation valve (relay or dedicated valve metric). */
  valveOpen: boolean;

  /** Mailbox flag raised (presence or open door delivery cue). */
  mailboxFlag: boolean;

  online: boolean;
  hasReadings: boolean;
  mappedMetrics: string[];
}

const EMPTY: TwinVisualState = {
  temperature: null,
  temperatureUnit: null,
  heatLevel: 'mild',
  heatNorm: 0.35,
  humidity: null,
  humidityUnit: null,
  misty: false,
  droplets: false,
  humidityNorm: 0,
  lightsOn: false,
  lightNorm: 0,
  presence: false,
  presenceNorm: 0,
  motionActive: false,
  nearNorm: 0,
  doorOpen: false,
  valveOpen: false,
  mailboxFlag: false,
  online: false,
  hasReadings: false,
  mappedMetrics: [],
};

function nameOf(capOrMetric: string): string {
  return capOrMetric.toLowerCase();
}

function matches(name: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(name));
}

const TEMP_PATTERNS = [/temp/, /температ/, /^t$/];
const HUMID_PATTERNS = [/humid/, /влажн/, /^rh$/];
const LIGHT_PATTERNS = [/light/, /lux/, /illumin/, /освещ/, /bright/, /яркость/];
const DIST_PATTERNS = [/dist/, /proxim/, /дистанц/, /range/, /ультразвук/, /ultrasonic/];
const MOTION_PATTERNS = [/motion/, /движен/, /pir/, /occupan/, /присут/];
const RELAY_PATTERNS = [/relay/, /реле/, /switch/, /actuator/];
const DOOR_PATTERNS = [/door/, /gate/, /двер/, /ворот/, /window/, /окон/];
const VALVE_PATTERNS = [/valve/, /клапан/, /irrigat/, /полив/, /pump/, /насос/];

function asNumber(value: number | boolean | string): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asBool(value: number | boolean | string): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value).toLowerCase();
  return s === 'true' || s === '1' || s === 'on' || s === 'open';
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function normalizeWithCap(value: number, cap?: Capability): number {
  const min = cap?.min ?? 0;
  const max = cap?.max ?? (value > 1 ? Math.max(value, 100) : 1);
  if (max <= min) return clamp01(value);
  return clamp01((value - min) / (max - min));
}

function heatFromTemp(celsius: number, cap?: Capability): { level: HeatLevel; norm: number } {
  const max = cap?.max ?? 85;
  const min = cap?.min ?? -40;
  const norm = normalizeWithCap(celsius, {
    name: 'temperature',
    type: 'number',
    role: 'sensor',
    unit: cap?.unit ?? '°C',
    min,
    max,
    schema_version: cap?.schema_version ?? 1,
  });
  // Absolute thresholds for demo readability even when range is wide (-40..85).
  if (celsius >= 55 || (max > 40 && celsius >= max * 0.85)) {
    return { level: 'fire', norm: Math.max(norm, 0.95) };
  }
  if (celsius >= 35) return { level: 'hot', norm: Math.max(norm, 0.75) };
  if (celsius >= 26) return { level: 'warm', norm: Math.max(norm, 0.55) };
  if (celsius <= 10) return { level: 'cool', norm: Math.min(norm, 0.25) };
  return { level: 'mild', norm };
}

function findReading(
  readings: HistoryPoint[],
  predicate: (metric: string) => boolean,
): HistoryPoint | undefined {
  return readings.find((r) => predicate(nameOf(r.metric)));
}

function findCap(caps: Capability[], predicate: (metric: string) => boolean): Capability | undefined {
  return caps.find((c) => predicate(nameOf(c.name)));
}

/**
 * Map device capabilities + latest telemetry into twin visuals.
 * Unknown metrics are ignored; known aliases (en/ru) and boolean actuators are handled generically.
 */
export function mapTwinState(
  capabilities: Capability[],
  readings: HistoryPoint[],
  online: boolean,
): TwinVisualState {
  if (!online && readings.length === 0) {
    return { ...EMPTY, online: false };
  }

  const mapped: string[] = [];
  const readingMap = new Map(readings.map((r) => [nameOf(r.metric), r]));

  const tempCap = findCap(capabilities, (n) => matches(n, TEMP_PATTERNS));
  const humidCap = findCap(capabilities, (n) => matches(n, HUMID_PATTERNS));
  const lightCap = findCap(capabilities, (n) => matches(n, LIGHT_PATTERNS));
  const distCap = findCap(capabilities, (n) => matches(n, DIST_PATTERNS));
  const motionCap = findCap(capabilities, (n) => matches(n, MOTION_PATTERNS));

  const tempReading =
    (tempCap && readingMap.get(nameOf(tempCap.name))) ||
    findReading(readings, (n) => matches(n, TEMP_PATTERNS));
  const humidReading =
    (humidCap && readingMap.get(nameOf(humidCap.name))) ||
    findReading(readings, (n) => matches(n, HUMID_PATTERNS));
  const lightReading =
    (lightCap && readingMap.get(nameOf(lightCap.name))) ||
    findReading(readings, (n) => matches(n, LIGHT_PATTERNS));
  const distReading =
    (distCap && readingMap.get(nameOf(distCap.name))) ||
    findReading(readings, (n) => matches(n, DIST_PATTERNS));
  const motionReading =
    (motionCap && readingMap.get(nameOf(motionCap.name))) ||
    findReading(readings, (n) => matches(n, MOTION_PATTERNS));

  let temperature: number | null = null;
  let heatLevel: HeatLevel = 'mild';
  let heatNorm = 0.35;
  if (tempReading) {
    temperature = asNumber(tempReading.value);
    if (temperature != null) {
      const h = heatFromTemp(temperature, tempCap);
      heatLevel = h.level;
      heatNorm = h.norm;
      mapped.push(tempReading.metric);
    }
  }

  let humidity: number | null = null;
  let humidityNorm = 0;
  let misty = false;
  let droplets = false;
  if (humidReading) {
    humidity = asNumber(humidReading.value);
    if (humidity != null) {
      humidityNorm = normalizeWithCap(humidity, humidCap ?? undefined);
      misty = humidity >= 70 || humidityNorm >= 0.7;
      // Droplets show earlier than thick mist so high RH is obvious.
      droplets = humidity >= 55 || humidityNorm >= 0.55;
      mapped.push(humidReading.metric);
    }
  }

  let lightsOn = false;
  let lightNorm = 0;
  if (lightReading) {
    const cap = lightCap;
    if (cap?.type === 'boolean' || typeof lightReading.value === 'boolean') {
      lightsOn = asBool(lightReading.value);
      lightNorm = lightsOn ? 1 : 0;
    } else {
      const n = asNumber(lightReading.value);
      if (n != null) {
        lightNorm = normalizeWithCap(n, cap);
        // For lux-like values without min/max, treat >50 as on.
        lightsOn = cap?.max != null ? lightNorm > 0.15 : n > 50;
      }
    }
    mapped.push(lightReading.metric);
  }

  let presence = false;
  let presenceNorm = 0;
  let motionActive = false;
  let nearNorm = 0;
  if (motionReading) {
    motionActive = asBool(motionReading.value);
    presence = motionActive;
    presenceNorm = motionActive ? 1 : 0;
    mapped.push(motionReading.metric);
  }
  if (distReading) {
    const n = asNumber(distReading.value);
    if (n != null) {
      const farNorm = normalizeWithCap(n, distCap);
      // Closer (smaller distance) → higher presence.
      nearNorm = 1 - farNorm;
      presenceNorm = Math.max(presenceNorm, nearNorm);
      presence = presence || nearNorm >= 0.55;
      mapped.push(distReading.metric);
    }
  }

  // Boolean actuators: door/gate preferred for door; valve preferred for irrigation;
  // otherwise first relay-like metric opens the door (and valve if name suggests it).
  let doorOpen = false;
  let valveOpen = false;

  const boolReadings = readings.filter((r) => {
    const cap = capabilities.find((c) => nameOf(c.name) === nameOf(r.metric));
    return (
      typeof r.value === 'boolean' ||
      cap?.type === 'boolean' ||
      matches(nameOf(r.metric), RELAY_PATTERNS)
    );
  });

  for (const r of boolReadings) {
    const n = nameOf(r.metric);
    const on = asBool(r.value);
    if (matches(n, VALVE_PATTERNS)) {
      valveOpen = on;
      mapped.push(r.metric);
    } else if (matches(n, DOOR_PATTERNS)) {
      doorOpen = on;
      mapped.push(r.metric);
    } else if (matches(n, RELAY_PATTERNS) || matches(n, [/relay_?\d+/])) {
      // Default simulator relay_1 → door + garden valve together (one twin narrative).
      doorOpen = on;
      valveOpen = on;
      mapped.push(r.metric);
    } else if (!matches(n, [...MOTION_PATTERNS, ...LIGHT_PATTERNS, ...TEMP_PATTERNS, ...HUMID_PATTERNS, ...DIST_PATTERNS])) {
      // Generic leftover boolean → door if door still unset.
      if (!doorOpen && on) doorOpen = true;
      mapped.push(r.metric);
    }
  }

  // Without a light metric, warm interior evening cue from heat does not force lights;
  // presence alone can gently brighten path (handled in scene via presenceNorm).
  const mailboxFlag = presence || doorOpen;

  return {
    temperature,
    temperatureUnit: tempCap?.unit ?? '°C',
    heatLevel,
    heatNorm,
    humidity,
    humidityUnit: humidCap?.unit ?? '%',
    misty,
    droplets,
    humidityNorm,
    lightsOn,
    lightNorm,
    presence,
    presenceNorm,
    motionActive,
    nearNorm,
    doorOpen,
    valveOpen,
    mailboxFlag,
    online,
    hasReadings: readings.length > 0,
    mappedMetrics: [...new Set(mapped)],
  };
}

export function emptyTwinState(online = false): TwinVisualState {
  return { ...EMPTY, online };
}

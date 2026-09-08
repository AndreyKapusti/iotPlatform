export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
}

export interface UserProfile extends User {
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  birth_date: string | null;
  phone: string | null;
  organization: string | null;
  job_title: string | null;
  timezone: string | null;
}

export interface UserProfileUpdate {
  email?: string;
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  organization?: string | null;
  job_title?: string | null;
  timezone?: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Device {
  id: number;
  name: string;
  api_key: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export interface DeviceCreateResponse {
  id: number;
  name: string;
  api_key: string;
}

export interface Capability {
  name: string;
  type: 'number' | 'boolean' | 'string';
  role: 'sensor' | 'actuator';
  unit: string | null;
  min: number | null;
  max: number | null;
  schema_version: number;
}

export type WidgetType = 'line' | 'gauge' | 'indicator' | 'toggle';

export type WidgetAccent = 'default' | 'blue' | 'amber' | 'rose' | 'green' | 'slate';

export interface WidgetLayout {
  id: string;
  type: WidgetType;
  metric: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  accent?: WidgetAccent;
}

export interface DashboardSummary {
  id: number;
  device_id: number;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Dashboard {
  id: number;
  user_id: number;
  device_id: number;
  name: string;
  layout: WidgetLayout[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface HistoryPoint {
  metric: string;
  value: number | boolean | string;
  type: string;
  received_at: string;
}

export interface HistoryResponse {
  device_id: number;
  metric: string;
  points: HistoryPoint[];
}

export interface LatestTelemetryResponse {
  device_id: number;
  readings: HistoryPoint[];
}

export interface ReadingEvent {
  device_id: number;
  metric: string;
  value: number | boolean | string;
  type: string;
  received_at: string;
}

export interface PaletteItem {
  type: WidgetType;
  metric: string;
  label: string;
  capability: Capability;
}

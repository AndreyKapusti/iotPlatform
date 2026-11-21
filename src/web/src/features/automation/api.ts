import { baseApi } from '../../shared/api/baseApi';

export interface Ref { device_id: number; metric: string }
export interface CapabilityRef extends Ref { device_name: string; name: string; role: 'sensor' | 'actuator'; type: 'number' | 'boolean' | 'string'; unit: string | null; min: number | null; max: number | null; last_seen_at: string | null }
export type Operand = ({ kind: 'literal'; value: number | boolean | string } | ({ kind: 'reference' } & Ref));
export interface Condition { left: Ref; operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'; right: Operand }
export interface ConditionGroup { op: 'all' | 'any'; children: (Condition | ConditionGroup)[] }
export interface Action extends Ref { value: boolean }
export interface RuleInput { name: string; enabled: boolean; freshness_seconds: number; delay_seconds: number; definition: { condition: ConditionGroup; then: Action[]; otherwise: Action[] } }
export interface Rule extends RuleInput { id: number; priority: number; state: string; error: string | null; evaluated_at: string | null }
export interface Mode { scope: 'account' | 'device' | 'actuator'; device_id: number; metric: string; mode: 'manual' | 'auto' }
export interface Modes { modes: Mode[]; automatic_targets: Ref[] }
export interface AutomationEvent { id: number; rule_id: number | null; device_id: number | null; metric: string | null; event: string; details: Record<string, unknown>; created_at: string }

export function isAutomatic(modes: Modes, deviceId: number, metric: string): boolean {
  return modes.automatic_targets.some((r) => r.device_id === deviceId && r.metric === metric) &&
    !modes.modes.some((m) => m.mode === 'manual' && (m.scope === 'account' ||
      (m.scope === 'device' && m.device_id === deviceId) ||
      (m.scope === 'actuator' && m.device_id === deviceId && m.metric === metric)));
}

export const automationApi = baseApi.injectEndpoints({ endpoints: (builder) => ({
  getAutomationCapabilities: builder.query<CapabilityRef[], void>({ query: () => '/api/v1/automation/capabilities',
    transformResponse: (items: CapabilityRef[]) => items.map((item) => ({ ...item, metric: item.name })), providesTags: ['Capability'] }),
  getRules: builder.query<Rule[], void>({ query: () => '/api/v1/automation/rules', providesTags: ['Automation'] }),
  createRule: builder.mutation<Rule, RuleInput>({ query: (body) => ({ url: '/api/v1/automation/rules', method: 'POST', body }), invalidatesTags: ['Automation'] }),
  updateRule: builder.mutation<Rule, { id: number; body: RuleInput }>({ query: ({ id, body }) => ({ url: `/api/v1/automation/rules/${id}`, method: 'PUT', body }), invalidatesTags: ['Automation'] }),
  deleteRule: builder.mutation<void, number>({ query: (id) => ({ url: `/api/v1/automation/rules/${id}`, method: 'DELETE' }), invalidatesTags: ['Automation'] }),
  reorderRules: builder.mutation<void, number[]>({ query: (ids) => ({ url: '/api/v1/automation/rules/order', method: 'PUT', body: { ids } }), invalidatesTags: ['Automation'] }),
  getModes: builder.query<Modes, void>({ query: () => '/api/v1/automation/modes', providesTags: ['Automation'] }),
  setMode: builder.mutation<void, Mode>({ query: (body) => ({ url: '/api/v1/automation/modes', method: 'PUT', body }), invalidatesTags: ['Automation'] }),
  getAutomationEvents: builder.query<AutomationEvent[], void>({ query: () => '/api/v1/automation/events', providesTags: ['Automation'] }),
}) });

export const { useGetAutomationCapabilitiesQuery, useGetRulesQuery, useCreateRuleMutation, useUpdateRuleMutation,
  useDeleteRuleMutation, useReorderRulesMutation, useGetModesQuery, useSetModeMutation, useGetAutomationEventsQuery } = automationApi;

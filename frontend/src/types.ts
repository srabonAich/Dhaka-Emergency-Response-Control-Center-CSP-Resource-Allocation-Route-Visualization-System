export type ResourceType =
  | 'Ambulance'
  | 'Fire Brigade'
  | 'Rescue Team'
  | 'Police Personnel'
  | 'Relief Team';

export type EmergencyCategory =
  | 'Medical Emergency'
  | 'Fire'
  | 'Accident'
  | 'Flood'
  | 'Earthquake'
  | 'Crime'
  | 'Other';

export interface ResourceInventory {
  total_capacity: number;
  available_units: number;
  unit_cost: number;
  capability_tags: string[];
}

export interface ResourceCenter {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  node_id: number;
  operational: boolean;
  inventory: Record<string, ResourceInventory>;
}

export interface EmergencyIncident {
  id: string;
  title: string;
  category: EmergencyCategory;
  priority: number; // 1 to 5
  lat: number;
  lng: number;
  node_id: number;
  required_resources: Record<string, number>;
  escalated: boolean;
  escalation_count: number;
  budget_max: number;
  time_max_minutes: number;
  status: 'PENDING' | 'ASSIGNED' | 'PARTIAL' | 'ESCALATED' | 'UNASSIGNED';
}

export interface RoadBlockConstraint {
  u: number;
  v: number;
  blocked: boolean;
  traffic_factor: number;
  hazard_zone: boolean;
  name?: string;
  lat?: number;
  lng?: number;
}

export interface CSPTraceEvent {
  step: number;
  event_type:
    | 'INIT'
    | 'AC3_PRUNE'
    | 'PC_PRUNE'
    | 'SELECT_VAR'
    | 'TRY_VALUE'
    | 'CONFLICT'
    | 'BACKTRACK'
    | 'BACKJUMP'
    | 'ASSIGN_SUCCESS'
    | 'EXHAUSTED'
    | 'COMPLETE';
  var_id?: string;
  incident_id?: string;
  center_id?: string;
  resource_type?: string;
  details: string;
  domain_size?: number;
  conflict_set?: string[];
  skipped_vars?: string[];
  current_assignments_count?: number;
}

export interface RouteInfo {
  var_id: string;
  incident_id: string;
  center_id: string;
  center_name: string;
  resource_type: string;
  distance_km: number;
  travel_time_min: number;
  cost: number;
  path_nodes: number[];
  path_coords: [number, number][]; // [lat, lng]
}

export interface CSPSolution {
  success: boolean;
  algorithm: string;
  scale: string;
  allocated_count: number;
  total_variables: number;
  unassigned_count: number;
  total_travel_time_min: number;
  total_cost: number;
  states_explored: number;
  backtracks: number;
  backjumps: number;
  domain_values_pruned: number;
  execution_time_ms: number;
  assignments: Record<string, string | null>;
  routes: RouteInfo[];
  trace_events: CSPTraceEvent[];
}

export interface BenchmarkMetric {
  algorithm: string;
  scale: string;
  allocated_count: number;
  total_variables: number;
  allocation_rate_pct: number;
  total_travel_time_min: number;
  total_cost: number;
  states_explored: number;
  backtracks: number;
  backjumps: number;
  domain_values_pruned: number;
  execution_time_ms: number;
}

export interface BenchmarkResponse {
  scale: string;
  total_incidents: number;
  total_variables: number;
  results: BenchmarkMetric[];
}

export type ClickMode =
  | 'inspect'
  | 'add_incident'
  | 'escalate'
  | 'block_road'
  | 'toggle_center';

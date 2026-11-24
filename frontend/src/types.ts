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
  priority: number; // 1 to 5 (5 = Critical, 1 = Low)
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

export type CSPAlgorithm = 'backtracking' | 'backjumping' | 'min_conflicts';
export type CSPInference = 'none' | 'forward_checking' | 'mac';
export type VarHeuristic = 'priority' | 'mrv' | 'mrv_degree';
export type ValHeuristic = 'nearest' | 'lcv';

export interface CSPSolveRequest {
  algorithm: CSPAlgorithm;
  use_node_consistency: boolean;
  use_ac3: boolean;
  use_path_consistency: boolean;
  inference: CSPInference;
  var_heuristic: VarHeuristic;
  val_heuristic: ValHeuristic;
  max_steps: number;
  initial_strategy: 'nearest' | 'random';
  random_walk_prob: number;
  allow_random_restart: boolean;
  time_limit_sec: number;
}

export type CSPEventType =
  | 'INIT'
  | 'NODE_PRUNE'
  | 'AC3_CHECK_ARC'
  | 'AC3_PRUNE'
  | 'AC3_REQUEUE'
  | 'PC_TRIPLE_CHECK'
  | 'PC_CONFLICT'
  | 'PC_PRUNE'
  | 'HEURISTIC_MRV'
  | 'HEURISTIC_DEGREE'
  | 'HEURISTIC_LCV'
  | 'FC_PRUNE'
  | 'FC_WIPEOUT'
  | 'MAC_PROPAGATE'
  | 'SELECT_VAR'
  | 'TRY_VALUE'
  | 'ASSIGN_SUCCESS'
  | 'CONFLICT'
  | 'BACKTRACK'
  | 'CBJ_CONFLICT_SET'
  | 'CBJ_BACKJUMP'
  | 'LOCAL_INIT_COMPLETE'
  | 'LOCAL_PICK_CONFLICTED'
  | 'LOCAL_EVALUATE_VALUES'
  | 'LOCAL_REPAIR'
  | 'LOCAL_OPTIMUM'
  | 'EXHAUSTED'
  | 'COMPLETE';

export interface CSPTraceEvent {
  step: number;
  event_type: CSPEventType;
  var_id?: string;
  incident_id?: string;
  center_id?: string;
  unit_id?: string;
  resource_type?: string;
  details: string;
  domain_size?: number;
  conflict_set?: string[];
  skipped_vars?: string[];
  from_var?: string;
  to_var?: string;
  triple_vars?: string[];
  pruned_unit_id?: string;
  prune_reason?: string;
  total_conflicts?: number;
  conflict_scores?: Record<string, number>;
  mrv_candidate_sizes?: Record<string, number>;
  degree_count?: number;
  lcv_ruled_out_counts?: Record<string, number>;
  current_assignments_count?: number;
}

export interface RouteInfo {
  var_id: string;
  incident_id: string;
  center_id: string;
  center_name: string;
  unit_id: string;
  resource_type: string;
  distance_km: number;
  travel_time_min: number;
  cost: number;
  path_nodes: number[];
  path_coords: [number, number][]; // [lat, lng]
}

export interface CSPSolution {
  success: boolean;
  status: 'SOLVED' | 'UNSOLVABLE' | 'LOCAL_OPTIMUM' | 'PARTIAL';
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
  final_conflicts: number;
  conflicts_history: number[];
  repairs_count: number;
  execution_time_ms: number;
  subproblems_count: number;
  assignments: Record<string, string | null>;
  routes: RouteInfo[];
  trace_events: CSPTraceEvent[];
}

export interface BenchmarkMetric {
  algorithm: string;
  algorithm_family: string;
  scale: string;
  status: string;
  allocated_count: number;
  total_variables: number;
  allocation_rate_pct: number;
  total_travel_time_min: number;
  total_cost: number;
  states_or_repairs: number;
  backtracks: number;
  backjumps: number;
  skipped_levels: number;
  domains_pruned: number;
  final_conflicts: number;
  memory_profile_kb: number;
  execution_time_ms: number;
}

export interface BenchmarkResponse {
  scale: string;
  total_incidents: number;
  total_variables: number;
  results: BenchmarkMetric[];
}

export interface ConstraintGraphNode {
  id: string;
  incident_id: string;
  resource_type: string;
  priority: number;
  category: string;
  domain_size: number;
  subproblem_id: number;
  lat: number;
  lng: number;
}

export interface ConstraintGraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface SubproblemCluster {
  subproblem_id: number;
  variables_count: number;
  variables: string[];
  resource_types: string[];
  categories: string[];
  is_independent: boolean;
}

export interface ConstraintCategorySummary {
  type: string;
  description: string;
}

export interface ConstraintsSummary {
  unary_count: number;
  binary_count: number;
  global_count: number;
  higher_order_count: number;
  soft_count: number;
  total_constraints: number;
  categories: ConstraintCategorySummary[];
}

export interface FormalTupleSnapshot {
  variables_count: number;
  total_physical_units: number;
  subproblems_count: number;
  variables: any[];
  initial_domains: Record<string, string[]>;
}

export interface FormulationSnapshot {
  formal_tuple: FormalTupleSnapshot;
  constraint_graph: {
    nodes: ConstraintGraphNode[];
    edges: ConstraintGraphEdge[];
    subproblems: SubproblemCluster[];
  };
  constraints_summary: ConstraintsSummary;
}

export type ClickMode =
  | 'inspect'
  | 'add_incident'
  | 'escalate'
  | 'block_road'
  | 'toggle_center';

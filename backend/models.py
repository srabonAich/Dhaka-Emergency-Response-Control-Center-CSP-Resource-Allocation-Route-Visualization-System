from typing import List, Dict, Optional, Any, Literal
from pydantic import BaseModel, Field

ResourceType = Literal[
    "Ambulance",
    "Fire Brigade",
    "Rescue Team",
    "Police Personnel",
    "Relief Team"
]

EmergencyCategory = Literal[
    "Medical Emergency",
    "Fire",
    "Accident",
    "Flood",
    "Earthquake",
    "Crime",
    "Other"
]

CATEGORY_REQUIREMENTS: Dict[str, List[str]] = {
    "Medical Emergency": ["Ambulance"],
    "Fire": ["Fire Brigade", "Ambulance"],
    "Accident": ["Ambulance", "Police Personnel"],
    "Flood": ["Rescue Team", "Relief Team"],
    "Earthquake": ["Rescue Team", "Ambulance", "Fire Brigade"],
    "Crime": ["Police Personnel"],
    "Other": ["Ambulance", "Police Personnel"]
}

PRIORITY_MAX_TIMES: Dict[int, float] = {
    5: 18.0,  # Critical
    4: 28.0,  # High
    3: 42.0,  # Medium
    2: 60.0,  # Low
    1: 90.0   # Minor
}

class ResourceInventory(BaseModel):
    total_capacity: int
    available_units: int
    unit_cost: float
    capability_tags: List[str]

class ResourceCenter(BaseModel):
    id: str
    name: str
    area: str
    lat: float
    lng: float
    node_id: int
    operational: bool = True
    inventory: Dict[str, ResourceInventory]

class EmergencyIncident(BaseModel):
    id: str
    title: str
    category: EmergencyCategory
    priority: int = Field(ge=1, le=5)  # 5=Critical, 1=Low
    lat: float
    lng: float
    node_id: int
    required_resources: Dict[str, int]
    escalated: bool = False
    escalation_count: int = 0
    budget_max: float = 16000.0
    time_max_minutes: float = 30.0
    status: str = "PENDING"  # PENDING, ASSIGNED, PARTIAL, ESCALATED, UNASSIGNED

class RoadBlockConstraint(BaseModel):
    u: int
    v: int
    blocked: bool = True
    traffic_factor: float = 1.0  # 1.0x to 5.0x
    hazard_zone: bool = False
    name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class CSPSolveRequest(BaseModel):
    # 3 Main Algorithms
    algorithm: Literal["backtracking", "backjumping", "min_conflicts"] = "backjumping"

    # Pre-search consistency modules
    use_node_consistency: bool = True
    use_ac3: bool = True
    use_path_consistency: bool = False

    # Systematic Search Look-Ahead & Inference
    inference: Literal["none", "forward_checking", "mac"] = "forward_checking"

    # Heuristics
    var_heuristic: Literal["priority", "mrv", "mrv_degree"] = "mrv_degree"
    val_heuristic: Literal["nearest", "lcv"] = "lcv"

    # Min-Conflicts Local Search Options
    max_steps: int = 300
    initial_strategy: Literal["nearest", "random"] = "nearest"
    random_walk_prob: float = 0.05
    allow_random_restart: bool = True

    # Safeguards
    time_limit_sec: float = 15.0

class CSPTraceEvent(BaseModel):
    step: int
    event_type: Literal[
        "INIT",
        "NODE_PRUNE",
        "AC3_CHECK_ARC",
        "AC3_PRUNE",
        "AC3_REQUEUE",
        "PC_TRIPLE_CHECK",
        "PC_CONFLICT",
        "PC_PRUNE",
        "HEURISTIC_MRV",
        "HEURISTIC_DEGREE",
        "HEURISTIC_LCV",
        "FC_PRUNE",
        "FC_WIPEOUT",
        "MAC_PROPAGATE",
        "SELECT_VAR",
        "TRY_VALUE",
        "ASSIGN_SUCCESS",
        "CONFLICT",
        "BACKTRACK",
        "CBJ_CONFLICT_SET",
        "CBJ_BACKJUMP",
        "LOCAL_INIT_COMPLETE",
        "LOCAL_PICK_CONFLICTED",
        "LOCAL_EVALUATE_VALUES",
        "LOCAL_REPAIR",
        "LOCAL_OPTIMUM",
        "EXHAUSTED",
        "COMPLETE"
    ]
    var_id: Optional[str] = None
    incident_id: Optional[str] = None
    center_id: Optional[str] = None
    unit_id: Optional[str] = None
    resource_type: Optional[str] = None
    details: str
    domain_size: Optional[int] = None
    conflict_set: Optional[List[str]] = None
    skipped_vars: Optional[List[str]] = None
    from_var: Optional[str] = None
    to_var: Optional[str] = None
    triple_vars: Optional[List[str]] = None
    pruned_unit_id: Optional[str] = None
    prune_reason: Optional[str] = None
    total_conflicts: Optional[int] = None
    conflict_scores: Optional[Dict[str, int]] = None
    mrv_candidate_sizes: Optional[Dict[str, int]] = None
    degree_count: Optional[int] = None
    lcv_ruled_out_counts: Optional[Dict[str, int]] = None
    current_assignments_count: Optional[int] = None

class RouteInfo(BaseModel):
    var_id: str
    incident_id: str
    center_id: str
    center_name: str
    unit_id: str
    resource_type: str
    distance_km: float
    travel_time_min: float
    cost: float
    path_nodes: List[int]
    path_coords: List[List[float]]  # [[lat, lng], [lat, lng], ...]

class CSPSolution(BaseModel):
    success: bool
    status: Literal["SOLVED", "UNSOLVABLE", "LOCAL_OPTIMUM", "PARTIAL"]
    algorithm: str
    scale: str
    allocated_count: int
    total_variables: int
    unassigned_count: int
    total_travel_time_min: float
    total_cost: float
    states_explored: int
    backtracks: int
    backjumps: int
    domain_values_pruned: int
    final_conflicts: int = 0
    conflicts_history: List[int] = []
    repairs_count: int = 0
    execution_time_ms: float
    subproblems_count: int = 1
    assignments: Dict[str, Optional[str]]  # var_id -> unit_id or None
    routes: List[RouteInfo]
    trace_events: List[CSPTraceEvent]

class BenchmarkMetric(BaseModel):
    algorithm: str
    algorithm_family: str
    scale: str
    status: str
    allocated_count: int
    total_variables: int
    allocation_rate_pct: float
    total_travel_time_min: float
    total_cost: float
    states_or_repairs: int
    backtracks: int
    backjumps: int
    skipped_levels: int
    domains_pruned: int
    final_conflicts: int
    memory_profile_kb: float
    execution_time_ms: float

class BenchmarkResponse(BaseModel):
    scale: str
    total_incidents: int
    total_variables: int
    results: List[BenchmarkMetric]

class EscalateRequest(BaseModel):
    incident_id: str
    repair_method: Literal["min_conflicts", "re_solve"] = "min_conflicts"

class ToggleCenterRequest(BaseModel):
    center_id: str
    operational: Optional[bool] = None

class AddIncidentRequest(BaseModel):
    category: EmergencyCategory
    priority: int
    lat: float
    lng: float
    title: Optional[str] = None
    required_resources: Optional[Dict[str, int]] = None

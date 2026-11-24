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

# Mapping of Emergency Category to default required capabilities
CATEGORY_REQUIREMENTS: Dict[str, List[str]] = {
    "Medical Emergency": ["Ambulance"],
    "Fire": ["Fire Brigade", "Ambulance"],
    "Accident": ["Ambulance", "Police Personnel"],
    "Flood": ["Rescue Team", "Relief Team"],
    "Earthquake": ["Rescue Team", "Ambulance", "Fire Brigade"],
    "Crime": ["Police Personnel"],
    "Other": ["Ambulance", "Police Personnel"]
}

# Response time thresholds based on Priority (minutes)
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
    required_resources: Dict[str, int]  # e.g., {"Ambulance": 2, "Rescue Team": 1}
    escalated: bool = False
    escalation_count: int = 0
    budget_max: float = 15000.0
    time_max_minutes: float = 30.0
    status: str = "PENDING"  # PENDING, ASSIGNED, PARTIAL, ESCALATED, UNASSIGNED

class RoadBlockConstraint(BaseModel):
    u: int
    v: int
    blocked: bool = True
    traffic_factor: float = 1.0  # 1.0x to 5.0x
    hazard_zone: bool = False
    name: Optional[str] = None

class CSPVariable(BaseModel):
    var_id: str  # e.g. "X_inc1_Ambulance_0"
    incident_id: str
    resource_type: str
    unit_index: int
    priority: int

class CSPSolveRequest(BaseModel):
    algorithm: Literal[
        "backtracking",
        "backjumping",
        "ac3_backtracking",
        "path_consistency_cbj"
    ] = "path_consistency_cbj"
    use_mrv: bool = True
    use_degree: bool = True
    use_lcv: bool = True
    use_nearest_center: bool = True
    time_limit_sec: float = 15.0

class CSPTraceEvent(BaseModel):
    step: int
    event_type: Literal[
        "INIT",
        "AC3_PRUNE",
        "PC_PRUNE",
        "SELECT_VAR",
        "TRY_VALUE",
        "CONFLICT",
        "BACKTRACK",
        "BACKJUMP",
        "ASSIGN_SUCCESS",
        "EXHAUSTED",
        "COMPLETE"
    ]
    var_id: Optional[str] = None
    incident_id: Optional[str] = None
    center_id: Optional[str] = None
    resource_type: Optional[str] = None
    details: str
    domain_size: Optional[int] = None
    conflict_set: Optional[List[str]] = None
    skipped_vars: Optional[List[str]] = None
    current_assignments_count: Optional[int] = None

class RouteInfo(BaseModel):
    var_id: str
    incident_id: str
    center_id: str
    center_name: str
    resource_type: str
    distance_km: float
    travel_time_min: float
    cost: float
    path_nodes: List[int]
    path_coords: List[List[float]]  # [[lat, lng], [lat, lng], ...]

class CSPSolution(BaseModel):
    success: bool
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
    execution_time_ms: float
    assignments: Dict[str, Optional[str]]  # var_id -> center_id or None
    routes: List[RouteInfo]
    trace_events: List[CSPTraceEvent]

class BenchmarkMetric(BaseModel):
    algorithm: str
    scale: str
    allocated_count: int
    total_variables: int
    allocation_rate_pct: float
    total_travel_time_min: float
    total_cost: float
    states_explored: int
    backtracks: int
    backjumps: int
    domain_values_pruned: int
    execution_time_ms: float

class BenchmarkResponse(BaseModel):
    scale: str
    total_incidents: int
    total_variables: int
    results: List[BenchmarkMetric]

class EscalateRequest(BaseModel):
    incident_id: str

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

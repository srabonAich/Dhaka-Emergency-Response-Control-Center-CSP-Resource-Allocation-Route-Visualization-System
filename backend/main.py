import os
import copy
import logging
from typing import Dict, List, Optional, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.models import (
    EmergencyIncident, ResourceCenter, CSPSolveRequest,
    CSPSolution, BenchmarkMetric, BenchmarkResponse,
    EscalateRequest, ToggleCenterRequest, AddIncidentRequest,
    RoadBlockConstraint, CATEGORY_REQUIREMENTS, PRIORITY_MAX_TIMES
)
from backend.graph_loader import dhaka_network
from backend.dhaka_landmarks import DHAKA_LANDMARKS, RAW_RESOURCE_CENTERS
from backend.scale_generator import generate_scale_scenario
from backend.csp_solver import CSPSolver

logger = logging.getLogger("dhaka_control_center")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Dhaka Emergency Response Control Center — CSP Resource Allocation API",
    version="1.0.0"
)

# Enable CORS for frontend Vite server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-Memory State
class GlobalState:
    def __init__(self):
        self.scale: str = "Small"
        self.incidents: List[EmergencyIncident] = []
        self.centers: List[ResourceCenter] = []
        self.last_solution: Optional[CSPSolution] = None
        self.active_roadblocks: List[RoadBlockConstraint] = []

    def reset_to_scale(self, scale: str):
        self.scale = scale
        self.incidents, self.centers = generate_scale_scenario(scale)
        self.last_solution = None

state = GlobalState()
dhaka_network.load_or_build()
state.reset_to_scale("Small")

@app.on_event("startup")
def startup_event():
    logger.info("Initializing Dhaka Road Network & Spatial Graph...")
    dhaka_network.load_or_build()
    state.reset_to_scale("Small")
    logger.info(f"Initialized state with scale='Small': {len(state.incidents)} incidents, {len(state.centers)} centers.")

@app.get("/api/init")
def get_init_data():
    """Returns network summary, centers, landmarks, and active scenario."""
    return {
        "status": "ready",
        "scale": state.scale,
        "graph_stats": {
            "nodes_count": len(dhaka_network.graph.nodes),
            "edges_count": len(dhaka_network.graph.edges),
            "center": [23.777176, 90.399452],
            "bounds": {
                "min_lat": 23.705,
                "max_lat": 23.880,
                "min_lng": 90.340,
                "max_lng": 90.450
            }
        },
        "landmarks": DHAKA_LANDMARKS,
        "centers": state.centers,
        "incidents": state.incidents,
        "roadblocks": state.active_roadblocks
    }

class ScaleRequest(BaseModel):
    scale: str

@app.post("/api/generate-scale")
def generate_scale(req: ScaleRequest):
    """Generates Small, Medium, or Large benchmark scenario."""
    if req.scale not in ("Small", "Medium", "Large"):
        raise HTTPException(status_code=400, detail="Scale must be Small, Medium, or Large.")
    dhaka_network.clear_hazard_zones()
    state.active_roadblocks.clear()
    state.reset_to_scale(req.scale)
    return {
        "scale": state.scale,
        "incidents": state.incidents,
        "centers": state.centers,
        "total_incidents": len(state.incidents),
        "total_centers": len(state.centers)
    }

@app.post("/api/solve-csp", response_model=CSPSolution)
def solve_csp(req: CSPSolveRequest):
    """Executes CSP allocation with chosen algorithm, heuristics, and returns full trace."""
    if not state.incidents:
        raise HTTPException(status_code=400, detail="No active emergency incidents.")

    # Reset center available units to total capacity before solving
    for c in state.centers:
        for r_type, inv in c.inventory.items():
            inv.available_units = inv.total_capacity

    solver = CSPSolver(
        incidents=state.incidents,
        centers=state.centers,
        algorithm=req.algorithm,
        use_mrv=req.use_mrv,
        use_degree=req.use_degree,
        use_lcv=req.use_lcv,
        use_nearest_center=req.use_nearest_center,
        scale=state.scale,
        time_limit_sec=req.time_limit_sec
    )
    solution = solver.solve()
    state.last_solution = solution

    # Update incident statuses based on assignments
    for inc in state.incidents:
        assigned_units = 0
        total_units = sum(inc.required_resources.values())
        for var_id, cid in solution.assignments.items():
            if f"_{inc.id}_" in var_id and cid is not None:
                assigned_units += 1
        if assigned_units == total_units:
            inc.status = "ASSIGNED"
        elif assigned_units > 0:
            inc.status = "PARTIAL"
        else:
            inc.status = "UNASSIGNED"

    return solution

@app.post("/api/escalate-incident")
def escalate_incident(req: EscalateRequest):
    """
    Dynamic Situation Escalation ("Worsening Situation"):
    Spawns high-priority sub-requests for extra resources (e.g. +2 Ambulances, +1 Rescue Team)
    forcing the CSP solver to re-allocate from remaining available centers.
    """
    inc = next((i for i in state.incidents if i.id == req.incident_id), None)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found.")

    inc.escalated = True
    inc.escalation_count += 1
    inc.priority = 5  # Elevated to Critical
    inc.time_max_minutes = PRIORITY_MAX_TIMES[5]
    inc.budget_max += 10000.0
    inc.status = "ESCALATED"

    # Add extra resources demanded by disaster escalation
    if inc.category in ("Fire", "Earthquake"):
        inc.required_resources["Ambulance"] = inc.required_resources.get("Ambulance", 0) + 2
        inc.required_resources["Fire Brigade"] = inc.required_resources.get("Fire Brigade", 0) + 1
        inc.required_resources["Rescue Team"] = inc.required_resources.get("Rescue Team", 0) + 1
    elif inc.category == "Flood":
        inc.required_resources["Rescue Team"] = inc.required_resources.get("Rescue Team", 0) + 2
        inc.required_resources["Relief Team"] = inc.required_resources.get("Relief Team", 0) + 2
    elif inc.category == "Accident":
        inc.required_resources["Ambulance"] = inc.required_resources.get("Ambulance", 0) + 2
        inc.required_resources["Police Personnel"] = inc.required_resources.get("Police Personnel", 0) + 1
    else:
        inc.required_resources["Ambulance"] = inc.required_resources.get("Ambulance", 0) + 1
        inc.required_resources["Rescue Team"] = inc.required_resources.get("Rescue Team", 0) + 1

    return {
        "success": True,
        "escalated_incident": inc,
        "incidents": state.incidents
    }

class BenchmarkRequest(BaseModel):
    scale: Optional[str] = None

@app.post("/api/benchmark", response_model=BenchmarkResponse)
def run_benchmark(req: BenchmarkRequest):
    """
    Runs scale benchmark comparing:
    - Standard Backtracking (BT)
    - Conflict-Directed Backjumping (CBJ)
    - AC-3 + Backtracking (MAC)
    - Full Heuristics (MRV + LCV + AC3 + CBJ)
    across the current scale.
    """
    target_scale = req.scale or state.scale
    bench_incidents, bench_centers = generate_scale_scenario(target_scale)

    configurations = [
        {
            "name": "Standard Backtracking (BT)",
            "algorithm": "backtracking",
            "mrv": False,
            "degree": False,
            "lcv": False,
            "nearest": True
        },
        {
            "name": "Conflict-Directed Backjumping (CBJ)",
            "algorithm": "backjumping",
            "mrv": False,
            "degree": False,
            "lcv": False,
            "nearest": True
        },
        {
            "name": "AC-3 + Backtracking",
            "algorithm": "ac3_backtracking",
            "mrv": True,
            "degree": True,
            "lcv": False,
            "nearest": True
        },
        {
            "name": "Full Heuristics (MRV+LCV+AC3+CBJ)",
            "algorithm": "path_consistency_cbj",
            "mrv": True,
            "degree": True,
            "lcv": True,
            "nearest": True
        }
    ]

    metrics_list: List[BenchmarkMetric] = []
    total_vars = 0

    for cfg in configurations:
        # Reset centers
        test_centers = copy.deepcopy(bench_centers)
        test_incidents = copy.deepcopy(bench_incidents)

        solver = CSPSolver(
            incidents=test_incidents,
            centers=test_centers,
            algorithm=cfg["algorithm"],
            use_mrv=cfg["mrv"],
            use_degree=cfg["degree"],
            use_lcv=cfg["lcv"],
            use_nearest_center=cfg["nearest"],
            scale=target_scale,
            time_limit_sec=12.0
        )
        sol = solver.solve()
        total_vars = sol.total_variables
        alloc_rate = round((sol.allocated_count / max(1, sol.total_variables)) * 100.0, 1)

        metrics_list.append(BenchmarkMetric(
            algorithm=cfg["name"],
            scale=target_scale,
            allocated_count=sol.allocated_count,
            total_variables=sol.total_variables,
            allocation_rate_pct=alloc_rate,
            total_travel_time_min=sol.total_travel_time_min,
            total_cost=sol.total_cost,
            states_explored=sol.states_explored,
            backtracks=sol.backtracks,
            backjumps=sol.backjumps,
            domain_values_pruned=sol.domain_values_pruned,
            execution_time_ms=sol.execution_time_ms
        ))

    return BenchmarkResponse(
        scale=target_scale,
        total_incidents=len(bench_incidents),
        total_variables=total_vars,
        results=metrics_list
    )

@app.post("/api/constraints/road")
def toggle_road_block(req: RoadBlockConstraint):
    """Adds or removes a road block / hazard constraint on an edge."""
    # Find nearest nodes if not provided
    dhaka_network.set_edge_constraint(
        u=req.u,
        v=req.v,
        blocked=req.blocked,
        traffic_factor=req.traffic_factor,
        hazard_zone=req.hazard_zone
    )
    existing = next((rb for rb in state.active_roadblocks if (rb.u == req.u and rb.v == req.v) or (rb.u == req.v and rb.v == req.u)), None)
    if existing:
        if not req.blocked and req.traffic_factor == 1.0 and not req.hazard_zone:
            state.active_roadblocks.remove(existing)
        else:
            existing.blocked = req.blocked
            existing.traffic_factor = req.traffic_factor
            existing.hazard_zone = req.hazard_zone
    else:
        state.active_roadblocks.append(req)

    return {"success": True, "active_roadblocks": state.active_roadblocks}

@app.post("/api/constraints/hazard-zone")
def create_hazard_zone(lat: float, lng: float, radius: float = 800.0):
    """Simulates earthquake / flood damage making roads in a radius impassable."""
    affected = dhaka_network.add_hazard_zone(lat, lng, radius)
    return {"success": True, "affected_edges": affected, "hazard_zones": dhaka_network.hazard_zones}

@app.post("/api/constraints/center")
def toggle_center_operational(req: ToggleCenterRequest):
    """Toggles Resource Center online/offline (Resource Center Availability constraint C7)."""
    center = next((c for c in state.centers if c.id == req.center_id), None)
    if not center:
        raise HTTPException(status_code=404, detail="Center not found.")

    if req.operational is not None:
        center.operational = req.operational
    else:
        center.operational = not center.operational

    return {"success": True, "center": center, "centers": state.centers}

@app.post("/api/add-incident")
def add_custom_incident(req: AddIncidentRequest):
    """Adds a new incident clicked by the user on the map."""
    node_id = dhaka_network.find_nearest_node(req.lat, req.lng)
    inc_id = f"INC-USR-{len(state.incidents)+1:03d}"

    req_resources = req.required_resources
    if not req_resources:
        req_resources = {rt: 1 for rt in CATEGORY_REQUIREMENTS.get(req.category, ["Ambulance"])}

    title = req.title or f"{req.category} (Reported via Control Center)"

    new_inc = EmergencyIncident(
        id=inc_id,
        title=title,
        category=req.category,
        priority=req.priority,
        lat=round(req.lat, 6),
        lng=round(req.lng, 6),
        node_id=node_id,
        required_resources=req_resources,
        escalated=False,
        escalation_count=0,
        budget_max=15000.0,
        time_max_minutes=PRIORITY_MAX_TIMES.get(req.priority, 35.0),
        status="PENDING"
    )
    state.incidents.insert(0, new_inc)
    return {"success": True, "incident": new_inc, "incidents": state.incidents}

@app.post("/api/reset")
def reset_system():
    """Resets scenario, cleared routes, and restorations."""
    dhaka_network.clear_hazard_zones()
    state.active_roadblocks.clear()
    state.reset_to_scale(state.scale)
    return {"success": True, "message": "Control Center state reset to default."}

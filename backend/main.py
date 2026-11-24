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
from backend.csp_formulation import DhakaEmergencyCSP, export_formulation_snapshot
from backend.csp_solver import CSPSolverEngine

logger = logging.getLogger("dhaka_control_center")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Dhaka Emergency Response Control Center — CSP Resource Allocation API",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    """Returns network summary, centers, landmarks, active scenario, and formulation snapshot."""
    csp = DhakaEmergencyCSP(state.incidents, state.centers)
    formulation_snapshot = export_formulation_snapshot(csp)

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
        "roadblocks": state.active_roadblocks,
        "formulation": formulation_snapshot
    }

@app.get("/api/csp/formulation")
def get_csp_formulation():
    """Returns the formal (X, D, C) tuple, Constraint Graph, and Independent Subproblems."""
    csp = DhakaEmergencyCSP(state.incidents, state.centers)
    return export_formulation_snapshot(csp)

@app.get("/api/csp/formulation-doc")
def get_formulation_document():
    """Returns the academic CSP_FORMULATION.md specification document."""
    doc_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "CSP_FORMULATION.md")
    if not os.path.exists(doc_path):
        doc_path = "CSP_FORMULATION.md"

    if os.path.exists(doc_path):
        with open(doc_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"markdown": content}
    return {"markdown": "# CSP Technical Specification\nDocument not found on disk."}

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

    csp = DhakaEmergencyCSP(state.incidents, state.centers)
    formulation_snapshot = export_formulation_snapshot(csp)

    return {
        "scale": state.scale,
        "incidents": state.incidents,
        "centers": state.centers,
        "total_incidents": len(state.incidents),
        "total_centers": len(state.centers),
        "formulation": formulation_snapshot
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

    engine = CSPSolverEngine(
        incidents=state.incidents,
        centers=state.centers,
        solve_request=req,
        scale=state.scale
    )
    solution = engine.solve()
    state.last_solution = solution

    # Update incident statuses based on assignments
    for inc in state.incidents:
        assigned_units = 0
        total_units = sum(inc.required_resources.values())
        for var_id, uid in solution.assignments.items():
            if f"_{inc.id}_" in var_id and uid is not None:
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
    Spawns high-priority sub-requests for extra resources (e.g. +2 Ambulances, +1 Rescue Team).
    Supports fast local repair using Min-Conflicts without restarting systematic search from scratch.
    """
    inc = next((i for i in state.incidents if i.id == req.incident_id), None)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found.")

    inc.escalated = True
    inc.escalation_count += 1
    inc.priority = 5
    inc.time_max_minutes = PRIORITY_MAX_TIMES[5]
    inc.budget_max += 10000.0
    inc.status = "ESCALATED"

    # Spawn disaster escalation requirements
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

    repaired_solution = None
    if req.repair_method == "min_conflicts" and state.last_solution:
        # Fast local repair using Min-Conflicts
        engine = CSPSolverEngine(
            incidents=state.incidents,
            centers=state.centers,
            solve_request=CSPSolveRequest(algorithm="min_conflicts", max_steps=150),
            scale=state.scale
        )
        repaired_solution = engine.solve_min_conflicts(initial_assignments=state.last_solution.assignments)
        state.last_solution = repaired_solution

    return {
        "success": True,
        "escalated_incident": inc,
        "incidents": state.incidents,
        "repaired_solution": repaired_solution
    }

class BenchmarkRequest(BaseModel):
    scale: Optional[str] = None

@app.post("/api/benchmark", response_model=BenchmarkResponse)
def run_benchmark(req: BenchmarkRequest):
    """
    Runs comprehensive benchmark comparing all 3 main solver families:
    1. Backtracking (Pure BT)
    2. Backtracking (BT + Forward Checking + MRV/Degree)
    3. Backtracking (BT + MAC + LCV)
    4. Conflict-Directed Backjumping (CBJ + FC + MRV)
    5. Local Search (Min-Conflicts - Greedy Nearest)
    6. Local Search (Min-Conflicts - Random Walk/Restart)
    """
    target_scale = req.scale or state.scale
    bench_incidents, bench_centers = generate_scale_scenario(target_scale)

    configurations = [
        {
            "name": "Backtracking (Pure BT)",
            "family": "Backtracking",
            "algorithm": "backtracking",
            "inference": "none",
            "var_h": "priority",
            "val_h": "nearest",
            "nc": False, "ac3": False, "pc": False
        },
        {
            "name": "Backtracking (BT + FC + MRV/Degree)",
            "family": "Backtracking",
            "algorithm": "backtracking",
            "inference": "forward_checking",
            "var_h": "mrv_degree",
            "val_h": "nearest",
            "nc": True, "ac3": False, "pc": False
        },
        {
            "name": "Backtracking (BT + MAC + LCV)",
            "family": "Backtracking",
            "algorithm": "backtracking",
            "inference": "mac",
            "var_h": "mrv_degree",
            "val_h": "lcv",
            "nc": True, "ac3": True, "pc": False
        },
        {
            "name": "Conflict-Directed Backjumping (CBJ + FC + MRV)",
            "family": "Backjumping",
            "algorithm": "backjumping",
            "inference": "forward_checking",
            "var_h": "mrv_degree",
            "val_h": "lcv",
            "nc": True, "ac3": True, "pc": False
        },
        {
            "name": "Local Search (Min-Conflicts - Greedy)",
            "family": "Local Search",
            "algorithm": "min_conflicts",
            "strategy": "nearest",
            "walk_p": 0.0,
            "nc": True, "ac3": False, "pc": False
        },
        {
            "name": "Local Search (Min-Conflicts - Random Walk/Restart)",
            "family": "Local Search",
            "algorithm": "min_conflicts",
            "strategy": "nearest",
            "walk_p": 0.08,
            "nc": True, "ac3": False, "pc": False
        }
    ]

    metrics_list: List[BenchmarkMetric] = []
    total_vars = 0

    for cfg in configurations:
        test_centers = copy.deepcopy(bench_centers)
        test_incidents = copy.deepcopy(bench_incidents)

        solve_req = CSPSolveRequest(
            algorithm=cfg["algorithm"],
            use_node_consistency=cfg.get("nc", True),
            use_ac3=cfg.get("ac3", False),
            use_path_consistency=cfg.get("pc", False),
            inference=cfg.get("inference", "forward_checking"),
            var_heuristic=cfg.get("var_h", "mrv_degree"),
            val_heuristic=cfg.get("val_h", "lcv"),
            initial_strategy=cfg.get("strategy", "nearest"),
            random_walk_prob=cfg.get("walk_p", 0.05),
            max_steps=350,
            time_limit_sec=12.0
        )

        engine = CSPSolverEngine(
            incidents=test_incidents,
            centers=test_centers,
            solve_request=solve_req,
            scale=target_scale
        )
        sol = engine.solve()
        total_vars = sol.total_variables
        alloc_rate = round((sol.allocated_count / max(1, sol.total_variables)) * 100.0, 1)

        states_repairs = sol.states_explored if cfg["family"] != "Local Search" else sol.repairs_count

        # Estimate memory profile based on tree depth or flat state
        mem_kb = round(len(engine.csp.variables) * (len(engine.csp.physical_units) * 0.12 if cfg["family"] != "Local Search" else 0.08), 2)

        metrics_list.append(BenchmarkMetric(
            algorithm=cfg["name"],
            algorithm_family=cfg["family"],
            scale=target_scale,
            status=sol.status,
            allocated_count=sol.allocated_count,
            total_variables=sol.total_variables,
            allocation_rate_pct=alloc_rate,
            total_travel_time_min=sol.total_travel_time_min,
            total_cost=sol.total_cost,
            states_or_repairs=states_repairs,
            backtracks=sol.backtracks,
            backjumps=sol.backjumps,
            skipped_levels=engine.skipped_levels_total,
            domains_pruned=sol.domain_values_pruned,
            final_conflicts=sol.final_conflicts,
            memory_profile_kb=mem_kb,
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
    affected = dhaka_network.add_hazard_zone(lat, lng, radius)
    return {"success": True, "affected_edges": affected, "hazard_zones": dhaka_network.hazard_zones}

@app.post("/api/constraints/center")
def toggle_center_operational(req: ToggleCenterRequest):
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
    dhaka_network.clear_hazard_zones()
    state.active_roadblocks.clear()
    state.reset_to_scale(state.scale)
    return {"success": True, "message": "Control Center state reset to default."}

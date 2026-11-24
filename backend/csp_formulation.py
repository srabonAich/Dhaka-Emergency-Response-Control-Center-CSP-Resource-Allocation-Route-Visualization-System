"""
CSP Formulation Module for Dhaka Emergency Response Control Center
Explicitly defines the Finite Discrete Constraint Satisfaction Problem tuple (X, D, C),
the Constraint Graph, and Independent Subproblem Decomposition.
"""

from typing import List, Dict, Set, Tuple, Optional, Any, Callable
from dataclasses import dataclass, field
import networkx as nx

from backend.models import EmergencyIncident, ResourceCenter, PRIORITY_MAX_TIMES
from backend.graph_loader import dhaka_network

# ---------------------------------------------------------------------------
# 1. Discrete Resource Unit & Variable Definitions
# ---------------------------------------------------------------------------

@dataclass
class DiscreteResourceUnit:
    """Represents a specific physical emergency response unit (e.g. DMCH_Ambulance_1)."""
    unit_id: str
    center_id: str
    center_name: str
    resource_type: str
    unit_number: int
    unit_cost: float
    capability_tags: List[str]
    operational: bool
    center_lat: float
    center_lng: float
    center_node_id: int

@dataclass
class CSPVariable:
    """Represents a single required resource slot X_{incident_id, resource_type, slot_idx}."""
    var_id: str
    incident_id: str
    resource_type: str
    slot_index: int
    priority: int  # 1 (Low) to 5 (Critical)
    incident_lat: float
    incident_lng: float
    incident_node_id: int
    budget_max: float
    time_max_minutes: float
    category: str
    subproblem_id: int = 0  # Tagged after connected components analysis

    def to_dict(self) -> Dict[str, Any]:
        return {
            "var_id": self.var_id,
            "incident_id": self.incident_id,
            "resource_type": self.resource_type,
            "slot_index": self.slot_index,
            "priority": self.priority,
            "incident_lat": self.incident_lat,
            "incident_lng": self.incident_lng,
            "incident_node_id": self.incident_node_id,
            "budget_max": self.budget_max,
            "time_max_minutes": self.time_max_minutes,
            "category": self.category,
            "subproblem_id": self.subproblem_id,
        }

# ---------------------------------------------------------------------------
# 2. Explicit Constraint Classes (All 5 Standard CSP Varieties)
# ---------------------------------------------------------------------------

class Constraint:
    """Base class for CSP constraints."""
    def __init__(self, name: str, scope: List[str], constraint_type: str):
        self.name = name
        self.scope = scope  # List of var_ids involved
        self.constraint_type = constraint_type  # 'Unary', 'Binary', 'HigherOrder', 'Global', 'Soft'

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "scope": self.scope,
            "type": self.constraint_type,
            "description": self.__doc__ or self.name
        }

class UnaryConstraint(Constraint):
    """
    Unary Constraint C(X_i): Checks validity of an individual unit assignment.
    Verifies:
      1. Capability match (unit.resource_type == var.resource_type)
      2. Resource center operational (center.operational == True)
      3. Road network accessibility (unblocked shortest path exists)
      4. Response time deadline (travel_time <= time_max_minutes)
      5. Cost constraint (unit_cost + mileage <= budget_max)
    """
    def __init__(self, var_id: str, check_fn: Callable[[DiscreteResourceUnit], Tuple[bool, str]]):
        super().__init__(name=f"Unary_{var_id}", scope=[var_id], constraint_type="Unary")
        self.var_id = var_id
        self.check_fn = check_fn

    def is_satisfied(self, unit: DiscreteResourceUnit) -> Tuple[bool, str]:
        return self.check_fn(unit)

class BinaryConstraint(Constraint):
    """
    Binary Constraint C(X_i, X_j): Mutual exclusion / No double-booking.
    Ensures two distinct incident slots cannot be assigned the exact same physical unit:
      Assignment(X_i) != Assignment(X_j)
    """
    def __init__(self, var_i: str, var_j: str):
        super().__init__(name=f"Alldiff_Pair_{var_i}_{var_j}", scope=[var_i, var_j], constraint_type="Binary")
        self.var_i = var_i
        self.var_j = var_j

    def is_satisfied(self, unit_i: str, unit_j: str) -> bool:
        return unit_i != unit_j

class HigherOrderConstraint(Constraint):
    """
    Higher-Order Constraint C(X_1, X_2, ... X_k):
    Enforces multi-variable regional restrictions, such as collective regional budget caps:
      Sum(Cost(X_k)) <= Regional_Budget
    or co-dispatch synchronization:
      |Time(X_fire) - Time(X_ambulance)| <= Max_Arrival_Delta
    """
    def __init__(self, name: str, scope: List[str], max_budget: float):
        super().__init__(name=name, scope=scope, constraint_type="HigherOrder")
        self.max_budget = max_budget

    def is_satisfied(self, costs: List[float]) -> bool:
        return sum(costs) <= self.max_budget

class GlobalConstraint(Constraint):
    """
    Global Constraint C(X_1, ... X_n):
    1. Alldiff(X): Every assigned physical unit across all simultaneous incidents must be distinct.
    2. CapacityConstraint(Center C_j): Count of variables assigned to Center C_j <= C_j.available_units.
    """
    def __init__(self, name: str, scope: List[str], center_id: Optional[str] = None, max_capacity: int = 999):
        super().__init__(name=name, scope=scope, constraint_type="Global")
        self.center_id = center_id
        self.max_capacity = max_capacity

    def check_alldiff(self, assignments: Dict[str, str]) -> bool:
        assigned_units = [u for v, u in assignments.items() if v in self.scope and u is not None]
        return len(assigned_units) == len(set(assigned_units))

    def check_center_capacity(self, assignments: Dict[str, str], unit_to_center: Dict[str, str]) -> bool:
        if not self.center_id:
            return True
        count = sum(1 for v, u in assignments.items() if v in self.scope and u and unit_to_center.get(u) == self.center_id)
        return count <= self.max_capacity

class SoftConstraint(Constraint):
    """
    Soft Constraint: Optimization preferences.
    1. Nearest Center: Minimize travel time T(C_j -> I_k) (penalty = travel_time_min).
    2. Priority Ordering: Allocate Priority 5 emergencies before Priority 1 emergencies.
    """
    def __init__(self, var_id: str, soft_type: str = "NearestCenter"):
        super().__init__(name=f"Soft_{soft_type}_{var_id}", scope=[var_id], constraint_type="Soft")
        self.var_id = var_id
        self.soft_type = soft_type

    def penalty(self, travel_time_min: float, priority: int) -> float:
        # High priority incidents receive higher penalties for long travel times
        return travel_time_min * (6.0 - priority)

# ---------------------------------------------------------------------------
# 3. Dhaka CSP Model & Constraint Graph
# ---------------------------------------------------------------------------

class DhakaEmergencyCSP:
    """
    Formal Discrete CSP Model (X, D, C) for Dhaka Emergency Response.
    Includes Constraint Graph construction and Independent Subproblem partitioning.
    """
    def __init__(self, incidents: List[EmergencyIncident], centers: List[ResourceCenter]):
        # Ensure Dhaka graph is loaded
        if len(dhaka_network.graph.nodes) == 0:
            dhaka_network.load_or_build()

        self.incidents = incidents
        self.centers = {c.id: c for c in centers}

        # 1. Instantiate Discrete Physical Units (e.g. DMCH_Ambulance_1)
        self.physical_units: Dict[str, DiscreteResourceUnit] = {}
        self.unit_to_center: Dict[str, str] = {}
        self._instantiate_physical_units()

        # 2. Formulate Variables X
        self.variables: List[CSPVariable] = []
        self.var_by_id: Dict[str, CSPVariable] = {}
        self._formulate_variables()

        # 3. Formulate Initial Unary Domains D
        self.initial_domains: Dict[str, List[str]] = {}  # var_id -> list of unit_ids
        self.route_cache: Dict[Tuple[str, str], Optional[Dict[str, Any]]] = {}
        self._precompute_routes_and_domains()

        # 4. Formulate Constraints C
        self.constraints: List[Constraint] = []
        self.unary_constraints: Dict[str, UnaryConstraint] = {}
        self.binary_constraints: List[BinaryConstraint] = []
        self.global_constraints: List[GlobalConstraint] = []
        self.higher_order_constraints: List[HigherOrderConstraint] = []
        self.soft_constraints: Dict[str, SoftConstraint] = []
        self._build_constraints()

        # 5. Build Constraint Graph & Detect Independent Subproblems
        self.constraint_graph = nx.Graph()
        self.subproblems: List[Dict[str, Any]] = []
        self._build_constraint_graph_and_subproblems()

    def _instantiate_physical_units(self):
        """Creates distinct physical units from center capacities."""
        for c in self.centers.values():
            for r_type, inv in c.inventory.items():
                for unit_idx in range(1, inv.total_capacity + 1):
                    unit_id = f"{c.id}_{r_type.replace(' ', '')}_{unit_idx}"
                    unit = DiscreteResourceUnit(
                        unit_id=unit_id,
                        center_id=c.id,
                        center_name=c.name,
                        resource_type=r_type,
                        unit_number=unit_idx,
                        unit_cost=inv.unit_cost,
                        capability_tags=inv.capability_tags,
                        operational=c.operational,
                        center_lat=c.lat,
                        center_lng=c.lng,
                        center_node_id=c.node_id
                    )
                    self.physical_units[unit_id] = unit
                    self.unit_to_center[unit_id] = c.id

    def _formulate_variables(self):
        """Constructs variables X_{k, r, m}."""
        for inc in self.incidents:
            for r_type, count in inc.required_resources.items():
                for slot_idx in range(count):
                    var_id = f"X_{inc.id}_{r_type.replace(' ', '')}_{slot_idx}"
                    var = CSPVariable(
                        var_id=var_id,
                        incident_id=inc.id,
                        resource_type=r_type,
                        slot_index=slot_idx,
                        priority=inc.priority,
                        incident_lat=inc.lat,
                        incident_lng=inc.lng,
                        incident_node_id=inc.node_id,
                        budget_max=inc.budget_max,
                        time_max_minutes=inc.time_max_minutes,
                        category=inc.category
                    )
                    self.variables.append(var)
                    self.var_by_id[var_id] = var

        # Sort variables by priority (Critical 5 down to Low 1) as baseline
        self.variables.sort(key=lambda v: -v.priority)

    def _precompute_routes_and_domains(self):
        """Precomputes road distances and populates initial raw domains."""
        center_nodes = [c.node_id for c in self.centers.values() if c.operational]
        incident_nodes = [inc.node_id for inc in self.incidents]
        raw_routes = dhaka_network.precompute_routes_matrix(center_nodes, incident_nodes)

        for c_id, center in self.centers.items():
            for inc in self.incidents:
                pair = (center.node_id, inc.node_id)
                self.route_cache[(c_id, inc.id)] = raw_routes.get(pair, None)

        for var in self.variables:
            matching_units: List[Tuple[str, float]] = []
            for unit_id, unit in self.physical_units.items():
                if unit.resource_type != var.resource_type:
                    continue
                route = self.route_cache.get((unit.center_id, var.incident_id))
                travel_time = route["travel_time_min"] if route else 999.0
                matching_units.append((unit_id, travel_time))

            # Order initial domain by nearest-center preference
            matching_units.sort(key=lambda item: item[1])
            self.initial_domains[var.var_id] = [item[0] for item in matching_units]

    def _build_constraints(self):
        """Instantiates Unary, Binary, Global, HigherOrder, and Soft constraints."""
        # Unary constraints per variable
        for var in self.variables:
            def make_unary_check(v: CSPVariable):
                def check(unit: DiscreteResourceUnit) -> Tuple[bool, str]:
                    if unit.resource_type != v.resource_type:
                        return False, f"Capability mismatch: requires {v.resource_type}, unit is {unit.resource_type}"
                    if not unit.operational:
                        return False, f"Center '{unit.center_name}' is offline (Operational == False)"
                    route = self.route_cache.get((unit.center_id, v.incident_id))
                    if not route:
                        return False, f"Road unreachable from '{unit.center_name}' (Blocked/Hazard)"
                    if route["travel_time_min"] > v.time_max_minutes:
                        return False, f"Exceeds max response time ({route['travel_time_min']}m > {v.time_max_minutes}m)"
                    cost = unit.unit_cost + (route["distance_km"] * 12.0)
                    if cost > v.budget_max:
                        return False, f"Cost exceeds budget (${cost:.1f} > ${v.budget_max:.1f})"
                    return True, "Satisfied"
                return check

            u_c = UnaryConstraint(var.var_id, make_unary_check(var))
            self.unary_constraints[var.var_id] = u_c
            self.constraints.append(u_c)

            # Soft constraint
            s_c = SoftConstraint(var.var_id, "NearestCenter")
            self.soft_constraints.append(s_c)
            self.constraints.append(s_c)

        # Binary constraints: All pairs of variables requiring the same resource type
        var_by_res: Dict[str, List[CSPVariable]] = {}
        for var in self.variables:
            var_by_res.setdefault(var.resource_type, []).append(var)

        for r_type, v_list in var_by_res.items():
            for i in range(len(v_list)):
                for j in range(i + 1, len(v_list)):
                    b_c = BinaryConstraint(v_list[i].var_id, v_list[j].var_id)
                    self.binary_constraints.append(b_c)
                    self.constraints.append(b_c)

        # Global constraints: Alldiff and Center Capacities
        for r_type, v_list in var_by_res.items():
            g_c = GlobalConstraint(f"Alldiff_{r_type}", [v.var_id for v in v_list])
            self.global_constraints.append(g_c)
            self.constraints.append(g_c)

        # Higher-Order constraints: Multi-incident regional budget caps (e.g. Dhanmondi, Gulshan, Mirpur)
        areas = set(inc.title.split(" near ")[-1] for inc in self.incidents if " near " in inc.title)
        for area in list(areas)[:4]:
            area_vars = [v.var_id for v in self.variables if area in next(i.title for i in self.incidents if i.id == v.incident_id)]
            if len(area_vars) >= 2:
                ho_c = HigherOrderConstraint(f"RegionalBudget_{area.replace(' ', '_')}", area_vars, max_budget=45000.0)
                self.higher_order_constraints.append(ho_c)
                self.constraints.append(ho_c)

    def _build_constraint_graph_and_subproblems(self):
        """
        Builds the CSP Constraint Graph (Nodes = Variables, Edges = shared resource competition).
        Detects independent connected components / subproblems.
        """
        self.constraint_graph.clear()

        # Add Nodes
        for var in self.variables:
            self.constraint_graph.add_node(
                var.var_id,
                incident_id=var.incident_id,
                resource_type=var.resource_type,
                priority=var.priority,
                category=var.category,
                lat=var.incident_lat,
                lng=var.incident_lng
            )

        # Add Edges between variables that share binary constraints (i.e. compete for same physical unit pool)
        for b_c in self.binary_constraints:
            self.constraint_graph.add_edge(b_c.var_i, b_c.var_j, constraint_type="BinaryAlldiff")

        # Detect Independent Subproblems (Connected Components)
        components = list(nx.connected_components(self.constraint_graph))
        self.subproblems = []

        for sub_id, comp in enumerate(components, start=1):
            comp_vars = list(comp)
            res_types = list(set(self.var_by_id[v].resource_type for v in comp_vars))
            categories = list(set(self.var_by_id[v].category for v in comp_vars))

            # Tag each variable with its subproblem ID
            for v_id in comp_vars:
                self.var_by_id[v_id].subproblem_id = sub_id

            self.subproblems.append({
                "subproblem_id": sub_id,
                "name": f"Subproblem #{sub_id}: {', '.join(categories[:2])} ({', '.join(res_types)})",
                "variables_count": len(comp_vars),
                "variables": comp_vars,
                "resource_types": res_types,
                "categories": categories,
                "is_independent": True
            })

def export_formulation_snapshot(csp: DhakaEmergencyCSP) -> Dict[str, Any]:
    """Serializes the complete (X, D, C) CSP tuple and Constraint Graph for frontend inspection."""
    nodes = []
    for var in csp.variables:
        nodes.append({
            "id": var.var_id,
            "incident_id": var.incident_id,
            "resource_type": var.resource_type,
            "priority": var.priority,
            "category": var.category,
            "domain_size": len(csp.initial_domains.get(var.var_id, [])),
            "subproblem_id": var.subproblem_id,
            "lat": var.incident_lat,
            "lng": var.incident_lng
        })

    edges = []
    for u, v, data in csp.constraint_graph.edges(data=True):
        edges.append({
            "source": u,
            "target": v,
            "type": data.get("constraint_type", "BinaryAlldiff")
        })

    # Summary of constraints
    constraints_summary = {
        "unary_count": len(csp.unary_constraints),
        "binary_count": len(csp.binary_constraints),
        "global_count": len(csp.global_constraints),
        "higher_order_count": len(csp.higher_order_constraints),
        "soft_count": len(csp.soft_constraints),
        "total_constraints": len(csp.constraints),
        "categories": [
            {
                "type": "Unary Constraints (C1, C2, C4, C6, C7)",
                "description": "Evaluates unit capability, center operational state, road network reachability, response time threshold, and incident budget limit."
            },
            {
                "type": "Binary Constraints (Mutual Exclusion)",
                "description": "No double-booking: Assignment(X_i) != Assignment(X_j) for all incident slots requiring the same physical resource unit."
            },
            {
                "type": "Global Constraints (Alldiff & Capacity)",
                "description": "Alldiff across all simultaneous dispatch slots + Center Capacity limits per emergency service hub."
            },
            {
                "type": "Higher-Order Constraints",
                "description": "Regional multi-incident emergency budget limits and coordinated arrival time bounds."
            },
            {
                "type": "Soft Constraints (Preferences)",
                "description": "Nearest-center dispatch minimization + Emergency priority scheduling (Priority 5 Critical before Priority 1 Low)."
            }
        ]
    }

    return {
        "formal_tuple": {
            "variables_count": len(csp.variables),
            "total_physical_units": len(csp.physical_units),
            "subproblems_count": len(csp.subproblems),
            "variables": [v.to_dict() for v in csp.variables],
            "initial_domains": {v_id: units for v_id, units in csp.initial_domains.items()}
        },
        "constraint_graph": {
            "nodes": nodes,
            "edges": edges,
            "subproblems": csp.subproblems
        },
        "constraints_summary": constraints_summary
    }

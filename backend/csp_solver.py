import time
import copy
from typing import Dict, List, Set, Tuple, Optional, Any
from backend.models import (
    EmergencyIncident, ResourceCenter, CSPVariable,
    CSPTraceEvent, RouteInfo, CSPSolution, BenchmarkMetric,
    PRIORITY_MAX_TIMES
)
from backend.graph_loader import dhaka_network

class CSPSolver:
    def __init__(
        self,
        incidents: List[EmergencyIncident],
        centers: List[ResourceCenter],
        algorithm: str = "path_consistency_cbj",
        use_mrv: bool = True,
        use_degree: bool = True,
        use_lcv: bool = True,
        use_nearest_center: bool = True,
        scale: str = "Small",
        time_limit_sec: float = 15.0
    ):
        self.incidents = incidents
        self.centers = {c.id: c for c in centers}
        self.algorithm = algorithm
        self.use_mrv = use_mrv
        self.use_degree = use_degree
        self.use_lcv = use_lcv
        self.use_nearest_center = use_nearest_center
        self.scale = scale
        self.time_limit_sec = time_limit_sec

        # Telemetry & Metrics
        self.states_explored: int = 0
        self.backtracks: int = 0
        self.backjumps: int = 0
        self.domain_values_pruned: int = 0
        self.start_time: float = 0.0
        self.trace_events: List[CSPTraceEvent] = []
        self.step_counter: int = 0
        self.max_trace_events: int = 1200  # Safeguard for frontend JSON transfer

        # Shortest path & accessibility cache: (center_id, incident_id) -> route_dict
        self.route_cache: Dict[Tuple[str, str], Optional[Dict[str, Any]]] = {}

        # CSP Structure
        self.variables: List[CSPVariable] = []
        self.var_by_id: Dict[str, CSPVariable] = {}
        self.inc_by_id: Dict[str, EmergencyIncident] = {i.id: i for i in self.incidents}
        self.initial_domains: Dict[str, List[str]] = {}  # var_id -> list of center_ids
        self.conflict_sets: Dict[str, Set[str]] = {}     # var_id -> set of var_ids

    def _record_trace(
        self,
        event_type: str,
        details: str,
        var_id: Optional[str] = None,
        incident_id: Optional[str] = None,
        center_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        domain_size: Optional[int] = None,
        conflict_set: Optional[List[str]] = None,
        skipped_vars: Optional[List[str]] = None,
        current_assignments_count: Optional[int] = None
    ) -> None:
        if len(self.trace_events) >= self.max_trace_events and event_type not in ("COMPLETE", "EXHAUSTED", "BACKJUMP"):
            return
        self.step_counter += 1
        event = CSPTraceEvent(
            step=self.step_counter,
            event_type=event_type,
            var_id=var_id,
            incident_id=incident_id,
            center_id=center_id,
            resource_type=resource_type,
            details=details,
            domain_size=domain_size,
            conflict_set=conflict_set,
            skipped_vars=skipped_vars,
            current_assignments_count=current_assignments_count
        )
        self.trace_events.append(event)

    def precompute_accessibility(self) -> None:
        """
        Precomputes the shortest-path travel time and accessibility matrix
        between all active Resource Centers and active Incident nodes.
        Ensures O(1) road queries during CSP tree search.
        """
        center_nodes = [c.node_id for c in self.centers.values() if c.operational]
        incident_nodes = [inc.node_id for inc in self.incidents]
        raw_matrix = dhaka_network.precompute_routes_matrix(center_nodes, incident_nodes)

        # Map to (center_id, incident_id)
        for c in self.centers.values():
            for inc in self.incidents:
                pair = (c.node_id, inc.node_id)
                self.route_cache[(c.id, inc.id)] = raw_matrix.get(pair, None)

    def formulate_csp(self) -> None:
        """
        Formulates Variables X and initial Domains D with constraints C1, C2, C4, C6, C7 applied.
        """
        self.variables = []
        self.var_by_id = {}
        self.inc_by_id = {i.id: i for i in self.incidents}
        self.initial_domains = {}
        self.conflict_sets = {}

        # 1. Variables X: X_{incident_id}_{resource_type}_{unit_idx}
        for inc in self.incidents:
            for r_type, count in inc.required_resources.items():
                for m in range(count):
                    var_id = f"X_{inc.id}_{r_type.replace(' ', '')}_{m}"
                    var = CSPVariable(
                        var_id=var_id,
                        incident_id=inc.id,
                        resource_type=r_type,
                        unit_index=m,
                        priority=inc.priority
                    )
                    self.variables.append(var)
                    self.var_by_id[var_id] = var
                    self.conflict_sets[var_id] = set()

        # Variable Priority Ordering (Critical 5 down to Low 1)
        self.variables.sort(key=lambda v: -v.priority)

        # 2. Domains D: Resource Centers capable of providing resource type
        for var in self.variables:
            inc = self.inc_by_id[var.incident_id]
            max_time = PRIORITY_MAX_TIMES.get(inc.priority, 40.0)
            valid_centers: List[Tuple[str, float]] = []

            for cid, center in self.centers.items():
                # C7: Resource Center Operational
                if not center.operational:
                    continue
                # C6 & C3: Resource Capability and base capacity > 0
                inv = center.inventory.get(var.resource_type)
                if not inv or inv.available_units <= 0:
                    continue

                # C4: Road Accessibility
                route = self.route_cache.get((cid, inc.id))
                if not route:
                    continue

                # C1: Response Time Constraint
                travel_time = route["travel_time_min"]
                if travel_time > max_time:
                    continue

                # C2: Budget / Cost Constraint
                total_cost = inv.unit_cost + (route["distance_km"] * 12.0)
                if total_cost > inc.budget_max:
                    continue

                valid_centers.append((cid, travel_time))

            # Nearest-Center-First ordering (minimum travel time)
            valid_centers.sort(key=lambda item: item[1])
            self.initial_domains[var.var_id] = [item[0] for item in valid_centers]

        self._record_trace(
            event_type="INIT",
            details=f"Formulated CSP with {len(self.variables)} variables and {len(self.centers)} Resource Centers across Dhaka.",
            current_assignments_count=0
        )

    # -------------------------------------------------------------
    # CSP Consistency Techniques: AC-3 & Path Consistency
    # -------------------------------------------------------------
    def apply_ac3(
        self,
        domains: Dict[str, List[str]],
        current_capacity: Dict[str, Dict[str, int]],
        trigger_var_id: Optional[str] = None
    ) -> bool:
        """
        Arc Consistency (AC-3): Enforces binary consistency between variables
        sharing finite center capacities.
        When trigger_var_id is passed, runs localized MAC on directly affected neighbors.
        """
        queue: List[Tuple[str, str]] = []
        var_by_res: Dict[str, List[str]] = {}
        for var in self.variables:
            var_by_res.setdefault(var.resource_type, []).append(var.var_id)

        if trigger_var_id:
            t_var = self.var_by_id.get(trigger_var_id)
            if t_var:
                for other_id in var_by_res.get(t_var.resource_type, []):
                    if other_id != trigger_var_id:
                        queue.append((other_id, trigger_var_id))
        else:
            for r_type, v_ids in var_by_res.items():
                limit = min(50, len(v_ids))
                for i in range(limit):
                    xi_id = v_ids[i]
                    for j in range(limit):
                        if i != j:
                            queue.append((xi_id, v_ids[j]))

        max_checks = 1500
        checks = 0

        while queue and checks < max_checks:
            checks += 1
            xi_id, xj_id = queue.pop(0)
            if self._revise_ac3(xi_id, xj_id, domains, current_capacity):
                xi_var = self.var_by_id[xi_id]
                for xk_id in var_by_res.get(xi_var.resource_type, [])[:10]:
                    if xk_id != xi_id and xk_id != xj_id and (xk_id, xi_id) not in queue:
                        queue.append((xk_id, xi_id))
        return True

    def _revise_ac3(
        self,
        xi_id: str,
        xj_id: str,
        domains: Dict[str, List[str]],
        current_capacity: Dict[str, Dict[str, int]]
    ) -> bool:
        revised = False
        xi_var = self.var_by_id[xi_id]
        xj_var = self.var_by_id[xj_id]

        # Higher priority variable dominates
        if xi_var.priority > xj_var.priority:
            return False

        r_type = xi_var.resource_type
        to_remove = []

        xj_dom = domains.get(xj_id, [])
        for cid in domains.get(xi_id, []):
            cap = current_capacity.get(cid, {}).get(r_type, 0)
            if cap <= 1 and xj_dom == [cid]:
                to_remove.append(cid)

        if to_remove:
            for cid in to_remove:
                if cid in domains[xi_id]:
                    domains[xi_id].remove(cid)
                    self.domain_values_pruned += 1
                    c_name = self.centers[cid].name
                    self._record_trace(
                        event_type="AC3_PRUNE",
                        var_id=xi_id,
                        incident_id=xi_var.incident_id,
                        center_id=cid,
                        resource_type=r_type,
                        domain_size=len(domains[xi_id]),
                        details=f"[AC-3] Pruned center '{c_name}' from variable {xi_id}: reserved for higher-priority {xj_id}."
                    )
            revised = True
        return revised

    def apply_path_consistency(self, domains: Dict[str, List[str]], current_capacity: Dict[str, Dict[str, int]]) -> None:
        """
        Path Consistency (PC-2 / 3-Consistency):
        Verifies triples (X_i, X_j, X_k) sharing limited resource center capacities.
        Prunes center values from lower-priority variables when mutual capacity cannot support all three.
        """
        var_by_res: Dict[str, List[str]] = {}
        for var in self.variables:
            var_by_res.setdefault(var.resource_type, []).append(var.var_id)

        for r_type, v_ids in var_by_res.items():
            if len(v_ids) < 3:
                continue
            # Sample triples
            for i in range(min(5, len(v_ids))):
                xi_id = v_ids[i]
                xi_var = self.var_by_id[xi_id]
                for j in range(i + 1, min(6, len(v_ids))):
                    xj_id = v_ids[j]
                    xj_var = self.var_by_id[xj_id]
                    for k in range(j + 1, min(7, len(v_ids))):
                        xk_id = v_ids[k]
                        xk_var = self.var_by_id[xk_id]

                        # Only prune if xi has lower priority than at least one peer
                        if xi_var.priority > xj_var.priority and xi_var.priority > xk_var.priority:
                            continue

                        to_prune_xi = []
                        for ca in domains.get(xi_id, []):
                            has_support = False
                            for cb in domains.get(xj_id, []):
                                for cc in domains.get(xk_id, []):
                                    needed = {ca: 0, cb: 0, cc: 0}
                                    needed[ca] += 1
                                    needed[cb] += 1
                                    needed[cc] += 1
                                    if all(needed[c] <= current_capacity.get(c, {}).get(r_type, 0) for c in needed):
                                        has_support = True
                                        break
                                if has_support:
                                    break
                            if not has_support:
                                to_prune_xi.append(ca)

                        for ca in to_prune_xi:
                            if ca in domains[xi_id] and len(domains[xi_id]) > 1:
                                domains[xi_id].remove(ca)
                                self.domain_values_pruned += 1
                                self._record_trace(
                                    event_type="PC_PRUNE",
                                    var_id=xi_id,
                                    center_id=ca,
                                    resource_type=r_type,
                                    domain_size=len(domains[xi_id]),
                                    details=f"[PC-2] Pruned center '{self.centers[ca].name}' from {xi_id}: 3-consistency capacity conflict with ({xj_id}, {xk_id})."
                                )

    # -------------------------------------------------------------
    # CSP Heuristics: MRV, Degree, LCV
    # -------------------------------------------------------------
    def select_unassigned_variable(
        self,
        unassigned_vars: List[CSPVariable],
        domains: Dict[str, List[str]]
    ) -> CSPVariable:
        """
        Orders unassigned variables by:
        1. Emergency Priority (5 down to 1)
        2. MRV (Minimum Remaining Values in domain)
        3. Degree Heuristic (most constraints with other unassigned variables)
        """
        if not self.use_mrv and not self.use_degree:
            return unassigned_vars[0]

        best_var = unassigned_vars[0]
        best_score = None

        for var in unassigned_vars:
            d_size = len(domains.get(var.var_id, [])) if self.use_mrv else 1000
            # Degree: number of unassigned vars sharing the same resource type
            degree = sum(1 for other in unassigned_vars if other.var_id != var.var_id and other.resource_type == var.resource_type) if self.use_degree else 0
            # Tuple comparison: (-priority, d_size, -degree)
            score = (-var.priority, d_size, -degree)
            if best_score is None or score < best_score:
                best_score = score
                best_var = var

        return best_var

    def order_domain_values(
        self,
        var: CSPVariable,
        domains: Dict[str, List[str]],
        current_capacity: Dict[str, Dict[str, int]],
        unassigned_vars: List[CSPVariable]
    ) -> List[str]:
        """
        Values ordering:
        - Nearest-Center-First (travel time)
        - LCV (Least Constraining Value): prefers centers with higher remaining surplus capacity
        """
        raw_values = domains.get(var.var_id, [])
        if not raw_values:
            return []

        if not self.use_lcv:
            return raw_values

        def lcv_score(cid: str) -> float:
            route = self.route_cache.get((cid, var.incident_id))
            t_min = route["travel_time_min"] if route else 999.0
            rem_cap = current_capacity.get(cid, {}).get(var.resource_type, 0)
            # LCV: Higher surplus capacity means less constraint pressure on peers
            return t_min - (rem_cap * 2.0)

        return sorted(raw_values, key=lcv_score)

    # -------------------------------------------------------------
    # Solvers: Backtracking, Conflict-Directed Backjumping, MAC
    # -------------------------------------------------------------
    def solve(self) -> CSPSolution:
        self.start_time = time.time()
        self.precompute_accessibility()
        self.formulate_csp()

        current_capacity: Dict[str, Dict[str, int]] = {}
        for cid, center in self.centers.items():
            current_capacity[cid] = {}
            for r_type, inv in center.inventory.items():
                current_capacity[cid][r_type] = inv.available_units

        # Apply preprocessing consistency if requested
        domains = copy.deepcopy(self.initial_domains)
        if "ac3" in self.algorithm or "path_consistency" in self.algorithm:
            self.apply_ac3(domains, current_capacity)
        if "path_consistency" in self.algorithm:
            self.apply_path_consistency(domains, current_capacity)

        assignments: Dict[str, Optional[str]] = {}
        unassigned_vars = list(self.variables)

        # Execute selected solver algorithm
        if self.algorithm == "backjumping" or self.algorithm == "path_consistency_cbj":
            success = self._search_cbj(assignments, unassigned_vars, domains, current_capacity)
        else:
            success = self._search_bt(assignments, unassigned_vars, domains, current_capacity)

        # Handle unassigned slots when resources are exhausted
        for var in self.variables:
            if var.var_id not in assignments or assignments[var.var_id] is None:
                assignments[var.var_id] = None
                self._record_trace(
                    event_type="EXHAUSTED",
                    var_id=var.var_id,
                    incident_id=var.incident_id,
                    resource_type=var.resource_type,
                    details=f"All resource centers for {var.resource_type} exhausted. Marked as UNASSIGNED."
                )

        exec_time_ms = round((time.time() - self.start_time) * 1000.0, 2)

        # Build routes and statistics
        routes: List[RouteInfo] = []
        total_travel_time = 0.0
        total_cost = 0.0
        allocated_count = 0

        for var_id, cid in assignments.items():
            if cid is not None:
                allocated_count += 1
                var = self.var_by_id[var_id]
                route_data = self.route_cache.get((cid, var.incident_id))
                if route_data:
                    c = self.centers[cid]
                    inv = c.inventory[var.resource_type]
                    cost = inv.unit_cost + (route_data["distance_km"] * 12.0)
                    total_travel_time += route_data["travel_time_min"]
                    total_cost += cost
                    routes.append(RouteInfo(
                        var_id=var_id,
                        incident_id=var.incident_id,
                        center_id=cid,
                        center_name=c.name,
                        resource_type=var.resource_type,
                        distance_km=route_data["distance_km"],
                        travel_time_min=route_data["travel_time_min"],
                        cost=round(cost, 2),
                        path_nodes=route_data["path_nodes"],
                        path_coords=dhaka_network.get_path_coords(route_data["path_nodes"])
                    ))

        unassigned_count = len(self.variables) - allocated_count

        self._record_trace(
            event_type="COMPLETE",
            details=f"CSP Search completed: {allocated_count}/{len(self.variables)} allocated ({unassigned_count} unassigned). Time: {exec_time_ms}ms.",
            current_assignments_count=allocated_count
        )

        return CSPSolution(
            success=(unassigned_count == 0),
            algorithm=self.algorithm,
            scale=self.scale,
            allocated_count=allocated_count,
            total_variables=len(self.variables),
            unassigned_count=unassigned_count,
            total_travel_time_min=round(total_travel_time, 2),
            total_cost=round(total_cost, 2),
            states_explored=self.states_explored,
            backtracks=self.backtracks,
            backjumps=self.backjumps,
            domain_values_pruned=self.domain_values_pruned,
            execution_time_ms=exec_time_ms,
            assignments=assignments,
            routes=routes,
            trace_events=self.trace_events
        )

    # -------------------------------------------------------------
    # Standard Backtracking (BT)
    # -------------------------------------------------------------
    def _search_bt(
        self,
        assignments: Dict[str, Optional[str]],
        unassigned_vars: List[CSPVariable],
        domains: Dict[str, List[str]],
        current_capacity: Dict[str, Dict[str, int]]
    ) -> bool:
        if not unassigned_vars:
            return True

        if time.time() - self.start_time > self.time_limit_sec:
            return False

        self.states_explored += 1
        var = self.select_unassigned_variable(unassigned_vars, domains)
        unassigned_vars.remove(var)

        ordered_values = self.order_domain_values(var, domains, current_capacity, unassigned_vars)

        self._record_trace(
            event_type="SELECT_VAR",
            var_id=var.var_id,
            incident_id=var.incident_id,
            resource_type=var.resource_type,
            domain_size=len(ordered_values),
            details=f"Selected variable {var.var_id} (Priority {var.priority}, {var.resource_type}). Domain choices: {len(ordered_values)}."
        )

        for val_idx, cid in enumerate(ordered_values):
            # Check C5: Resource Capacity Constraint
            rem_cap = current_capacity.get(cid, {}).get(var.resource_type, 0)
            c_name = self.centers[cid].name
            nearest_rank = f"{val_idx + 1}{'st' if val_idx==0 else 'nd' if val_idx==1 else 'rd' if val_idx==2 else 'th'} Nearest"

            self._record_trace(
                event_type="TRY_VALUE",
                var_id=var.var_id,
                incident_id=var.incident_id,
                center_id=cid,
                resource_type=var.resource_type,
                details=f"Probing {nearest_rank} center '{c_name}' (Remaining units: {rem_cap})."
            )

            if rem_cap <= 0:
                self._record_trace(
                    event_type="CONFLICT",
                    var_id=var.var_id,
                    incident_id=var.incident_id,
                    center_id=cid,
                    resource_type=var.resource_type,
                    details=f"[CAPACITY FULL] '{c_name}' exhausted for {var.resource_type}. Cascading to next nearest."
                )
                continue

            # Assign
            assignments[var.var_id] = cid
            current_capacity[cid][var.resource_type] -= 1

            self._record_trace(
                event_type="ASSIGN_SUCCESS",
                var_id=var.var_id,
                incident_id=var.incident_id,
                center_id=cid,
                resource_type=var.resource_type,
                current_assignments_count=len([a for a in assignments.values() if a is not None]),
                details=f"[ASSIGN] Variable {var.var_id} -> '{c_name}' ({nearest_rank}). Units left: {current_capacity[cid][var.resource_type]}."
            )

            # Maintaining Arc Consistency (MAC) if configured
            mac_ok = True
            if self.algorithm == "ac3_backtracking":
                saved_domains = copy.deepcopy(domains)
                mac_ok = self.apply_ac3(domains, current_capacity, trigger_var_id=var.var_id)

            if mac_ok:
                result = self._search_bt(assignments, unassigned_vars, domains, current_capacity)
                if result:
                    return True

            # Backtrack
            self.backtracks += 1
            if self.algorithm == "ac3_backtracking" and not mac_ok:
                domains = saved_domains

            current_capacity[cid][var.resource_type] += 1
            assignments.pop(var.var_id, None)

            self._record_trace(
                event_type="BACKTRACK",
                var_id=var.var_id,
                incident_id=var.incident_id,
                center_id=cid,
                resource_type=var.resource_type,
                details=f"[BACKTRACK] Reverted assignment of {var.var_id} to '{c_name}'."
            )

        # Cascade Rule: If all centers in domain are exhausted, mark as UNASSIGNED and continue
        assignments[var.var_id] = None
        self._record_trace(
            event_type="EXHAUSTED",
            var_id=var.var_id,
            incident_id=var.incident_id,
            resource_type=var.resource_type,
            details=f"[EXHAUSTED] All candidate centers for {var.var_id} ({var.resource_type}) exhausted. Cascaded to UNASSIGNED."
        )
        res = self._search_bt(assignments, unassigned_vars, domains, current_capacity)
        if res:
            return True

        assignments.pop(var.var_id, None)
        unassigned_vars.append(var)
        return False

    # -------------------------------------------------------------
    # Conflict-Directed Backjumping (CBJ)
    # -------------------------------------------------------------
    def _search_cbj(
        self,
        assignments: Dict[str, Optional[str]],
        unassigned_vars: List[CSPVariable],
        domains: Dict[str, List[str]],
        current_capacity: Dict[str, Dict[str, int]],
        assigned_history: Optional[List[str]] = None
    ) -> bool:
        if assigned_history is None:
            assigned_history = []

        if not unassigned_vars:
            return True

        if time.time() - self.start_time > self.time_limit_sec:
            return False

        self.states_explored += 1
        var = self.select_unassigned_variable(unassigned_vars, domains)
        unassigned_vars.remove(var)

        ordered_values = self.order_domain_values(var, domains, current_capacity, unassigned_vars)
        self.conflict_sets[var.var_id] = set()

        self._record_trace(
            event_type="SELECT_VAR",
            var_id=var.var_id,
            incident_id=var.incident_id,
            resource_type=var.resource_type,
            domain_size=len(ordered_values),
            details=f"Selected variable {var.var_id} (Priority {var.priority}). Domain choices: {len(ordered_values)}."
        )

        for val_idx, cid in enumerate(ordered_values):
            rem_cap = current_capacity.get(cid, {}).get(var.resource_type, 0)
            c_name = self.centers[cid].name
            nearest_rank = f"{val_idx + 1}{'st' if val_idx==0 else 'nd' if val_idx==1 else 'rd' if val_idx==2 else 'th'} Nearest"

            if rem_cap <= 0:
                # Capacity conflict: find which previously assigned variables took capacity at center cid
                competing_vars = [
                    v_id for v_id in assigned_history
                    if assignments.get(v_id) == cid
                    and next((v.resource_type for v in self.variables if v.var_id == v_id), None) == var.resource_type
                ]
                for cv in competing_vars:
                    self.conflict_sets[var.var_id].add(cv)

                self._record_trace(
                    event_type="CONFLICT",
                    var_id=var.var_id,
                    center_id=cid,
                    resource_type=var.resource_type,
                    conflict_set=list(self.conflict_sets[var.var_id]),
                    details=f"[CONFLICT] Center '{c_name}' capacity exhausted. Conflicts added: {competing_vars}."
                )
                continue

            # Assign
            assignments[var.var_id] = cid
            current_capacity[cid][var.resource_type] -= 1
            assigned_history.append(var.var_id)

            self._record_trace(
                event_type="ASSIGN_SUCCESS",
                var_id=var.var_id,
                incident_id=var.incident_id,
                center_id=cid,
                resource_type=var.resource_type,
                current_assignments_count=len([a for a in assignments.values() if a is not None]),
                details=f"[ASSIGN] {var.var_id} -> '{c_name}' ({nearest_rank}). Units remaining: {current_capacity[cid][var.resource_type]}."
            )

            # Maintaining consistency
            mac_ok = True
            if "ac3" in self.algorithm or "path_consistency" in self.algorithm:
                saved_domains = copy.deepcopy(domains)
                mac_ok = self.apply_ac3(domains, current_capacity, trigger_var_id=var.var_id)

            if mac_ok:
                result = self._search_cbj(assignments, unassigned_vars, domains, current_capacity, assigned_history)
                if result:
                    return True

            # Backjump handling
            assigned_history.remove(var.var_id)
            current_capacity[cid][var.resource_type] += 1
            assignments.pop(var.var_id, None)

            if ("ac3" in self.algorithm or "path_consistency" in self.algorithm) and not mac_ok:
                domains = saved_domains

        # Domain wipeout occurred at var.var_id
        # Conflict-directed backjump to the most recent conflicting variable in conflict set
        cset = self.conflict_sets[var.var_id]
        if cset and assigned_history:
            deepest_conflict_var = None
            for past_var in reversed(assigned_history):
                if past_var in cset:
                    deepest_conflict_var = past_var
                    break

            if deepest_conflict_var:
                self.conflict_sets[deepest_conflict_var] |= (cset - {deepest_conflict_var})
                idx_deepest = assigned_history.index(deepest_conflict_var)
                skipped = assigned_history[idx_deepest + 1:]
                self.backjumps += 1

                self._record_trace(
                    event_type="BACKJUMP",
                    var_id=var.var_id,
                    incident_id=var.incident_id,
                    conflict_set=list(cset),
                    skipped_vars=skipped,
                    details=f"[BACKJUMP] Conflict wipeout at {var.var_id} -> Backjumped to {deepest_conflict_var}, skipping {len(skipped)} levels: {skipped}."
                )

        self.backtracks += 1

        # Cascade Rule: If all candidate centers exhausted, cascade to UNASSIGNED and continue solving
        assignments[var.var_id] = None
        self._record_trace(
            event_type="EXHAUSTED",
            var_id=var.var_id,
            incident_id=var.incident_id,
            resource_type=var.resource_type,
            details=f"[EXHAUSTED] All candidate centers for {var.var_id} ({var.resource_type}) exhausted. Cascaded to UNASSIGNED."
        )
        res = self._search_cbj(assignments, unassigned_vars, domains, current_capacity, assigned_history)
        if res:
            return True

        assignments.pop(var.var_id, None)
        unassigned_vars.append(var)
        return False

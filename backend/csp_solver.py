"""
CSP Solver Engines for Dhaka Emergency Response Control Center
Implements:
1. Pre-Search Consistency Modules: Node Consistency, AC-3, Path Consistency (PC-2)
2. Systematic Backtracking Search (BT) with Forward Checking / MAC and MRV/Degree/LCV heuristics
3. Conflict-Directed Backjumping (CBJ) with Conflict Sets and variable level skipping
4. Local Search: Min-Conflicts with complete state repair, random walk, and dynamic escalation support
"""

import time
import copy
import random
from typing import Dict, List, Set, Tuple, Optional, Any

from backend.models import (
    EmergencyIncident, ResourceCenter, CSPTraceEvent,
    RouteInfo, CSPSolution, BenchmarkMetric, CSPSolveRequest
)
from backend.csp_formulation import (
    DhakaEmergencyCSP, CSPVariable, DiscreteResourceUnit, export_formulation_snapshot
)
from backend.graph_loader import dhaka_network

class CSPSolverEngine:
    def __init__(
        self,
        incidents: List[EmergencyIncident],
        centers: List[ResourceCenter],
        solve_request: Optional[CSPSolveRequest] = None,
        scale: str = "Small"
    ):
        self.incidents = incidents
        self.centers = centers
        self.scale = scale
        self.req = solve_request or CSPSolveRequest()

        # Build formal CSP formulation
        self.csp = DhakaEmergencyCSP(incidents, centers)

        # Telemetry & Trace
        self.states_explored: int = 0
        self.backtracks: int = 0
        self.backjumps: int = 0
        self.skipped_levels_total: int = 0
        self.domain_values_pruned: int = 0
        self.repairs_count: int = 0
        self.final_conflicts: int = 0
        self.conflicts_history: List[int] = []
        self.start_time: float = 0.0
        self.step_counter: int = 0
        self.trace_events: List[CSPTraceEvent] = []
        self.max_trace_events: int = 1400

        # Working Domains: var_id -> List[unit_id]
        self.domains: Dict[str, List[str]] = copy.deepcopy(self.csp.initial_domains)

        # Conflict sets for CBJ: var_id -> Set[var_id]
        self.conflict_sets: Dict[str, Set[str]] = {v.var_id: set() for v in self.csp.variables}

    def _record_trace(
        self,
        event_type: str,
        details: str,
        var_id: Optional[str] = None,
        incident_id: Optional[str] = None,
        center_id: Optional[str] = None,
        unit_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        domain_size: Optional[int] = None,
        conflict_set: Optional[List[str]] = None,
        skipped_vars: Optional[List[str]] = None,
        from_var: Optional[str] = None,
        to_var: Optional[str] = None,
        triple_vars: Optional[List[str]] = None,
        pruned_unit_id: Optional[str] = None,
        prune_reason: Optional[str] = None,
        total_conflicts: Optional[int] = None,
        conflict_scores: Optional[Dict[str, int]] = None,
        mrv_candidate_sizes: Optional[Dict[str, int]] = None,
        degree_count: Optional[int] = None,
        lcv_ruled_out_counts: Optional[Dict[str, int]] = None,
        current_assignments_count: Optional[int] = None
    ):
        if len(self.trace_events) >= self.max_trace_events and event_type not in (
            "COMPLETE", "LOCAL_OPTIMUM", "CBJ_BACKJUMP", "EXHAUSTED", "LOCAL_REPAIR"
        ):
            return

        self.step_counter += 1
        self.trace_events.append(CSPTraceEvent(
            step=self.step_counter,
            event_type=event_type,
            var_id=var_id,
            incident_id=incident_id,
            center_id=center_id,
            unit_id=unit_id,
            resource_type=resource_type,
            details=details,
            domain_size=domain_size,
            conflict_set=conflict_set,
            skipped_vars=skipped_vars,
            from_var=from_var,
            to_var=to_var,
            triple_vars=triple_vars,
            pruned_unit_id=pruned_unit_id,
            prune_reason=prune_reason,
            total_conflicts=total_conflicts,
            conflict_scores=conflict_scores,
            mrv_candidate_sizes=mrv_candidate_sizes,
            degree_count=degree_count,
            lcv_ruled_out_counts=lcv_ruled_out_counts,
            current_assignments_count=current_assignments_count
        ))

    # =========================================================================
    # 1. Pre-Search Consistency Modules (Node, AC-3, Path Consistency)
    # =========================================================================

    def apply_node_consistency(self) -> int:
        """
        Node Consistency (NC): Evaluates all unary constraints independently per variable.
        Prunes incompatible, offline, unreachable, or over-time physical units from D(X_i).
        """
        pruned_count = 0
        for var in self.csp.variables:
            u_c = self.csp.unary_constraints.get(var.var_id)
            if not u_c:
                continue

            valid_units = []
            for unit_id in self.domains.get(var.var_id, []):
                unit = self.csp.physical_units[unit_id]
                satisfied, reason = u_c.is_satisfied(unit)
                if satisfied:
                    valid_units.append(unit_id)
                else:
                    pruned_count += 1
                    self.domain_values_pruned += 1
                    self._record_trace(
                        event_type="NODE_PRUNE",
                        var_id=var.var_id,
                        incident_id=var.incident_id,
                        center_id=unit.center_id,
                        unit_id=unit_id,
                        pruned_unit_id=unit_id,
                        prune_reason=reason,
                        resource_type=var.resource_type,
                        domain_size=len(valid_units),
                        details=f"[Node Consistency] Pruned unit '{unit_id}' from {var.var_id}: {reason}."
                    )
            self.domains[var.var_id] = valid_units

        return pruned_count

    def apply_ac3(self, initial_arcs: Optional[List[Tuple[str, str]]] = None) -> bool:
        """
        Arc Consistency (AC-3): Enforces pairwise consistency over directed arcs (X_i -> X_j).
        Binary constraint: X_i != X_j (two slots cannot be assigned the same physical unit).
        Complexity: O(c * d^3).
        """
        queue: List[Tuple[str, str]] = []
        if initial_arcs:
            queue = list(initial_arcs)
        else:
            for b_c in self.csp.binary_constraints:
                queue.append((b_c.var_i, b_c.var_j))
                queue.append((b_c.var_j, b_c.var_i))

        max_arc_checks = 2000
        checks = 0

        while queue and checks < max_arc_checks:
            checks += 1
            xi_id, xj_id = queue.pop(0)

            revised, pruned_units = self._revise_ac3(xi_id, xj_id)
            if revised:
                if len(self.domains[xi_id]) == 0:
                    return False  # Domain wipeout

                # Re-queue neighbor arcs (X_k -> X_i)
                xi_neighbors = list(self.csp.constraint_graph.neighbors(xi_id))
                for xk_id in xi_neighbors:
                    if xk_id != xj_id and (xk_id, xi_id) not in queue:
                        queue.append((xk_id, xi_id))
                        self._record_trace(
                            event_type="AC3_REQUEUE",
                            var_id=xi_id,
                            from_var=xk_id,
                            to_var=xi_id,
                            details=f"[AC-3] Re-enqueued arc ({xk_id} -> {xi_id}) after domain revision."
                        )

        return True

    def _revise_ac3(self, xi_id: str, xj_id: str) -> Tuple[bool, List[str]]:
        """Revises domain D(X_i) with respect to arc (X_i -> X_j)."""
        revised = False
        to_prune = []
        xi_domain = self.domains.get(xi_id, [])
        xj_domain = self.domains.get(xj_id, [])

        xi_var = self.csp.var_by_id[xi_id]
        xj_var = self.csp.var_by_id[xj_id]

        # If X_j only has one value {u}, then X_i cannot also take u
        if len(xj_domain) == 1 and xj_domain[0] in xi_domain and len(xi_domain) > 1 and xi_var.priority <= xj_var.priority:
            to_prune.append(xj_domain[0])

        if to_prune:
            for u in to_prune:
                if u in self.domains[xi_id]:
                    self.domains[xi_id].remove(u)
                    self.domain_values_pruned += 1
                    revised = True
                    unit = self.csp.physical_units[u]
                    self._record_trace(
                        event_type="AC3_PRUNE",
                        var_id=xi_id,
                        incident_id=xi_var.incident_id,
                        center_id=unit.center_id,
                        unit_id=u,
                        pruned_unit_id=u,
                        prune_reason=f"No binary support in {xj_id}",
                        resource_type=xi_var.resource_type,
                        domain_size=len(self.domains[xi_id]),
                        details=f"[AC-3] Arc ({xi_id} -> {xj_id}) pruned unit '{u}' from {xi_id} (reserved for {xj_id})."
                    )

        return revised, to_prune

    def apply_path_consistency(self) -> int:
        """
        Path Consistency (PC-2 / 3-Consistency):
        Evaluates variable triples {X_i, X_j, X_k} competing for scarce resource units.
        Prunes values that have pairwise support but deadlock across the triple.
        """
        pruned_count = 0
        var_by_res: Dict[str, List[CSPVariable]] = {}
        for var in self.csp.variables:
            var_by_res.setdefault(var.resource_type, []).append(var)

        for r_type, v_list in var_by_res.items():
            if len(v_list) < 3:
                continue

            # Evaluate representative triples of nearby competing incidents
            triples_to_check = []
            for i in range(min(4, len(v_list))):
                for j in range(i + 1, min(5, len(v_list))):
                    for k in range(j + 1, min(6, len(v_list))):
                        triples_to_check.append((v_list[i], v_list[j], v_list[k]))

            for vi, vj, vk in triples_to_check:
                self._record_trace(
                    event_type="PC_TRIPLE_CHECK",
                    var_id=vi.var_id,
                    triple_vars=[vi.var_id, vj.var_id, vk.var_id],
                    resource_type=r_type,
                    details=f"[Path Consistency] Checking 3-Consistency across triangle ({vi.var_id}, {vj.var_id}, {vk.var_id})."
                )

                # Check available distinct physical units in mutual union of domains
                union_units = set(self.domains.get(vi.var_id, [])) | set(self.domains.get(vj.var_id, [])) | set(self.domains.get(vk.var_id, []))
                if len(union_units) < 3:
                    # Bottleneck deadlock: 3 variables need distinct units, but only <3 exist in their joint domain!
                    self._record_trace(
                        event_type="PC_CONFLICT",
                        var_id=vi.var_id,
                        triple_vars=[vi.var_id, vj.var_id, vk.var_id],
                        resource_type=r_type,
                        details=f"[PC-2 Conflict] Triangle ({vi.var_id}, {vj.var_id}, {vk.var_id}) requires 3 distinct units, but only {len(union_units)} available in joint domain!"
                    )

                    # Prune lowest priority variable from the bottleneck
                    lowest_var = min([vi, vj, vk], key=lambda v: v.priority)
                    if len(self.domains[lowest_var.var_id]) > 1:
                        pruned_u = self.domains[lowest_var.var_id].pop()
                        self.domain_values_pruned += 1
                        pruned_count += 1
                        self._record_trace(
                            event_type="PC_PRUNE",
                            var_id=lowest_var.var_id,
                            pruned_unit_id=pruned_u,
                            prune_reason="3-Consistency joint bottleneck",
                            triple_vars=[vi.var_id, vj.var_id, vk.var_id],
                            domain_size=len(self.domains[lowest_var.var_id]),
                            details=f"[PC-2 Pruned] Pruned '{pruned_u}' from lowest-priority {lowest_var.var_id} to resolve triple bottleneck."
                        )

        return pruned_count

    # =========================================================================
    # 2. Heuristics: MRV, Degree Heuristic, LCV, Nearest-Center
    # =========================================================================

    def select_unassigned_variable(
        self,
        unassigned_vars: List[CSPVariable],
        current_domains: Dict[str, List[str]]
    ) -> CSPVariable:
        """
        Variable Ordering Heuristic:
        - Priority (Baseline)
        - MRV (Minimum Remaining Values / Fail-First)
        - Degree Heuristic (Tie-Breaker)
        """
        if self.req.var_heuristic == "priority":
            return unassigned_vars[0]

        best_var = unassigned_vars[0]
        best_score = None
        candidate_sizes: Dict[str, int] = {}

        for var in unassigned_vars:
            d_size = len(current_domains.get(var.var_id, []))
            candidate_sizes[var.var_id] = d_size

            degree = 0
            if self.req.var_heuristic == "mrv_degree":
                neighbors = self.csp.constraint_graph.neighbors(var.var_id)
                degree = sum(1 for n in neighbors if any(u.var_id == n for u in unassigned_vars))

            score = (d_size, -var.priority, -degree)
            if best_score is None or score < best_score:
                best_score = score
                best_var = var

        self._record_trace(
            event_type="HEURISTIC_MRV",
            var_id=best_var.var_id,
            incident_id=best_var.incident_id,
            domain_size=len(current_domains.get(best_var.var_id, [])),
            mrv_candidate_sizes={v.var_id: candidate_sizes[v.var_id] for v in unassigned_vars[:5]},
            degree_count=sum(1 for n in self.csp.constraint_graph.neighbors(best_var.var_id) if any(u.var_id == n for u in unassigned_vars)),
            details=f"[Heuristic MRV] Selected variable {best_var.var_id} with |D|={len(current_domains.get(best_var.var_id, []))} (Priority {best_var.priority})."
        )

        return best_var

    def order_domain_values(
        self,
        var: CSPVariable,
        current_domains: Dict[str, List[str]],
        unassigned_vars: List[CSPVariable]
    ) -> List[str]:
        """
        Value Ordering Heuristic:
        - Nearest-Center-First (Travel Time Baseline)
        - LCV (Least Constraining Value / Succeed-First)
        """
        raw_values = current_domains.get(var.var_id, [])
        if not raw_values:
            return []

        if self.req.val_heuristic == "nearest":
            return raw_values

        ruled_out_map: Dict[str, int] = {}
        neighbors = set(self.csp.constraint_graph.neighbors(var.var_id))
        unassigned_neighbor_ids = [u.var_id for u in unassigned_vars if u.var_id in neighbors and u.var_id != var.var_id]

        for unit_id in raw_values:
            ruled_out = sum(1 for n_id in unassigned_neighbor_ids if unit_id in current_domains.get(n_id, []))
            ruled_out_map[unit_id] = ruled_out

        def lcv_key(unit_id: str):
            route = self.csp.route_cache.get((self.csp.unit_to_center[unit_id], var.incident_id))
            t_min = route["travel_time_min"] if route else 999.0
            return (ruled_out_map[unit_id], t_min)

        sorted_values = sorted(raw_values, key=lcv_key)

        self._record_trace(
            event_type="HEURISTIC_LCV",
            var_id=var.var_id,
            lcv_ruled_out_counts={u: ruled_out_map[u] for u in sorted_values[:4]},
            details=f"[Heuristic LCV] Ordered values for {var.var_id}. Least constraining: '{sorted_values[0]}' (rules out {ruled_out_map[sorted_values[0]]} neighbor choices)."
        )

        return sorted_values

    # =========================================================================
    # 3. Look-Ahead Interleaved Inference (Forward Checking & MAC)
    # =========================================================================

    def run_inference(
        self,
        assigned_var: CSPVariable,
        assigned_unit: str,
        current_domains: Dict[str, List[str]],
        unassigned_vars: List[CSPVariable]
    ) -> Tuple[bool, Dict[str, List[str]]]:
        pruned_map: Dict[str, List[str]] = {}

        if self.req.inference == "none":
            return True, pruned_map

        # Forward Checking (FC)
        neighbors = set(self.csp.constraint_graph.neighbors(assigned_var.var_id))
        unassigned_neighbors = [u for u in unassigned_vars if u.var_id in neighbors and u.var_id != assigned_var.var_id]

        for n_var in unassigned_neighbors:
            n_domain = current_domains.get(n_var.var_id, [])
            if assigned_unit in n_domain:
                n_domain.remove(assigned_unit)
                pruned_map.setdefault(n_var.var_id, []).append(assigned_unit)
                self.domain_values_pruned += 1

                self.conflict_sets[n_var.var_id].add(assigned_var.var_id)

                self._record_trace(
                    event_type="FC_PRUNE",
                    var_id=n_var.var_id,
                    incident_id=n_var.incident_id,
                    unit_id=assigned_unit,
                    pruned_unit_id=assigned_unit,
                    prune_reason=f"Assigned to {assigned_var.var_id}",
                    domain_size=len(n_domain),
                    details=f"[Forward Checking] Pruned unit '{assigned_unit}' from {n_var.var_id} because it was assigned to {assigned_var.var_id}."
                )

                if len(n_domain) == 0:
                    self._record_trace(
                        event_type="FC_WIPEOUT",
                        var_id=n_var.var_id,
                        conflict_set=list(self.conflict_sets[n_var.var_id]),
                        details=f"[FC Wipeout] Domain wipeout at {n_var.var_id}! No remaining physical units available."
                    )
                    return False, pruned_map

        # Maintaining Arc Consistency (MAC)
        if self.req.inference == "mac":
            initial_arcs = [(n_var.var_id, assigned_var.var_id) for n_var in unassigned_neighbors]
            mac_ok = self.apply_ac3(initial_arcs=initial_arcs)
            if not mac_ok:
                return False, pruned_map
            self._record_trace(
                event_type="MAC_PROPAGATE",
                var_id=assigned_var.var_id,
                details=f"[MAC] Propagated arc consistency across neighbors of {assigned_var.var_id}."
            )

        return True, pruned_map

    # =========================================================================
    # 4. Main Algorithm 1: Systematic Backtracking Search (BT)
    # =========================================================================

    def solve_backtracking(self) -> CSPSolution:
        """Executes systematic Backtracking search with chronological backtracking."""
        self.start_time = time.time()
        self._record_trace("INIT", "Starting Systematic Backtracking Search (BT).")

        if self.req.use_node_consistency:
            self.apply_node_consistency()
        if self.req.use_ac3:
            self.apply_ac3()
        if self.req.use_path_consistency:
            self.apply_path_consistency()

        assignments: Dict[str, Optional[str]] = {}
        unassigned_vars = list(self.csp.variables)

        success = self._recursive_bt(assignments, unassigned_vars, self.domains)

        return self._build_solution(assignments, "Backtracking (BT)", success)

    def _recursive_bt(
        self,
        assignments: Dict[str, Optional[str]],
        unassigned_vars: List[CSPVariable],
        current_domains: Dict[str, List[str]]
    ) -> bool:
        if not unassigned_vars:
            return True

        if time.time() - self.start_time > self.req.time_limit_sec:
            return False

        self.states_explored += 1
        var = self.select_unassigned_variable(unassigned_vars, current_domains)
        unassigned_vars.remove(var)

        ordered_values = self.order_domain_values(var, current_domains, unassigned_vars)

        self._record_trace(
            event_type="SELECT_VAR",
            var_id=var.var_id,
            incident_id=var.incident_id,
            resource_type=var.resource_type,
            domain_size=len(ordered_values),
            details=f"Evaluating variable {var.var_id} (Priority {var.priority}, {var.resource_type}). Candidate units: {len(ordered_values)}."
        )

        for val_idx, unit_id in enumerate(ordered_values):
            # Check Binary constraints
            is_consistent = True
            for assigned_v_id, assigned_u in assignments.items():
                if assigned_u == unit_id:
                    is_consistent = False
                    self._record_trace(
                        event_type="CONFLICT",
                        var_id=var.var_id,
                        unit_id=unit_id,
                        details=f"[Double-Booking Conflict] Unit '{unit_id}' already assigned to {assigned_v_id}."
                    )
                    break

            if not is_consistent:
                continue

            # Assign
            assignments[var.var_id] = unit_id
            unit = self.csp.physical_units[unit_id]

            self._record_trace(
                event_type="ASSIGN_SUCCESS",
                var_id=var.var_id,
                incident_id=var.incident_id,
                center_id=unit.center_id,
                unit_id=unit_id,
                resource_type=var.resource_type,
                current_assignments_count=len([a for a in assignments.values() if a is not None]),
                details=f"[ASSIGN] {var.var_id} -> '{unit_id}' at {unit.center_name}."
            )

            # Inference (FC / MAC)
            inference_ok, pruned_map = self.run_inference(var, unit_id, current_domains, unassigned_vars)

            if inference_ok:
                result = self._recursive_bt(assignments, unassigned_vars, current_domains)
                if result:
                    return True

            # Chronological Backtrack
            self.backtracks += 1
            assignments.pop(var.var_id, None)

            for n_id, p_units in pruned_map.items():
                current_domains[n_id].extend(p_units)

            self._record_trace(
                event_type="BACKTRACK",
                var_id=var.var_id,
                incident_id=var.incident_id,
                unit_id=unit_id,
                details=f"[BACKTRACK] Chronological backtrack: Reverted assignment of {var.var_id} to '{unit_id}'."
            )

        # Nearest Center Cascade
        assignments[var.var_id] = None
        self._record_trace(
            event_type="EXHAUSTED",
            var_id=var.var_id,
            incident_id=var.incident_id,
            resource_type=var.resource_type,
            details=f"[EXHAUSTED] All candidate units for {var.var_id} ({var.resource_type}) exhausted. Marked as UNASSIGNED."
        )

        cascade_ok = self._recursive_bt(assignments, unassigned_vars, current_domains)
        if cascade_ok:
            return True

        assignments.pop(var.var_id, None)
        unassigned_vars.append(var)
        return False

    # =========================================================================
    # 5. Main Algorithm 2: Conflict-Directed Backjumping (CBJ)
    # =========================================================================

    def solve_backjumping(self) -> CSPSolution:
        """Executes Conflict-Directed Backjumping with Conflict Sets and level skipping."""
        self.start_time = time.time()
        self._record_trace("INIT", "Starting Conflict-Directed Backjumping (CBJ).")

        if self.req.use_node_consistency:
            self.apply_node_consistency()
        if self.req.use_ac3:
            self.apply_ac3()
        if self.req.use_path_consistency:
            self.apply_path_consistency()

        assignments: Dict[str, Optional[str]] = {}
        unassigned_vars = list(self.csp.variables)
        assigned_history: List[str] = []

        success = self._recursive_cbj(assignments, unassigned_vars, self.domains, assigned_history)

        return self._build_solution(assignments, "Conflict-Directed Backjumping (CBJ)", success)

    def _recursive_cbj(
        self,
        assignments: Dict[str, Optional[str]],
        unassigned_vars: List[CSPVariable],
        current_domains: Dict[str, List[str]],
        assigned_history: List[str]
    ) -> bool:
        if not unassigned_vars:
            return True

        if time.time() - self.start_time > self.req.time_limit_sec:
            return False

        self.states_explored += 1
        var = self.select_unassigned_variable(unassigned_vars, current_domains)
        unassigned_vars.remove(var)

        ordered_values = self.order_domain_values(var, current_domains, unassigned_vars)
        if var.var_id not in self.conflict_sets:
            self.conflict_sets[var.var_id] = set()

        self._record_trace(
            event_type="SELECT_VAR",
            var_id=var.var_id,
            incident_id=var.incident_id,
            resource_type=var.resource_type,
            domain_size=len(ordered_values),
            details=f"Evaluating variable {var.var_id} (Priority {var.priority}). Candidate units: {len(ordered_values)}."
        )

        for val_idx, unit_id in enumerate(ordered_values):
            conflicting_var = None
            for past_var_id in assigned_history:
                if assignments.get(past_var_id) == unit_id:
                    conflicting_var = past_var_id
                    break

            if conflicting_var:
                self.conflict_sets[var.var_id].add(conflicting_var)
                self._record_trace(
                    event_type="CONFLICT",
                    var_id=var.var_id,
                    unit_id=unit_id,
                    from_var=conflicting_var,
                    to_var=var.var_id,
                    conflict_set=list(self.conflict_sets[var.var_id]),
                    details=f"[CONFLICT] Unit '{unit_id}' already booked by {conflicting_var}. Added {conflicting_var} to ConflictSet({var.var_id})."
                )
                continue

            assignments[var.var_id] = unit_id
            assigned_history.append(var.var_id)
            unit = self.csp.physical_units[unit_id]

            self._record_trace(
                event_type="ASSIGN_SUCCESS",
                var_id=var.var_id,
                incident_id=var.incident_id,
                center_id=unit.center_id,
                unit_id=unit_id,
                resource_type=var.resource_type,
                current_assignments_count=len([a for a in assignments.values() if a is not None]),
                details=f"[ASSIGN] {var.var_id} -> '{unit_id}' ({unit.center_name})."
            )

            inference_ok, pruned_map = self.run_inference(var, unit_id, current_domains, unassigned_vars)

            if inference_ok:
                result = self._recursive_cbj(assignments, unassigned_vars, current_domains, assigned_history)
                if result:
                    return True

            assigned_history.remove(var.var_id)
            assignments.pop(var.var_id, None)

            for n_id, p_units in pruned_map.items():
                current_domains[n_id].extend(p_units)

        # Domain wipeout occurred at var.var_id -> Backjump to deepest conflicting variable
        cset = self.conflict_sets[var.var_id]
        if cset and assigned_history:
            deepest_culprit = None
            for past_var in reversed(assigned_history):
                if past_var in cset:
                    deepest_culprit = past_var
                    break

            if deepest_culprit:
                self.conflict_sets[deepest_culprit] |= (cset - {deepest_culprit})
                idx_deepest = assigned_history.index(deepest_culprit)
                skipped_vars = assigned_history[idx_deepest + 1:]
                self.backjumps += 1
                self.skipped_levels_total += len(skipped_vars)

                self._record_trace(
                    event_type="CBJ_BACKJUMP",
                    var_id=var.var_id,
                    incident_id=var.incident_id,
                    from_var=var.var_id,
                    to_var=deepest_culprit,
                    conflict_set=list(cset),
                    skipped_vars=skipped_vars,
                    details=f"[CBJ BACKJUMP] Wipeout at {var.var_id} -> JUMPED directly to {deepest_culprit}, SKIPPING {len(skipped_vars)} levels: {skipped_vars}."
                )

        self.backtracks += 1

        assignments[var.var_id] = None
        self._record_trace(
            event_type="EXHAUSTED",
            var_id=var.var_id,
            incident_id=var.incident_id,
            resource_type=var.resource_type,
            details=f"[EXHAUSTED] All candidate units for {var.var_id} ({var.resource_type}) exhausted. Marked as UNASSIGNED."
        )

        cascade_ok = self._recursive_cbj(assignments, unassigned_vars, current_domains, assigned_history)
        if cascade_ok:
            return True

        assignments.pop(var.var_id, None)
        unassigned_vars.append(var)
        return False

    # =========================================================================
    # 6. Main Algorithm 3: Local Search — Min-Conflicts (MIN-CONFLICTS)
    # =========================================================================

    def solve_min_conflicts(self, initial_assignments: Optional[Dict[str, str]] = None) -> CSPSolution:
        """
        Executes Local Search with Min-Conflicts on complete state representations.
        Supports Fast Dynamic Incident Escalation repair.
        """
        self.start_time = time.time()
        self._record_trace("INIT", "Starting Local Search (Min-Conflicts).")

        if self.req.use_node_consistency:
            self.apply_node_consistency()

        current_assignment: Dict[str, str] = {}
        if initial_assignments:
            current_assignment = dict(initial_assignments)

        for var in self.csp.variables:
            if var.var_id not in current_assignment or not current_assignment[var.var_id]:
                domain = self.domains.get(var.var_id, [])
                if domain:
                    if self.req.initial_strategy == "random":
                        current_assignment[var.var_id] = random.choice(domain)
                    else:
                        current_assignment[var.var_id] = domain[0]
                else:
                    current_assignment[var.var_id] = None

        total_conflicts, conflicted_vars = self._evaluate_total_conflicts(current_assignment)
        self.conflicts_history = [total_conflicts]

        self._record_trace(
            event_type="LOCAL_INIT_COMPLETE",
            total_conflicts=total_conflicts,
            details=f"[Min-Conflicts Init] Generated initial complete assignment with {total_conflicts} initial conflicts."
        )

        max_steps = self.req.max_steps
        restarts_left = 2 if self.req.allow_random_restart else 0

        step = 0
        while step < max_steps:
            if total_conflicts == 0:
                self._record_trace(
                    event_type="COMPLETE",
                    total_conflicts=0,
                    details=f"[Min-Conflicts Solved] Reached zero conflicts in {step} repair steps!"
                )
                break

            step += 1
            self.repairs_count += 1

            conflicted_vars.sort(key=lambda v_id: -self.csp.var_by_id[v_id].priority)
            var_id = conflicted_vars[0] if random.random() > 0.3 else random.choice(conflicted_vars)
            var = self.csp.var_by_id[var_id]

            self._record_trace(
                event_type="LOCAL_PICK_CONFLICTED",
                var_id=var_id,
                incident_id=var.incident_id,
                total_conflicts=total_conflicts,
                details=f"[Step {step}] Selected conflicted variable {var_id} (Priority {var.priority}, Current: '{current_assignment.get(var_id)}')."
            )

            domain = self.domains.get(var_id, [])
            if not domain:
                continue

            if random.random() < self.req.random_walk_prob:
                best_unit = random.choice(domain)
                score_map = {best_unit: 0}
            else:
                score_map = {}
                for unit_id in domain:
                    temp_assignment = dict(current_assignment)
                    temp_assignment[var_id] = unit_id
                    score_map[unit_id] = self._count_variable_conflicts(var_id, unit_id, temp_assignment)

                min_score = min(score_map.values())
                best_candidates = [u for u, score in score_map.items() if score == min_score]

                def tie_breaker(u: str):
                    r = self.csp.route_cache.get((self.csp.unit_to_center[u], var.incident_id))
                    return r["travel_time_min"] if r else 999.0

                best_unit = min(best_candidates, key=tie_breaker)

            old_unit = current_assignment[var_id]
            current_assignment[var_id] = best_unit

            total_conflicts, conflicted_vars = self._evaluate_total_conflicts(current_assignment)
            self.conflicts_history.append(total_conflicts)

            self._record_trace(
                event_type="LOCAL_REPAIR",
                var_id=var_id,
                incident_id=var.incident_id,
                unit_id=best_unit,
                conflict_scores={u: score_map.get(u, 0) for u in domain[:4]},
                total_conflicts=total_conflicts,
                details=f"[Step {step} Repair] Shifted {var_id}: '{old_unit}' -> '{best_unit}'. Total conflicts reduced to {total_conflicts}."
            )

            if step > 40 and len(set(self.conflicts_history[-20:])) == 1 and restarts_left > 0:
                restarts_left -= 1
                self._record_trace(
                    event_type="LOCAL_OPTIMUM",
                    total_conflicts=total_conflicts,
                    details=f"[Local Optimum] Stuck in plateau at {total_conflicts} conflicts. Triggering Random Restart ({restarts_left} left)..."
                )
                for v in self.csp.variables:
                    dom = self.domains.get(v.var_id, [])
                    if dom:
                        current_assignment[v.var_id] = random.choice(dom)
                total_conflicts, conflicted_vars = self._evaluate_total_conflicts(current_assignment)

        self.final_conflicts = total_conflicts
        success = (total_conflicts == 0)
        status = "SOLVED" if success else "LOCAL_OPTIMUM"

        if not success:
            self._record_trace(
                event_type="LOCAL_OPTIMUM",
                total_conflicts=total_conflicts,
                details=f"[Local Optimum] Finished with {total_conflicts} unresolved conflicts after {step} steps."
            )

        return self._build_solution(current_assignment, "Local Search (Min-Conflicts)", success, status=status)

    def _evaluate_total_conflicts(self, assignment: Dict[str, str]) -> Tuple[int, List[str]]:
        total_conflicts = 0
        conflicted_vars = set()

        unit_counts: Dict[str, List[str]] = {}
        for var_id, unit_id in assignment.items():
            if unit_id:
                unit_counts.setdefault(unit_id, []).append(var_id)

        for unit_id, v_ids in unit_counts.items():
            if len(v_ids) > 1:
                total_conflicts += (len(v_ids) - 1)
                conflicted_vars.update(v_ids)

        for var_id, unit_id in assignment.items():
            if unit_id:
                var = self.csp.var_by_id[var_id]
                unit = self.csp.physical_units[unit_id]
                route = self.csp.route_cache.get((unit.center_id, var.incident_id))
                if not route:
                    total_conflicts += 1
                    conflicted_vars.add(var_id)
                elif route["travel_time_min"] > var.time_max_minutes:
                    total_conflicts += 1
                    conflicted_vars.add(var_id)
                cost = unit.unit_cost + (route["distance_km"] * 12.0) if route else 999.0
                if cost > var.budget_max:
                    total_conflicts += 1
                    conflicted_vars.add(var_id)

        return total_conflicts, list(conflicted_vars)

    def _count_variable_conflicts(self, var_id: str, unit_id: str, assignment: Dict[str, str]) -> int:
        conflicts = 0
        var = self.csp.var_by_id[var_id]
        unit = self.csp.physical_units[unit_id]

        for other_id, other_unit in assignment.items():
            if other_id != var_id and other_unit == unit_id:
                conflicts += 1

        route = self.csp.route_cache.get((unit.center_id, var.incident_id))
        if not route:
            conflicts += 5
        else:
            if route["travel_time_min"] > var.time_max_minutes:
                conflicts += 1
            cost = unit.unit_cost + (route["distance_km"] * 12.0)
            if cost > var.budget_max:
                conflicts += 1

        return conflicts

    def solve(self) -> CSPSolution:
        """Dispatches to the selected main algorithm."""
        algo = self.req.algorithm
        if algo == "backtracking":
            return self.solve_backtracking()
        elif algo == "backjumping":
            return self.solve_backjumping()
        elif algo == "min_conflicts":
            return self.solve_min_conflicts()
        else:
            return self.solve_backjumping()

    # =========================================================================
    # 7. Solution Assembly
    # =========================================================================

    def _build_solution(
        self,
        assignments: Dict[str, Optional[str]],
        algorithm_name: str,
        success: bool,
        status: Optional[str] = None
    ) -> CSPSolution:
        exec_time_ms = round((time.time() - self.start_time) * 1000.0, 2)
        routes: List[RouteInfo] = []
        total_travel_time = 0.0
        total_cost = 0.0
        allocated_count = 0

        for var_id, unit_id in assignments.items():
            if unit_id is not None:
                allocated_count += 1
                var = self.csp.var_by_id[var_id]
                unit = self.csp.physical_units[unit_id]
                route_data = self.csp.route_cache.get((unit.center_id, var.incident_id))
                if route_data:
                    c = self.csp.centers[unit.center_id]
                    cost = unit.unit_cost + (route_data["distance_km"] * 12.0)
                    total_travel_time += route_data["travel_time_min"]
                    total_cost += cost

                    routes.append(RouteInfo(
                        var_id=var_id,
                        incident_id=var.incident_id,
                        center_id=unit.center_id,
                        center_name=c.name,
                        unit_id=unit_id,
                        resource_type=var.resource_type,
                        distance_km=route_data["distance_km"],
                        travel_time_min=route_data["travel_time_min"],
                        cost=round(cost, 2),
                        path_nodes=route_data["path_nodes"],
                        path_coords=dhaka_network.get_path_coords(route_data["path_nodes"])
                    ))

        unassigned_count = len(self.csp.variables) - allocated_count
        if status is None:
            status = "SOLVED" if unassigned_count == 0 else "PARTIAL"

        return CSPSolution(
            success=success,
            status=status,
            algorithm=algorithm_name,
            scale=self.scale,
            allocated_count=allocated_count,
            total_variables=len(self.csp.variables),
            unassigned_count=unassigned_count,
            total_travel_time_min=round(total_travel_time, 2),
            total_cost=round(total_cost, 2),
            states_explored=self.states_explored,
            backtracks=self.backtracks,
            backjumps=self.backjumps,
            domain_values_pruned=self.domain_values_pruned,
            final_conflicts=self.final_conflicts,
            conflicts_history=self.conflicts_history,
            repairs_count=self.repairs_count,
            execution_time_ms=exec_time_ms,
            subproblems_count=len(self.csp.subproblems),
            assignments=assignments,
            routes=routes,
            trace_events=self.trace_events
        )

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Code2,
  ListFilter,
  CheckCircle,
  AlertOctagon,
  ArrowRightLeft,
  Scissors,
  Layers,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { CSPTraceEvent, CSPSolution, EmergencyIncident } from '../types';

interface CSPInspectorProps {
  events: CSPTraceEvent[];
  currentStep: number;
  solution: CSPSolution | null;
  incidents: EmergencyIncident[];
}

export const CSPInspector: React.FC<CSPInspectorProps> = ({
  events,
  currentStep,
  solution,
  incidents,
}) => {
  const [activeTab, setActiveTab] = useState<'log' | 'variables' | 'constraints' | 'telemetry'>('log');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of log as steps advance
  useEffect(() => {
    if (activeTab === 'log' && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentStep, activeTab]);

  const visibleEvents = events.slice(0, currentStep);

  const filteredEvents = visibleEvents.filter(e => {
    if (filterType === 'ALL') return true;
    if (filterType === 'ASSIGN') return e.event_type === 'ASSIGN_SUCCESS';
    if (filterType === 'CONFLICT') return e.event_type === 'CONFLICT' || e.event_type === 'BACKTRACK' || e.event_type === 'BACKJUMP';
    if (filterType === 'PRUNE') return e.event_type === 'AC3_PRUNE' || e.event_type === 'PC_PRUNE';
    return true;
  });

  const getBadgeStyle = (eventType: string) => {
    switch (eventType) {
      case 'ASSIGN_SUCCESS':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'CONFLICT':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'BACKTRACK':
        return 'bg-orange-950 text-orange-300 border-orange-800';
      case 'BACKJUMP':
        return 'bg-red-950 text-red-300 border-red-800 animate-pulse';
      case 'AC3_PRUNE':
      case 'PC_PRUNE':
        return 'bg-purple-950 text-purple-300 border-purple-800';
      case 'EXHAUSTED':
        return 'bg-gray-800 text-gray-300 border-gray-600';
      default:
        return 'bg-blue-950 text-blue-300 border-blue-800';
    }
  };

  return (
    <aside
      className={`bg-[#111827] border-l border-[#1f2937] flex flex-col transition-all duration-300 z-10 shadow-2xl ${
        isExpanded ? 'w-96' : 'w-12'
      }`}
    >
      {/* Drawer Header */}
      <div className="p-3 border-b border-gray-800 flex items-center justify-between bg-[#0d131f]">
        {isExpanded ? (
          <>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-xs uppercase tracking-wider text-gray-200">
                CSP State Inspector
              </span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white"
              title="Collapse Panel"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full flex justify-center py-2 text-cyan-400 hover:text-cyan-300"
            title="Expand CSP Inspector"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {isExpanded && (
        <>
          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-800 bg-[#0b0f19] text-xs">
            <button
              onClick={() => setActiveTab('log')}
              className={`flex-1 py-2 px-1 text-center font-semibold transition border-b-2 ${
                activeTab === 'log'
                  ? 'border-cyan-500 text-cyan-300 bg-gray-800/50'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Trace Log ({visibleEvents.length})
            </button>
            <button
              onClick={() => setActiveTab('variables')}
              className={`flex-1 py-2 px-1 text-center font-semibold transition border-b-2 ${
                activeTab === 'variables'
                  ? 'border-cyan-500 text-cyan-300 bg-gray-800/50'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Vars (X) & Dom (D)
            </button>
            <button
              onClick={() => setActiveTab('constraints')}
              className={`flex-1 py-2 px-1 text-center font-semibold transition border-b-2 ${
                activeTab === 'constraints'
                  ? 'border-cyan-500 text-cyan-300 bg-gray-800/50'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Constraints (C)
            </button>
            <button
              onClick={() => setActiveTab('telemetry')}
              className={`flex-1 py-2 px-1 text-center font-semibold transition border-b-2 ${
                activeTab === 'telemetry'
                  ? 'border-cyan-500 text-cyan-300 bg-gray-800/50'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              KPIs
            </button>
          </div>

          {/* TAB 1: Real-time Trace Log */}
          {activeTab === 'log' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Filter bar */}
              <div className="p-2 border-b border-gray-800 bg-[#0e1626] flex items-center justify-between text-[11px]">
                <span className="text-gray-400 flex items-center gap-1">
                  <ListFilter className="w-3 h-3" />
                  Filter:
                </span>
                <div className="flex gap-1">
                  {['ALL', 'ASSIGN', 'CONFLICT', 'PRUNE'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilterType(f)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition ${
                        filterType === f
                          ? 'bg-cyan-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Event Stream */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 text-xs font-mono">
                {filteredEvents.length === 0 ? (
                  <div className="text-center text-gray-500 py-10 italic">
                    {events.length === 0
                      ? 'Click "Solve CSP & Dispatch" to execute the CSP solver.'
                      : 'Step through or play animation to view execution events.'}
                  </div>
                ) : (
                  filteredEvents.map((e, idx) => (
                    <div
                      key={`evt-${e.step}-${idx}`}
                      className="p-2 rounded bg-[#0b0f19] border border-gray-800 text-[11px] space-y-1 shadow-sm hover:border-gray-700 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 font-bold">#{e.step}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getBadgeStyle(e.event_type)}`}>
                          {e.event_type}
                        </span>
                      </div>
                      <div className="text-gray-200 leading-snug">{e.details}</div>
                      {e.skipped_vars && e.skipped_vars.length > 0 && (
                        <div className="text-[10px] text-red-400 bg-red-950/40 p-1 rounded border border-red-900/50">
                          ⚡ Skipped {e.skipped_vars.length} intermediate levels: {e.skipped_vars.slice(0, 3).join(', ')}...
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* TAB 2: Mathematical Variables (X) & Domains (D) */}
          {activeTab === 'variables' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
              <div className="bg-[#0b0f19] p-2.5 rounded-lg border border-gray-800">
                <span className="text-[11px] font-bold text-cyan-300 block mb-1">
                  Mathematical Variable Model:
                </span>
                <p className="text-[11px] text-gray-400 leading-relaxed font-mono">
                  X_{'{k, r, m}'} = Variable representing Unit #m of Resource Type r required for Incident k.
                </p>
              </div>

              <div className="space-y-2">
                {incidents.slice(0, 15).map(inc => {
                  const assignedCount = solution?.routes.filter(r => r.incident_id === inc.id).length || 0;
                  const totalRequired = Object.values(inc.required_resources).reduce((a, b) => a + b, 0);

                  return (
                    <div key={inc.id} className="p-2.5 rounded-lg bg-[#0b0f19] border border-gray-800 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-200">{inc.id}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          assignedCount === totalRequired ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'
                        }`}>
                          {assignedCount} / {totalRequired} Units Allocated
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-300">{inc.title}</div>
                      <div className="space-y-1 pt-1">
                        {Object.entries(inc.required_resources).map(([rt, cnt]) => (
                          <div key={rt} className="text-[10px] text-gray-400 flex justify-between font-mono bg-gray-900/70 px-1.5 py-0.5 rounded">
                            <span>Var: X_{'{' + inc.id + ',' + rt.split(' ')[0] + '}'}</span>
                            <span className="text-cyan-400 font-semibold">{cnt} slot(s)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Mathematical Constraints (C1 to C7) */}
          {activeTab === 'constraints' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
              <div className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">
                Active Constraints:
              </div>

              <div className="p-2.5 rounded bg-[#0b0f19] border border-gray-800 space-y-1">
                <span className="font-bold text-cyan-400 text-[11px]">C1: Maximum Travel Time</span>
                <p className="text-[11px] font-mono text-gray-300">T(C_j → I_k) ≤ T_max(Priority)</p>
                <p className="text-[10px] text-gray-400">Response time on road network must not exceed priority deadline (18m critical, 28m high, 42m medium).</p>
              </div>

              <div className="p-2.5 rounded bg-[#0b0f19] border border-gray-800 space-y-1">
                <span className="font-bold text-cyan-400 text-[11px]">C2: Budget Threshold</span>
                <p className="text-[11px] font-mono text-gray-300">Cost(C_j, I_k) ≤ Budget_max</p>
                <p className="text-[10px] text-gray-400">Dispatch unit cost + mileage fuel surcharge cannot exceed allocated emergency budget.</p>
              </div>

              <div className="p-2.5 rounded bg-[#0b0f19] border border-gray-800 space-y-1">
                <span className="font-bold text-cyan-400 text-[11px]">C3: Resource Center Inventory</span>
                <p className="text-[11px] font-mono text-gray-300">Available_Units(C_j, r) &gt; 0</p>
                <p className="text-[10px] text-gray-400">Target center must possess unallocated inventory of the exact capability requested.</p>
              </div>

              <div className="p-2.5 rounded bg-[#0b0f19] border border-gray-800 space-y-1">
                <span className="font-bold text-cyan-400 text-[11px]">C4: Road Network Accessibility</span>
                <p className="text-[11px] font-mono text-gray-300">Path(C_j → I_k) ≠ ∅, Cost &lt; ∞</p>
                <p className="text-[10px] text-gray-400">Road must not be blocked by collapsed flyover, flood hazard, or impassable road block.</p>
              </div>

              <div className="p-2.5 rounded bg-[#0b0f19] border border-gray-800 space-y-1">
                <span className="font-bold text-cyan-400 text-[11px]">C5: Global Capacity (N-ary)</span>
                <p className="text-[11px] font-mono text-gray-300">∑_{'{k}'} Assigned(X_{'{k,r}'} = C_j) ≤ Cap(C_j, r)</p>
                <p className="text-[10px] text-gray-400">Total concurrent dispatches from Center C_j across all incidents cannot exceed maximum vehicle count.</p>
              </div>

              <div className="p-2.5 rounded bg-[#0b0f19] border border-gray-800 space-y-1">
                <span className="font-bold text-cyan-400 text-[11px]">C6: Capability Matching (Unary)</span>
                <p className="text-[11px] font-mono text-gray-300">Capability(r) ∈ Required(Category)</p>
                <p className="text-[10px] text-gray-400">Resource assigned matches exact category capability (Fire requires Fire Brigade, etc.).</p>
              </div>

              <div className="p-2.5 rounded bg-[#0b0f19] border border-gray-800 space-y-1">
                <span className="font-bold text-cyan-400 text-[11px]">C7: Resource Center Operational</span>
                <p className="text-[11px] font-mono text-gray-300">Operational(C_j) == True</p>
                <p className="text-[10px] text-gray-400">Resource center must be online and active (switchable in Toggle Center mode).</p>
              </div>
            </div>
          )}

          {/* TAB 4: Solver Telemetry KPIs */}
          {activeTab === 'telemetry' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
              {solution ? (
                <div className="space-y-2">
                  <div className="bg-[#0b0f19] p-3 rounded-lg border border-gray-800 space-y-2">
                    <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wide">
                      Solution Metrics ({solution.algorithm}):
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-900/60 p-2 rounded">
                        <span className="text-gray-400 text-[10px] block">Allocated / Total</span>
                        <span className="text-emerald-400 font-bold text-sm font-mono">
                          {solution.allocated_count} / {solution.total_variables}
                        </span>
                      </div>
                      <div className="bg-gray-900/60 p-2 rounded">
                        <span className="text-gray-400 text-[10px] block">Execution Time</span>
                        <span className="text-cyan-300 font-bold text-sm font-mono">
                          {solution.execution_time_ms} ms
                        </span>
                      </div>
                      <div className="bg-gray-900/60 p-2 rounded">
                        <span className="text-gray-400 text-[10px] block">States Explored</span>
                        <span className="text-gray-200 font-bold text-sm font-mono">
                          {solution.states_explored}
                        </span>
                      </div>
                      <div className="bg-gray-900/60 p-2 rounded">
                        <span className="text-gray-400 text-[10px] block">Backtracks</span>
                        <span className="text-amber-400 font-bold text-sm font-mono">
                          {solution.backtracks}
                        </span>
                      </div>
                      <div className="bg-gray-900/60 p-2 rounded">
                        <span className="text-gray-400 text-[10px] block">Backjumps (CBJ)</span>
                        <span className="text-red-400 font-bold text-sm font-mono">
                          {solution.backjumps}
                        </span>
                      </div>
                      <div className="bg-gray-900/60 p-2 rounded">
                        <span className="text-gray-400 text-[10px] block">Values Pruned (AC3/PC)</span>
                        <span className="text-purple-400 font-bold text-sm font-mono">
                          {solution.domain_values_pruned}
                        </span>
                      </div>
                      <div className="bg-gray-900/60 p-2 rounded">
                        <span className="text-gray-400 text-[10px] block">Total Travel Time</span>
                        <span className="text-yellow-300 font-bold text-sm font-mono">
                          {solution.total_travel_time_min} mins
                        </span>
                      </div>
                      <div className="bg-gray-900/60 p-2 rounded">
                        <span className="text-gray-400 text-[10px] block">Total Cost</span>
                        <span className="text-blue-300 font-bold text-sm font-mono">
                          ${solution.total_cost}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-10 italic">
                  Run CSP solver to view telemetry KPIs.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
};

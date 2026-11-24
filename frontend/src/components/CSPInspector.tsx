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
  Minimize2,
  Zap,
  Repeat,
  ShieldAlert,
  TrendingDown,
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
  const [activeTab, setActiveTab] = useState<'log' | 'conflicts' | 'variables' | 'telemetry'>('log');
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

  const filteredEvents = visibleEvents.filter((e) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'ASSIGN') return e.event_type === 'ASSIGN_SUCCESS';
    if (filterType === 'PRUNE')
      return (
        e.event_type === 'NODE_PRUNE' ||
        e.event_type === 'AC3_PRUNE' ||
        e.event_type === 'PC_PRUNE' ||
        e.event_type === 'FC_PRUNE'
      );
    if (filterType === 'CONFLICT')
      return (
        e.event_type === 'CONFLICT' ||
        e.event_type === 'BACKTRACK' ||
        e.event_type === 'CBJ_BACKJUMP' ||
        e.event_type === 'FC_WIPEOUT'
      );
    if (filterType === 'LOCAL')
      return (
        e.event_type === 'LOCAL_INIT_COMPLETE' ||
        e.event_type === 'LOCAL_PICK_CONFLICTED' ||
        e.event_type === 'LOCAL_REPAIR' ||
        e.event_type === 'LOCAL_OPTIMUM'
      );
    return true;
  });

  const getBadgeStyle = (eventType: string) => {
    switch (eventType) {
      case 'ASSIGN_SUCCESS':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'CONFLICT':
      case 'FC_WIPEOUT':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'BACKTRACK':
        return 'bg-orange-950 text-orange-300 border-orange-800';
      case 'CBJ_BACKJUMP':
        return 'bg-rose-950 text-rose-300 border-rose-800 font-bold';
      case 'NODE_PRUNE':
      case 'AC3_PRUNE':
      case 'PC_PRUNE':
      case 'FC_PRUNE':
        return 'bg-purple-950 text-purple-300 border-purple-800';
      case 'HEURISTIC_MRV':
      case 'HEURISTIC_DEGREE':
      case 'HEURISTIC_LCV':
        return 'bg-indigo-950 text-indigo-300 border-indigo-800';
      case 'LOCAL_REPAIR':
        return 'bg-emerald-900 text-emerald-200 border-emerald-700';
      case 'LOCAL_PICK_CONFLICTED':
        return 'bg-rose-900 text-rose-200 border-rose-700';
      default:
        return 'bg-blue-950 text-blue-300 border-blue-800';
    }
  };

  // Sparkline data for Min-Conflicts
  const conflictHistory = solution?.conflicts_history || [];

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
                CSP State & Heuristic Inspector
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
              Trace ({visibleEvents.length})
            </button>
            <button
              onClick={() => setActiveTab('conflicts')}
              className={`flex-1 py-2 px-1 text-center font-semibold transition border-b-2 ${
                activeTab === 'conflicts'
                  ? 'border-emerald-500 text-emerald-300 bg-gray-800/50'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Conflicts
            </button>
            <button
              onClick={() => setActiveTab('variables')}
              className={`flex-1 py-2 px-1 text-center font-semibold transition border-b-2 ${
                activeTab === 'variables'
                  ? 'border-cyan-500 text-cyan-300 bg-gray-800/50'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Assignments
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

          {/* TAB 1: Trace Log */}
          {activeTab === 'log' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Filter bar */}
              <div className="p-2 border-b border-gray-800 bg-[#0e1626] flex items-center justify-between text-[11px]">
                <span className="text-gray-400 flex items-center gap-1">
                  <ListFilter className="w-3 h-3" /> Filter:
                </span>
                <div className="flex gap-1">
                  {(['ALL', 'ASSIGN', 'PRUNE', 'CONFLICT', 'LOCAL'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                        filterType === t
                          ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-700/60 font-bold'
                          : 'text-gray-400 hover:bg-gray-800'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Log Event Stream */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 font-mono text-xs">
                {filteredEvents.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 text-[11px]">
                    No trace events recorded yet. Start CSP solver or advance step.
                  </div>
                ) : (
                  filteredEvents.map((e, idx) => (
                    <div
                      key={`evt-${idx}`}
                      className="p-2 bg-[#0b0f19] border border-gray-800 rounded-lg space-y-1 hover:border-gray-700 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">#{e.step}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${getBadgeStyle(
                            e.event_type
                          )}`}
                        >
                          {e.event_type}
                        </span>
                      </div>

                      <div className="text-gray-200 text-[11px] leading-tight font-sans">
                        {e.details}
                      </div>

                      {/* Metadata Pill Row */}
                      <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] text-gray-400 font-mono">
                        {e.var_id && (
                          <span className="bg-gray-800/80 px-1 rounded text-cyan-300">
                            Var: {e.var_id.split('_').slice(1).join('_')}
                          </span>
                        )}
                        {e.domain_size !== undefined && (
                          <span className="bg-gray-800/80 px-1 rounded text-purple-300">
                            |D|: {e.domain_size}
                          </span>
                        )}
                        {e.total_conflicts !== undefined && (
                          <span className="bg-rose-950/80 px-1 rounded text-rose-300">
                            Conflicts: {e.total_conflicts}
                          </span>
                        )}
                        {e.skipped_vars && e.skipped_vars.length > 0 && (
                          <span className="bg-orange-950/80 px-1 rounded text-orange-300">
                            Skipped: {e.skipped_vars.length} vars
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* TAB 2: Min-Conflicts Sparkline & History */}
          {activeTab === 'conflicts' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-emerald-400" />
                    Conflict Minimization Progress
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {solution?.final_conflicts ?? 0} Conflicts
                  </span>
                </div>

                {/* SVG Sparkline */}
                {conflictHistory.length > 1 ? (
                  <div className="pt-2">
                    <div className="h-28 w-full bg-slate-900 rounded-lg p-2 flex items-end">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 280 80">
                        {/* Area Fill */}
                        {(() => {
                          const maxC = Math.max(...conflictHistory, 1);
                          const pts = conflictHistory.map((c, i) => {
                            const x = (i / (conflictHistory.length - 1)) * 280;
                            const y = 75 - (c / maxC) * 70;
                            return `${x},${y}`;
                          });
                          return (
                            <polygon
                              points={`0,75 ${pts.join(' ')} 280,75`}
                              fill="rgba(16, 185, 129, 0.15)"
                            />
                          );
                        })()}

                        {/* Polyline */}
                        {(() => {
                          const maxC = Math.max(...conflictHistory, 1);
                          const pts = conflictHistory.map((c, i) => {
                            const x = (i / (conflictHistory.length - 1)) * 280;
                            const y = 75 - (c / maxC) * 70;
                            return `${x},${y}`;
                          });
                          return (
                            <polyline
                              points={pts.join(' ')}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2"
                            />
                          );
                        })()}
                      </svg>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                      <span>Step 0 ({conflictHistory[0]} conflicts)</span>
                      <span>
                        Step {conflictHistory.length - 1} ({conflictHistory[conflictHistory.length - 1]} conflicts)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Run Min-Conflicts Local Search to view the live conflict reduction sparkline.
                  </div>
                )}
              </div>

              {/* Conflict Metrics Card */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-500 block">Total Local Repairs</span>
                  <span className="text-base font-bold text-white font-mono">
                    {solution?.repairs_count || 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-500 block">Status</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {solution?.status || 'IDLE'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-200 block mb-1">
                  How Min-Conflicts Works:
                </span>
                Starts with a complete assignment, selects a conflicted variable at each step, and
                greedily re-assigns it to the value that minimizes the total number of constraint
                violations across the network.
              </div>
            </div>
          )}

          {/* TAB 3: Current Assignments */}
          {activeTab === 'variables' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                <span>Variables: {solution?.total_variables || 0}</span>
                <span className="text-emerald-400 font-bold">
                  Assigned: {solution?.allocated_count || 0}
                </span>
              </div>

              {solution?.assignments ? (
                Object.entries(solution.assignments).map(([vId, unitId]) => (
                  <div
                    key={vId}
                    className="p-2 bg-[#0b0f19] border border-gray-800 rounded-lg text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono text-cyan-300 font-medium block">
                        {vId}
                      </span>
                    </div>
                    <div>
                      {unitId ? (
                        <span className="font-mono text-[11px] text-emerald-400 font-bold bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800">
                          {unitId}
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-rose-400 bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-800">
                          UNASSIGNED
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-gray-500">
                  No active solution assignments yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Telemetry & KPIs */}
          {activeTab === 'telemetry' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-[#0b0f19] border border-gray-800 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">States / Repairs</span>
                  <span className="text-lg font-bold text-cyan-400 font-mono">
                    {solution?.states_explored ?? solution?.repairs_count ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-[#0b0f19] border border-gray-800 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">Backtracks</span>
                  <span className="text-lg font-bold text-amber-400 font-mono">
                    {solution?.backtracks ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-[#0b0f19] border border-gray-800 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">CBJ Backjumps</span>
                  <span className="text-lg font-bold text-rose-400 font-mono">
                    {solution?.backjumps ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-[#0b0f19] border border-gray-800 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">Domains Pruned</span>
                  <span className="text-lg font-bold text-purple-400 font-mono">
                    {solution?.domain_values_pruned ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-[#0b0f19] border border-gray-800 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">Execution Time</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    {solution?.execution_time_ms ? `${solution.execution_time_ms.toFixed(1)}ms` : '0ms'}
                  </span>
                </div>
                <div className="p-3 bg-[#0b0f19] border border-gray-800 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">Subproblems</span>
                  <span className="text-lg font-bold text-indigo-400 font-mono">
                    {solution?.subproblems_count ?? 1}
                  </span>
                </div>
              </div>

              {solution && (
                <div className="p-3 bg-[#0b0f19] border border-gray-800 rounded-lg space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-300">
                    <span>Algorithm:</span>
                    <span className="font-bold text-cyan-300">{solution.algorithm}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Success Rate:</span>
                    <span className="font-bold text-emerald-400">
                      {solution.total_variables > 0
                        ? `${((solution.allocated_count / solution.total_variables) * 100).toFixed(1)}%`
                        : '0%'}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Total Travel Time:</span>
                    <span className="font-mono text-amber-300">
                      {solution.total_travel_time_min.toFixed(1)} mins
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Total Cost:</span>
                    <span className="font-mono text-emerald-300">
                      ${solution.total_cost.toFixed(0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
};

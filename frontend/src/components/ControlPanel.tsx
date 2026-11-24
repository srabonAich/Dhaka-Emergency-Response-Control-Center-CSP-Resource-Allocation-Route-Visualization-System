import React from 'react';
import {
  Play,
  RotateCcw,
  PlusCircle,
  AlertTriangle,
  ShieldAlert,
  Sliders,
  Flame,
  CheckCircle2,
  TableProperties,
  Sigma,
  Zap,
  Repeat,
  Compass,
} from 'lucide-react';
import {
  ClickMode,
  EmergencyCategory,
  CSPAlgorithm,
  CSPInference,
  VarHeuristic,
  ValHeuristic,
  CSPSolveRequest,
} from '../types';

interface ControlPanelProps {
  scale: string;
  onScaleChange: (scale: string) => void;
  clickMode: ClickMode;
  onClickModeChange: (mode: ClickMode) => void;

  solveRequest: CSPSolveRequest;
  onUpdateSolveRequest: (updates: Partial<CSPSolveRequest>) => void;

  onSolve: () => void;
  onReset: () => void;
  onOpenBenchmark: () => void;
  onOpenFormulation: () => void;
  isSolving: boolean;

  newIncidentCategory: EmergencyCategory;
  onNewIncidentCategoryChange: (cat: EmergencyCategory) => void;
  newIncidentPriority: number;
  onNewIncidentPriorityChange: (prio: number) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  scale,
  onScaleChange,
  clickMode,
  onClickModeChange,
  solveRequest,
  onUpdateSolveRequest,
  onSolve,
  onReset,
  onOpenBenchmark,
  onOpenFormulation,
  isSolving,
  newIncidentCategory,
  onNewIncidentCategoryChange,
  newIncidentPriority,
  onNewIncidentPriorityChange,
}) => {
  const categories: EmergencyCategory[] = [
    'Medical Emergency',
    'Fire',
    'Accident',
    'Flood',
    'Earthquake',
    'Crime',
    'Other',
  ];

  return (
    <aside className="w-80 h-full bg-[#111827] border-r border-[#1f2937] flex flex-col justify-between overflow-y-auto text-sm z-10 shadow-2xl">
      <div className="p-4 space-y-4">
        {/* 1. Scale Presets */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              1. Scenario Scale
            </label>
            <span className="text-[10px] text-cyan-400 font-mono">
              {scale === 'Small' ? '25 Incidents' : scale === 'Medium' ? '120 Incidents' : '220 Incidents'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 bg-[#0b0f19] p-1 rounded-lg border border-gray-800">
            {(['Small', 'Medium', 'Large'] as const).map((s) => (
              <button
                key={s}
                onClick={() => onScaleChange(s)}
                className={`py-1.5 px-2 text-xs font-semibold rounded-md transition ${
                  scale === s
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Map Interaction Tool */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">
            2. Map Interaction Mode
          </label>
          <div className="space-y-1 bg-[#0b0f19] p-1.5 rounded-lg border border-gray-800">
            <button
              onClick={() => onClickModeChange('inspect')}
              className={`w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between transition ${
                clickMode === 'inspect'
                  ? 'bg-gray-700/80 text-cyan-300 font-semibold'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <span>Normal / Inspect</span>
              <CheckCircle2 className="w-3.5 h-3.5 opacity-60" />
            </button>
            <button
              onClick={() => onClickModeChange('add_incident')}
              className={`w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between transition ${
                clickMode === 'add_incident'
                  ? 'bg-amber-900/40 text-amber-300 font-semibold border border-amber-600/40'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                Add Incident
              </span>
              <span className="text-[9px] bg-amber-950 px-1 rounded text-amber-300">Click Map</span>
            </button>
            <button
              onClick={() => onClickModeChange('escalate')}
              className={`w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between transition ${
                clickMode === 'escalate'
                  ? 'bg-red-900/40 text-red-300 font-semibold border border-red-600/40'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-red-400" />
                Escalate Incident
              </span>
              <span className="text-[9px] bg-red-950 px-1 rounded text-red-300">Click Inc</span>
            </button>
            <button
              onClick={() => onClickModeChange('block_road')}
              className={`w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between transition ${
                clickMode === 'block_road'
                  ? 'bg-yellow-900/40 text-yellow-300 font-semibold border border-yellow-600/40'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                Block Road / Hazard
              </span>
              <span className="text-[9px] bg-yellow-950 px-1 rounded text-yellow-300">C4 Test</span>
            </button>
            <button
              onClick={() => onClickModeChange('toggle_center')}
              className={`w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between transition ${
                clickMode === 'toggle_center'
                  ? 'bg-purple-900/40 text-purple-300 font-semibold border border-purple-600/40'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                Toggle Center Offline
              </span>
              <span className="text-[9px] bg-purple-950 px-1 rounded text-purple-300">C7 Test</span>
            </button>
          </div>
        </div>

        {/* Add Incident Mini-Form */}
        {clickMode === 'add_incident' && (
          <div className="bg-amber-950/20 border border-amber-600/30 p-2.5 rounded-lg space-y-2">
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wide block">
              New Incident Config:
            </span>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">Category</label>
              <select
                value={newIncidentCategory}
                onChange={(e) =>
                  onNewIncidentCategoryChange(e.target.value as EmergencyCategory)
                }
                className="w-full bg-[#0b0f19] border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                <span>Priority:</span>
                <span className="font-bold text-amber-300">
                  {newIncidentPriority} ({newIncidentPriority === 5 ? 'Critical' : newIncidentPriority >= 3 ? 'High' : 'Low'})
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={newIncidentPriority}
                onChange={(e) => onNewIncidentPriorityChange(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-gray-400 italic">
              Click anywhere on the Dhaka map to spawn this incident!
            </p>
          </div>
        )}

        {/* 3. The 3 Primary CSP Algorithms */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5 flex items-center justify-between">
            <span>3. CSP Solver Algorithm</span>
            <span className="text-indigo-400 font-mono text-[10px] lowercase">3 engines</span>
          </label>

          {/* 3 Main Algorithm Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-[#0b0f19] p-1 rounded-lg border border-gray-800 mb-2">
            <button
              onClick={() => onUpdateSolveRequest({ algorithm: 'backtracking' })}
              className={`py-1.5 px-1 text-[11px] font-semibold rounded transition text-center ${
                solveRequest.algorithm === 'backtracking'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Backtracking
            </button>
            <button
              onClick={() => onUpdateSolveRequest({ algorithm: 'backjumping' })}
              className={`py-1.5 px-1 text-[11px] font-semibold rounded transition text-center ${
                solveRequest.algorithm === 'backjumping'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Backjumping
            </button>
            <button
              onClick={() => onUpdateSolveRequest({ algorithm: 'min_conflicts' })}
              className={`py-1.5 px-1 text-[11px] font-semibold rounded transition text-center ${
                solveRequest.algorithm === 'min_conflicts'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Min-Conflicts
            </button>
          </div>

          {/* Pre-Search Consistency Preprocessing Checkboxes */}
          <div className="bg-[#0b0f19] p-2.5 rounded-lg border border-gray-800 space-y-1.5 mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" />
              Pre-Search Consistency:
            </span>
            <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer">
              <span>Node Consistency (Unary C1-C7)</span>
              <input
                type="checkbox"
                checked={solveRequest.use_node_consistency}
                onChange={(e) =>
                  onUpdateSolveRequest({ use_node_consistency: e.target.checked })
                }
                className="accent-yellow-500 rounded"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer">
              <span>Arc Consistency (AC-3)</span>
              <input
                type="checkbox"
                checked={solveRequest.use_ac3}
                onChange={(e) => onUpdateSolveRequest({ use_ac3: e.target.checked })}
                className="accent-indigo-500 rounded"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer">
              <span>Path Consistency (3-Consistency)</span>
              <input
                type="checkbox"
                checked={solveRequest.use_path_consistency}
                onChange={(e) =>
                  onUpdateSolveRequest({ use_path_consistency: e.target.checked })
                }
                className="accent-purple-500 rounded"
              />
            </label>
          </div>

          {/* Algorithm-Specific Options */}
          {solveRequest.algorithm === 'min_conflicts' ? (
            /* Min-Conflicts Local Search Controls */
            <div className="bg-emerald-950/20 border border-emerald-600/30 p-2.5 rounded-lg space-y-2">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                <Repeat className="w-3 h-3 text-emerald-400" />
                Min-Conflicts Local Search Options
              </span>

              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                  <span>Max Steps:</span>
                  <span className="font-bold text-emerald-300">{solveRequest.max_steps}</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={1000}
                  step={50}
                  value={solveRequest.max_steps}
                  onChange={(e) => onUpdateSolveRequest({ max_steps: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Initial Strategy</label>
                <select
                  value={solveRequest.initial_strategy}
                  onChange={(e) =>
                    onUpdateSolveRequest({
                      initial_strategy: e.target.value as 'nearest' | 'random',
                    })
                  }
                  className="w-full bg-[#0b0f19] border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
                >
                  <option value="nearest">Nearest Resource Center (Greedy)</option>
                  <option value="random">Random Complete Assignment</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                  <span>Random Walk Prob:</span>
                  <span className="font-bold text-emerald-300">
                    {(solveRequest.random_walk_prob * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={0.3}
                  step={0.01}
                  value={solveRequest.random_walk_prob}
                  onChange={(e) =>
                    onUpdateSolveRequest({ random_walk_prob: Number(e.target.value) })
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer pt-1">
                <span>Random Restart on Plateau</span>
                <input
                  type="checkbox"
                  checked={solveRequest.allow_random_restart}
                  onChange={(e) =>
                    onUpdateSolveRequest({ allow_random_restart: e.target.checked })
                  }
                  className="accent-emerald-500 rounded"
                />
              </label>
            </div>
          ) : (
            /* Systematic Search (BT / CBJ) Heuristics & Look-Ahead */
            <div className="bg-[#0b0f19] p-2.5 rounded-lg border border-gray-800 space-y-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                <Sliders className="w-3 h-3 text-cyan-400" />
                Systematic Search Heuristics:
              </span>

              {/* Interleaved Inference */}
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">
                  Search Inference (Look-Ahead)
                </label>
                <select
                  value={solveRequest.inference}
                  onChange={(e) =>
                    onUpdateSolveRequest({ inference: e.target.value as CSPInference })
                  }
                  className="w-full bg-[#111827] border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
                >
                  <option value="forward_checking">Forward Checking (FC)</option>
                  <option value="mac">Maintaining Arc Consistency (MAC)</option>
                  <option value="none">None (Standard Backtrack)</option>
                </select>
              </div>

              {/* Variable Ordering */}
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">
                  Variable Ordering Heuristic
                </label>
                <select
                  value={solveRequest.var_heuristic}
                  onChange={(e) =>
                    onUpdateSolveRequest({ var_heuristic: e.target.value as VarHeuristic })
                  }
                  className="w-full bg-[#111827] border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
                >
                  <option value="mrv_degree">MRV + Degree Heuristic (Fail-First)</option>
                  <option value="mrv">Minimum Remaining Values (MRV)</option>
                  <option value="priority">Emergency Priority Only (Static)</option>
                </select>
              </div>

              {/* Value Ordering */}
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">
                  Value Ordering Heuristic
                </label>
                <select
                  value={solveRequest.val_heuristic}
                  onChange={(e) =>
                    onUpdateSolveRequest({ val_heuristic: e.target.value as ValHeuristic })
                  }
                  className="w-full bg-[#111827] border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
                >
                  <option value="lcv">Least Constraining Value (LCV)</option>
                  <option value="nearest">Nearest Resource Center Cascade</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons & Formulation Modal Link */}
      <div className="p-4 border-t border-gray-800 bg-[#0d131f] space-y-2">
        <button
          onClick={onSolve}
          disabled={isSolving}
          className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98] disabled:opacity-50 text-xs"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>{isSolving ? 'Solving CSP...' : 'Solve CSP & Dispatch'}</span>
        </button>

        <button
          onClick={onOpenFormulation}
          className="w-full bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 font-semibold py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 border border-indigo-700/40 shadow transition text-xs"
        >
          <Sigma className="w-3.5 h-3.5" />
          <span>View Formal CSP Formulation</span>
        </button>

        <button
          onClick={onOpenBenchmark}
          className="w-full bg-gray-800 hover:bg-gray-700 text-cyan-300 font-semibold py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 border border-cyan-800/50 shadow transition text-xs"
        >
          <TableProperties className="w-3.5 h-3.5" />
          <span>Run Scale Benchmark (6 Algos)</span>
        </button>

        <button
          onClick={onReset}
          className="w-full bg-transparent hover:bg-gray-800 text-gray-400 hover:text-gray-200 font-medium py-1 px-3 rounded flex items-center justify-center gap-1.5 transition text-[11px]"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Scenario</span>
        </button>
      </div>
    </aside>
  );
};

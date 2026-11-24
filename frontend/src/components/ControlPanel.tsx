import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  PlusCircle,
  AlertTriangle,
  ShieldAlert,
  Sliders,
  Flame,
  CheckCircle2,
  TableProperties
} from 'lucide-react';
import { ClickMode, EmergencyCategory } from '../types';

interface ControlPanelProps {
  scale: string;
  onScaleChange: (scale: string) => void;
  clickMode: ClickMode;
  onClickModeChange: (mode: ClickMode) => void;
  algorithm: string;
  onAlgorithmChange: (algo: string) => void;
  useMrv: boolean;
  onToggleMrv: (val: boolean) => void;
  useDegree: boolean;
  onToggleDegree: (val: boolean) => void;
  useLcv: boolean;
  onToggleLcv: (val: boolean) => void;
  useNearestCenter: boolean;
  onToggleNearestCenter: (val: boolean) => void;
  onSolve: () => void;
  onReset: () => void;
  onOpenBenchmark: () => void;
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
  algorithm,
  onAlgorithmChange,
  useMrv,
  onToggleMrv,
  useDegree,
  onToggleDegree,
  useLcv,
  onToggleLcv,
  useNearestCenter,
  onToggleNearestCenter,
  onSolve,
  onReset,
  onOpenBenchmark,
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
      <div className="p-4 space-y-5">
        {/* Scenario Scale Preset Selector */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
            1. Problem Scale Presets
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-[#0b0f19] p-1 rounded-lg border border-gray-800">
            {(['Small', 'Medium', 'Large'] as const).map(s => (
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
                <span className="block text-[10px] font-normal opacity-80">
                  {s === 'Small' ? '25 Inc.' : s === 'Medium' ? '120 Inc.' : '220 Inc.'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Click Mode Selector */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
            2. Map Interaction Tool
          </label>
          <div className="space-y-1 bg-[#0b0f19] p-1.5 rounded-lg border border-gray-800">
            <button
              onClick={() => onClickModeChange('inspect')}
              className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition ${
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
              className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition ${
                clickMode === 'add_incident'
                  ? 'bg-amber-900/40 text-amber-300 font-semibold border border-amber-600/40'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                Add Custom Incident
              </span>
              <span className="text-[10px] bg-amber-950 px-1.5 py-0.5 rounded text-amber-300">Click Map</span>
            </button>
            <button
              onClick={() => onClickModeChange('escalate')}
              className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition ${
                clickMode === 'escalate'
                  ? 'bg-red-900/40 text-red-300 font-semibold border border-red-600/40'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-red-400" />
                Escalate / Worsen Situation
              </span>
              <span className="text-[10px] bg-red-950 px-1.5 py-0.5 rounded text-red-300">Click Inc</span>
            </button>
            <button
              onClick={() => onClickModeChange('block_road')}
              className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition ${
                clickMode === 'block_road'
                  ? 'bg-yellow-900/40 text-yellow-300 font-semibold border border-yellow-600/40'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                Block Road / Hazard
              </span>
              <span className="text-[10px] bg-yellow-950 px-1.5 py-0.5 rounded text-yellow-300">C4 Test</span>
            </button>
            <button
              onClick={() => onClickModeChange('toggle_center')}
              className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition ${
                clickMode === 'toggle_center'
                  ? 'bg-purple-900/40 text-purple-300 font-semibold border border-purple-600/40'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                Toggle Center Offline
              </span>
              <span className="text-[10px] bg-purple-950 px-1.5 py-0.5 rounded text-purple-300">C7 Test</span>
            </button>
          </div>
        </div>

        {/* Dynamic Incident Creator Form (Visible when in Add Incident mode) */}
        {clickMode === 'add_incident' && (
          <div className="bg-amber-950/20 border border-amber-600/30 p-2.5 rounded-lg space-y-2">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide block">
              New Incident Config:
            </span>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Category</label>
              <select
                value={newIncidentCategory}
                onChange={e => onNewIncidentCategoryChange(e.target.value as EmergencyCategory)}
                className="w-full bg-[#0b0f19] border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>Priority:</span>
                <span className="font-bold text-amber-300">{newIncidentPriority} ({newIncidentPriority === 5 ? 'Critical' : newIncidentPriority >= 3 ? 'High' : 'Low'})</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={newIncidentPriority}
                onChange={e => onNewIncidentPriorityChange(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-gray-400 italic">
              Click anywhere on Dhaka map to place this emergency!
            </p>
          </div>
        )}

        {/* CSP Solver Configuration */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
            3. AI / CSP Algorithm
          </label>
          <div className="space-y-1.5">
            <select
              value={algorithm}
              onChange={e => onAlgorithmChange(e.target.value)}
              className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-2.5 py-2 text-xs text-gray-100 font-medium focus:ring-1 focus:ring-cyan-500 outline-none"
            >
              <option value="path_consistency_cbj">Path Consistency + Conflict Backjumping (PC-2 + CBJ)</option>
              <option value="ac3_backtracking">Maintaining Arc Consistency (AC-3 + BT)</option>
              <option value="backjumping">Conflict-Directed Backjumping (CBJ)</option>
              <option value="backtracking">Standard Backtracking Search (BT)</option>
            </select>
          </div>

          {/* Heuristics Toggles */}
          <div className="mt-3 bg-[#0b0f19] p-2.5 rounded-lg border border-gray-800 space-y-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
              <Sliders className="w-3 h-3 text-cyan-400" />
              Active Heuristics:
            </span>
            <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer">
              <span>MRV (Min Remaining Values)</span>
              <input
                type="checkbox"
                checked={useMrv}
                onChange={e => onToggleMrv(e.target.checked)}
                className="accent-cyan-500 rounded"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer">
              <span>Degree Heuristic (Tie-breaker)</span>
              <input
                type="checkbox"
                checked={useDegree}
                onChange={e => onToggleDegree(e.target.checked)}
                className="accent-cyan-500 rounded"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer">
              <span>LCV (Least Constraining Value)</span>
              <input
                type="checkbox"
                checked={useLcv}
                onChange={e => onToggleLcv(e.target.checked)}
                className="accent-cyan-500 rounded"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer">
              <span>Nearest-Center Cascade</span>
              <input
                type="checkbox"
                checked={useNearestCenter}
                onChange={e => onToggleNearestCenter(e.target.checked)}
                className="accent-cyan-500 rounded"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-gray-800 bg-[#0d131f] space-y-2">
        <button
          onClick={onSolve}
          disabled={isSolving}
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98] disabled:opacity-50"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>{isSolving ? 'Solving CSP...' : 'Solve CSP & Dispatch'}</span>
        </button>

        <button
          onClick={onOpenBenchmark}
          className="w-full bg-gray-800 hover:bg-gray-700 text-cyan-300 font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-2 border border-cyan-800/50 shadow transition text-xs"
        >
          <TableProperties className="w-3.5 h-3.5" />
          <span>Run Scale Benchmark</span>
        </button>

        <button
          onClick={onReset}
          className="w-full bg-transparent hover:bg-gray-800 text-gray-400 hover:text-gray-200 font-medium py-1.5 px-3 rounded flex items-center justify-center gap-1.5 transition text-xs"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Scenario</span>
        </button>
      </div>
    </aside>
  );
};

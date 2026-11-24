import React from 'react';
import {
  ShieldAlert,
  Flame,
  Truck,
  Activity,
  Layers,
  CheckCircle,
  Clock,
  Map as MapIcon,
  Network,
  Sigma,
} from 'lucide-react';
import { CSPSolution, EmergencyIncident, ResourceCenter } from '../types';

interface HeaderProps {
  scale: string;
  incidents: EmergencyIncident[];
  centers: ResourceCenter[];
  solution: CSPSolution | null;
  isSolving: boolean;
  isPlaying: boolean;
  animationCompleted: boolean;
  viewMode: 'map' | 'graph';
  onViewModeChange: (mode: 'map' | 'graph') => void;
  onOpenFormulation: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  scale,
  incidents,
  centers,
  solution,
  isSolving,
  isPlaying,
  animationCompleted,
  viewMode,
  onViewModeChange,
  onOpenFormulation,
}) => {
  const totalUnitsRequired = incidents.reduce(
    (acc, inc) => acc + Object.values(inc.required_resources).reduce((a, b) => a + b, 0),
    0
  );

  const activeCentersCount = centers.filter((c) => c.operational).length;

  return (
    <header className="h-16 bg-[#0f172a] border-b border-[#1e293b] px-4 flex items-center justify-between shadow-md z-20">
      {/* Title & Branding */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-950/50">
          <ShieldAlert className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-black tracking-wide text-gray-100 uppercase">
              Dhaka Emergency Response Control Center
            </h1>
            <span className="bg-red-950/80 text-red-400 border border-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
              LIVE GIS
            </span>
          </div>
          <p className="text-[11px] text-gray-400 flex items-center gap-2">
            <span>Constraint Satisfaction Problem (CSP) Theory & Route Optimization</span>
            <span>•</span>
            <span className="text-cyan-400 font-semibold">{scale} Scale Preset</span>
          </p>
        </div>
      </div>

      {/* Dual-View Switcher (Map View vs Constraint Graph View) */}
      <div className="flex items-center bg-[#0b0f19] p-1 rounded-xl border border-gray-800 shadow-inner">
        <button
          onClick={() => onViewModeChange('map')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            viewMode === 'map'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>Dhaka Map View</span>
        </button>
        <button
          onClick={() => onViewModeChange('graph')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            viewMode === 'graph'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>Constraint Graph & Matrix</span>
        </button>
      </div>

      {/* Live Operational KPI Badges & Formulation Link */}
      <div className="flex items-center gap-2.5">
        <div className="bg-[#1e293b]/70 border border-gray-700 px-3 py-1 rounded-lg flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-400" />
          <div className="text-left">
            <div className="text-[9px] text-gray-400 font-medium uppercase leading-none">Incidents</div>
            <div className="text-xs font-mono font-bold text-gray-100">{incidents.length}</div>
          </div>
        </div>

        <div className="bg-[#1e293b]/70 border border-gray-700 px-3 py-1 rounded-lg flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <div className="text-left">
            <div className="text-[9px] text-gray-400 font-medium uppercase leading-none">Variables (X)</div>
            <div className="text-xs font-mono font-bold text-cyan-300">{totalUnitsRequired}</div>
          </div>
        </div>

        <div className="bg-[#1e293b]/70 border border-gray-700 px-3 py-1 rounded-lg flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-400" />
          <div className="text-left">
            <div className="text-[9px] text-gray-400 font-medium uppercase leading-none">Allocated</div>
            <div className="text-xs font-mono font-bold text-emerald-400">
              {solution ? `${solution.allocated_count} / ${solution.total_variables}` : '—'}
            </div>
          </div>
        </div>

        {/* Solver Execution State Badge */}
        <div className="pl-1 border-l border-gray-700">
          {isSolving ? (
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-spin" />
              Solving...
            </span>
          ) : isPlaying ? (
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Trace Replay
            </span>
          ) : animationCompleted ? (
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              Dispatched
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-gray-800 text-gray-300 border border-gray-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              Ready
            </span>
          )}
        </div>
      </div>
    </header>
  );
};

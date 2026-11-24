import React, { useState } from 'react';
import {
  X,
  TableProperties,
  Play,
  CheckCircle2,
  TrendingUp,
  Zap,
  BarChart3,
  Clock,
  Shuffle,
  ShieldCheck,
} from 'lucide-react';
import { BenchmarkResponse, BenchmarkMetric } from '../types';

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunBenchmark: (scale: string) => void;
  benchmarkData: BenchmarkResponse | null;
  isLoading: boolean;
  currentScale: string;
}

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({
  isOpen,
  onClose,
  onRunBenchmark,
  benchmarkData,
  isLoading,
  currentScale,
}) => {
  const [selectedScale, setSelectedScale] = useState<string>(currentScale || 'Small');
  const [chartMetric, setChartMetric] = useState<'time' | 'states'>('time');

  if (!isOpen) return null;

  const results = benchmarkData?.results || [];

  const maxTime = Math.max(...results.map((r) => r.execution_time_ms), 1);
  const maxStates = Math.max(...results.map((r) => r.states_or_repairs), 1);

  return (
    <div className="fixed inset-0 z-[2000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-gray-700 rounded-xl w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#0d131f]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <TableProperties className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                Comparative CSP Algorithm Benchmark
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono">
                  6 Configurations
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Systematic Backtracking vs Conflict-Directed Backjumping vs Min-Conflicts Local Search
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Controls Bar */}
        <div className="p-4 bg-[#0e1626] border-b border-gray-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400">Benchmark Scale:</span>
            <div className="flex gap-1 bg-[#0b0f19] p-1 rounded-lg border border-gray-800">
              {(['Small', 'Medium', 'Large'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedScale(s)}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    selectedScale === s
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {s} {s === 'Small' ? '(25)' : s === 'Medium' ? '(120)' : '(220)'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#0b0f19] p-1 rounded-lg border border-gray-800 text-xs">
              <button
                onClick={() => setChartMetric('time')}
                className={`px-2.5 py-1 rounded transition ${
                  chartMetric === 'time'
                    ? 'bg-indigo-600 text-white font-medium shadow'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Time Chart
              </button>
              <button
                onClick={() => setChartMetric('states')}
                className={`px-2.5 py-1 rounded transition ${
                  chartMetric === 'states'
                    ? 'bg-indigo-600 text-white font-medium shadow'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                States/Repairs Chart
              </button>
            </div>

            <button
              onClick={() => onRunBenchmark(selectedScale)}
              disabled={isLoading}
              className="bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold py-1.5 px-4 rounded-lg flex items-center gap-2 text-xs shadow transition disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Benchmarking 6 Configurations...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Run {selectedScale} Scale Benchmark</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Body: Results Table & Visual Chart */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {benchmarkData && results.length > 0 ? (
            <div className="space-y-4">
              {/* Visual SVG Comparison Chart */}
              <div className="bg-[#0b0f19] p-4 rounded-xl border border-gray-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span className="font-bold flex items-center gap-1.5 text-indigo-400">
                    <BarChart3 className="w-4 h-4" />
                    Comparative Visual Chart ({chartMetric === 'time' ? 'Execution Time (ms)' : 'States Explored / Local Repairs'})
                  </span>
                  <span className="text-[11px] text-gray-500">Lower is better</span>
                </div>

                <div className="space-y-2 pt-2">
                  {results.map((row, idx) => {
                    const value = chartMetric === 'time' ? row.execution_time_ms : row.states_or_repairs;
                    const maxVal = chartMetric === 'time' ? maxTime : maxStates;
                    const pct = Math.max(2, Math.min(100, Math.round((value / maxVal) * 100)));

                    const barColor =
                      row.algorithm_family === 'CBJ'
                        ? 'from-amber-600 to-amber-500'
                        : row.algorithm_family === 'Min-Conflicts'
                        ? 'from-emerald-600 to-emerald-500'
                        : 'from-indigo-600 to-blue-500';

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-300 font-medium truncate max-w-md">
                            {row.algorithm}
                          </span>
                          <span className="font-mono font-bold text-white">
                            {chartMetric === 'time' ? `${value.toFixed(1)} ms` : `${value} steps`}
                          </span>
                        </div>
                        <div className="w-full bg-gray-800/80 h-2 rounded-full overflow-hidden">
                          <div
                            className={`bg-gradient-to-r ${barColor} h-full rounded-full transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Comprehensive Comparison Table */}
              <div className="overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0b0f19] text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800">
                    <tr>
                      <th className="py-2.5 px-3">Configuration</th>
                      <th className="py-2.5 px-2">Family</th>
                      <th className="py-2.5 px-2 text-right">Allocated</th>
                      <th className="py-2.5 px-2 text-right">States / Repairs</th>
                      <th className="py-2.5 px-2 text-right">Backtracks</th>
                      <th className="py-2.5 px-2 text-right">Backjumps</th>
                      <th className="py-2.5 px-2 text-right">Skipped Levels</th>
                      <th className="py-2.5 px-2 text-right">Pruned (AC3/FC)</th>
                      <th className="py-2.5 px-2 text-right">Time (ms)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 bg-[#111827]">
                    {results.map((row, idx) => {
                      const isCBJ = row.algorithm_family === 'CBJ';
                      const isMinConflicts = row.algorithm_family === 'Min-Conflicts';
                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-gray-800/50 transition ${
                            isCBJ
                              ? 'bg-amber-950/10'
                              : isMinConflicts
                              ? 'bg-emerald-950/10'
                              : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-gray-200 font-sans font-medium">
                            {row.algorithm}
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isCBJ
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : isMinConflicts
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-indigo-500/20 text-indigo-300'
                              }`}
                            >
                              {row.algorithm_family}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right text-emerald-400 font-bold">
                            {row.allocated_count} / {row.total_variables}
                          </td>
                          <td className="py-3 px-2 text-right text-gray-300">
                            {row.states_or_repairs}
                          </td>
                          <td className="py-3 px-2 text-right text-amber-400">
                            {row.backtracks}
                          </td>
                          <td className="py-3 px-2 text-right text-rose-400 font-bold">
                            {row.backjumps}
                          </td>
                          <td className="py-3 px-2 text-right text-cyan-300 font-bold">
                            {row.skipped_levels}
                          </td>
                          <td className="py-3 px-2 text-right text-purple-400">
                            {row.domains_pruned}
                          </td>
                          <td className="py-3 px-2 text-right text-white font-bold">
                            {row.execution_time_ms.toFixed(1)} ms
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Analytical Insights Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="bg-[#0b0f19] p-3 rounded-lg border border-gray-800 space-y-1">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1">
                    <Shuffle className="w-3.5 h-3.5" />
                    CBJ Level Skipping
                  </span>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    On domain wipeouts, CBJ jumps over unrelated variables directly to the true source
                    of conflict in the conflict set, saving dozens of useless intermediate search states.
                  </p>
                </div>

                <div className="bg-[#0b0f19] p-3 rounded-lg border border-gray-800 space-y-1">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    Min-Conflicts Scalability
                  </span>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Min-conflicts operates on complete state assignments. With nearest-center initial
                    assignment, it resolves the vast majority of conflicts in few steps.
                  </p>
                </div>

                <div className="bg-[#0b0f19] p-3 rounded-lg border border-gray-800 space-y-1">
                  <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    MAC & MRV Synergy
                  </span>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Maintaining Arc Consistency (MAC) combined with MRV prunes incompatible physical units
                    ahead of time, driving the search directly toward consistent assignments.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500 space-y-3">
              <TableProperties className="w-12 h-12 text-gray-600" />
              <p className="text-sm">
                Click "Run Benchmark" to evaluate all 6 CSP solver configurations on {selectedScale} scale.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

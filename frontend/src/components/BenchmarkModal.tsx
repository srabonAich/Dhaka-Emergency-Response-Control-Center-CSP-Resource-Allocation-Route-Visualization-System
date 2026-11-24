import React, { useState } from 'react';
import { X, TableProperties, Play, CheckCircle2, TrendingUp, Zap } from 'lucide-react';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-gray-700 rounded-xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#0d131f]">
          <div className="flex items-center gap-2.5">
            <TableProperties className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-bold text-gray-100">
                CSP Comparative Benchmark Suite
              </h2>
              <p className="text-xs text-gray-400">
                Evaluation across Backtracking, Conflict-Directed Backjumping, AC-3, and Full Heuristics
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
              {(['Small', 'Medium', 'Large'] as const).map(s => (
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

          <button
            onClick={() => onRunBenchmark(selectedScale)}
            disabled={isLoading}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-1.5 px-4 rounded-lg flex items-center gap-2 text-xs shadow transition disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Running Benchmark...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Run {selectedScale} Scale Benchmark</span>
              </>
            )}
          </button>
        </div>

        {/* Modal Body: Results Table */}
        <div className="p-4 overflow-y-auto flex-1">
          {benchmarkData && benchmarkData.results.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0b0f19] text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800">
                    <tr>
                      <th className="py-2.5 px-3">Algorithm</th>
                      <th className="py-2.5 px-2">Scale</th>
                      <th className="py-2.5 px-2 text-right">Allocated / Total</th>
                      <th className="py-2.5 px-2 text-right">Alloc Rate</th>
                      <th className="py-2.5 px-2 text-right">States Explored</th>
                      <th className="py-2.5 px-2 text-right">Backtracks</th>
                      <th className="py-2.5 px-2 text-right">Backjumps (CBJ)</th>
                      <th className="py-2.5 px-2 text-right">Pruned (AC3/PC)</th>
                      <th className="py-2.5 px-2 text-right">Total Travel Time</th>
                      <th className="py-2.5 px-3 text-right">Time (ms)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 bg-[#111827]">
                    {benchmarkData.results.map((row, idx) => {
                      const isFull = row.algorithm.includes('Full Heuristics');
                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-gray-800/50 transition ${
                            isFull ? 'bg-cyan-950/20 font-semibold' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-gray-200 flex items-center gap-1.5 font-sans">
                            {isFull && <Zap className="w-3.5 h-3.5 text-amber-400" />}
                            {row.algorithm}
                          </td>
                          <td className="py-3 px-2 text-gray-400">{row.scale}</td>
                          <td className="py-3 px-2 text-right text-emerald-400 font-bold">
                            {row.allocated_count} / {row.total_variables}
                          </td>
                          <td className="py-3 px-2 text-right text-cyan-300 font-bold">
                            {row.allocation_rate_pct}%
                          </td>
                          <td className="py-3 px-2 text-right text-gray-300">
                            {row.states_explored}
                          </td>
                          <td className="py-3 px-2 text-right text-amber-400">
                            {row.backtracks}
                          </td>
                          <td className="py-3 px-2 text-right text-red-400 font-bold">
                            {row.backjumps}
                          </td>
                          <td className="py-3 px-2 text-right text-purple-400">
                            {row.domain_values_pruned}
                          </td>
                          <td className="py-3 px-2 text-right text-yellow-300">
                            {row.total_travel_time_min} min
                          </td>
                          <td className="py-3 px-3 text-right text-white font-bold">
                            {row.execution_time_ms} ms
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Analytical Insights Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="bg-[#0b0f19] p-3 rounded-lg border border-gray-800">
                  <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wide flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Conflict Backjumping (CBJ)
                  </span>
                  <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                    By jumping directly to the source of resource capacity exhaustion, CBJ skips multiple unconflicted subtrees without repetitive failures.
                  </p>
                </div>
                <div className="bg-[#0b0f19] p-3 rounded-lg border border-gray-800">
                  <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wide flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    AC-3 & Path Consistency (PC-2)
                  </span>
                  <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                    Prior to and during search, AC-3 and 3-consistency eliminate unsupported center options, preventing pointless domain probing.
                  </p>
                </div>
                <div className="bg-[#0b0f19] p-3 rounded-lg border border-gray-800">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    MRV + LCV Heuristics
                  </span>
                  <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                    MRV prioritizes critical emergencies with restricted center choices, while LCV leaves maximum remaining surplus capacity for peers.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <TableProperties className="w-10 h-10 mx-auto mb-2 opacity-40 text-cyan-400" />
              <p className="text-sm">Click "Run Benchmark" above to execute comparative analysis.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

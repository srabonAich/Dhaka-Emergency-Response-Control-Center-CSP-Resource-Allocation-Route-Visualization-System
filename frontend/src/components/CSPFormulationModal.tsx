import React, { useState, useEffect } from 'react';
import {
  FormulationSnapshot,
  SubproblemCluster,
  ConstraintsSummary,
} from '../types';
import {
  X,
  FileText,
  Sigma,
  Network,
  ShieldCheck,
  Split,
  ChevronRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';

interface CSPFormulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  formulation: FormulationSnapshot | null;
}

export const CSPFormulationModal: React.FC<CSPFormulationModalProps> = ({
  isOpen,
  onClose,
  formulation,
}) => {
  const [activeTab, setActiveTab] = useState<'tuple' | 'doc'>('tuple');
  const [markdownDoc, setMarkdownDoc] = useState<string>('');
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && activeTab === 'doc' && !markdownDoc) {
      setIsLoadingDoc(true);
      fetch('/api/csp/formulation-doc')
        .then((res) => res.json())
        .then((data) => {
          setMarkdownDoc(data.markdown || data.content || '');
          setIsLoadingDoc(false);
        })
        .catch((err) => {
          console.error('Failed to load CSP formulation doc:', err);
          setIsLoadingDoc(false);
        });
    }
  }, [isOpen, activeTab, markdownDoc]);

  if (!isOpen) return null;

  const tuple = formulation?.formal_tuple;
  const graph = formulation?.constraint_graph;
  const summary = formulation?.constraints_summary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-5xl h-[88vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Sigma className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                CSP Formal Specification & Mathematical Model
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                  ⟨X, D, C⟩
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Dhaka Emergency Response Control Center — Constraint Satisfaction Problem Definition
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switchers */}
            <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg">
              <button
                onClick={() => setActiveTab('tuple')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                  activeTab === 'tuple'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sigma className="w-3.5 h-3.5" />
                ⟨X, D, C⟩ Tuple & Graph
              </button>
              <button
                onClick={() => setActiveTab('doc')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                  activeTab === 'doc'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Academic Doc (CSP_FORMULATION.md)
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/90 text-slate-200">
          {activeTab === 'tuple' ? (
            <div className="space-y-6">
              {/* Top High-level Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Variables (X)</span>
                    <span className="font-mono text-indigo-400 font-bold">Slots</span>
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {tuple?.variables_count || 0}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Required emergency slots across active incidents
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Physical Units (D)</span>
                    <span className="font-mono text-emerald-400 font-bold">Discrete</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-400 font-mono">
                    {tuple?.total_physical_units || 0}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Distinct physical ambulances, trucks & teams
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Constraints (C)</span>
                    <span className="font-mono text-amber-400 font-bold">5 Classes</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-400 font-mono">
                    {summary?.total_constraints || 0}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Unary, Binary, Global, Higher-Order & Soft
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Subproblems</span>
                    <span className="font-mono text-purple-400 font-bold">Independent</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-400 font-mono">
                    {tuple?.subproblems_count || 1}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Decoupled connected components in constraint graph
                  </div>
                </div>
              </div>

              {/* 5 Constraint Classes Breakdown */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      The 5 Standard Constraint Classes
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    Formal representation evaluated during consistency checks & search
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {summary?.categories?.map((cat, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-300">{cat.type}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          Class #{idx + 1}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{cat.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Independent Subproblem Decomposition */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Split className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Graph Decomposition & Independent Subproblems
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    Disjoint Connected Components P = ⋃ P_k
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {graph?.subproblems?.map((sp: SubproblemCluster) => (
                    <div
                      key={sp.subproblem_id}
                      className="p-4 bg-slate-900 border border-purple-500/20 rounded-xl space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                          Subproblem #{sp.subproblem_id + 1}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-900/40 border border-purple-500/30 text-purple-300 font-mono">
                          {sp.variables_count} variables
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 space-y-1">
                        <div>
                          <span className="text-slate-500">Resource Types: </span>
                          <span className="text-indigo-300 font-medium">
                            {sp.resource_types.join(', ')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Emergency Categories: </span>
                          <span className="text-emerald-300">{sp.categories.join(', ')}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Variables Involved: </span>
                          <span className="font-mono text-slate-400 text-[11px]">
                            {sp.variables.join(', ')}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Zero cross-component conflict</span>
                        <span className="text-emerald-400 font-medium">Independent Search Space</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Variable Domain Sample Table */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
                  Variables & Initial Discrete Domains Sample
                </h3>
                <div className="overflow-x-auto max-h-64 border border-slate-800 rounded-lg">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] sticky top-0">
                      <tr>
                        <th className="p-2.5">Variable ($X_i$)</th>
                        <th className="p-2.5">Incident</th>
                        <th className="p-2.5">Resource</th>
                        <th className="p-2.5">Priority</th>
                        <th className="p-2.5">Domain Size ($|D_i|$)</th>
                        <th className="p-2.5">Sample Units</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {tuple?.variables?.slice(0, 15).map((v: any) => {
                        const units = tuple.initial_domains[v.var_id] || [];
                        return (
                          <tr key={v.var_id} className="hover:bg-slate-900/40">
                            <td className="p-2.5 font-bold text-indigo-300">{v.var_id}</td>
                            <td className="p-2.5">{v.incident_id}</td>
                            <td className="p-2.5 text-emerald-400">{v.resource_type}</td>
                            <td className="p-2.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  v.priority >= 4
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                P{v.priority}
                              </span>
                            </td>
                            <td className="p-2.5 font-bold text-cyan-300">{units.length}</td>
                            <td className="p-2.5 text-slate-400 text-[11px] truncate max-w-xs">
                              {units.slice(0, 3).join(', ')}
                              {units.length > 3 ? ` +${units.length - 3} more` : ''}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-6 font-sans">
              {isLoadingDoc ? (
                <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span>Loading Academic Specification Document...</span>
                </div>
              ) : (
                <div className="prose prose-invert max-w-none text-xs leading-relaxed text-slate-300 space-y-4">
                  <pre className="whitespace-pre-wrap font-mono text-xs bg-slate-900 p-4 rounded-lg border border-slate-800 text-slate-200 overflow-x-auto">
                    {markdownDoc}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-500">
          <span>Mathematical Formulation conforms to Russell & Norvig (AIMA 4th Ed.) Chapter 6</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};

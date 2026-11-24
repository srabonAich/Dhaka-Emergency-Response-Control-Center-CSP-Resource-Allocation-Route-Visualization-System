import React, { useState, useMemo } from 'react';
import {
  ConstraintGraphNode,
  ConstraintGraphEdge,
  SubproblemCluster,
  CSPTraceEvent,
  CSPSolution,
} from '../types';
import {
  Network,
  Layers,
  Sparkles,
  ShieldAlert,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Activity,
} from 'lucide-react';

interface ConstraintGraphViewerProps {
  nodes: ConstraintGraphNode[];
  edges: ConstraintGraphEdge[];
  subproblems: SubproblemCluster[];
  initialDomains: Record<string, string[]>;
  currentEvent: CSPTraceEvent | null;
  solution: CSPSolution | null;
  onSelectVariable?: (varId: string) => void;
}

export const ConstraintGraphViewer: React.FC<ConstraintGraphViewerProps> = ({
  nodes,
  edges,
  subproblems,
  initialDomains,
  currentEvent,
  solution,
  onSelectVariable,
}) => {
  const [selectedVarId, setSelectedVarId] = useState<string | null>(null);
  const [selectedSubproblem, setSelectedSubproblem] = useState<number | 'all'>('all');

  // Filter nodes based on selected subproblem
  const filteredNodes = useMemo(() => {
    if (selectedSubproblem === 'all') return nodes;
    return nodes.filter((n) => n.subproblem_id === selectedSubproblem);
  }, [nodes, selectedSubproblem]);

  const activeNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return edges.filter((e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));
  }, [edges, activeNodeIds]);

  // Compute 2D positions for nodes using a radial/clustered layout
  const nodePositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    const width = 640;
    const height = 480;
    const padding = 60;

    // Group nodes by subproblem
    const clusters: Record<number, ConstraintGraphNode[]> = {};
    filteredNodes.forEach((node) => {
      clusters[node.subproblem_id] = clusters[node.subproblem_id] || [];
      clusters[node.subproblem_id].push(node);
    });

    const clusterKeys = Object.keys(clusters).map(Number);
    const numClusters = clusterKeys.length;

    clusterKeys.forEach((clusterId, cIdx) => {
      const clusterNodes = clusters[clusterId];
      // Center for this cluster
      let cx = width / 2;
      let cy = height / 2;

      if (numClusters > 1) {
        const clusterAngle = (cIdx / numClusters) * 2 * Math.PI - Math.PI / 2;
        const clusterRadius = Math.min(width, height) * 0.28;
        cx = width / 2 + clusterRadius * Math.cos(clusterAngle);
        cy = height / 2 + clusterRadius * Math.sin(clusterAngle);
      }

      const n = clusterNodes.length;
      if (n === 1) {
        pos[clusterNodes[0].id] = { x: cx, y: cy };
      } else {
        const radius = Math.min(100, 30 + n * 12);
        clusterNodes.forEach((node, i) => {
          const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
          pos[node.id] = {
            x: Math.max(padding, Math.min(width - padding, cx + radius * Math.cos(angle))),
            y: Math.max(padding, Math.min(height - padding, cy + radius * Math.sin(angle))),
          };
        });
      }
    });

    return pos;
  }, [filteredNodes]);

  // Active variable from current trace event
  const currentVarId = currentEvent?.var_id || currentEvent?.from_var;

  const effectiveSelectedVarId = selectedVarId || currentVarId || (nodes[0]?.id ?? null);
  const selectedNode = nodes.find((n) => n.id === effectiveSelectedVarId);

  // Compute pruned/assigned status for domains of selected variable
  const selectedVarDomain = useMemo(() => {
    if (!effectiveSelectedVarId) return [];
    return initialDomains[effectiveSelectedVarId] || [];
  }, [effectiveSelectedVarId, initialDomains]);

  // Current assignment
  const currentAssignment = solution?.assignments?.[effectiveSelectedVarId || ''];

  // Check if current event is backjump with conflict set
  const conflictSet = currentEvent?.conflict_set || [];
  const skippedVars = currentEvent?.skipped_vars || [];

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Left / Top: Graph Canvas */}
      <div className="flex-1 flex flex-col p-4 bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                CSP Constraint Graph & Subproblem Decomposition
              </h2>
              <p className="text-xs text-slate-400">
                Nodes = Resource Variables ($X$), Edges = Binary Alldiff Constraints
              </p>
            </div>
          </div>

          {/* Subproblem selector filter */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setSelectedSubproblem('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                selectedSubproblem === 'all'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({subproblems.length} Subproblems)
            </button>
            {subproblems.map((sp) => (
              <button
                key={sp.subproblem_id}
                onClick={() => setSelectedSubproblem(sp.subproblem_id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  selectedSubproblem === sp.subproblem_id
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      sp.subproblem_id === 0
                        ? '#3b82f6'
                        : sp.subproblem_id === 1
                        ? '#ec4899'
                        : sp.subproblem_id === 2
                        ? '#10b981'
                        : '#f59e0b',
                  }}
                />
                SP #{sp.subproblem_id + 1} ({sp.variables_count} vars)
              </button>
            ))}
          </div>
        </div>

        {/* SVG Graph View */}
        <div className="relative flex-1 flex items-center justify-center min-h-[360px] bg-slate-950/50 rounded-lg my-3 overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 640 480">
            <defs>
              <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.4" />
              </linearGradient>
              <linearGradient id="activeEdgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#fb923c" stopOpacity="0.9" />
              </linearGradient>
            </defs>

            {/* Edges */}
            {filteredEdges.map((edge, idx) => {
              const p1 = nodePositions[edge.source];
              const p2 = nodePositions[edge.target];
              if (!p1 || !p2) return null;

              const isConflictEdge =
                (currentEvent?.from_var === edge.source && currentEvent?.to_var === edge.target) ||
                (currentEvent?.from_var === edge.target && currentEvent?.to_var === edge.source) ||
                (conflictSet.includes(edge.source) && conflictSet.includes(edge.target));

              const isSelectedNeighbor =
                effectiveSelectedVarId === edge.source || effectiveSelectedVarId === edge.target;

              return (
                <g key={`edge-${idx}`}>
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={
                      isConflictEdge
                        ? 'url(#activeEdgeGrad)'
                        : isSelectedNeighbor
                        ? '#818cf8'
                        : 'url(#edgeGrad)'
                    }
                    strokeWidth={isConflictEdge ? 3 : isSelectedNeighbor ? 2 : 1.2}
                    strokeDasharray={isConflictEdge ? '4 2' : undefined}
                    className={isConflictEdge ? 'animate-pulse' : ''}
                  />
                  {/* Small constraint badge in middle of edge if selected */}
                  {isSelectedNeighbor && (
                    <circle
                      cx={(p1.x + p2.x) / 2}
                      cy={(p1.y + p2.y) / 2}
                      r="4"
                      fill="#6366f1"
                      opacity="0.8"
                    />
                  )}
                </g>
              );
            })}

            {/* Subproblem Clusters Background Halos */}
            {subproblems.map((sp) => {
              if (selectedSubproblem !== 'all' && selectedSubproblem !== sp.subproblem_id)
                return null;
              const spNodes = filteredNodes.filter((n) => n.subproblem_id === sp.subproblem_id);
              if (spNodes.length === 0) return null;

              const xs = spNodes.map((n) => nodePositions[n.id]?.x || 0);
              const ys = spNodes.map((n) => nodePositions[n.id]?.y || 0);
              const minX = Math.min(...xs) - 30;
              const maxX = Math.max(...xs) + 30;
              const minY = Math.min(...ys) - 30;
              const maxY = Math.max(...ys) + 30;

              const spColor =
                sp.subproblem_id === 0
                  ? 'rgba(59, 130, 246, 0.08)'
                  : sp.subproblem_id === 1
                  ? 'rgba(236, 72, 153, 0.08)'
                  : sp.subproblem_id === 2
                  ? 'rgba(16, 185, 129, 0.08)'
                  : 'rgba(245, 158, 11, 0.08)';

              const strokeColor =
                sp.subproblem_id === 0
                  ? 'rgba(59, 130, 246, 0.25)'
                  : sp.subproblem_id === 1
                  ? 'rgba(236, 72, 153, 0.25)'
                  : sp.subproblem_id === 2
                  ? 'rgba(16, 185, 129, 0.25)'
                  : 'rgba(245, 158, 11, 0.25)';

              return (
                <g key={`sp-box-${sp.subproblem_id}`}>
                  <rect
                    x={minX}
                    y={minY}
                    width={maxX - minX}
                    height={maxY - minY}
                    rx="16"
                    fill={spColor}
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={minX + 8}
                    y={minY + 16}
                    fill="#94a3b8"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    Subproblem #{sp.subproblem_id + 1} ({sp.resource_types.join(', ')})
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {filteredNodes.map((node) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;

              const isSelected = effectiveSelectedVarId === node.id;
              const isCurrentVar = currentVarId === node.id;
              const isInConflictSet = conflictSet.includes(node.id);
              const isSkipped = skippedVars.includes(node.id);
              const isAssigned = !!solution?.assignments?.[node.id];

              let nodeFill = '#1e293b';
              let nodeStroke = '#475569';

              if (isCurrentVar) {
                nodeFill = '#4f46e5';
                nodeStroke = '#a5b4fc';
              } else if (isInConflictSet) {
                nodeFill = '#9a3412';
                nodeStroke = '#f97316';
              } else if (isSkipped) {
                nodeFill = '#334155';
                nodeStroke = '#64748b';
              } else if (isAssigned) {
                nodeFill = '#065f46';
                nodeStroke = '#34d399';
              }

              if (isSelected) {
                nodeStroke = '#facc15';
              }

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => {
                    setSelectedVarId(node.id);
                    onSelectVariable?.(node.id);
                  }}
                >
                  {/* Outer pulsing ring for current / conflict */}
                  {(isCurrentVar || isInConflictSet) && (
                    <circle
                      r="26"
                      fill="none"
                      stroke={isInConflictSet ? '#f97316' : '#818cf8'}
                      strokeWidth="2"
                      opacity="0.6"
                      className="animate-ping"
                    />
                  )}

                  {/* Main Circle */}
                  <circle
                    r="20"
                    fill={nodeFill}
                    stroke={nodeStroke}
                    strokeWidth={isSelected ? 3 : 2}
                    className="shadow-lg"
                  />

                  {/* Variable Icon or Text */}
                  <text
                    textAnchor="middle"
                    dy="4"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="bold"
                    className="pointer-events-none select-none font-mono"
                  >
                    P{node.priority}
                  </text>

                  {/* Domain size bubble badge */}
                  <g transform="translate(14, -14)">
                    <circle r="8" fill="#0f172a" stroke="#6366f1" strokeWidth="1.5" />
                    <text
                      textAnchor="middle"
                      dy="3"
                      fill="#e2e8f0"
                      fontSize="8"
                      fontWeight="bold"
                      className="pointer-events-none select-none"
                    >
                      {node.domain_size}
                    </text>
                  </g>

                  {/* Status indicator below */}
                  {isSkipped && (
                    <g transform="translate(0, 26)">
                      <rect
                        x="-20"
                        y="-6"
                        width="40"
                        height="12"
                        rx="3"
                        fill="#000"
                        stroke="#64748b"
                      />
                      <text
                        textAnchor="middle"
                        dy="3"
                        fill="#94a3b8"
                        fontSize="7"
                        fontWeight="bold"
                      >
                        SKIPPED
                      </text>
                    </g>
                  )}

                  {/* Label under node */}
                  <text
                    y="32"
                    textAnchor="middle"
                    fill={isSelected ? '#facc15' : '#cbd5e1'}
                    fontSize="9"
                    fontWeight="500"
                    className="pointer-events-none select-none"
                  >
                    {node.id.split('_').slice(1).join('_')}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Graph Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-300" />
              Assigned
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 border border-indigo-300" />
              Inspecting
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 border border-amber-300" />
              Conflict Set
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-slate-500" />
              Skipped / Untouched
            </span>
          </div>
          <span className="text-slate-500">
            Click any variable node to inspect physical unit domain matrix
          </span>
        </div>
      </div>

      {/* Right: Domain Matrix & Variable Inspector Panel */}
      <div className="w-full lg:w-80 p-4 flex flex-col bg-slate-900 overflow-y-auto">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Finite Discrete Domain Matrix</h3>
        </div>

        {selectedNode ? (
          <div className="flex flex-col gap-3 pt-3">
            {/* Selected Variable Metadata Card */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-indigo-300">
                  {selectedNode.id}
                </span>
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                    selectedNode.priority >= 4
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  Priority {selectedNode.priority}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px]">Resource Type</span>
                  <span className="font-medium text-emerald-400">{selectedNode.resource_type}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Subproblem</span>
                  <span className="font-medium text-purple-400">
                    Component #{selectedNode.subproblem_id + 1}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Incident</span>
                  <span className="font-mono text-slate-300">{selectedNode.incident_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Assigned Unit</span>
                  <span className="font-mono text-cyan-300">
                    {currentAssignment || 'Unassigned'}
                  </span>
                </div>
              </div>
            </div>

            {/* Conflict Set Notice if present */}
            {conflictSet.length > 0 && conflictSet.includes(selectedNode.id) && (
              <div className="p-2.5 bg-amber-950/40 border border-amber-500/30 rounded-lg text-xs text-amber-200 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">In Conflict Set:</span>
                  <span className="text-[11px] text-amber-300/90">
                    This variable induced a domain wipeout or mutual resource collision.
                  </span>
                </div>
              </div>
            )}

            {/* Discrete Domain Units List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">
                  Physical Resource Units ($D_i$)
                </span>
                <span className="text-xs text-indigo-400 font-bold">
                  {selectedVarDomain.length} candidate units
                </span>
              </div>

              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                {selectedVarDomain.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                    No physical units found for this resource type.
                  </div>
                ) : (
                  selectedVarDomain.map((unitId) => {
                    const isAssignedThis = currentAssignment === unitId;
                    const isPrunedInCurrentEvent =
                      currentEvent?.pruned_unit_id === unitId ||
                      (currentEvent?.event_type === 'NODE_PRUNE' &&
                        currentEvent?.details.includes(unitId));

                    return (
                      <div
                        key={unitId}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between transition-all ${
                          isAssignedThis
                            ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                            : isPrunedInCurrentEvent
                            ? 'bg-rose-950/30 border-rose-500/30 text-rose-300 line-through opacity-70'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {isAssignedThis ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : isPrunedInCurrentEvent ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                          )}
                          <span className="font-mono text-[11px] truncate">{unitId}</span>
                        </div>

                        {/* Status badge */}
                        <div className="text-[10px] shrink-0">
                          {isAssignedThis && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                              ASSIGNED
                            </span>
                          )}
                          {isPrunedInCurrentEvent && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                              PRUNED
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Independent Subproblem Insights */}
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs space-y-1.5 text-slate-400">
              <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                <span>Subproblem Independence</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This variable belongs to Independent Component #{selectedNode.subproblem_id + 1}.
                Variables in disjoint subproblems do not share physical unit constraints and can be
                solved without cross-subproblem backtracking.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <Info className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs">Select any node in the constraint graph to inspect its domain matrix.</p>
          </div>
        )}
      </div>
    </div>
  );
};

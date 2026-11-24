import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { MapViewer } from './components/MapViewer';
import { ConstraintGraphViewer } from './components/ConstraintGraphViewer';
import { AnimationControls } from './components/AnimationControls';
import { CSPInspector } from './components/CSPInspector';
import { BenchmarkModal } from './components/BenchmarkModal';
import { CSPFormulationModal } from './components/CSPFormulationModal';
import {
  EmergencyIncident,
  ResourceCenter,
  CSPSolution,
  CSPTraceEvent,
  RouteInfo,
  ClickMode,
  EmergencyCategory,
  BenchmarkResponse,
  RoadBlockConstraint,
  CSPSolveRequest,
  FormulationSnapshot,
} from './types';

export const App: React.FC = () => {
  // Scenario State
  const [scale, setScale] = useState<string>('Small');
  const [incidents, setIncidents] = useState<EmergencyIncident[]>([]);
  const [centers, setCenters] = useState<ResourceCenter[]>([]);
  const [roadblocks, setRoadblocks] = useState<RoadBlockConstraint[]>([]);

  // Dual View Mode: Map View vs Constraint Graph View
  const [viewMode, setViewMode] = useState<'map' | 'graph'>('map');

  // Interaction Mode State
  const [clickMode, setClickMode] = useState<ClickMode>('inspect');
  const [newIncidentCategory, setNewIncidentCategory] = useState<EmergencyCategory>('Fire');
  const [newIncidentPriority, setNewIncidentPriority] = useState<number>(4);

  // Formal CSP Formulation State
  const [formulation, setFormulation] = useState<FormulationSnapshot | null>(null);
  const [isFormulationModalOpen, setIsFormulationModalOpen] = useState<boolean>(false);

  // CSP Solver Configuration (3 Main Algorithms + Consistency + Heuristics)
  const [solveRequest, setSolveRequest] = useState<CSPSolveRequest>({
    algorithm: 'backjumping',
    use_node_consistency: true,
    use_ac3: true,
    use_path_consistency: false,
    inference: 'forward_checking',
    var_heuristic: 'mrv_degree',
    val_heuristic: 'lcv',
    max_steps: 300,
    initial_strategy: 'nearest',
    random_walk_prob: 0.05,
    allow_random_restart: true,
    time_limit_sec: 15.0,
  });
  const [isSolving, setIsSolving] = useState<boolean>(false);

  // Solution & Step-by-Step Animation State
  const [solution, setSolution] = useState<CSPSolution | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(10);
  const [animationCompleted, setAnimationCompleted] = useState<boolean>(false);

  // Benchmark Modal State
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkResponse | null>(null);
  const [isBenchmarkLoading, setIsBenchmarkLoading] = useState<boolean>(false);

  // Animation Timer Reference
  const timerRef = useRef<any>(null);

  // Fetch Formulation Snapshot from Backend
  const fetchFormulation = useCallback(async () => {
    try {
      const res = await fetch('/api/csp/formulation');
      if (res.ok) {
        const data: FormulationSnapshot = await res.json();
        setFormulation(data);
      }
    } catch (err) {
      console.error('Failed to load CSP formulation snapshot:', err);
    }
  }, []);

  // Load Initial State from Backend
  const fetchInitData = useCallback(async () => {
    try {
      const res = await fetch('/api/init');
      const data = await res.json();
      setScale(data.scale || 'Small');
      setIncidents(data.incidents || []);
      setCenters(data.centers || []);
      setRoadblocks(data.roadblocks || []);
      await fetchFormulation();
    } catch (err) {
      console.error('Failed to load initial data from backend:', err);
    }
  }, [fetchFormulation]);

  useEffect(() => {
    fetchInitData();
  }, [fetchInitData]);

  // Handle Scenario Scale Change
  const handleScaleChange = async (newScale: string) => {
    setIsPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setSolution(null);
    setCurrentStep(0);
    setAnimationCompleted(false);

    try {
      const res = await fetch('/api/generate-scale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scale: newScale }),
      });
      const data = await res.json();
      setScale(data.scale);
      setIncidents(data.incidents);
      setCenters(data.centers);
      await fetchFormulation();
    } catch (err) {
      console.error('Error switching scale:', err);
    }
  };

  // Update Solver Request Parameters
  const handleUpdateSolveRequest = (updates: Partial<CSPSolveRequest>) => {
    setSolveRequest((prev) => ({ ...prev, ...updates }));
  };

  // Execute CSP Solve
  const handleSolveCSP = async () => {
    setIsSolving(true);
    setIsPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentStep(0);
    setAnimationCompleted(false);

    try {
      const res = await fetch('/api/solve-csp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solveRequest),
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const sol: CSPSolution = await res.json();
      setSolution(sol);
      setCurrentStep(1);
      setIsPlaying(true);
      await fetchFormulation();
    } catch (err) {
      console.error('Error running CSP solver:', err);
      alert('Failed to solve CSP. Check backend server logs.');
    } finally {
      setIsSolving(false);
    }
  };

  // Step-by-Step Animation Loop
  useEffect(() => {
    if (!isPlaying || !solution || !solution.trace_events) return;

    const total = solution.trace_events.length;
    if (currentStep >= total) {
      setIsPlaying(false);
      setAnimationCompleted(true);
      return;
    }

    // Interval inversely proportional to speed
    const delay = Math.max(6, Math.round(500 / speed));

    timerRef.current = setTimeout(() => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next >= total) {
          setIsPlaying(false);
          setAnimationCompleted(true);
        }
        return next;
      });
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentStep, speed, solution]);

  // Animation Controls
  const handleTogglePlay = () => {
    if (currentStep >= (solution?.trace_events.length || 0)) {
      setCurrentStep(0);
      setAnimationCompleted(false);
    }
    setIsPlaying((prev) => !prev);
  };

  const handleStepForward = () => {
    if (!solution || !solution.trace_events) return;
    setIsPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentStep((prev) => {
      const next = Math.min(solution.trace_events.length, prev + 1);
      if (next >= solution.trace_events.length) {
        setAnimationCompleted(true);
      }
      return next;
    });
  };

  const handleStepBackward = () => {
    if (!solution || !solution.trace_events) return;
    setIsPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentStep((prev) => Math.max(0, prev - 1));
    setAnimationCompleted(false);
  };

  const handleSkipToEnd = () => {
    if (!solution || !solution.trace_events) return;
    setIsPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentStep(solution.trace_events.length);
    setAnimationCompleted(true);
  };

  const handleResetAnimation = () => {
    setIsPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentStep(0);
    setAnimationCompleted(false);
  };

  // Reset Entire Scenario
  const handleResetScenario = async () => {
    setIsPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setSolution(null);
    setCurrentStep(0);
    setAnimationCompleted(false);
    setRoadblocks([]);

    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        await fetchInitData();
      }
    } catch (err) {
      console.error('Error resetting scenario:', err);
    }
  };

  // Incident Escalation Handler ("Worsening Situation")
  const handleIncidentClick = async (incident: EmergencyIncident) => {
    if (
      clickMode === 'escalate' ||
      window.confirm(`Escalate ${incident.title} (Request Urgent Backup Units)?`)
    ) {
      try {
        const res = await fetch('/api/escalate-incident', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            incident_id: incident.id,
            repair_method: 'min_conflicts',
          }),
        });
        const data = await res.json();
        if (data.success) {
          setIncidents(data.incidents);
          const repSol = data.solution || data.repaired_solution;
          if (repSol) {
            setSolution(repSol);
            setCurrentStep(repSol.trace_events.length);
            setAnimationCompleted(true);
          } else {
            setSolution(null);
            setCurrentStep(0);
            setAnimationCompleted(false);
          }
          await fetchFormulation();
        }
      } catch (err) {
        console.error('Error escalating incident:', err);
      }
    }
  };

  // Resource Center Click Handler (Toggle Operational C7)
  const handleCenterClick = async (center: ResourceCenter) => {
    if (clickMode === 'toggle_center') {
      try {
        const res = await fetch('/api/constraints/center', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ center_id: center.id }),
        });
        const data = await res.json();
        if (data.success) {
          setCenters(data.centers);
          setSolution(null);
          setCurrentStep(0);
          setAnimationCompleted(false);
          await fetchFormulation();
        }
      } catch (err) {
        console.error('Error toggling center operational state:', err);
      }
    }
  };

  // Map Click Handler (Add Custom Incident or Block Road)
  const handleMapClick = async (lat: number, lng: number) => {
    if (clickMode === 'add_incident') {
      try {
        const res = await fetch('/api/add-incident', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: newIncidentCategory,
            priority: newIncidentPriority,
            lat,
            lng,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setIncidents(data.incidents);
          setSolution(null);
          setCurrentStep(0);
          setAnimationCompleted(false);
          setClickMode('inspect');
          await fetchFormulation();
        }
      } catch (err) {
        console.error('Error adding incident:', err);
      }
    } else if (clickMode === 'block_road') {
      try {
        const res = await fetch(
          `/api/constraints/hazard-zone?lat=${lat}&lng=${lng}&radius=600`,
          { method: 'POST' }
        );
        const data = await res.json();
        if (data.success) {
          setRoadblocks((prev) => [
            ...prev,
            {
              u: 0,
              v: 0,
              blocked: true,
              traffic_factor: 5.0,
              hazard_zone: true,
              lat,
              lng,
            },
          ]);
          setSolution(null);
          setCurrentStep(0);
          setAnimationCompleted(false);
          setClickMode('inspect');
        }
      } catch (err) {
        console.error('Error adding hazard roadblock:', err);
      }
    }
  };

  // Run Benchmark across all 6 configurations
  const handleRunBenchmark = async (targetScale: string) => {
    setIsBenchmarkLoading(true);
    try {
      const res = await fetch('/api/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scale: targetScale }),
      });
      const data: BenchmarkResponse = await res.json();
      setBenchmarkData(data);
    } catch (err) {
      console.error('Error running benchmark:', err);
    } finally {
      setIsBenchmarkLoading(false);
    }
  };

  // Compute Active Routes to render on map:
  // RULE: DO NOT draw the final dispatch route polylines before the step-by-step animation finishes!
  // If animation is complete or skipped, show all solution routes.
  // While animation is playing, show only routes for variables that have received ASSIGN_SUCCESS up to currentStep!
  const activeRoutesToRender: RouteInfo[] = React.useMemo(() => {
    if (!solution || !solution.routes) return [];
    if (animationCompleted || currentStep >= (solution.trace_events.length || 0)) {
      return solution.routes;
    }
    const assignedVarIds = new Set<string>();
    const traceSlice = solution.trace_events.slice(0, currentStep);
    traceSlice.forEach((evt) => {
      if (
        (evt.event_type === 'ASSIGN_SUCCESS' || evt.event_type === 'LOCAL_REPAIR') &&
        evt.var_id
      ) {
        assignedVarIds.add(evt.var_id);
      } else if (
        (evt.event_type === 'BACKTRACK' || evt.event_type === 'CBJ_BACKJUMP') &&
        evt.var_id
      ) {
        assignedVarIds.delete(evt.var_id);
        if (evt.skipped_vars) {
          evt.skipped_vars.forEach((sv) => assignedVarIds.delete(sv));
        }
      }
    });

    return solution.routes.filter((r) => assignedVarIds.has(r.var_id));
  }, [solution, currentStep, animationCompleted]);

  // Current Trace Event for candidate probing lines & conflict animations
  const currentTraceEvent = React.useMemo(() => {
    if (!solution || !solution.trace_events || currentStep === 0) return null;
    return solution.trace_events[currentStep - 1] || null;
  }, [solution, currentStep]);

  return (
    <div className="flex flex-col w-screen h-screen bg-[#0b0f19] text-gray-100 overflow-hidden">
      {/* Top Header / Operational Status Bar */}
      <Header
        scale={scale}
        incidents={incidents}
        centers={centers}
        solution={solution}
        isSolving={isSolving}
        isPlaying={isPlaying}
        animationCompleted={animationCompleted}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenFormulation={() => setIsFormulationModalOpen(true)}
      />

      {/* Main Workspace: Left Controls, Central Canvas (Map or Constraint Graph), Right Inspector */}
      <div className="flex flex-1 w-full h-[calc(100vh-64px)] relative overflow-hidden">
        {/* Left Sidebar Control Panel */}
        <ControlPanel
          scale={scale}
          onScaleChange={handleScaleChange}
          clickMode={clickMode}
          onClickModeChange={setClickMode}
          solveRequest={solveRequest}
          onUpdateSolveRequest={handleUpdateSolveRequest}
          onSolve={handleSolveCSP}
          onReset={handleResetScenario}
          onOpenBenchmark={() => {
            setIsBenchmarkOpen(true);
            if (!benchmarkData) {
              handleRunBenchmark(scale);
            }
          }}
          onOpenFormulation={() => setIsFormulationModalOpen(true)}
          isSolving={isSolving}
          newIncidentCategory={newIncidentCategory}
          onNewIncidentCategoryChange={setNewIncidentCategory}
          newIncidentPriority={newIncidentPriority}
          onNewIncidentPriorityChange={setNewIncidentPriority}
        />

        {/* Central Workspace: Either MapViewer or ConstraintGraphViewer */}
        <div className="flex-1 h-full relative overflow-hidden bg-[#0d131f] p-1">
          {viewMode === 'map' ? (
            <>
              <MapViewer
                incidents={incidents}
                centers={centers}
                activeRoutes={activeRoutesToRender}
                currentTraceEvent={currentTraceEvent}
                animationCompleted={animationCompleted}
                clickMode={clickMode}
                onMapClick={handleMapClick}
                onIncidentClick={handleIncidentClick}
                onCenterClick={handleCenterClick}
                roadblocks={roadblocks}
              />

              {/* Floating Animation Controls at bottom */}
              {solution && solution.trace_events.length > 0 && (
                <AnimationControls
                  isPlaying={isPlaying}
                  onTogglePlay={handleTogglePlay}
                  onStepForward={handleStepForward}
                  onStepBackward={handleStepBackward}
                  onSkipToEnd={handleSkipToEnd}
                  onResetAnimation={handleResetAnimation}
                  currentStep={currentStep}
                  totalSteps={solution.trace_events.length}
                  speed={speed}
                  onSpeedChange={setSpeed}
                  disabled={isSolving}
                />
              )}

              {/* Click Mode Prompt Banner */}
              {clickMode !== 'inspect' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-amber-500/90 text-black px-4 py-1.5 rounded-full font-bold text-xs shadow-xl animate-bounce flex items-center gap-2">
                  <span>Tool Active:</span>
                  <span className="uppercase">{clickMode.replace('_', ' ')}</span>
                  <span>— Click map/marker to execute</span>
                  <button
                    onClick={() => setClickMode('inspect')}
                    className="ml-2 bg-black/80 text-white rounded-full px-2 py-0.5 text-[10px] hover:bg-black"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Constraint Graph & Domain Matrix View */
            <div className="h-full w-full p-2">
              <ConstraintGraphViewer
                nodes={formulation?.constraint_graph.nodes || []}
                edges={formulation?.constraint_graph.edges || []}
                subproblems={formulation?.constraint_graph.subproblems || []}
                initialDomains={formulation?.formal_tuple.initial_domains || {}}
                currentEvent={currentTraceEvent}
                solution={solution}
              />
            </div>
          )}
        </div>

        {/* Right CSP State Inspector Drawer */}
        <CSPInspector
          events={solution?.trace_events || []}
          currentStep={currentStep}
          solution={solution}
          incidents={incidents}
        />
      </div>

      {/* Benchmark Modal */}
      <BenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        onRunBenchmark={handleRunBenchmark}
        benchmarkData={benchmarkData}
        isLoading={isBenchmarkLoading}
        currentScale={scale}
      />

      {/* Formal CSP Formulation Modal */}
      <CSPFormulationModal
        isOpen={isFormulationModalOpen}
        onClose={() => setIsFormulationModalOpen(false)}
        formulation={formulation}
      />
    </div>
  );
};

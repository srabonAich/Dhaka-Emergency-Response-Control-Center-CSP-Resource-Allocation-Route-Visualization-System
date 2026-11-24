import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { MapViewer } from './components/MapViewer';
import { AnimationControls } from './components/AnimationControls';
import { CSPInspector } from './components/CSPInspector';
import { BenchmarkModal } from './components/BenchmarkModal';
import {
  EmergencyIncident,
  ResourceCenter,
  CSPSolution,
  CSPTraceEvent,
  RouteInfo,
  ClickMode,
  EmergencyCategory,
  BenchmarkResponse,
  RoadBlockConstraint
} from './types';

export const App: React.FC = () => {
  // Scenario State
  const [scale, setScale] = useState<string>('Small');
  const [incidents, setIncidents] = useState<EmergencyIncident[]>([]);
  const [centers, setCenters] = useState<ResourceCenter[]>([]);
  const [roadblocks, setRoadblocks] = useState<RoadBlockConstraint[]>([]);

  // Interaction Mode State
  const [clickMode, setClickMode] = useState<ClickMode>('inspect');
  const [newIncidentCategory, setNewIncidentCategory] = useState<EmergencyCategory>('Fire');
  const [newIncidentPriority, setNewIncidentPriority] = useState<number>(4);

  // CSP Solver Configuration
  const [algorithm, setAlgorithm] = useState<string>('path_consistency_cbj');
  const [useMrv, setUseMrv] = useState<boolean>(true);
  const [useDegree, setUseDegree] = useState<boolean>(true);
  const [useLcv, setUseLcv] = useState<boolean>(true);
  const [useNearestCenter, setUseNearestCenter] = useState<boolean>(true);
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

  // Load Initial State from Backend
  const fetchInitData = useCallback(async () => {
    try {
      const res = await fetch('/api/init');
      const data = await res.json();
      setScale(data.scale || 'Small');
      setIncidents(data.incidents || []);
      setCenters(data.centers || []);
      setRoadblocks(data.roadblocks || []);
    } catch (err) {
      console.error('Failed to load initial data from backend:', err);
    }
  }, []);

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
    } catch (err) {
      console.error('Error switching scale:', err);
    }
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
        body: JSON.stringify({
          algorithm,
          use_mrv: useMrv,
          use_degree: useDegree,
          use_lcv: useLcv,
          use_nearest_center: useNearestCenter,
          time_limit_sec: 15.0,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const sol: CSPSolution = await res.json();
      setSolution(sol);
      setCurrentStep(1);
      setIsPlaying(true);
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

    // Interval inversely proportional to speed (1000ms at 1x down to 10ms at 100x)
    const delay = Math.max(8, Math.round(500 / speed));

    timerRef.current = setTimeout(() => {
      setCurrentStep(prev => {
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
    setIsPlaying(prev => !prev);
  };

  const handleStepForward = () => {
    if (!solution || !solution.trace_events) return;
    setIsPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentStep(prev => {
      const next = Math.min(solution.trace_events.length, prev + 1);
      if (next >= solution.trace_events.length) {
        setAnimationCompleted(true);
      }
      return next;
    });
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

  // Reset Entire System Scenario
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
    if (clickMode === 'escalate' || window.confirm(`Escalate ${incident.title} (Request Urgent Backup)?`)) {
      try {
        const res = await fetch('/api/escalate-incident', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ incident_id: incident.id }),
        });
        const data = await res.json();
        if (data.success) {
          setIncidents(data.incidents);
          // Invalidate current routes to prompt re-solve
          setSolution(null);
          setCurrentStep(0);
          setAnimationCompleted(false);
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
        }
      } catch (err) {
        console.error('Error adding incident:', err);
      }
    } else if (clickMode === 'block_road') {
      // Simulate road obstruction / flood hazard zone
      try {
        const res = await fetch(`/api/constraints/hazard-zone?lat=${lat}&lng=${lng}&radius=600`, {
          method: 'POST',
        });
        const data = await res.json();
        if (data.success) {
          setRoadblocks(prev => [
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

  // Run Scale Benchmark
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
  // RULE: DO NOT draw the final dispatch route polylines before the step-by-step CSP animation finishes!
  // If animation is complete or skipped, show all solution routes.
  // While animation is playing, show only routes for variables that have received ASSIGN_SUCCESS up to currentStep!
  const activeRoutesToRender: RouteInfo[] = React.useMemo(() => {
    if (!solution || !solution.routes) return [];
    if (animationCompleted || currentStep >= (solution.trace_events.length || 0)) {
      return solution.routes;
    }
    // Collect variables assigned up to currentStep
    const assignedVarIds = new Set<string>();
    const traceSlice = solution.trace_events.slice(0, currentStep);
    traceSlice.forEach(evt => {
      if (evt.event_type === 'ASSIGN_SUCCESS' && evt.var_id) {
        assignedVarIds.add(evt.var_id);
      } else if ((evt.event_type === 'BACKTRACK' || evt.event_type === 'BACKJUMP') && evt.var_id) {
        assignedVarIds.delete(evt.var_id);
        if (evt.skipped_vars) {
          evt.skipped_vars.forEach(sv => assignedVarIds.delete(sv));
        }
      }
    });

    return solution.routes.filter(r => assignedVarIds.has(r.var_id));
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
      />

      {/* Main Workspace: Left Controls, Central Map Canvas, Right CSP Inspector */}
      <div className="flex flex-1 w-full h-[calc(100vh-64px)] relative overflow-hidden">
        {/* Left Sidebar Control Panel */}
        <ControlPanel
          scale={scale}
          onScaleChange={handleScaleChange}
          clickMode={clickMode}
          onClickModeChange={setClickMode}
          algorithm={algorithm}
          onAlgorithmChange={setAlgorithm}
          useMrv={useMrv}
          onToggleMrv={setUseMrv}
          useDegree={useDegree}
          onToggleDegree={setUseDegree}
          useLcv={useLcv}
          onToggleLcv={setUseLcv}
          useNearestCenter={useNearestCenter}
          onToggleNearestCenter={setUseNearestCenter}
          onSolve={handleSolveCSP}
          onReset={handleResetScenario}
          onOpenBenchmark={() => {
            setIsBenchmarkOpen(true);
            if (!benchmarkData) {
              handleRunBenchmark(scale);
            }
          }}
          isSolving={isSolving}
          newIncidentCategory={newIncidentCategory}
          onNewIncidentCategoryChange={setNewIncidentCategory}
          newIncidentPriority={newIncidentPriority}
          onNewIncidentPriorityChange={setNewIncidentPriority}
        />

        {/* Central Map Canvas */}
        <div className="flex-1 h-full relative overflow-hidden bg-[#0d131f]">
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
    </div>
  );
};

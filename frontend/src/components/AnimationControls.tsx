import React from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  FastForward,
  RotateCcw,
  Gauge,
} from 'lucide-react';

interface AnimationControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onStepBackward?: () => void;
  onSkipToEnd: () => void;
  onResetAnimation: () => void;
  currentStep: number;
  totalSteps: number;
  speed: number;
  onSpeedChange: (speed: number) => void;
  disabled: boolean;
}

export const AnimationControls: React.FC<AnimationControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onStepForward,
  onStepBackward,
  onSkipToEnd,
  onResetAnimation,
  currentStep,
  totalSteps,
  speed,
  onSpeedChange,
  disabled,
}) => {
  const progressPct =
    totalSteps > 0 ? Math.min(100, Math.round((currentStep / totalSteps) * 100)) : 0;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-[#111827]/90 backdrop-blur-md border border-gray-700/80 rounded-xl px-4 py-2.5 shadow-2xl flex flex-col gap-2 min-w-[520px]">
      {/* Top Bar: Progress & Step Count */}
      <div className="flex items-center justify-between text-xs text-gray-300">
        <span className="font-semibold flex items-center gap-1.5 text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          CSP Execution Trace
        </span>
        <div className="font-mono text-[11px] text-gray-400">
          Step <span className="text-white font-bold">{currentStep}</span> / {totalSteps} (
          {progressPct}%)
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-75"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Control Buttons & Speed Slider */}
      <div className="flex items-center justify-between pt-1">
        {/* Playback Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onResetAnimation}
            disabled={disabled || currentStep === 0}
            title="Rewind to Step 0"
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-40 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {onStepBackward && (
            <button
              onClick={onStepBackward}
              disabled={disabled || isPlaying || currentStep <= 0}
              title="Step Backward"
              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-40 transition"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onTogglePlay}
            disabled={disabled || (currentStep >= totalSteps && totalSteps > 0)}
            title={isPlaying ? 'Pause' : 'Play Trace'}
            className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold disabled:opacity-40 shadow transition active:scale-95"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
          </button>

          <button
            onClick={onStepForward}
            disabled={disabled || isPlaying || currentStep >= totalSteps}
            title="Step Forward"
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-40 transition"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onSkipToEnd}
            disabled={disabled || currentStep >= totalSteps}
            title="Skip to Final Result"
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-amber-300 disabled:opacity-40 transition flex items-center gap-1 text-xs px-2"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Skip</span>
          </button>
        </div>

        {/* Speed Slider: 1x to 100x */}
        <div className="flex items-center gap-2 pl-4 border-l border-gray-700 text-xs">
          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-gray-400 whitespace-nowrap text-[11px]">Speed:</span>
          <input
            type="range"
            min={1}
            max={100}
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="w-24 accent-cyan-500 cursor-pointer"
          />
          <span className="font-mono text-cyan-300 font-bold min-w-[32px] text-right">
            {speed}x
          </span>
        </div>
      </div>
    </div>
  );
};

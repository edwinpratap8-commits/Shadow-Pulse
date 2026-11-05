import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import {
  Wrench,
  ChevronUp,
  ChevronDown,
  User,
  Zap,
  Radio,
  FastForward,
  Navigation,
  RotateCcw,
  Sparkles,
  Eye,
} from 'lucide-react';
import { Role, PlayerStatus } from '../game/radarRules';

export const DevToolbar: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    currentUser,
    switchViewRole,
    skipToBeforeReveal,
    forceImmediateReveal,
    toggleBotMovement,
    botMovementActive,
    restartGame,
    userLocation,
    cycleSeconds,
    radarState,
    gameState,
  } = useGame();

  const currentRole = currentUser?.role || 'HIDER';
  const currentStatus = currentUser?.status || 'ACTIVE';

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 border-t border-slate-800 text-xs font-mono select-none backdrop-blur-md shadow-2xl">
      {/* Toggle Bar */}
      <div className="px-3 py-1.5 flex items-center justify-between bg-slate-900/90 border-b border-slate-800/80">
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 font-bold transition-colors"
          aria-expanded={isExpanded}
          aria-label="Toggle simulation test controls toolbar"
        >
          <Wrench className="w-3.5 h-3.5 text-emerald-400" />
          <span className="tracking-wider">DEBUG & SIMULATION CONTROLS</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-normal">
            CYCLE: {cycleSeconds}s ({radarState.phase})
          </span>
        </button>

        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="text-slate-400 hover:text-slate-200 p-1"
          aria-label="Toggle panel"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Controls Panel */}
      {isExpanded && (
        <div className="p-3 max-w-4xl mx-auto space-y-3">
          {/* Row 1: Role Switchers */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 text-[10px] uppercase font-semibold">Switch View:</span>

            {/* Denner Button */}
            <button
              onClick={() => switchViewRole('DENNER', 'ACTIVE')}
              className={`px-2.5 py-1 rounded font-bold transition-all active:scale-95 flex items-center gap-1 ${
                currentRole === 'DENNER'
                  ? 'bg-red-600 text-white ring-2 ring-red-400'
                  : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span>DENNER (SEEKER)</span>
            </button>

            {/* Active Hider Button */}
            <button
              onClick={() => switchViewRole('HIDER', 'ACTIVE')}
              className={`px-2.5 py-1 rounded font-bold transition-all active:scale-95 flex items-center gap-1 ${
                currentRole === 'HIDER' && currentStatus === 'ACTIVE'
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                  : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span>ACTIVE HIDER</span>
            </button>

            {/* Found Hider (Co-Seeker) Button */}
            <button
              onClick={() => switchViewRole('HIDER', 'FOUND')}
              className={`px-2.5 py-1 rounded font-bold transition-all active:scale-95 flex items-center gap-1 ${
                currentRole === 'HIDER' && currentStatus === 'FOUND'
                  ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                  : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span>FOUND HIDER (CO-SEEKER)</span>
            </button>
          </div>

          {/* Row 2: Radar Cycle Test Triggers & Bot Drift */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Skip to 35s Before Reveal */}
            <button
              onClick={skipToBeforeReveal}
              aria-label="Skip to 35 seconds before reveal"
              className="px-2.5 py-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-600/80 text-amber-300 font-bold transition-all active:scale-95 flex items-center gap-1 shadow"
              title="Jumps clock to 265s (5s before 30-sec warning, then 10s flash)"
            >
              <FastForward className="w-3.5 h-3.5 text-amber-400" />
              <span>SKIP TO 35s BEFORE REVEAL</span>
            </button>

            {/* Force 10s Live Flash immediately */}
            <button
              onClick={forceImmediateReveal}
              aria-label="Force immediate 10-second location flash"
              className="px-2.5 py-1 rounded bg-red-950/80 hover:bg-red-900 border border-red-600/80 text-red-200 font-bold transition-all active:scale-95 flex items-center gap-1 shadow"
              title="Triggers 10s live GPS broadcast immediately"
            >
              <Radio className="w-3.5 h-3.5 text-red-400 animate-spin" />
              <span>TRIGGER 10s FLASH</span>
            </button>

            {/* Toggle Simulated Bot Movement */}
            <button
              onClick={toggleBotMovement}
              aria-label="Toggle bot GPS wander"
              className={`px-2.5 py-1 rounded border transition-all active:scale-95 flex items-center gap-1 ${
                botMovementActive
                  ? 'bg-indigo-950/80 border-indigo-600 text-indigo-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
              title="Simulates AI players moving realistically around your GPS location"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>BOT DRIFT: {botMovementActive ? 'RUNNING' : 'PAUSED'}</span>
            </button>

            {/* Reset / Restart */}
            <button
              onClick={restartGame}
              aria-label="Restart match"
              className="ml-auto px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET MATCH</span>
            </button>
          </div>

          {/* Coordinate & Accuracy diagnostics */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
            <span>
              GPS: {userLocation?.lat.toFixed(5)}, {userLocation?.lng.toFixed(5)} (±
              {userLocation?.accuracy || 5}m)
            </span>
            <span>Current State: {gameState}</span>
          </div>
        </div>
      )}
    </div>
  );
};

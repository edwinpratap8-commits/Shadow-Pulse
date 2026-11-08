import React from 'react';
import { useGame } from '../context/GameContext';
import { calculateDistanceMeters, Checkpoint } from '../game/radarRules';
import { Flag, CheckCircle2, Navigation, Radio, Timer } from 'lucide-react';

interface CheckpointHUDProps {
  onFocusCheckpoint?: (cp: Checkpoint) => void;
}

export const CheckpointHUD: React.FC<CheckpointHUDProps> = ({ onFocusCheckpoint }) => {
  const {
    currentUser,
    activeCheckpointZone,
    checkpointRemainingSec,
    gameState,
  } = useGame();

  if (
    !currentUser ||
    currentUser.role !== 'HIDER' ||
    (gameState !== 'HIDING' && gameState !== 'ACTIVE_SEEKING')
  ) {
    return null;
  }

  const checkpoints = currentUser.checkpoints || [];
  if (checkpoints.length === 0) return null;

  const completedCount = checkpoints.filter((cp) => cp.completed).length;
  const isAllMineDone = completedCount >= checkpoints.length;

  return (
    <>
      {/* 1. High-Priority In-Zone Infiltration Banner (When inside 50m radius) */}
      {activeCheckpointZone && !activeCheckpointZone.completed && (
        <div className="absolute top-2.5 left-2.5 right-14 sm:top-3 sm:left-3 sm:right-20 z-30 max-w-md pointer-events-none animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-cyan-950/95 border-2 border-cyan-400 text-cyan-100 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl shadow-2xl backdrop-blur-md pointer-events-auto">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 sm:p-2 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 animate-pulse shrink-0">
                  <Flag className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <div className="font-mono font-black text-xs sm:text-sm tracking-wider text-cyan-200 uppercase flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                    INFILTRATING {activeCheckpointZone.name}
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-sans text-cyan-300 font-medium truncate">
                    Stay within 50m radius to secure waypoint!
                  </div>
                </div>
              </div>

              {/* Big Digital Countdown */}
              <div className="flex items-center gap-1 bg-slate-900/90 border border-cyan-500/80 px-2.5 py-1 rounded-lg shrink-0">
                <Timer className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span className="font-mono text-lg sm:text-xl font-black text-cyan-300 tabular-nums">
                  {checkpointRemainingSec}s
                </span>
              </div>
            </div>

            {/* 20-Second Progress Bar */}
            <div className="mt-2 w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-cyan-900">
              <div
                className="bg-cyan-400 h-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${Math.max(0, Math.min(100, ((20 - checkpointRemainingSec) / 20) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. Compact Tactical Objective Strip (Floating below header or above bottom drawer) */}
      <div className="absolute top-14 left-2.5 right-2.5 sm:left-4 sm:right-auto z-20 pointer-events-auto max-w-sm">
        <div className="bg-slate-950/90 border border-slate-800/90 rounded-lg p-2 backdrop-blur-md shadow-xl flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold">
              <Flag className="w-3.5 h-3.5 text-cyan-400" />
              <span>CAMPUS CHECKPOINTS</span>
            </div>
            <span
              className={`px-1.5 py-0.2 rounded font-black text-[10px] ${
                isAllMineDone
                  ? 'bg-emerald-950 border border-emerald-600 text-emerald-400'
                  : 'bg-cyan-950 border border-cyan-700 text-cyan-300'
              }`}
            >
              {completedCount}/3 SECURED
            </span>
          </div>

          {/* Quick Checkpoint Buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            {checkpoints.map((cp) => {
              const dist = calculateDistanceMeters(
                currentUser.latitude,
                currentUser.longitude,
                cp.latitude,
                cp.longitude
              );
              const isZoneActive = activeCheckpointZone?.id === cp.id;

              return (
                <button
                  key={cp.id}
                  onClick={() => onFocusCheckpoint?.(cp)}
                  aria-label={`View waypoint ${cp.code}`}
                  className={`px-2 py-1.5 rounded flex flex-col items-center justify-center text-center transition-all cursor-pointer border ${
                    cp.completed
                      ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-300'
                      : isZoneActive
                      ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 animate-pulse ring-2 ring-cyan-500/40'
                      : 'bg-slate-900/80 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                  }`}
                  title={`${cp.name} - Click to center on map`}
                >
                  <div className="flex items-center gap-1 font-mono font-bold text-[10px]">
                    {cp.completed ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Navigation className="w-2.5 h-2.5 text-cyan-400" />
                    )}
                    <span>WAYPOINT {cp.code}</span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 tabular-nums">
                    {cp.completed ? (
                      <span className="text-emerald-400 font-semibold">DONE</span>
                    ) : isZoneActive ? (
                      <span className="text-cyan-300 font-bold">{checkpointRemainingSec}s HOLD</span>
                    ) : (
                      <span>{dist}m away</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

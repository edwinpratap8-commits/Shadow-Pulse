import React from 'react';
import { useGame } from '../context/GameContext';
import { formatSeconds } from '../game/radarRules';
import { EyeOff, Radio } from 'lucide-react';

export const HidingPhaseOverlay: React.FC = () => {
  const {
    currentUser,
    remainingHeadStartSeconds,
    headStartMinutes,
    gameState,
  } = useGame();

  if (gameState !== 'HIDING' || !currentUser) return null;

  const isDenner = currentUser.role === 'DENNER';
  const totalSeconds = headStartMinutes * 60;
  const progressPercent = Math.max(
    0,
    Math.min(100, ((totalSeconds - remainingHeadStartSeconds) / totalSeconds) * 100)
  );

  return (
    <>
      {isDenner ? (
        /* Denner Blindfold Screen Overlay (Map is completely hidden/disabled) */
        <div className="absolute inset-0 z-30 bg-slate-950/98 backdrop-blur-xl flex flex-col items-center justify-center p-6 pb-12 overflow-y-auto text-center select-none">
          {/* Tactical Blindfold Reticle */}
          <div className="relative mb-6">
            <div className="w-28 h-28 rounded-full border-4 border-dashed border-red-600/60 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-red-500">
              <EyeOff className="w-14 h-14 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2 max-w-sm">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950 border border-red-700 text-red-400 font-mono text-xs font-bold uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              DENNER RADAR BLINDED
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-mono text-white tracking-wide">
              HIDERS ARE SCATTERING
            </h2>
            <p className="text-xs text-slate-400">
              Your satellite radar is offline to give hiders an initial head start. Stand by for release.
            </p>
          </div>

          {/* Big Digital Countdown */}
          <div className="my-6 px-6 py-3 rounded-2xl bg-slate-900 border-2 border-red-900/80 shadow-2xl">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
              RELEASE IN
            </div>
            <div className="font-mono text-4xl sm:text-5xl font-black text-red-400 tabular-nums">
              {formatSeconds(remainingHeadStartSeconds)}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-xs bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="bg-red-500 h-full transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : (
        /* Hider Floating Head-Start Banner (Hiders see the map and scatter) */
        <div className="absolute top-3 inset-x-4 z-30 max-w-md mx-auto pointer-events-none">
          <div className="bg-emerald-950/95 border-2 border-emerald-500 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between pointer-events-auto backdrop-blur-md animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 animate-pulse">
                <Radio className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="font-mono font-black text-xs sm:text-sm tracking-wider text-emerald-100 uppercase">
                  HEAD-START: RUN & HIDE!
                </div>
                <div className="text-[11px] font-sans text-emerald-300 font-medium">
                  Denner map is blinded for {formatSeconds(remainingHeadStartSeconds)}. Get moving!
                </div>
              </div>
            </div>

            <div className="font-mono text-2xl font-black text-emerald-400 tabular-nums ml-2">
              {formatSeconds(remainingHeadStartSeconds)}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

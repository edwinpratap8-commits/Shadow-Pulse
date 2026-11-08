import React from 'react';
import { useGame } from '../context/GameContext';
import { Crosshair, ShieldAlert, FastForward, Radio, Eye } from 'lucide-react';
import { formatSeconds } from '../game/radarRules';

export const CaughtCooldownModal: React.FC = () => {
  const { currentUser, gameState, accelerateCooldown } = useGame();

  // Active during ACTIVE_SEEKING when user is a caught Hider undergoing 30s cooldown
  const isCaughtHider = currentUser?.status === 'FOUND' && currentUser?.role === 'HIDER';

  if (!isCaughtHider || gameState !== 'ACTIVE_SEEKING' || !currentUser) {
    return null;
  }

  const remainingCooldown = currentUser.cooldownRemainingSec !== undefined
    ? currentUser.cooldownRemainingSec
    : 30;

  const progressPercent = Math.max(0, Math.min(100, ((30 - remainingCooldown) / 30) * 100));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300">
      {/* Animated Hunter Reticle */}
      <div className="relative mb-6">
        <div className="w-28 h-28 rounded-full border-4 border-dashed border-red-500/60 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-red-500">
          <Crosshair className="w-14 h-14 animate-pulse" />
        </div>
      </div>

      {/* Status Badge */}
      <div className="space-y-2 max-w-sm">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950 border border-red-700 text-red-400 font-mono text-xs font-bold uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span>HUNTER RE-ARMAMENT PROTOCOL</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black font-mono text-white tracking-wide uppercase">
          YOU HAVE BEEN CAUGHT!
        </h2>
        <p className="text-xs sm:text-sm text-slate-300">
          Stand by for satellite re-calibration. You are converting into an active <strong>Seeker</strong>!
        </p>
      </div>

      {/* 30-Second Countdown Display */}
      <div className="my-6 px-8 py-4 rounded-2xl bg-slate-900 border-2 border-red-800 shadow-2xl space-y-1">
        <div className="text-[11px] font-mono text-slate-400 uppercase tracking-widest font-bold">
          CONVERTING TO SEEKER IN
        </div>
        <div className="font-mono text-5xl sm:text-6xl font-black text-red-400 tabular-nums">
          :{remainingCooldown.toString().padStart(2, '0')}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-xs bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
        <div
          className="bg-red-500 h-full transition-all duration-1000 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Tactical Role Briefing */}
      <div className="mt-5 p-3.5 max-w-sm rounded-xl bg-slate-900/80 border border-slate-800 text-left text-xs font-sans text-slate-300 space-y-1">
        <div className="text-amber-400 font-mono font-bold text-[11px] uppercase flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" />
          <span>WHAT HAPPENS NEXT:</span>
        </div>
        <p className="text-[11px] text-slate-400">
          When the timer hits 0, you join the Hunting Team. You will receive the full Seeker radar view, 10s live GPS flash pings of remaining hiders, and the Target Tagging drawer!
        </p>
      </div>

      {/* Dev Skip Button */}
      <button
        onClick={() => accelerateCooldown(currentUser.id)}
        className="mt-6 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        title="Skip 30s wait for rapid testing"
      >
        <FastForward className="w-3.5 h-3.5" />
        <span>Skip 30s Cooldown (Instant Seeker)</span>
      </button>
    </div>
  );
};

import React, { useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { ShieldAlert, Check, X, AlertTriangle, Radio } from 'lucide-react';
import { soundManager } from '../utils/audioEffects';

export const CaptureConfirmationModal: React.FC = () => {
  const { currentUser, confirmCapture, disputeCapture } = useGame();

  const pending = currentUser?.pendingCapture;

  useEffect(() => {
    if (pending) {
      soundManager.playRevealAlarm();
      soundManager.triggerVibration([300, 150, 300, 150, 500]);
    }
  }, [pending?.timestamp]);

  if (!pending || !currentUser) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border-2 border-red-500 rounded-2xl p-6 shadow-2xl shadow-red-950/80 space-y-5 animate-in zoom-in-95 duration-200 text-center">
        {/* Pulsing Alert Reticle */}
        <div className="mx-auto relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-red-600/30 animate-ping" />
          <div className="relative w-16 h-16 rounded-full bg-red-600 border-2 border-white flex items-center justify-center text-white shadow-xl">
            <ShieldAlert className="w-9 h-9 animate-pulse" />
          </div>
        </div>

        {/* Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950 border border-red-700 text-red-400 font-mono text-xs font-bold uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5 animate-spin" />
            <span>CAPTURE REPORT RECEIVED</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white uppercase">
            WERE YOU CAUGHT?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Seeker <strong className="text-red-400 font-bold">{pending.seekerName}</strong> reported capturing you in real life!
          </p>
        </div>

        {/* Mission Clarification Card */}
        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-left text-xs font-sans text-slate-300 space-y-1.5">
          <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold text-[11px] uppercase">
            <Check className="w-3.5 h-3.5" />
            <span>If you confirm:</span>
          </div>
          <p className="text-[11px] text-slate-400 pl-5">
            You will enter a 30-second cooldown, then convert into an active <strong>Seeker</strong> with full radar tracking tools!
          </p>

          <div className="flex items-center gap-1.5 text-amber-400 font-mono font-bold text-[11px] uppercase pt-1">
            <X className="w-3.5 h-3.5" />
            <span>If you escaped:</span>
          </div>
          <p className="text-[11px] text-slate-400 pl-5">
            Tap &quot;Dispute / Escaped&quot; to cancel this report and stay hidden as an active hider.
          </p>
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Dispute Button */}
          <button
            onClick={() => disputeCapture(currentUser.id)}
            className="w-full py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-mono font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-400" />
            <span>DISPUTE / ESCAPED</span>
          </button>

          {/* Confirm Button */}
          <button
            onClick={() => confirmCapture(currentUser.id)}
            className="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-mono font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-xl shadow-red-950/60 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>YES, I WAS CAUGHT</span>
          </button>
        </div>
      </div>
    </div>
  );
};

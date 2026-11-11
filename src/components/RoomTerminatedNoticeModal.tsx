import React from 'react';
import { useGame } from '../context/GameContext';
import { AlertOctagon, RotateCcw } from 'lucide-react';

export const RoomTerminatedNoticeModal: React.FC = () => {
  const { terminationNotice, dismissTerminationNotice, createRoom } = useGame();

  if (!terminationNotice) return null;

  const handleReturnHome = () => {
    dismissTerminationNotice();
    createRoom('Host Operator');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-red-500 rounded-2xl shadow-2xl p-6 max-w-md w-full text-slate-100 flex flex-col gap-4 text-center animate-in zoom-in-95 duration-200">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-950 border-2 border-red-500 flex items-center justify-center text-red-400">
          <AlertOctagon className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <h3 className="font-mono font-black text-lg text-white uppercase tracking-wider">
            MATCH TERMINATED
          </h3>
          <p className="font-mono text-xs text-red-400 mt-1">
            SERVER DATA PURGED
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans">
          {terminationNotice}
        </div>

        <button
          onClick={handleReturnHome}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/80 active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>RETURN TO LOBBY / NEW MATCH</span>
        </button>
      </div>
    </div>
  );
};

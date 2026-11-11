import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Trash2, AlertTriangle, X, ShieldAlert, Loader2 } from 'lucide-react';

interface TerminateMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TerminateMatchModal: React.FC<TerminateMatchModalProps> = ({ isOpen, onClose }) => {
  const { terminateMatch, roomCode } = useGame();
  const [terminating, setTerminating] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setTerminating(true);
    await terminateMatch();
    setTerminating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-red-600/80 rounded-2xl shadow-2xl p-5 max-w-md w-full text-slate-100 flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          disabled={terminating}
          className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-950 border border-red-600 text-red-400 shrink-0">
            <Trash2 className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-mono font-black text-base text-white tracking-wide uppercase">
              TERMINATE MATCH & WIPE SERVER
            </h3>
            <p className="text-xs font-mono text-red-400">
              ROOM CODE: {roomCode}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/80 text-xs font-sans text-red-200 space-y-2 leading-relaxed">
          <div className="flex items-center gap-2 font-mono font-bold text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>PERMANENT SERVER DATA DELETION</span>
          </div>
          <p>
            This action will <strong>immediately terminate the match</strong> for all connected players.
          </p>
          <p className="text-slate-300">
            All coordinates, checkpoints, voice communication channels, and match state will be <strong>permanently purged from the server memory</strong>. This cannot be undone.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            onClick={handleConfirm}
            disabled={terminating}
            className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-mono font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-950/80 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {terminating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>PURGING SERVER DATA...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>TERMINATE & ERASE ALL DATA</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            disabled={terminating}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};

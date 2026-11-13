import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Sparkles, X, Shield, RefreshCw, Compass, MapPin } from 'lucide-react';
import { formatSeconds } from '../game/radarRules';

interface TacticalIntelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TacticalIntelModal: React.FC<TacticalIntelModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, userLocation, remainingGameSeconds, players } = useGame();
  const [intelText, setIntelText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<string>('gemini-dispatch');

  if (!isOpen) return null;

  const isDenner = currentUser?.role === 'DENNER';
  const unfoundCount = players.filter((p) => p.role === 'HIDER' && p.status === 'ACTIVE').length;

  const requestIntel = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tactical-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: currentUser?.role || 'HIDER',
          lat: userLocation?.lat || 17.4933,
          lng: userLocation?.lng || 78.3914,
          remainingTime: formatSeconds(remainingGameSeconds),
          unfoundCount,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIntelText(data.intel);
        setSource(data.source || 'gemini-tactical-ai');
      } else {
        setIntelText(
          'Tactical Dispatch: Maintain low silhouette. Use peripheral vision rather than direct line of sight. Relocate immediately following the 10s reveal window.'
        );
      }
    } catch {
      setIntelText(
        'Tactical Dispatch: Terrain advice: Move perpendicular to the Denner’s last known trajectory. Avoid dead-ends with single chokepoints.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-slate-900 border border-indigo-700/80 rounded-2xl p-5 shadow-2xl flex flex-col space-y-4 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-wider">
                TACTICAL SCOUT DISPATCH
              </h2>
              <div className="text-[10px] font-mono text-indigo-300">
                POWERED BY GEMINI AI • ROLE: {currentUser?.role}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close intel modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Telemetry info */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              GPS: {userLocation?.lat.toFixed(4)}, {userLocation?.lng.toFixed(4)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>TIME REMAINING: {formatSeconds(remainingGameSeconds)}</span>
          </div>
        </div>

        {/* Tactical Recommendation Box */}
        <div className="min-h-24 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs font-sans text-slate-200 space-y-2">
          {loading ? (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-indigo-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="font-mono text-xs">Analyzing tactical terrain & radar cycles...</span>
            </div>
          ) : intelText ? (
            <div className="whitespace-pre-line leading-relaxed font-mono text-xs text-indigo-100">
              {intelText}
            </div>
          ) : (
            <div className="py-4 text-center text-slate-400 font-sans text-xs">
              Request real-time tactical advice based on your current role, coordinates, remaining time, and radar cycle state.
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={requestIntel}
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-950"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{intelText ? 'REFRESH TACTICAL INTEL' : 'REQUEST SCOUT DISPATCH'}</span>
        </button>
      </div>
    </div>
  );
};

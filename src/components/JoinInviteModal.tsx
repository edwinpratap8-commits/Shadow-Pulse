import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Shield, User, ArrowRight, Dices, Radio } from 'lucide-react';

const SUGGESTED_NAMES = [
  'Ghost',
  'Viper',
  'Spectre',
  'Shadow',
  'Recon',
  'Falcon',
  'Maverick',
  'StealthFox',
  'Echo-7',
  'NightHawk',
];

export const JoinInviteModal: React.FC = () => {
  const { pendingInviteCode, setPendingInviteCode, joinRoom, currentUser } = useGame();
  const [callsign, setCallsign] = useState(
    currentUser?.name ||
      (typeof window !== 'undefined' ? localStorage.getItem('shadowpulse_uname') : '') ||
      'Spectre'
  );
  const [submitting, setSubmitting] = useState(false);

  if (!pendingInviteCode) return null;

  const handlePickRandom = () => {
    const randomPick = SUGGESTED_NAMES[Math.floor(Math.random() * SUGGESTED_NAMES.length)];
    setCallsign(`${randomPick}-${Math.floor(Math.random() * 90 + 10)}`);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = callsign.trim() || 'Operative';
    setSubmitting(true);
    await joinRoom(pendingInviteCode, finalName);
    setSubmitting(false);
    setPendingInviteCode(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-slate-900 border-2 border-emerald-500/80 rounded-2xl p-6 shadow-2xl shadow-emerald-950/50 space-y-5 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-400 text-xs font-mono font-bold uppercase tracking-widest">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Incoming Room Invitation</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white uppercase">
            JOIN ROOM: <span className="text-emerald-400">{pendingInviteCode}</span>
          </h2>
          <p className="text-xs text-slate-400">
            Choose the Operative Call-Sign that will be visible to the Host and all other players on the radar.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300 font-semibold">
              <label htmlFor="callsignInput" className="flex items-center gap-1.5 uppercase">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Your Visible Call-Sign</span>
              </label>
              <button
                type="button"
                onClick={handlePickRandom}
                className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                title="Generate random tactical callsign"
              >
                <Dices className="w-3 h-3" />
                <span>Randomize</span>
              </button>
            </div>

            <input
              id="callsignInput"
              type="text"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              placeholder="Enter your call-sign (e.g. Maverick, ShadowFox)"
              maxLength={20}
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border-2 border-slate-700 text-slate-100 font-mono text-base font-bold focus:outline-none focus:border-emerald-500 shadow-inner"
            />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              Quick Call-Sign Suggestions:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_NAMES.slice(0, 6).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setCallsign(name)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all ${
                    callsign === name
                      ? 'bg-emerald-600 text-slate-950 font-bold'
                      : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || !callsign.trim()}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-black text-sm uppercase tracking-wider transition-all active:scale-95 shadow-xl shadow-emerald-950/60 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>{submitting ? 'CONNECTING...' : `ENTER ROOM AS "${callsign.trim() || 'OPERATIVE'}"`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

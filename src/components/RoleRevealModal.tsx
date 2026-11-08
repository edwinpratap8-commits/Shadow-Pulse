import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Crosshair, Shield, EyeOff, Radio, ArrowRight } from 'lucide-react';

export const RoleRevealModal: React.FC = () => {
  const { currentUser, headStartMinutes, dismissRoleReveal, gameState } = useGame();
  const [dismissed, setDismissed] = useState(false);

  if (gameState !== 'ROLE_REVEAL' || !currentUser || dismissed) return null;

  const isDenner = currentUser.role === 'DENNER';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-lg flex items-center justify-center p-4 select-none">
      <div
        className={`w-full max-w-md rounded-2xl p-6 border-2 shadow-2xl flex flex-col items-center text-center space-y-5 animate-in fade-in zoom-in duration-300 ${
          isDenner
            ? 'bg-gradient-to-b from-red-950/90 to-slate-950 border-red-600 shadow-red-950/50'
            : 'bg-gradient-to-b from-emerald-950/90 to-slate-950 border-emerald-500 shadow-emerald-950/50'
        }`}
      >
        {/* Animated Role Icon Badge */}
        <div
          className={`relative p-5 rounded-full border-2 ${
            isDenner
              ? 'bg-red-600/20 border-red-500 text-red-400 animate-pulse'
              : 'bg-emerald-600/20 border-emerald-400 text-emerald-400 animate-pulse'
          }`}
        >
          <div
            className={`absolute inset-0 rounded-full animate-ping opacity-25 ${
              isDenner ? 'bg-red-500' : 'bg-emerald-500'
            }`}
          />
          {isDenner ? <Crosshair className="w-14 h-14" /> : <EyeOff className="w-14 h-14" />}
        </div>

        {/* Big Reveal Heading */}
        <div className="space-y-1">
          <div className="font-mono text-xs uppercase tracking-widest text-slate-400 font-bold">
            MISSION ASSIGNMENT
          </div>
          <h2
            className={`text-2xl sm:text-3xl font-black font-mono tracking-tight uppercase ${
              isDenner ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {isDenner ? 'YOU ARE THE DENNER' : 'YOU ARE A HIDER'}
          </h2>
          <div className="font-mono text-xs font-semibold text-slate-300">
            {isDenner ? 'SEEKER & CAPTOR' : 'STEALTH EVADER'}
          </div>
        </div>

        {/* Tactical Mission Brief */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left space-y-2 text-xs font-sans text-slate-300 w-full">
          {isDenner ? (
            <>
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-red-400">01.</span>
                <span>
                  <strong>Map Blinded:</strong> Your radar is locked for{' '}
                  <strong className="text-white">{headStartMinutes} minutes</strong> while hiders scatter.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-red-400">02.</span>
                <span>
                  <strong>5-Minute Radar Ping:</strong> Every 5 minutes, unfound hiders will flash on your map for{' '}
                  <strong className="text-red-300">10 seconds</strong>!
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-red-400">03.</span>
                <span>
                  <strong>Tag as Found:</strong> Once you spot a hider in real life, mark them in your drawer to turn them into a Co-Seeker.
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-emerald-400">01.</span>
                <span>
                  <strong>Head-Start Scatter:</strong> You have{' '}
                  <strong className="text-white">{headStartMinutes} minutes</strong> to run and hide before the Denner is unleashed!
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-emerald-400">02.</span>
                <span>
                  <strong>30s Warning Alert:</strong> You will get an urgent siren 30 seconds before every 10-second live location reveal.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-emerald-400">03.</span>
                <span>
                  <strong>Relocate:</strong> Move stealthily during the 4-minute radar silence to throw off the Denner's search path.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            setDismissed(true);
            dismissRoleReveal();
          }}
          className={`w-full py-3.5 rounded-xl font-mono font-black text-sm uppercase tracking-wider transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
            isDenner
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/60'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/60'
          }`}
        >
          <span>{isDenner ? 'STAND BY FOR RELEASE' : 'SCATTER & HIDE NOW'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

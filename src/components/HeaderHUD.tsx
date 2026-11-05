import React from 'react';
import { useGame } from '../context/GameContext';
import { formatSeconds } from '../game/radarRules';
import { Volume2, VolumeX, Shield, Radio, Copy, Check, Sparkles, Navigation } from 'lucide-react';

interface HeaderHUDProps {
  onOpenIntel: () => void;
}

export const HeaderHUD: React.FC<HeaderHUDProps> = ({ onOpenIntel }) => {
  const {
    roomCode,
    currentUser,
    remainingGameSeconds,
    radarState,
    gameState,
    soundEnabled,
    toggleSound,
    players,
  } = useGame();

  const [copied, setCopied] = React.useState(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDenner = currentUser?.role === 'DENNER';
  const isFound = currentUser?.status === 'FOUND';
  const unfoundCount = players.filter((p) => p.role === 'HIDER' && p.status === 'ACTIVE').length;
  const totalHiders = players.filter((p) => p.role === 'HIDER').length;

  return (
    <header className="w-full bg-slate-950/95 border-b border-slate-800/80 px-3 py-2 flex items-center justify-between text-xs z-30 select-none backdrop-blur shadow-md">
      {/* Left: App Title & Room Code */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono font-black text-sm tracking-wider text-slate-100 hidden sm:inline">
            SHADOW<span className="text-emerald-400">PULSE</span>
          </span>
        </div>

        {/* Room Code Badge */}
        <button
          onClick={copyRoomCode}
          aria-label="Copy room code"
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 transition-colors font-mono font-semibold"
          title="Click to copy room code"
        >
          <span className="text-slate-400">CODE:</span>
          <span className="text-emerald-400 font-bold">{roomCode}</span>
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
        </button>
      </div>

      {/* Center: Live Match Timers & Role Status */}
      <div className="flex items-center gap-2 sm:gap-4">
        {gameState === 'ACTIVE_SEEKING' && (
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-md font-mono">
            {/* Total Game Clock */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[10px]">TIME:</span>
              <span className="tabular-nums font-bold text-slate-100 text-xs">
                {formatSeconds(remainingGameSeconds)}
              </span>
            </div>

            <div className="w-px h-3 bg-slate-700" />

            {/* Radar Cycle Countdown */}
            <div className="flex items-center gap-1">
              <Radio
                className={`w-3 h-3 ${
                  radarState.isRevealActive
                    ? 'text-red-500 animate-spin'
                    : radarState.isWarningActive
                    ? 'text-amber-400 animate-pulse'
                    : 'text-emerald-400'
                }`}
              />
              <span className="text-slate-400 text-[10px]">PING:</span>
              <span
                className={`tabular-nums font-bold text-xs ${
                  radarState.isRevealActive
                    ? 'text-red-400 animate-pulse'
                    : radarState.isWarningActive
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {radarState.isRevealActive
                  ? `${radarState.revealCountdown}s FLASH`
                  : radarState.isWarningActive
                  ? `${radarState.warningCountdown}s ALERT`
                  : formatSeconds(radarState.secondsRemainingInCycle)}
              </span>
            </div>
          </div>
        )}

        {/* Player Role Badge */}
        <div
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-mono font-bold text-[11px] uppercase tracking-wider border shadow-sm ${
            isDenner
              ? 'bg-red-950/80 border-red-700 text-red-300'
              : isFound
              ? 'bg-amber-950/80 border-amber-700 text-amber-300'
              : 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>{isDenner ? 'DENNER' : isFound ? 'CO-SEEKER' : 'HIDER'}</span>
          {gameState === 'ACTIVE_SEEKING' && (
            <span className="ml-1 text-[10px] text-slate-400">
              ({totalHiders - unfoundCount}/{totalHiders})
            </span>
          )}
        </div>
      </div>

      {/* Right: AI Scout Intel & Sound Toggle */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={onOpenIntel}
          aria-label="Open AI tactical dispatch intel"
          className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-950/80 border border-indigo-700/80 text-indigo-300 hover:bg-indigo-900 transition-colors font-mono font-medium"
          title="AI Tactical Dispatch"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">AI INTEL</span>
        </button>

        <button
          onClick={toggleSound}
          aria-label={soundEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
          className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title={soundEnabled ? 'Sound On' : 'Sound Muted'}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
        </button>
      </div>
    </header>
  );
};

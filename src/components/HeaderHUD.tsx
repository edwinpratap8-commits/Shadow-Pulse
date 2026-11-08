import React from 'react';
import { useGame } from '../context/GameContext';
import { formatSeconds } from '../game/radarRules';
import { Volume2, VolumeX, Shield, Radio, Copy, Check, Sparkles, Clock, Users, Flag } from 'lucide-react';

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
    const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/?room=${roomCode}` : roomCode;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDenner = currentUser?.role === 'DENNER';
  const isFound = currentUser?.status === 'FOUND';
  const unfoundCount = players.filter((p) => p.role === 'HIDER' && p.status === 'ACTIVE').length;
  const totalHiders = players.filter((p) => p.role === 'HIDER').length;
  const caughtCount = totalHiders - unfoundCount;
  const myCompletedCps = currentUser?.checkpoints
    ? currentUser.checkpoints.filter((cp) => cp.completed).length
    : 0;

  return (
    <header className="w-full bg-slate-950/95 border-b border-slate-800/80 px-2.5 sm:px-4 pt-[max(env(safe-area-inset-top,0px),0.5rem)] pb-2 flex flex-col gap-1.5 z-30 select-none backdrop-blur shadow-md shrink-0">
      {/* Top Primary Bar: Identity, Code, Role & Actions */}
      <div className="w-full flex items-center justify-between gap-2">
        {/* Left: App Logo & Room Code */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-mono font-black text-xs sm:text-sm tracking-wider text-slate-100 hidden xs:inline sm:inline">
              SHADOW<span className="text-emerald-400">PULSE</span>
            </span>
          </div>

          {/* Room Code Tappable Badge */}
          <button
            onClick={copyRoomCode}
            aria-label="Copy room code and invite link"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-700/80 hover:bg-slate-800 active:bg-slate-700 text-slate-300 transition-colors font-mono text-[11px] font-semibold shrink-0"
            title="Click to copy invite link"
          >
            <span className="text-slate-400">CODE:</span>
            <span className="text-emerald-400 font-bold">{roomCode}</span>
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <Copy className="w-3 h-3 text-slate-400 shrink-0" />
            )}
          </button>
        </div>

        {/* Right: Role Badge & Quick Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Player Role Badge */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded font-mono font-bold text-[10px] sm:text-[11px] uppercase tracking-wider border shadow-sm ${
              isDenner
                ? 'bg-red-950/90 border-red-700 text-red-300'
                : isFound
                ? 'bg-amber-950/90 border-amber-700 text-amber-300'
                : 'bg-emerald-950/90 border-emerald-700 text-emerald-300'
            }`}
          >
            <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>{isDenner ? 'DENNER' : isFound ? 'CO-SEEKER' : 'HIDER'}</span>
          </div>

          {/* AI Intel Button */}
          <button
            onClick={onOpenIntel}
            aria-label="Open AI tactical dispatch intel"
            className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-950/90 border border-indigo-700/80 text-indigo-300 hover:bg-indigo-900 active:bg-indigo-800 transition-colors font-mono text-[11px] font-medium"
            title="AI Tactical Dispatch"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="hidden sm:inline">AI INTEL</span>
          </button>

          {/* Sound Toggle Button */}
          <button
            onClick={toggleSound}
            aria-label={soundEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors"
            title={soundEnabled ? 'Sound Enabled' : 'Sound Muted'}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>
        </div>
      </div>

      {/* Secondary Bar: Active Tactical Match Telemetry Strip (In-Game Only) */}
      {gameState === 'ACTIVE_SEEKING' && (
        <div className="w-full pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono px-0.5">
          {/* Match Clock */}
          <div className="flex items-center gap-1 text-slate-300 bg-slate-900/80 border border-slate-800/70 px-2 py-0.5 rounded">
            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="text-slate-400 text-[10px]">TIME:</span>
            <span className="font-bold text-white tabular-nums">
              {formatSeconds(remainingGameSeconds)}
            </span>
          </div>

          {/* Radar Cycle Countdown */}
          <div
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded border transition-colors ${
              radarState.isRevealActive
                ? 'bg-red-500/20 text-red-300 border-red-500/50 animate-pulse'
                : radarState.isWarningActive
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}
          >
            <Radio
              className={`w-3 h-3 shrink-0 ${
                radarState.isRevealActive
                  ? 'text-red-400 animate-spin'
                  : radarState.isWarningActive
                  ? 'text-amber-400 animate-pulse'
                  : 'text-emerald-400'
              }`}
            />
            <span className="font-bold tabular-nums">
              {radarState.isRevealActive
                ? `FLASH ${radarState.revealCountdown}s`
                : radarState.isWarningActive
                ? `ALERT ${radarState.warningCountdown}s`
                : `PING ${formatSeconds(radarState.secondsRemainingInCycle)}`}
            </span>
          </div>

          {/* Target / Checkpoint Metric */}
          <div className="flex items-center gap-1 text-slate-300 bg-slate-900/80 border border-slate-800/70 px-2 py-0.5 rounded">
            {!isDenner && currentUser?.checkpoints && currentUser.checkpoints.length > 0 ? (
              <>
                <Flag className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="text-slate-400 text-[10px]">CPS:</span>
                <span
                  className={`font-bold tabular-nums ${
                    myCompletedCps === 3 ? 'text-emerald-400' : 'text-cyan-400'
                  }`}
                >
                  {myCompletedCps}/3
                </span>
              </>
            ) : (
              <>
                <Users className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="text-slate-400 text-[10px]">CAUGHT:</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  {caughtCount}/{totalHiders}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

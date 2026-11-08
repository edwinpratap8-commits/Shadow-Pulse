import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useGame } from '../context/GameContext';
import { Trophy, Shield, Users, Clock, RotateCcw, Skull, CheckCircle, Zap } from 'lucide-react';
import { formatSeconds, rankHidersByCheckpointSpeed } from '../game/radarRules';

export const GameOverModal: React.FC = () => {
  const {
    gameState,
    gameOverData,
    players,
    restartGame,
    gameDurationMinutes,
    remainingGameSeconds,
    currentUser,
  } = useGame();

  useEffect(() => {
    if (gameState === 'GAME_OVER') {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
        });
      } catch {
        // ignore
      }
    }
  }, [gameState]);

  if (gameState !== 'GAME_OVER' || !gameOverData) return null;

  const isDennerWinner = gameOverData.winner === 'DENNER';
  const totalSecondsPlayed = gameDurationMinutes * 60 - remainingGameSeconds;
  const hiders = players.filter((p) => p.role === 'HIDER');
  const foundCount = hiders.filter((p) => p.status === 'FOUND').length;
  const survivorCount = hiders.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 pb-12 overflow-y-auto select-none">
      <div
        className={`w-full max-w-lg rounded-2xl p-6 border-2 shadow-2xl flex flex-col items-center text-center space-y-5 animate-in fade-in zoom-in duration-300 ${
          isDennerWinner
            ? 'bg-gradient-to-b from-red-950/90 to-slate-950 border-red-600 shadow-red-950/60'
            : 'bg-gradient-to-b from-emerald-950/90 to-slate-950 border-emerald-500 shadow-emerald-950/60'
        }`}
      >
        {/* Trophy / Winner Icon */}
        <div
          className={`p-4 rounded-full border-2 ${
            isDennerWinner
              ? 'bg-red-600/20 border-red-500 text-red-400'
              : 'bg-emerald-600/20 border-emerald-400 text-emerald-400'
          }`}
        >
          <Trophy className="w-12 h-12" />
        </div>

        {/* Winner Heading */}
        <div className="space-y-1">
          <div className="font-mono text-xs uppercase tracking-widest text-slate-400 font-bold">
            MATCH CONCLUSION
          </div>
          <h2
            className={`text-2xl sm:text-3xl font-black font-mono tracking-tight uppercase ${
              isDennerWinner ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {isDennerWinner ? 'DENNER VICTORY!' : 'HIDERS VICTORY!'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">{gameOverData.reason}</p>
        </div>

        {/* Match Statistics Row */}
        <div className="grid grid-cols-3 gap-2 w-full">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col items-center">
            <Clock className="w-4 h-4 text-slate-400 mb-1" />
            <span className="text-[10px] font-mono text-slate-400 uppercase">Match Time</span>
            <span className="font-mono font-bold text-sm text-slate-100">
              {formatSeconds(totalSecondsPlayed)}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col items-center">
            <Skull className="w-4 h-4 text-red-400 mb-1" />
            <span className="text-[10px] font-mono text-slate-400 uppercase">Captured</span>
            <span className="font-mono font-bold text-sm text-red-400">
              {foundCount} / {hiders.length}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col items-center">
            <CheckCircle className="w-4 h-4 text-emerald-400 mb-1" />
            <span className="text-[10px] font-mono text-slate-400 uppercase">Survivors</span>
            <span className="font-mono font-bold text-sm text-emerald-400">{survivorCount}</span>
          </div>
        </div>

        {/* Hider Team Speed Leaderboard */}
        {(() => {
          const rankedHiders = rankHidersByCheckpointSpeed(players);
          if (rankedHiders.length === 0) return null;

          return (
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 text-left space-y-2.5 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                    HIDER CHECKPOINT SPEED LEADERBOARD
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800 font-semibold">
                  FASTEST TO 3/3 WAYPOINTS
                </span>
              </div>

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {rankedHiders.map((entry) => {
                  const isMe = currentUser?.id === entry.player.id;
                  const isChampion = entry.rank === 1 && entry.isAllCompleted;

                  return (
                    <div
                      key={entry.player.id}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between transition-all ${
                        isChampion
                          ? 'bg-amber-950/30 border-amber-500/60 shadow-sm shadow-amber-950/50'
                          : entry.rank === 2 && entry.isAllCompleted
                          ? 'bg-slate-800/70 border-slate-600'
                          : entry.rank === 3 && entry.isAllCompleted
                          ? 'bg-orange-950/20 border-orange-800/40'
                          : 'bg-slate-950/60 border-slate-800/80'
                      }`}
                    >
                      {/* Left: Rank & Player info */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Rank Badge */}
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center font-mono font-bold text-xs flex-shrink-0 ${
                            entry.rank === 1
                              ? 'bg-amber-500 text-slate-950 shadow'
                              : entry.rank === 2
                              ? 'bg-slate-300 text-slate-950'
                              : entry.rank === 3
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-100 truncate">
                              {entry.player.name}
                            </span>
                            {isMe && (
                              <span className="text-[10px] font-mono text-emerald-400 font-extrabold">
                                (YOU)
                              </span>
                            )}
                            {isChampion && (
                              <span className="text-[9px] font-mono text-amber-300 bg-amber-950 px-1.5 py-0.2 rounded border border-amber-600 font-bold uppercase tracking-wider">
                                SPEED CHAMP
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                            <span>
                              {entry.player.status === 'FOUND' ? 'Captured' : 'Survived'}
                            </span>
                            <span>•</span>
                            <span
                              className={
                                entry.isAllCompleted
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-amber-400'
                              }
                            >
                              {entry.checkpointsCompleted}/{entry.totalCheckpoints} Waypoints
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Time to complete */}
                      <div className="text-right flex-shrink-0 pl-2">
                        <div
                          className={`font-mono text-xs font-black flex items-center justify-end gap-1 ${
                            entry.isAllCompleted
                              ? 'text-emerald-400'
                              : entry.checkpointsCompleted > 0
                              ? 'text-amber-400'
                              : 'text-slate-500'
                          }`}
                        >
                          <Clock className="w-3 h-3 inline" />
                          <span>{entry.formattedTime}</span>
                        </div>
                        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-tight">
                          {entry.isAllCompleted ? 'SECURED' : entry.checkpointsCompleted > 0 ? 'PARTIAL' : 'INCOMPLETE'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Full Match Mission Roster */}
        <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-left space-y-2">
          <div className="text-[11px] font-mono font-bold uppercase text-slate-400 tracking-wider">
            COMPLETE ROSTER REPORT
          </div>
          <div className="divide-y divide-slate-800/80 max-h-32 overflow-y-auto">
            {players.map((p) => {
              const isDenner = p.role === 'DENNER';
              const isFound = p.status === 'FOUND';
              return (
                <div key={p.id} className="py-1.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-200 font-semibold">{p.name}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                        isDenner
                          ? 'bg-red-950 border border-red-700 text-red-300'
                          : 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                      }`}
                    >
                      {p.role}
                    </span>
                  </div>

                  <span
                    className={`font-mono text-[10px] font-bold ${
                      isDenner
                        ? isDennerWinner
                          ? 'text-red-400'
                          : 'text-slate-400'
                        : isFound
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {isDenner
                      ? isDennerWinner
                        ? 'CAPTURED ALL'
                        : 'FAILED TO SWEEP'
                      : isFound
                      ? 'CAPTURED'
                      : p.checkpoints && p.checkpoints.every((cp) => cp.completed)
                      ? '3/3 WAYPOINTS (SECURED)'
                      : p.checkpoints
                      ? `${p.checkpoints.filter((cp) => cp.completed).length}/3 WAYPOINTS`
                      : 'SURVIVED'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Return to Lobby CTA */}
        <button
          onClick={restartGame}
          className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-black text-sm uppercase tracking-wider transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>RETURN TO LOBBY / PLAY AGAIN</span>
        </button>
      </div>
    </div>
  );
};

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useGame } from '../context/GameContext';
import { Trophy, Shield, Users, Clock, RotateCcw, Skull, CheckCircle } from 'lucide-react';
import { formatSeconds } from '../game/radarRules';

export const GameOverModal: React.FC = () => {
  const { gameState, gameOverData, players, restartGame, gameDurationMinutes, remainingGameSeconds } =
    useGame();

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
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 select-none">
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

        {/* Player Leaderboard */}
        <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-left space-y-2">
          <div className="text-[11px] font-mono font-bold uppercase text-slate-400 tracking-wider">
            MISSION REPORT
          </div>
          <div className="divide-y divide-slate-800/80 max-h-40 overflow-y-auto">
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
                        : 'TIME RUN OUT'
                      : isFound
                      ? 'CAPTURED'
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

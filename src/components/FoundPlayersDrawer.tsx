import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Player } from '../game/radarRules';
import { Users, ChevronUp, ChevronDown, Check, UserCheck, ShieldAlert, Crosshair, Radio } from 'lucide-react';

export const FoundPlayersDrawer: React.FC = () => {
  const {
    players,
    currentUser,
    markPlayerFound,
    gameState,
    radarState,
    radioTarget,
    setRadioTarget,
  } = useGame();
  const [isOpen, setIsOpen] = useState(false);

  if (gameState !== 'ACTIVE_SEEKING') return null;

  const isDenner = currentUser?.role === 'DENNER';

  // Active targets are players who are still HIDER & ACTIVE
  const activeHiders = players.filter((p) => p.role === 'HIDER' && p.status === 'ACTIVE');
  // Caught players are those marked FOUND or converted to Seeker with lastFoundAt
  const caughtPlayers = players.filter((p) => p.status === 'FOUND' || (p.role === 'DENNER' && p.lastFoundAt));
  const totalTargets = activeHiders.length + caughtPlayers.length;

  return (
    <div className="absolute bottom-2 sm:bottom-3 inset-x-2.5 sm:inset-x-6 z-30 max-w-md mx-auto pointer-events-auto mb-[env(safe-area-inset-bottom,0px)]">
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-300">
        {/* Drawer Header / Toggle Handle */}
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/60 active:bg-slate-800 transition-colors cursor-pointer select-none min-h-[48px]"
          aria-expanded={isOpen}
          aria-label="Toggle hiders tracking drawer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-1.5 rounded-lg border shrink-0 ${
              isDenner
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-mono font-bold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <span>TARGET ROSTER</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-emerald-400 font-black shrink-0">
                  {caughtPlayers.length}/{totalTargets} CAUGHT
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-sans truncate">
                {isDenner
                  ? `${activeHiders.length} target(s) remaining to capture`
                  : `Stealth Evader • ${activeHiders.length} hider(s) remaining`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400 shrink-0 ml-1">
            <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">
              {isOpen ? 'COLLAPSE' : 'EXPAND'}
            </span>
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </button>

        {/* Collapsible Content */}
        {isOpen && (
          <div className="px-3.5 pb-3.5 pt-1 max-h-[45vh] sm:max-h-60 overflow-y-auto divide-y divide-slate-800/80 border-t border-slate-800 overscroll-contain">
            {totalTargets === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400">No active targets registered</div>
            ) : (
              [...activeHiders, ...caughtPlayers].map((target) => {
                const isFound = target.status === 'FOUND' || (target.role === 'DENNER' && target.lastFoundAt);
                const isMe = target.id === currentUser?.id;

                return (
                  <div
                    key={target.id}
                    className={`py-2.5 flex items-center justify-between text-xs transition-colors ${
                      isFound ? 'opacity-65' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          isFound
                            ? 'bg-amber-500'
                            : isDenner && radarState.isRevealActive
                            ? 'bg-red-500 animate-ping'
                            : 'bg-emerald-400'
                        }`}
                      />
                      <div className="truncate">
                        <div className="font-mono font-semibold text-slate-200 truncate flex items-center gap-1.5">
                          <span>{target.name}</span>
                          {isMe && <span className="text-[9px] text-emerald-400 font-bold">(YOU)</span>}
                          {target.isBot && <span className="text-[9px] text-slate-500 font-mono">AI BOT</span>}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {isFound ? (
                            <span className="text-amber-400 font-medium">
                              {target.role === 'DENNER'
                                ? 'CONVERTED TO SEEKER'
                                : `CAUGHT • COOLDOWN (${target.cooldownRemainingSec ?? 30}s)`}
                            </span>
                          ) : isDenner ? (
                            radarState.isRevealActive ? (
                              <span className="text-red-400 font-black animate-pulse flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                                EXPOSED ON RADAR
                              </span>
                            ) : (
                              <span className="text-slate-500 font-medium">
                                SIGNAL SILENCED
                              </span>
                            )
                          ) : isMe ? (
                            <span className="text-emerald-400 font-medium">
                              STEALTH ACTIVE (YOU)
                            </span>
                          ) : (
                            <span className="text-emerald-400/80 font-medium">
                              ACTIVE HIDER
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Controls for Seekers */}
                    <div className="flex-shrink-0">
                      {target.pendingCapture ? (
                        <div className="px-2.5 py-1 rounded bg-amber-950/90 border border-amber-600 text-amber-300 font-mono text-[10px] flex items-center gap-1.5 animate-pulse">
                          <Radio className="w-3 h-3 text-amber-400 animate-spin" />
                          <span>AWAITING CONFIRM...</span>
                        </div>
                      ) : isDenner && !isFound && !isMe ? (
                        <button
                          onClick={() => markPlayerFound(target.id)}
                          aria-label={`Tag ${target.name} as caught`}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-mono font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md shadow-red-950"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                          <span>TAG CAUGHT</span>
                        </button>
                      ) : isFound ? (
                        <div className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[10px] flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-emerald-400" />
                          <span>
                            {target.role === 'DENNER'
                              ? 'HUNTER'
                              : `${target.cooldownRemainingSec ?? 30}s CD`}
                          </span>
                        </div>
                      ) : !isDenner && !isFound && !isMe ? (
                        <button
                          onClick={() => {
                            setRadioTarget({
                              type: 'DIRECT',
                              targetPlayerId: target.id,
                              targetPlayerName: target.name,
                            });
                          }}
                          className={`px-2.5 py-1 rounded border font-mono text-[10px] font-bold flex items-center gap-1 transition-all ${
                            radioTarget.type === 'DIRECT' && radioTarget.targetPlayerId === target.id
                              ? 'bg-cyan-600 border-cyan-400 text-slate-950 font-black'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-cyan-300'
                          }`}
                          title={`Connect direct 1-to-1 radio with ${target.name}`}
                        >
                          <Radio className="w-3 h-3 text-cyan-400" />
                          <span>1-TO-1</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

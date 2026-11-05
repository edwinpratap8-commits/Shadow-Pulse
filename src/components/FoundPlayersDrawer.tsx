import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { calculateDistanceMeters, Player } from '../game/radarRules';
import { Users, ChevronUp, ChevronDown, Check, UserCheck, ShieldAlert, Crosshair } from 'lucide-react';

export const FoundPlayersDrawer: React.FC = () => {
  const { players, currentUser, markPlayerFound, gameState } = useGame();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (gameState !== 'ACTIVE_SEEKING') return null;

  const isDenner = currentUser?.role === 'DENNER';
  const hiders = players.filter((p) => p.role === 'HIDER');
  const unfoundHiders = hiders.filter((p) => p.status === 'ACTIVE');
  const foundHiders = hiders.filter((p) => p.status === 'FOUND');

  const handleMarkFoundClick = (playerId: string) => {
    if (confirmingId === playerId) {
      markPlayerFound(playerId);
      setConfirmingId(null);
    } else {
      setConfirmingId(playerId);
      // Auto-clear confirm state after 3.5 seconds
      setTimeout(() => {
        setConfirmingId((curr) => (curr === playerId ? null : curr));
      }, 3500);
    }
  };

  return (
    <div className="absolute bottom-12 sm:bottom-14 inset-x-3 sm:inset-x-6 z-30 max-w-md mx-auto pointer-events-auto">
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-300">
        {/* Drawer Header / Toggle Handle */}
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/60 transition-colors"
          aria-expanded={isOpen}
          aria-label="Toggle hiders tracking drawer"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="font-mono font-bold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span>TARGET ROSTER</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-emerald-400 font-black">
                  {foundHiders.length}/{hiders.length} FOUND
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                {isDenner
                  ? `${unfoundHiders.length} target(s) remaining in area`
                  : `Active Co-Seeker Radar Protocol`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">
              {isOpen ? 'COLLAPSE' : 'EXPAND'}
            </span>
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </button>

        {/* Collapsible Content */}
        {isOpen && (
          <div className="px-4 pb-4 pt-1 max-h-60 overflow-y-auto divide-y divide-slate-800/80 border-t border-slate-800">
            {hiders.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400">No hiders currently registered</div>
            ) : (
              hiders.map((hider) => {
                const isFound = hider.status === 'FOUND';
                const isMe = hider.id === currentUser?.id;
                const distance = currentUser
                  ? calculateDistanceMeters(
                      currentUser.latitude,
                      currentUser.longitude,
                      hider.latitude,
                      hider.longitude
                    )
                  : 0;
                const isConfirming = confirmingId === hider.id;

                return (
                  <div
                    key={hider.id}
                    className={`py-2.5 flex items-center justify-between text-xs transition-colors ${
                      isFound ? 'opacity-55' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          isFound ? 'bg-slate-600' : 'bg-emerald-400 animate-pulse'
                        }`}
                      />
                      <div className="truncate">
                        <div className="font-mono font-semibold text-slate-200 truncate flex items-center gap-1.5">
                          <span>{hider.name}</span>
                          {isMe && <span className="text-[9px] text-emerald-400 font-bold">(YOU)</span>}
                          {hider.isBot && <span className="text-[9px] text-slate-500 font-mono">BOT</span>}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {isFound ? (
                            <span className="text-amber-400 font-medium">CAPTURED (CO-SEEKER)</span>
                          ) : (
                            <span className="text-emerald-400 font-medium">
                              ACTIVE • ~{distance}m away
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Controls for Denner */}
                    {isDenner && !isFound && (
                      <button
                        onClick={() => handleMarkFoundClick(hider.id)}
                        aria-label={`Mark ${hider.name} as found`}
                        className={`px-3 py-1.5 rounded-lg font-mono font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 ${
                          isConfirming
                            ? 'bg-amber-600 hover:bg-amber-500 text-white ring-2 ring-amber-400 animate-pulse'
                            : 'bg-red-600 hover:bg-red-500 text-white'
                        }`}
                      >
                        {isConfirming ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>CONFIRM?</span>
                          </>
                        ) : (
                          <>
                            <Crosshair className="w-3.5 h-3.5" />
                            <span>TAG FOUND</span>
                          </>
                        )}
                      </button>
                    )}

                    {isFound && (
                      <div className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[10px] flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-emerald-400" />
                        <span>LOGGED</span>
                      </div>
                    )}
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

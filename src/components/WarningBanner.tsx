import React from 'react';
import { useGame } from '../context/GameContext';
import { AlertTriangle, Radio, Eye } from 'lucide-react';

export const WarningBanner: React.FC = () => {
  const { radarState, currentUser, gameState } = useGame();

  if (gameState !== 'ACTIVE_SEEKING') return null;

  const isWarning = radarState.isWarningActive;
  const isReveal = radarState.isRevealActive;
  const isDenner = currentUser?.role === 'DENNER';

  if (!isWarning && !isReveal) return null;

  return (
    <>
      {/* Screen edge pulsing vignette during warning / reveal */}
      {isReveal && (
        <div className="fixed inset-0 pointer-events-none z-20 reveal-alert-vignette" />
      )}
      {isWarning && (
        <div className="fixed inset-0 pointer-events-none z-20 ring-4 ring-amber-500/30 animate-pulse" />
      )}

      {/* Floating Tactical Banner at top of map */}
      <div className="absolute top-3 inset-x-4 z-20 max-w-md mx-auto pointer-events-none">
        {isWarning && (
          <div className="bg-amber-950/95 border-2 border-amber-500 text-amber-200 px-4 py-2.5 rounded-lg shadow-2xl warning-pulse-active flex items-center justify-between pointer-events-auto backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 animate-pulse">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="font-mono font-black text-xs sm:text-sm tracking-wider text-amber-100 uppercase">
                  WARNING: LOCATION REVEAL IN {radarState.warningCountdown}s
                </div>
                <div className="text-[11px] font-sans text-amber-300 font-medium">
                  {isDenner
                    ? 'Satellite radar acquiring coordinates. Prepare to sweep!'
                    : 'Your position will be exposed on all radars! FREEZE OR RUN!'}
                </div>
              </div>
            </div>

            <div className="font-mono text-xl sm:text-2xl font-black text-amber-400 tabular-nums ml-2">
              :{radarState.warningCountdown.toString().padStart(2, '0')}
            </div>
          </div>
        )}

        {isReveal && (
          <div className="bg-red-950/95 border-2 border-red-500 text-red-100 px-4 py-2.5 rounded-lg shadow-2xl animate-bounce flex items-center justify-between pointer-events-auto backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-600/30 border border-red-400 text-red-200 animate-spin">
                <Radio className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="font-mono font-black text-xs sm:text-sm tracking-wider text-red-200 uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  LIVE LOCATION BROADCAST ACTIVE!
                </div>
                <div className="text-[11px] font-sans text-red-300 font-medium">
                  {isDenner
                    ? 'All active hiders exposed on map with crimson pins!'
                    : 'YOU ARE EXPOSED ON DENNER MAP! Relocate after countdown!'}
                </div>
              </div>
            </div>

            <div className="font-mono text-xl sm:text-2xl font-black text-red-400 tabular-nums ml-2">
              :{radarState.revealCountdown.toString().padStart(2, '0')}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

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

      {/* Floating Tactical Banner at top of map (leaves top-right clear for map controls) */}
      <div className="absolute top-2.5 left-2.5 right-14 sm:top-3 sm:left-3 sm:right-20 z-20 max-w-md pointer-events-none">
        {isWarning && (
          <div className="bg-amber-950/95 border-2 border-amber-500 text-amber-200 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg shadow-2xl warning-pulse-active flex items-center justify-between pointer-events-auto backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 sm:p-2 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 animate-pulse shrink-0">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="font-mono font-black text-[11px] sm:text-xs tracking-wider text-amber-100 uppercase truncate">
                  WARNING: REVEAL IN {radarState.warningCountdown}s
                </div>
                <div className="text-[10px] sm:text-[11px] font-sans text-amber-300 font-medium line-clamp-1 sm:line-clamp-none">
                  {isDenner
                    ? 'Satellite radar acquiring coordinates. Prepare to sweep!'
                    : 'Position exposed on radar! FREEZE OR RUN!'}
                </div>
              </div>
            </div>

            <div className="font-mono text-lg sm:text-2xl font-black text-amber-400 tabular-nums ml-2 shrink-0">
              :{radarState.warningCountdown.toString().padStart(2, '0')}
            </div>
          </div>
        )}

        {isReveal && (
          <div className="bg-red-950/95 border-2 border-red-500 text-red-100 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg shadow-2xl animate-bounce flex items-center justify-between pointer-events-auto backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 sm:p-2 rounded-full bg-red-600/30 border border-red-400 text-red-200 animate-spin shrink-0">
                <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              </div>
              <div className="min-w-0">
                <div className="font-mono font-black text-[11px] sm:text-xs tracking-wider text-red-200 uppercase flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                  LIVE LOCATION BROADCAST ACTIVE!
                </div>
                <div className="text-[10px] sm:text-[11px] font-sans text-red-300 font-medium line-clamp-1 sm:line-clamp-none">
                  {isDenner
                    ? 'Active hiders exposed with crimson pins!'
                    : 'EXPOSED ON RADAR! Relocate after countdown!'}
                </div>
              </div>
            </div>

            <div className="font-mono text-lg sm:text-2xl font-black text-red-400 tabular-nums ml-2 shrink-0">
              :{radarState.revealCountdown.toString().padStart(2, '0')}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

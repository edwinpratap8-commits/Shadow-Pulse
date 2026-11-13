/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { HeaderHUD } from './components/HeaderHUD';
import { LobbyView } from './components/LobbyView';
import { TacticalMap } from './components/TacticalMap';
import { WarningBanner } from './components/WarningBanner';
import { FoundPlayersDrawer } from './components/FoundPlayersDrawer';
import { RoleRevealModal } from './components/RoleRevealModal';
import { HidingPhaseOverlay } from './components/HidingPhaseOverlay';
import { GameOverModal } from './components/GameOverModal';
import { TacticalIntelModal } from './components/TacticalIntelModal';
import { JoinInviteModal } from './components/JoinInviteModal';
import { CaptureConfirmationModal } from './components/CaptureConfirmationModal';
import { CaughtCooldownModal } from './components/CaughtCooldownModal';
import { CheckpointHUD } from './components/CheckpointHUD';
import { TacticalRadio } from './components/TacticalRadio';
import { RoomTerminatedNoticeModal } from './components/RoomTerminatedNoticeModal';
import { CommanderPassButton } from './components/CommanderPassButton';


const GameShell: React.FC = () => {
  const { gameState } = useGame();
  const [intelOpen, setIntelOpen] = useState(false);
  const [focusCoord, setFocusCoord] = useState<{ lat: number; lng: number } | null>(null);

  return (
    <div className="fixed inset-0 w-full h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col bg-slate-950 text-slate-100 font-sans select-none">
      {/* Tactical Top HUD */}
      <HeaderHUD onOpenIntel={() => setIntelOpen(true)} />

      {/* Main Content Area */}
      <main className="relative flex-1 w-full h-full overflow-hidden flex flex-col">
             {gameState === 'LOBBY' ? (
       <div className="flex-1 overflow-y-auto pb-12">
         <div className="max-w-md mx-auto px-4 pt-4">
           <CommanderPassButton />
         </div>
         <LobbyView />
       </div>
     ) : (
      
          <div className="relative flex-1 w-full h-full flex flex-col">
            {/* The Tactical Leaflet Map is rendered in HIDING, ACTIVE_SEEKING, and GAME_OVER */}
            <TacticalMap focusCoord={focusCoord} />

            {/* Checkpoint Objective Tracker & 20s Infiltration Banner for Hiders */}
            {(gameState === 'HIDING' || gameState === 'ACTIVE_SEEKING') && (
              <CheckpointHUD
                onFocusCheckpoint={(cp) => setFocusCoord({ lat: cp.latitude, lng: cp.longitude })}
              />
            )}

            {/* Tactical Push-to-Talk Walkie-Talkie Radio for Hiders (Group & 1-to-1) */}
            {(gameState === 'HIDING' || gameState === 'ACTIVE_SEEKING') && <TacticalRadio />}

            {/* Hiding Phase Head-Start Countdown & Denner Blindfold */}
            {gameState === 'HIDING' && <HidingPhaseOverlay />}

            {/* Warning Countdown Banner & 10s Flash Beacon Banner */}
            {gameState === 'ACTIVE_SEEKING' && <WarningBanner />}

            {/* Denner Roster & Co-Seeker Found Players Drawer */}
            {gameState === 'ACTIVE_SEEKING' && <FoundPlayersDrawer />}
          </div>
        )}

        {/* Overlays & Modals */}
        {gameState === 'ROLE_REVEAL' && <RoleRevealModal />}
        {gameState === 'GAME_OVER' && <GameOverModal />}
        <TacticalIntelModal isOpen={intelOpen} onClose={() => setIntelOpen(false)} />
        <JoinInviteModal />
        <CaptureConfirmationModal />
        <CaughtCooldownModal />
        <RoomTerminatedNoticeModal />
      </main>
    </div>
  );
};

export default function App() {
  return (
    <GameProvider>
      <GameShell />
    </GameProvider>
  );
}

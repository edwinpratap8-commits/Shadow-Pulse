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
import { DevToolbar } from './components/DevToolbar';
import { TacticalIntelModal } from './components/TacticalIntelModal';

const GameShell: React.FC = () => {
  const { gameState } = useGame();
  const [intelOpen, setIntelOpen] = useState(false);

  return (
    <div className="relative w-screen h-screen max-w-full overflow-hidden flex flex-col bg-slate-950 text-slate-100 font-sans select-none">
      {/* Tactical Top HUD */}
      <HeaderHUD onOpenIntel={() => setIntelOpen(true)} />

      {/* Main Content Area */}
      <main className="relative flex-1 w-full h-full overflow-hidden flex flex-col">
        {gameState === 'LOBBY' ? (
          <div className="flex-1 overflow-y-auto pb-36">
            <LobbyView />
          </div>
        ) : (
          <div className="relative flex-1 w-full h-full flex flex-col">
            {/* The Tactical Leaflet Map is rendered in HIDING, ACTIVE_SEEKING, and GAME_OVER */}
            <TacticalMap />

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
      </main>

      {/* Collapsible Developer / Simulation Toolbar at Bottom */}
      <DevToolbar />
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

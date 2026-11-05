import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Player,
  Role,
  PlayerStatus,
  RadarPhaseState,
  getRadarPhaseState,
  assignRandomDenner,
  checkGameEnd,
  generateRoomCode,
  TOTAL_CYCLE_SECONDS,
} from '../game/radarRules';
import { soundManager } from '../utils/audioEffects';

export type GameState = 'LOBBY' | 'ROLE_REVEAL' | 'HIDING' | 'ACTIVE_SEEKING' | 'GAME_OVER';

interface GameContextType {
  gameState: GameState;
  roomCode: string;
  currentUser: Player | null;
  players: Player[];
  isHost: boolean;
  headStartMinutes: number;
  gameDurationMinutes: number;
  remainingHeadStartSeconds: number;
  remainingGameSeconds: number;
  cycleSeconds: number;
  radarState: RadarPhaseState;
  userLocation: { lat: number; lng: number; accuracy: number } | null;
  gameOverData: { winner: 'DENNER' | 'HIDERS' | null; reason: string } | null;
  botMovementActive: boolean;
  soundEnabled: boolean;
  toggleSound: () => void;
  // Game Actions
  createRoom: (hostName: string) => void;
  joinRoom: (code: string, playerName: string) => boolean;
  setHeadStartMinutes: (mins: number) => void;
  setGameDurationMinutes: (mins: number) => void;
  startGame: () => void;
  dismissRoleReveal: () => void;
  markPlayerFound: (playerId: string) => void;
  restartGame: () => void;
  leaveRoom: () => void;
  // Dev & Simulation Actions
  switchViewRole: (newRole: Role, newStatus?: PlayerStatus) => void;
  skipToBeforeReveal: () => void;
  forceImmediateReveal: () => void;
  addSimulatedBot: () => void;
  removePlayer: (playerId: string) => void;
  toggleBotMovement: () => void;
  setUserCoordinates: (lat: number, lng: number) => void;
}

const GameContext = createContext<GameContextType | null>(null);

// Default coordinates: Central Park outdoor green zone or fallback
const DEFAULT_COORDS = { lat: 40.785091, lng: -73.968285 };

const BOT_NAMES = ['Ghost', 'Viper', 'Shadow', 'Spectre', 'Echo', 'Phantom', 'Tracker', 'Recon'];

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>('LOBBY');
  const [roomCode, setRoomCode] = useState<string>('PULSE8');
  const [currentUser, setCurrentUser] = useState<Player | null>({
    id: 'player_host',
    name: 'Operator-1',
    role: 'DENNER',
    status: 'ACTIVE',
    isHost: true,
    latitude: DEFAULT_COORDS.lat,
    longitude: DEFAULT_COORDS.lng,
  });

  const [players, setPlayers] = useState<Player[]>([
    {
      id: 'player_host',
      name: 'Operator-1',
      role: 'DENNER',
      status: 'ACTIVE',
      isHost: true,
      latitude: DEFAULT_COORDS.lat,
      longitude: DEFAULT_COORDS.lng,
    },
    {
      id: 'bot_1',
      name: 'Ghost (AI)',
      role: 'HIDER',
      status: 'ACTIVE',
      isHost: false,
      isBot: true,
      latitude: DEFAULT_COORDS.lat + 0.0012,
      longitude: DEFAULT_COORDS.lng + 0.0008,
    },
    {
      id: 'bot_2',
      name: 'Viper (AI)',
      role: 'HIDER',
      status: 'ACTIVE',
      isHost: false,
      isBot: true,
      latitude: DEFAULT_COORDS.lat - 0.0015,
      longitude: DEFAULT_COORDS.lng + 0.0011,
    },
    {
      id: 'bot_3',
      name: 'Shadow (AI)',
      role: 'HIDER',
      status: 'ACTIVE',
      isHost: false,
      isBot: true,
      latitude: DEFAULT_COORDS.lat + 0.0007,
      longitude: DEFAULT_COORDS.lng - 0.0014,
    },
  ]);

  const [headStartMinutes, setHeadStartMinutes] = useState<number>(3);
  const [gameDurationMinutes, setGameDurationMinutes] = useState<number>(30);
  const [remainingHeadStartSeconds, setRemainingHeadStartSeconds] = useState<number>(180);
  const [remainingGameSeconds, setRemainingGameSeconds] = useState<number>(1800);
  const [cycleSeconds, setCycleSeconds] = useState<number>(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>({
    lat: DEFAULT_COORDS.lat,
    lng: DEFAULT_COORDS.lng,
    accuracy: 10,
  });

  const [gameOverData, setGameOverData] = useState<{ winner: 'DENNER' | 'HIDERS' | null; reason: string } | null>(null);
  const [botMovementActive, setBotMovementActive] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const prevPhaseRef = useRef<string>('SAFE');
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Cross-tab synchronization via BroadcastChannel
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(`shadowpulse_${roomCode}`);
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'SYNC_STATE') {
          // If message is from another host or player
          if (payload.gameState && payload.gameState !== gameState) {
            setGameState(payload.gameState);
          }
          if (payload.players) {
            setPlayers(payload.players);
          }
        } else if (type === 'MARK_FOUND') {
          setPlayers((prev) =>
            prev.map((p) => (p.id === payload.playerId ? { ...p, status: 'FOUND' } : p))
          );
        }
      };

      return () => {
        channel.close();
      };
    }
  }, [roomCode, gameState]);

  const broadcast = useCallback((type: string, payload: any) => {
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type, payload });
      } catch {
        // ignore
      }
    }
  }, []);

  // Real GPS Geolocation Watcher
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude, accuracy });
        // Update current user location in players array
        setCurrentUser((prev) => (prev ? { ...prev, latitude, longitude } : null));
        setPlayers((prev) =>
          prev.map((p) => (p.id === currentUser?.id ? { ...p, latitude, longitude } : p))
        );
      },
      (err) => {
        // Browser refused or geolocation timed out; keep current default coords
        console.log('GPS watch status:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [currentUser?.id]);

  // Main Game Clock Loop (1-second tick)
  useEffect(() => {
    if (gameState === 'LOBBY' || gameState === 'ROLE_REVEAL' || gameState === 'GAME_OVER') {
      return;
    }

    const interval = setInterval(() => {
      if (gameState === 'HIDING') {
        setRemainingHeadStartSeconds((prev) => {
          if (prev <= 1) {
            // Head start complete! Transition to ACTIVE_SEEKING
            setGameState('ACTIVE_SEEKING');
            setCycleSeconds(0);
            soundManager.playRevealAlarm();
            soundManager.triggerVibration([300, 150, 300]);
            return 0;
          }
          return prev - 1;
        });
      } else if (gameState === 'ACTIVE_SEEKING') {
        // Decrement overall game timer
        setRemainingGameSeconds((prev) => {
          const next = Math.max(0, prev - 1);
          return next;
        });

        // Increment 5-minute radar cycle (0 to 310s)
        setCycleSeconds((prev) => {
          const next = (prev + 1) % TOTAL_CYCLE_SECONDS;
          return next;
        });

        // Wander simulated bot players if active
        if (botMovementActive) {
          setPlayers((prevPlayers) =>
            prevPlayers.map((p) => {
              if (!p.isBot || p.status === 'FOUND') return p;
              // realistic GPS drift: ~1-2 meters
              const dLat = (Math.random() - 0.5) * 0.00012;
              const dLng = (Math.random() - 0.5) * 0.00012;
              return {
                ...p,
                latitude: p.latitude + dLat,
                longitude: p.longitude + dLng,
              };
            })
          );
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, botMovementActive]);

  // Derive radar state from current cycle second
  const radarState = getRadarPhaseState(cycleSeconds);

  // Check Win / Loss condition whenever players or remainingGameSeconds change during seeking
  useEffect(() => {
    if (gameState !== 'ACTIVE_SEEKING') return;

    const result = checkGameEnd(players, remainingGameSeconds);
    if (result.isGameOver) {
      setGameState('GAME_OVER');
      setGameOverData({ winner: result.winner, reason: result.reason });
      soundManager.playVictoryFanfare();
      soundManager.triggerVibration([500, 200, 500, 200, 500]);
    }
  }, [players, remainingGameSeconds, gameState]);

  // Audio & Haptic Alerts for Radar Phase Transitions
  useEffect(() => {
    if (gameState !== 'ACTIVE_SEEKING') return;

    // Trigger Warning alerts
    if (radarState.phase === 'WARNING') {
      if (prevPhaseRef.current !== 'WARNING') {
        soundManager.playWarningBeep(850);
        soundManager.triggerVibration([200, 100, 200]);
      } else if (radarState.warningCountdown <= 5 && radarState.warningCountdown > 0) {
        // Beep each of the final 5 seconds
        soundManager.playWarningBeep(900 + (5 - radarState.warningCountdown) * 80);
      }
    }

    // Trigger Reveal Flash alert
    if (radarState.phase === 'REVEAL') {
      if (prevPhaseRef.current !== 'REVEAL') {
        soundManager.playRevealAlarm();
        soundManager.triggerVibration([400, 200, 400]);
      }
    }

    prevPhaseRef.current = radarState.phase;
  }, [radarState.phase, radarState.warningCountdown, gameState]);

  // Actions
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setSoundEnabled(next);
  };

  const createRoom = (hostName: string) => {
    const code = generateRoomCode();
    setRoomCode(code);
    const hostPlayer: Player = {
      id: `p_${Date.now()}`,
      name: hostName.trim() || 'Host Operator',
      role: 'DENNER',
      status: 'ACTIVE',
      isHost: true,
      latitude: userLocation?.lat || DEFAULT_COORDS.lat,
      longitude: userLocation?.lng || DEFAULT_COORDS.lng,
    };
    setCurrentUser(hostPlayer);
    setPlayers([
      hostPlayer,
      {
        id: 'bot_1',
        name: 'Ghost (AI)',
        role: 'HIDER',
        status: 'ACTIVE',
        isHost: false,
        isBot: true,
        latitude: (userLocation?.lat || DEFAULT_COORDS.lat) + 0.0012,
        longitude: (userLocation?.lng || DEFAULT_COORDS.lng) + 0.0008,
      },
      {
        id: 'bot_2',
        name: 'Viper (AI)',
        role: 'HIDER',
        status: 'ACTIVE',
        isHost: false,
        isBot: true,
        latitude: (userLocation?.lat || DEFAULT_COORDS.lat) - 0.0014,
        longitude: (userLocation?.lng || DEFAULT_COORDS.lng) + 0.001,
      },
    ]);
    setGameState('LOBBY');
  };

  const joinRoom = (code: string, playerName: string): boolean => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return false;
    setRoomCode(cleanCode);
    const newPlayer: Player = {
      id: `p_${Date.now()}`,
      name: playerName.trim() || `Player-${Math.floor(Math.random() * 100)}`,
      role: 'HIDER',
      status: 'ACTIVE',
      isHost: false,
      latitude: (userLocation?.lat || DEFAULT_COORDS.lat) + (Math.random() - 0.5) * 0.002,
      longitude: (userLocation?.lng || DEFAULT_COORDS.lng) + (Math.random() - 0.5) * 0.002,
    };
    setCurrentUser(newPlayer);
    setPlayers((prev) => [...prev, newPlayer]);
    setGameState('LOBBY');
    return true;
  };

  const startGame = () => {
    // Random Denner selection
    const randomized = assignRandomDenner(players);
    setPlayers(randomized);

    // Update current user role
    const me = randomized.find((p) => p.id === currentUser?.id);
    if (me) {
      setCurrentUser(me);
    }

    setRemainingHeadStartSeconds(headStartMinutes * 60);
    setRemainingGameSeconds(gameDurationMinutes * 60);
    setCycleSeconds(0);
    setGameState('ROLE_REVEAL');
    soundManager.playRadarBlip();

    broadcast('SYNC_STATE', { gameState: 'ROLE_REVEAL', players: randomized });
  };

  const dismissRoleReveal = () => {
    setGameState('HIDING');
    broadcast('SYNC_STATE', { gameState: 'HIDING' });
  };

  const markPlayerFound = (playerId: string) => {
    setPlayers((prev) => {
      const updated = prev.map((p) =>
        p.id === playerId ? { ...p, status: 'FOUND' as const, lastFoundAt: Date.now() } : p
      );
      return updated;
    });

    if (currentUser?.id === playerId) {
      setCurrentUser((prev) => (prev ? { ...prev, status: 'FOUND' } : null));
    }

    soundManager.playFoundChime();
    soundManager.triggerVibration([250, 100, 250]);
    broadcast('MARK_FOUND', { playerId });
  };

  const restartGame = () => {
    setGameState('LOBBY');
    setGameOverData(null);
    setRemainingHeadStartSeconds(headStartMinutes * 60);
    setRemainingGameSeconds(gameDurationMinutes * 60);
    setCycleSeconds(0);
    setPlayers((prev) =>
      prev.map((p) => ({ ...p, status: 'ACTIVE' as const, role: p.isHost ? 'DENNER' : 'HIDER' }))
    );
  };

  const leaveRoom = () => {
    setGameState('LOBBY');
    setRoomCode(generateRoomCode());
  };

  // Developer & Simulation Controls
  const switchViewRole = (newRole: Role, newStatus: PlayerStatus = 'ACTIVE') => {
    if (!currentUser) return;
    const updated: Player = {
      ...currentUser,
      role: newRole,
      status: newStatus,
    };
    setCurrentUser(updated);
    setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const skipToBeforeReveal = () => {
    setGameState('ACTIVE_SEEKING');
    setRemainingHeadStartSeconds(0);
    // Skip to 265s (5 seconds before the 30-second warning at 270s)
    // This allows testing the warning countdown (30s) and subsequent 10s reveal immediately!
    setCycleSeconds(265);
    soundManager.playRadarBlip();
  };

  const forceImmediateReveal = () => {
    setGameState('ACTIVE_SEEKING');
    setRemainingHeadStartSeconds(0);
    // Jump straight to 300s (beginning of 10s flash)
    setCycleSeconds(300);
    soundManager.playRevealAlarm();
  };

  const addSimulatedBot = () => {
    const nextName = BOT_NAMES[players.filter((p) => p.isBot).length % BOT_NAMES.length];
    const newBot: Player = {
      id: `bot_${Date.now()}`,
      name: `${nextName} (AI)`,
      role: 'HIDER',
      status: 'ACTIVE',
      isHost: false,
      isBot: true,
      latitude: (userLocation?.lat || DEFAULT_COORDS.lat) + (Math.random() - 0.5) * 0.003,
      longitude: (userLocation?.lng || DEFAULT_COORDS.lng) + (Math.random() - 0.5) * 0.003,
    };
    setPlayers((prev) => [...prev, newBot]);
  };

  const removePlayer = (playerId: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
  };

  const toggleBotMovement = () => {
    setBotMovementActive((prev) => !prev);
  };

  const setUserCoordinates = (lat: number, lng: number) => {
    setUserLocation({ lat, lng, accuracy: 5 });
    setCurrentUser((prev) => (prev ? { ...prev, latitude: lat, longitude: lng } : null));
    setPlayers((prev) =>
      prev.map((p) => (p.id === currentUser?.id ? { ...p, latitude: lat, longitude: lng } : p))
    );
  };

  const isHost = Boolean(currentUser?.isHost);

  return (
    <GameContext.Provider
      value={{
        gameState,
        roomCode,
        currentUser,
        players,
        isHost,
        headStartMinutes,
        gameDurationMinutes,
        remainingHeadStartSeconds,
        remainingGameSeconds,
        cycleSeconds,
        radarState,
        userLocation,
        gameOverData,
        botMovementActive,
        soundEnabled,
        toggleSound,
        createRoom,
        joinRoom,
        setHeadStartMinutes,
        setGameDurationMinutes,
        startGame,
        dismissRoleReveal,
        markPlayerFound,
        restartGame,
        leaveRoom,
        switchViewRole,
        skipToBeforeReveal,
        forceImmediateReveal,
        addSimulatedBot,
        removePlayer,
        toggleBotMovement,
        setUserCoordinates,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

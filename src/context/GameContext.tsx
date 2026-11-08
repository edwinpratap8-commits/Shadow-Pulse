import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Player,
  Role,
  PlayerStatus,
  RadarPhaseState,
  getRadarPhaseState,
  generateRoomCode,
  calculateDistanceMeters,
  Checkpoint,
  RadioTransmission,
  RadioTargetType,
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
  pingIntervalSeconds: number;
  revealDurationSeconds: number;
  remainingHeadStartSeconds: number;
  remainingGameSeconds: number;
  cycleSeconds: number;
  radarState: RadarPhaseState;
  userLocation: { lat: number; lng: number; accuracy: number } | null;
  gameOverData: { winner: 'DENNER' | 'HIDERS' | null; reason: string } | null;
  botMovementActive: boolean;
  soundEnabled: boolean;
  isSyncing: boolean;
  shareableUrl: string;
  toggleSound: () => void;
  updatePlayerName: (newName: string) => Promise<void>;
  pendingInviteCode: string | null;
  setPendingInviteCode: (code: string | null) => void;
  // Tactical Radio Comm-Link System
  radioTarget: { type: RadioTargetType; targetPlayerId?: string; targetPlayerName?: string };
  setRadioTarget: (target: { type: RadioTargetType; targetPlayerId?: string; targetPlayerName?: string }) => void;
  activeRadioSpeaker: { name: string; targetType: RadioTargetType; isDirect: boolean } | null;
  lastRadioTransmission: RadioTransmission | null;
  transmitVoiceBurst: (audioData: string, durationMs: number) => Promise<boolean>;
  // Checkpoints Objective System
  activeCheckpointZone: Checkpoint | null;
  checkpointRemainingSec: number;
  completeCheckpoint: (checkpointId: string) => Promise<void>;
  // Game Actions
  createRoom: (hostName: string) => Promise<void>;
  joinRoom: (code: string, playerName: string) => Promise<boolean>;
  setHeadStartMinutes: (mins: number) => void;
  setGameDurationMinutes: (mins: number) => void;
  setPingIntervalSeconds: (secs: number) => void;
  setRevealDurationSeconds: (secs: number) => void;
  startGame: () => void;
  dismissRoleReveal: () => void;
  markPlayerFound: (playerId: string) => void;
  requestCapture: (targetId: string) => void;
  confirmCapture: (playerId: string) => void;
  disputeCapture: (playerId: string) => void;
  accelerateCooldown: (playerId: string) => void;
  restartGame: () => void;
  leaveRoom: () => void;
  // Dev & Simulation Actions
  switchViewRole: (newRole: Role, newStatus?: PlayerStatus) => void;
  forceImmediateReveal: () => void;
  addSimulatedBot: () => void;
  removePlayer: (playerId: string) => void;
  toggleBotMovement: () => void;
  setUserCoordinates: (lat: number, lng: number) => void;
}

const GameContext = createContext<GameContextType | null>(null);

// JNTUH Campus, Hyderabad Default Center
const DEFAULT_COORDS = { lat: 17.4933, lng: 78.3914 };

const getInitialCoords = () => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('shadowpulse_last_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number' && !isNaN(parsed.lat)) {
          return { lat: parsed.lat, lng: parsed.lng };
        }
      }
    } catch {}
  }
  return DEFAULT_COORDS;
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>('LOBBY');
  const [roomCode, setRoomCode] = useState<string>('PULSE8');

  // Load persistent user profile from localStorage if available
  const [currentUser, setCurrentUser] = useState<Player | null>(() => {
    const coords = getInitialCoords();
    if (typeof window !== 'undefined') {
      const storedId = localStorage.getItem('shadowpulse_uid') || `player_${Date.now()}`;
      const storedName = localStorage.getItem('shadowpulse_uname') || 'Operative-1';
      localStorage.setItem('shadowpulse_uid', storedId);
      return {
        id: storedId,
        name: storedName,
        role: 'DENNER',
        status: 'ACTIVE',
        isHost: true,
        latitude: coords.lat,
        longitude: coords.lng,
      };
    }
    return null;
  });

  const [players, setPlayers] = useState<Player[]>([]);
  const [headStartMinutes, setHeadStartMinutesState] = useState<number>(3);
  const [gameDurationMinutes, setGameDurationMinutesState] = useState<number>(30);
  const [pingIntervalSeconds, setPingIntervalSecondsState] = useState<number>(300);
  const [revealDurationSeconds, setRevealDurationSecondsState] = useState<number>(10);
  const [remainingHeadStartSeconds, setRemainingHeadStartSeconds] = useState<number>(180);
  const [remainingGameSeconds, setRemainingGameSeconds] = useState<number>(1800);
  const [cycleSeconds, setCycleSeconds] = useState<number>(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(() => {
    const coords = getInitialCoords();
    return {
      lat: coords.lat,
      lng: coords.lng,
      accuracy: 10,
    };
  });

  const [gameOverData, setGameOverData] = useState<{ winner: 'DENNER' | 'HIDERS' | null; reason: string } | null>(null);
  const [botMovementActive, setBotMovementActive] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);

  // Checkpoints Objective State
  const [activeCheckpointZone, setActiveCheckpointZone] = useState<Checkpoint | null>(null);
  const [checkpointRemainingSec, setCheckpointRemainingSec] = useState<number>(20);
  const checkpointIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Tactical Radio State
  const [radioTarget, setRadioTarget] = useState<{
    type: RadioTargetType;
    targetPlayerId?: string;
    targetPlayerName?: string;
  }>({ type: 'GROUP' });

  const [activeRadioSpeaker, setActiveRadioSpeaker] = useState<{
    name: string;
    targetType: RadioTargetType;
    isDirect: boolean;
  } | null>(null);

  const [lastRadioTransmission, setLastRadioTransmission] = useState<RadioTransmission | null>(null);
  const lastRadioSyncRef = useRef<number>(Date.now());

  const prevGameStateRef = useRef<GameState>('LOBBY');
  const prevPhaseRef = useRef<string>('SAFE');
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastCoordsSentRef = useRef<number>(0);

  const playIncomingTransmission = useCallback((transmission: RadioTransmission) => {
    if (!currentUser || currentUser.role !== 'HIDER' || currentUser.status !== 'ACTIVE') {
      return;
    }

    setLastRadioTransmission(transmission);
    soundManager.playRadioIncomingBeep();

    setActiveRadioSpeaker({
      name: transmission.senderName,
      targetType: transmission.targetType,
      isDirect: transmission.targetType === 'DIRECT',
    });

    try {
      const audio = new Audio(transmission.audioData);
      audio.onended = () => {
        soundManager.playRadioTransmissionEnd();
        setActiveRadioSpeaker(null);
      };
      audio.onerror = () => {
        setActiveRadioSpeaker(null);
      };
      audio.play().catch(() => {
        setActiveRadioSpeaker(null);
      });
    } catch {
      setActiveRadioSpeaker(null);
    }
  }, [currentUser]);

  // Helper to trigger remote action on backend
  const sendRoomAction = useCallback(
    async (action: string, payload?: any) => {
      try {
        await fetch(`/api/rooms/${roomCode}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, payload }),
        });
      } catch (err) {
        console.error('Failed to send room action:', action, err);
      }
    },
    [roomCode]
  );

  // Process room state from backend (via SSE or polling)
  const applyRoomData = useCallback(
    (room: any) => {
      if (!room) return;

      // Update room state
      if (room.gameState !== undefined) {
        if (room.gameState !== prevGameStateRef.current) {
          if (room.gameState === 'ROLE_REVEAL') {
            soundManager.playRadarBlip();
          } else if (room.gameState === 'ACTIVE_SEEKING') {
            soundManager.playRevealAlarm();
          } else if (room.gameState === 'GAME_OVER') {
            soundManager.playVictoryFanfare();
          }
          prevGameStateRef.current = room.gameState;
        }
        setGameState(room.gameState);
      }

      if (room.players && Array.isArray(room.players)) {
        setPlayers(room.players);

        // Update current user role / status / host / name from server state
        if (currentUser) {
          const serverMe = room.players.find((p: Player) => p.id === currentUser.id);
          if (serverMe) {
            setCurrentUser((prev) =>
              prev
                ? {
                    ...prev,
                    name: serverMe.name,
                    role: serverMe.role,
                    status: serverMe.status,
                    isHost: serverMe.isHost,
                    pendingCapture: serverMe.pendingCapture,
                    cooldownRemainingSec: serverMe.cooldownRemainingSec,
                    checkpoints: serverMe.checkpoints,
                  }
                : null
            );
          }
        }
      }

      if (room.headStartMinutes !== undefined) setHeadStartMinutesState(room.headStartMinutes);
      if (room.gameDurationMinutes !== undefined) setGameDurationMinutesState(room.gameDurationMinutes);
      if (room.pingIntervalSeconds !== undefined) setPingIntervalSecondsState(room.pingIntervalSeconds);
      if (room.revealDurationSeconds !== undefined) setRevealDurationSecondsState(room.revealDurationSeconds);
      if (room.remainingHeadStartSeconds !== undefined) setRemainingHeadStartSeconds(room.remainingHeadStartSeconds);
      if (room.remainingGameSeconds !== undefined) setRemainingGameSeconds(room.remainingGameSeconds);
      if (room.cycleSeconds !== undefined) setCycleSeconds(room.cycleSeconds);
      if (room.gameOverData !== undefined) setGameOverData(room.gameOverData);
      setIsSyncing(false);
    },
    [currentUser?.id]
  );

  // Connect to Real-Time Server-Sent Events (SSE) for the active room
  useEffect(() => {
    if (typeof window === 'undefined' || !roomCode) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const myId = currentUser?.id || '';
    const sseUrl = `/api/rooms/${roomCode}/events?playerId=${encodeURIComponent(myId)}`;
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsSyncing(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const roomData = JSON.parse(event.data);
        applyRoomData(roomData);
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    const handleRadioEvent = (event: MessageEvent) => {
      try {
        const transmission: RadioTransmission = JSON.parse(event.data);
        lastRadioSyncRef.current = Math.max(lastRadioSyncRef.current, transmission.timestamp);
        playIncomingTransmission(transmission);
      } catch (err) {
        console.error('Radio transmission parse error:', err);
      }
    };

    eventSource.addEventListener('radio_transmission', handleRadioEvent as EventListener);

    eventSource.onerror = () => {
      // Reconnection will automatically be attempted by browser EventSource
      setIsSyncing(true);
    };

    // Heartbeat polling fallback every 2 seconds for ultra-reliability across network hops
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${roomCode}`);
        if (res.ok) {
          const data = await res.json();
          if (data.room) {
            applyRoomData(data.room);
          }
        }

        // Backup sync for radio transmissions if active hider
        if (currentUser?.role === 'HIDER' && currentUser.status === 'ACTIVE') {
          const radioRes = await fetch(
            `/api/rooms/${roomCode}/radio?playerId=${currentUser.id}&since=${lastRadioSyncRef.current}`
          );
          if (radioRes.ok) {
            const rData = await radioRes.json();
            if (rData.transmissions && Array.isArray(rData.transmissions) && rData.transmissions.length > 0) {
              for (const t of rData.transmissions) {
                lastRadioSyncRef.current = Math.max(lastRadioSyncRef.current, t.timestamp);
                playIncomingTransmission(t);
              }
            }
          }
        }
      } catch {
        // network dip
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.removeEventListener('radio_transmission', handleRadioEvent as EventListener);
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [roomCode, applyRoomData, currentUser?.id, currentUser?.role, currentUser?.status, playIncomingTransmission]);

  // Read URL query parameter ?room=XYZ on initial load
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const paramRoom = urlParams.get('room') || urlParams.get('join') || urlParams.get('code');

    if (paramRoom && paramRoom.trim()) {
      const cleanParam = paramRoom.trim().toUpperCase();
      setPendingInviteCode(cleanParam);
    } else {
      // Auto-join or initialize default room on backend
      const storedName = localStorage.getItem('shadowpulse_uname') || 'Operator-1';
      joinRoom(roomCode, storedName);
    }
  }, []);

  const prevCoordRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  // Real GPS Geolocation Watcher with Outlier & Jitter Smoothing (Fixes location jumping)
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        // 1. Filter out excessively poor accuracy (>90 meters) if an established fix already exists
        if (accuracy > 90 && prevCoordRef.current) {
          return;
        }

        let filteredLat = latitude;
        let filteredLng = longitude;
        const now = Date.now();

        if (prevCoordRef.current) {
          const dist = calculateDistanceMeters(
            prevCoordRef.current.lat,
            prevCoordRef.current.lng,
            latitude,
            longitude
          );

          const dtSeconds = Math.max(0.1, (now - prevCoordRef.current.time) / 1000);
          const speedMps = dist / dtSeconds;

          // 2. Deadband: If user moved less than 1.8m, ignore stationary sensor jitter
          if (dist < 1.8) {
            filteredLat = prevCoordRef.current.lat;
            filteredLng = prevCoordRef.current.lng;
          } else if (speedMps > 30) {
            // 3. Outlier Clamp: User moved faster than 108 km/h on foot! Smooth the jump
            filteredLat = prevCoordRef.current.lat * 0.85 + latitude * 0.15;
            filteredLng = prevCoordRef.current.lng * 0.85 + longitude * 0.15;
          } else {
            // 4. Exponential Moving Average to smooth jitter
            filteredLat = prevCoordRef.current.lat * 0.45 + latitude * 0.55;
            filteredLng = prevCoordRef.current.lng * 0.45 + longitude * 0.55;
          }
        }

        prevCoordRef.current = { lat: filteredLat, lng: filteredLng, time: now };

        try {
          localStorage.setItem(
            'shadowpulse_last_pos',
            JSON.stringify({ lat: filteredLat, lng: filteredLng })
          );
        } catch {}

        setUserLocation({ lat: filteredLat, lng: filteredLng, accuracy });
        setCurrentUser((prev) => (prev ? { ...prev, latitude: filteredLat, longitude: filteredLng } : null));

        // Throttle coordinate transmission to server (at most once every 1.5 seconds)
        if (now - lastCoordsSentRef.current > 1500 && currentUser?.id) {
          lastCoordsSentRef.current = now;
          fetch(`/api/rooms/${roomCode}/coords`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId: currentUser.id,
              lat: filteredLat,
              lng: filteredLng,
            }),
          }).catch(() => {});
        }
      },
      (err) => {
        console.log('GPS watch status:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [currentUser?.id, roomCode]);

  // Derive radar state from current cycle second and custom intervals
  const radarState = getRadarPhaseState(cycleSeconds, pingIntervalSeconds, revealDurationSeconds);

  // Audio & Haptic Alerts for Radar Phase Transitions
  useEffect(() => {
    if (gameState !== 'ACTIVE_SEEKING') return;

    if (radarState.phase === 'WARNING') {
      if (prevPhaseRef.current !== 'WARNING') {
        soundManager.playWarningBeep(850);
        soundManager.triggerVibration([200, 100, 200]);
      } else if (radarState.warningCountdown <= 5 && radarState.warningCountdown > 0) {
        soundManager.playWarningBeep(900 + (5 - radarState.warningCountdown) * 80);
      }
    }

    if (radarState.phase === 'REVEAL') {
      if (prevPhaseRef.current !== 'REVEAL') {
        soundManager.playRevealAlarm();
        soundManager.triggerVibration([400, 200, 400]);
      }
    }

    prevPhaseRef.current = radarState.phase;
  }, [radarState.phase, radarState.warningCountdown, gameState]);

  // Checkpoint Proximity Monitoring for Active Hiders
  useEffect(() => {
    if (
      !currentUser ||
      currentUser.role !== 'HIDER' ||
      currentUser.status !== 'ACTIVE' ||
      !currentUser.checkpoints ||
      currentUser.checkpoints.length === 0 ||
      (gameState !== 'HIDING' && gameState !== 'ACTIVE_SEEKING')
    ) {
      setActiveCheckpointZone(null);
      setCheckpointRemainingSec(20);
      return;
    }

    const myLat = currentUser.latitude;
    const myLng = currentUser.longitude;

    // Check if player is within 50m of an incomplete checkpoint
    const candidate = currentUser.checkpoints.find((cp) => {
      if (cp.completed) return false;
      const dist = calculateDistanceMeters(myLat, myLng, cp.latitude, cp.longitude);
      return dist <= cp.radiusMeters;
    });

    if (candidate) {
      setActiveCheckpointZone(candidate);
    } else {
      setActiveCheckpointZone(null);
      setCheckpointRemainingSec(20);
    }
  }, [
    currentUser?.latitude,
    currentUser?.longitude,
    currentUser?.checkpoints,
    currentUser?.role,
    currentUser?.status,
    gameState,
  ]);

  // 20-second continuous timer inside checkpoint
  useEffect(() => {
    if (!activeCheckpointZone || !currentUser) {
      if (checkpointIntervalRef.current) {
        clearInterval(checkpointIntervalRef.current);
        checkpointIntervalRef.current = null;
      }
      return;
    }

    checkpointIntervalRef.current = setInterval(() => {
      setCheckpointRemainingSec((prev) => {
        soundManager.playCheckpointTick();
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(40);
        }

        if (prev <= 1) {
          // Checkpoint Complete!
          soundManager.playCheckpointSecured();
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([150, 75, 250]);
          }
          sendRoomAction('COMPLETE_CHECKPOINT', {
            playerId: currentUser.id,
            checkpointId: activeCheckpointZone.id,
          });
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (checkpointIntervalRef.current) {
        clearInterval(checkpointIntervalRef.current);
        checkpointIntervalRef.current = null;
      }
    };
  }, [activeCheckpointZone?.id, currentUser?.id]);

  // Actions
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setSoundEnabled(next);
  };

  const createRoom = async (hostName: string) => {
    const code = generateRoomCode();
    const actualHostName = hostName.trim() || 'Host Operator';
    const myId = currentUser?.id || `p_${Date.now()}`;

    if (typeof window !== 'undefined') {
      localStorage.setItem('shadowpulse_uname', actualHostName);
    }

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: code,
          hostName: actualHostName,
          hostId: myId,
          lat: userLocation?.lat || DEFAULT_COORDS.lat,
          lng: userLocation?.lng || DEFAULT_COORDS.lng,
          headStartMinutes,
          gameDurationMinutes,
          pingIntervalSeconds,
          revealDurationSeconds,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRoomCode(code);
        setCurrentUser(data.player);
        applyRoomData(data.room);
      }
    } catch (e) {
      console.error('Create room error:', e);
      setRoomCode(code);
    }
  };

  const joinRoom = async (code: string, playerName: string): Promise<boolean> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return false;
    const actualName = playerName.trim() || `Operative-${Math.floor(Math.random() * 100)}`;
    const myId = currentUser?.id || `p_${Date.now()}`;

    if (typeof window !== 'undefined') {
      localStorage.setItem('shadowpulse_uname', actualName);
    }

    try {
      const res = await fetch(`/api/rooms/${cleanCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: actualName,
          playerId: myId,
          lat: userLocation?.lat || DEFAULT_COORDS.lat,
          lng: userLocation?.lng || DEFAULT_COORDS.lng,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRoomCode(cleanCode);
        setCurrentUser(data.player);
        applyRoomData(data.room);
        return true;
      }
    } catch (e) {
      console.error('Join room error:', e);
    }

    return false;
  };

  const updatePlayerName = async (newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName || !currentUser) return;

    if (typeof window !== 'undefined') {
      localStorage.setItem('shadowpulse_uname', cleanName);
    }

    setCurrentUser((prev) => (prev ? { ...prev, name: cleanName } : null));
    setPlayers((prev) =>
      prev.map((p) => (p.id === currentUser.id ? { ...p, name: cleanName } : p))
    );

    await sendRoomAction('UPDATE_PLAYER_NAME', {
      playerId: currentUser.id,
      newName: cleanName,
    });
  };

  const setHeadStartMinutes = (mins: number) => {
    setHeadStartMinutesState(mins);
    sendRoomAction('UPDATE_TIMERS', {
      headStartMinutes: mins,
      gameDurationMinutes,
      pingIntervalSeconds,
      revealDurationSeconds,
    });
  };

  const setGameDurationMinutes = (mins: number) => {
    setGameDurationMinutesState(mins);
    sendRoomAction('UPDATE_TIMERS', {
      headStartMinutes,
      gameDurationMinutes: mins,
      pingIntervalSeconds,
      revealDurationSeconds,
    });
  };

  const setPingIntervalSeconds = (secs: number) => {
    setPingIntervalSecondsState(secs);
    sendRoomAction('UPDATE_TIMERS', {
      headStartMinutes,
      gameDurationMinutes,
      pingIntervalSeconds: secs,
      revealDurationSeconds,
    });
  };

  const setRevealDurationSeconds = (secs: number) => {
    setRevealDurationSecondsState(secs);
    sendRoomAction('UPDATE_TIMERS', {
      headStartMinutes,
      gameDurationMinutes,
      pingIntervalSeconds,
      revealDurationSeconds: secs,
    });
  };

  const startGame = () => {
    sendRoomAction('START_GAME');
  };

  const dismissRoleReveal = () => {
    sendRoomAction('DISMISS_REVEAL');
  };

  const requestCapture = (targetId: string) => {
    if (!currentUser) return;
    sendRoomAction('REQUEST_CAPTURE', {
      targetId,
      seekerId: currentUser.id,
      seekerName: currentUser.name,
    });
    soundManager.playFoundChime();
    soundManager.triggerVibration([250, 100, 250]);
  };

  const confirmCapture = (playerId: string) => {
    sendRoomAction('CONFIRM_CAPTURE', { playerId });
    soundManager.playFoundChime();
    soundManager.triggerVibration([400, 200, 400]);
  };

  const disputeCapture = (playerId: string) => {
    sendRoomAction('DISPUTE_CAPTURE', { playerId });
    soundManager.playRadarBlip();
  };

  const accelerateCooldown = (playerId: string) => {
    sendRoomAction('ACCELERATE_COOLDOWN', { playerId });
  };

  const markPlayerFound = (playerId: string) => {
    requestCapture(playerId);
  };

  const restartGame = () => {
    sendRoomAction('RESTART_GAME');
  };

  const leaveRoom = () => {
    createRoom('Host Operator');
  };

  const switchViewRole = (newRole: Role, newStatus: PlayerStatus = 'ACTIVE') => {
    if (!currentUser) return;
    sendRoomAction('SWITCH_VIEW_ROLE', {
      playerId: currentUser.id,
      role: newRole,
      status: newStatus,
    });
  };

  const completeCheckpoint = async (checkpointId: string) => {
    if (!currentUser) return;
    soundManager.playCheckpointSecured();
    await sendRoomAction('COMPLETE_CHECKPOINT', {
      playerId: currentUser.id,
      checkpointId,
    });
  };

  const forceImmediateReveal = () => {
    sendRoomAction('DEBUG_TRIGGER_10S');
    soundManager.playRevealAlarm();
  };

  const addSimulatedBot = () => {
    sendRoomAction('ADD_BOT');
  };

  const removePlayer = (playerId: string) => {
    sendRoomAction('REMOVE_PLAYER', { playerId });
  };

  const toggleBotMovement = () => {
    setBotMovementActive((prev) => !prev);
  };

  const setUserCoordinates = (lat: number, lng: number) => {
    setUserLocation({ lat, lng, accuracy: 5 });
    if (currentUser?.id) {
      fetch(`/api/rooms/${roomCode}/coords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: currentUser.id, lat, lng }),
      }).catch(() => {});
    }
  };

  const transmitVoiceBurst = async (audioData: string, durationMs: number): Promise<boolean> => {
    if (!currentUser || currentUser.role !== 'HIDER' || currentUser.status !== 'ACTIVE') {
      return false;
    }
    try {
      const res = await fetch(`/api/rooms/${roomCode}/radio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          senderName: currentUser.name,
          targetType: radioTarget.type,
          targetPlayerId: radioTarget.targetPlayerId,
          audioData,
          durationMs,
        }),
      });
      return res.ok;
    } catch (err) {
      console.error('Radio transmit error:', err);
      return false;
    }
  };

  const isHost = Boolean(currentUser?.isHost);

  const shareableUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?room=${roomCode}`
      : `https://shadowpulse.app/?room=${roomCode}`;

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
        pingIntervalSeconds,
        revealDurationSeconds,
        remainingHeadStartSeconds,
        remainingGameSeconds,
        cycleSeconds,
        radarState,
        userLocation,
        gameOverData,
        botMovementActive,
        soundEnabled,
        isSyncing,
        shareableUrl,
        pendingInviteCode,
        setPendingInviteCode,
        radioTarget,
        setRadioTarget,
        activeRadioSpeaker,
        lastRadioTransmission,
        transmitVoiceBurst,
        activeCheckpointZone,
        checkpointRemainingSec,
        completeCheckpoint,
        toggleSound,
        updatePlayerName,
        createRoom,
        joinRoom,
        setHeadStartMinutes,
        setGameDurationMinutes,
        setPingIntervalSeconds,
        setRevealDurationSeconds,
        startGame,
        dismissRoleReveal,
        markPlayerFound,
        requestCapture,
        confirmCapture,
        disputeCapture,
        accelerateCooldown,
        restartGame,
        leaveRoom,
        switchViewRole,
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

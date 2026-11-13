import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Player,
  Role,
  PlayerStatus,
  RadarPhaseState,
  getRadarPhaseState,
  generateRoomCode,
  calculateDistanceMeters,
  isValidCoordinate,
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
  // Tactical Radio Comm-Link System (Server-Relayed Walkie-Talkie & Quick-Comms)
  radioTarget: { type: RadioTargetType; targetPlayerId?: string; targetPlayerName?: string };
  setRadioTarget: (target: { type: RadioTargetType; targetPlayerId?: string; targetPlayerName?: string }) => void;
  activeRadioSpeaker: { name: string; targetType: RadioTargetType; isDirect: boolean } | null;
  lastRadioTransmission: RadioTransmission | null;
  radioHistory: RadioTransmission[];
  playingTransmissionId: string | null;
  audioUnlocked: boolean;
  unlockAudio: () => void;
  transmitVoiceBurst: (audioData: string, durationMs: number) => Promise<boolean>;
  transmitTextAlert: (textMessage: string) => Promise<boolean>;
  replayTransmission: (transmission: RadioTransmission) => void;
  // Map Target Focus Trigger
  focusTargetsNonce: number;
  triggerFocusTargets: () => void;
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
  terminateMatch: () => Promise<boolean>;
  terminationNotice: string | null;
  dismissTerminationNotice: () => void;
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
        if (isValidCoordinate(parsed.lat, parsed.lng)) {
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
  const [hasJoinedRoom, setHasJoinedRoom] = useState<boolean>(false);

  // Load persistent user profile from localStorage if available
  const [currentUser, setCurrentUser] = useState<Player | null>(() => {
    const coords = getInitialCoords();
    if (typeof window !== 'undefined') {
      const storedId = localStorage.getItem('shadowpulse_uid') || `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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
  const [focusTargetsNonce, setFocusTargetsNonce] = useState<number>(0);

  // Checkpoints Objective State
  const [activeCheckpointZone, setActiveCheckpointZone] = useState<Checkpoint | null>(null);
  const [checkpointRemainingSec, setCheckpointRemainingSec] = useState<number>(20);
  const checkpointIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  const [radioHistory, setRadioHistory] = useState<RadioTransmission[]>([]);
  const [playingTransmissionId, setPlayingTransmissionId] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);

  const lastRadioSyncRef = useRef<number>(Date.now() - 5000);
  const seenTransmissionIdsRef = useRef<Set<string>>(new Set());
  const audioQueueRef = useRef<RadioTransmission[]>([]);
  const isPlayingQueueRef = useRef<boolean>(false);
  const activeAudioElRef = useRef<HTMLAudioElement | null>(null);
  const unlockAudioCtxRef = useRef<AudioContext | null>(null);

  const prevGameStateRef = useRef<GameState>('LOBBY');
  const prevPhaseRef = useRef<string>('SAFE');
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastCoordsSentRef = useRef<number>(0);
  const lastSentCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const hasRealGpsFixRef = useRef<boolean>(false);
  const timerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest mutable refs so SSE/callbacks never re-trigger EventSource reconnections
  const currentUserRef = useRef<Player | null>(currentUser);
  currentUserRef.current = currentUser;
  const roomCodeRef = useRef<string>(roomCode);
  roomCodeRef.current = roomCode;
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;
  const timersRef = useRef({
    headStartMinutes,
    gameDurationMinutes,
    pingIntervalSeconds,
    revealDurationSeconds,
  });
  timersRef.current = {
    headStartMinutes,
    gameDurationMinutes,
    pingIntervalSeconds,
    revealDurationSeconds,
  };

  const [terminationNotice, setTerminationNotice] = useState<string | null>(null);

  const triggerFocusTargets = useCallback(() => {
    setFocusTargetsNonce((n) => n + 1);
  }, []);

  const dismissTerminationNotice = useCallback(() => {
    setTerminationNotice(null);
  }, []);

  const handleRoomTerminated = useCallback((message: string) => {
    setTerminationNotice(message);
    setHasJoinedRoom(false);
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch {}
      eventSourceRef.current = null;
    }
    setGameState('LOBBY');
    setGameOverData(null);
  }, []);

  const unlockAudio = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        if (!unlockAudioCtxRef.current) {
          unlockAudioCtxRef.current = new AudioCtx();
        }
        if (unlockAudioCtxRef.current.state === 'suspended') {
          unlockAudioCtxRef.current.resume().catch(() => {});
        }
        // Play a 1-sample silent buffer to satisfy mobile Safari/Chrome autoplay policies
        const buffer = unlockAudioCtxRef.current.createBuffer(1, 1, 22050);
        const source = unlockAudioCtxRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(unlockAudioCtxRef.current.destination);
        source.start(0);
      }
      setAudioUnlocked(true);
    } catch {
      setAudioUnlocked(true);
    }
  }, []);

  const processAudioQueue = useCallback(() => {
    if (isPlayingQueueRef.current) return;
    const next = audioQueueRef.current.shift();
    if (!next || !next.audioData) {
      setPlayingTransmissionId(null);
      setActiveRadioSpeaker(null);
      return;
    }

    isPlayingQueueRef.current = true;
    setPlayingTransmissionId(next.id);
    setActiveRadioSpeaker({
      name: next.senderName,
      targetType: next.targetType,
      isDirect: next.targetType === 'DIRECT',
    });

    try {
      const audio = new Audio(next.audioData);
      activeAudioElRef.current = audio;

      const finish = (playEndSquelch: boolean) => {
        if (activeAudioElRef.current === audio) {
          activeAudioElRef.current = null;
        }
        isPlayingQueueRef.current = false;
        if (playEndSquelch) {
          soundManager.playRadioTransmissionEnd();
        }
        processAudioQueue();
      };

      audio.onended = () => finish(true);
      audio.onerror = () => finish(false);
      audio.play().catch(() => {
        // Browser autoplay policy blocked automatic play; clip stays playable via manual Replay button in feed
        finish(false);
      });
    } catch {
      isPlayingQueueRef.current = false;
      processAudioQueue();
    }
  }, []);

  const replayTransmission = useCallback(
    (transmission: RadioTransmission) => {
      unlockAudio();
      if (!transmission.audioData) return;

      if (activeAudioElRef.current) {
        try {
          activeAudioElRef.current.pause();
        } catch {}
        activeAudioElRef.current = null;
      }
      audioQueueRef.current = [];
      isPlayingQueueRef.current = false;

      audioQueueRef.current.push(transmission);
      processAudioQueue();
    },
    [processAudioQueue, unlockAudio]
  );

  const playIncomingTransmission = useCallback(
    (transmission: RadioTransmission) => {
      const me = currentUserRef.current;
      if (!me || me.role !== 'HIDER' || me.status !== 'ACTIVE') {
        return;
      }
      if (seenTransmissionIdsRef.current.has(transmission.id)) {
        return;
      }
      seenTransmissionIdsRef.current.add(transmission.id);

      setLastRadioTransmission(transmission);
      setRadioHistory((prev) => [transmission, ...prev].slice(0, 15));
      soundManager.playRadioIncomingBeep();

      if (transmission.audioData && transmission.messageType !== 'TEXT') {
        audioQueueRef.current.push(transmission);
        processAudioQueue();
      } else {
        setActiveRadioSpeaker({
          name: transmission.senderName,
          targetType: transmission.targetType,
          isDirect: transmission.targetType === 'DIRECT',
        });
        setTimeout(() => {
          setActiveRadioSpeaker((curr) =>
            curr?.name === transmission.senderName ? null : curr
          );
        }, 2800);
      }
    },
    [processAudioQueue]
  );

  // Helper to trigger remote action on backend
  const sendRoomAction = useCallback(async (action: string, payload?: unknown) => {
    try {
      await fetch(`/api/rooms/${roomCodeRef.current}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
    } catch (err) {
      console.error('Failed to send room action:', action, err);
    }
  }, []);

  // Process room state from backend (via SSE or polling)
  const applyRoomData = useCallback((room: any) => {
    if (!room) return;

    if (room.gameState !== undefined) {
      if (room.gameState !== prevGameStateRef.current) {
        if (room.gameState === 'ROLE_REVEAL') {
          soundManager.playRadarBlip();
        } else if (room.gameState === 'ACTIVE_SEEKING') {
          soundManager.playRevealAlarm();
        } else if (room.gameState === 'GAME_OVER') {
          soundManager.playVictoryFanfare();
        } else if (room.gameState === 'LOBBY') {
          setRadioHistory([]);
          seenTransmissionIdsRef.current.clear();
        }
        prevGameStateRef.current = room.gameState;
      }
      setGameState(room.gameState);
    }

    if (room.players && Array.isArray(room.players)) {
      setPlayers(room.players);

      const myId = currentUserRef.current?.id;
      if (myId) {
        const serverMe = room.players.find((p: Player) => p.id === myId);
        if (serverMe) {
          setCurrentUser((prev) =>
            prev
              ? {
                  ...prev,
                  name: serverMe.name,
                  role: serverMe.role,
                  status: serverMe.status,
                  isHost: serverMe.isHost,
                  latitude: hasRealGpsFixRef.current ? prev.latitude : serverMe.latitude,
                  longitude: hasRealGpsFixRef.current ? prev.longitude : serverMe.longitude,
                  pendingCapture: serverMe.pendingCapture,
                  cooldownRemainingSec: serverMe.cooldownRemainingSec,
                  checkpoints: serverMe.checkpoints,
                  lastFoundAt: serverMe.lastFoundAt,
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
  }, []);

  // Connect to Real-Time Server-Sent Events (SSE) for the active joined room ONLY
  // Critical: Depends ONLY on [roomCode, currentUser?.id, hasJoinedRoom, handleRoomTerminated] so EventSource is NEVER torn down on every state tick!
  useEffect(() => {
    if (typeof window === 'undefined' || !roomCode || !hasJoinedRoom) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const myId = currentUserRef.current?.id || '';
    const sseUrl = `/api/rooms/${roomCode}/events?playerId=${encodeURIComponent(myId)}`;
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    const syncMissedRadio = async () => {
      const me = currentUserRef.current;
      if (!me || me.role !== 'HIDER' || me.status !== 'ACTIVE') return;
      try {
        const res = await fetch(
          `/api/rooms/${roomCode}/radio?playerId=${encodeURIComponent(me.id)}&since=${lastRadioSyncRef.current}`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.transmissions)) {
            for (const t of data.transmissions as RadioTransmission[]) {
              lastRadioSyncRef.current = Math.max(lastRadioSyncRef.current, t.timestamp);
              playIncomingTransmission(t);
            }
          }
        }
      } catch {}
    };

    eventSource.onopen = () => {
      setIsSyncing(false);
      syncMissedRadio();
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

    const handleRoomTerminatedEvent = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        handleRoomTerminated(payload.message || 'The match was terminated by the host.');
      } catch {
        handleRoomTerminated('The match was terminated by the host.');
      }
    };

    eventSource.addEventListener('radio_transmission', handleRadioEvent as EventListener);
    eventSource.addEventListener('room_terminated', handleRoomTerminatedEvent as EventListener);

    eventSource.onerror = () => {
      setIsSyncing(true);
    };

    // Graceful fallback polling: ONLY active if SSE stream is disconnected or reconnecting!
    const pollInterval = setInterval(async () => {
      if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN) {
        return;
      }

      try {
        const res = await fetch(`/api/rooms/${roomCode}`);
        if (res.ok) {
          const data = await res.json();
          if (data.room) {
            applyRoomData(data.room);
          }
          syncMissedRadio();
        } else if (res.status === 404) {
          handleRoomTerminated('Match session has ended or was deleted by the host.');
        }
      } catch {}
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.removeEventListener('radio_transmission', handleRadioEvent as EventListener);
        eventSourceRef.current.removeEventListener('room_terminated', handleRoomTerminatedEvent as EventListener);
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [roomCode, currentUser?.id, hasJoinedRoom, applyRoomData, playIncomingTransmission, handleRoomTerminated]);

  // Helper to push coordinates immediately when room changes or on fix
  const pushCoordinates = useCallback((code: string, playerId: string, lat: number, lng: number) => {
    if (!code || !playerId || !isValidCoordinate(lat, lng)) return;
    lastCoordsSentRef.current = Date.now();
    lastSentCoordsRef.current = { lat, lng };
    fetch(`/api/rooms/${code}/coords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, lat, lng }),
    }).catch(() => {});
  }, []);

  // Read URL query parameter ?room=XYZ on initial load
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const paramRoom = urlParams.get('room') || urlParams.get('join') || urlParams.get('code');

    if (paramRoom && paramRoom.trim()) {
      const cleanParam = paramRoom.trim().toUpperCase();
      setPendingInviteCode(cleanParam);
    } else {
      const storedName = localStorage.getItem('shadowpulse_uname') || 'Operator-1';
      joinRoom('PULSE8', storedName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevCoordRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  // Real GPS Geolocation Watcher + Heartbeat Sync
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    const handlePosition = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      if (!isValidCoordinate(latitude, longitude)) return;

      const now = Date.now();
      const timeSincePrevFix = prevCoordRef.current ? now - prevCoordRef.current.time : Infinity;

      // Only discard very coarse (>400m) fixes if we recently had a solid fix (<25s ago)
      if (accuracy > 400 && prevCoordRef.current && timeSincePrevFix < 25000) {
        return;
      }

      hasRealGpsFixRef.current = true;
      let filteredLat = latitude;
      let filteredLng = longitude;

      if (prevCoordRef.current) {
        const dist = calculateDistanceMeters(
          prevCoordRef.current.lat,
          prevCoordRef.current.lng,
          latitude,
          longitude
        );

        const dtSeconds = Math.max(0.1, (now - prevCoordRef.current.time) / 1000);
        const speedMps = dist / dtSeconds;

        if (dist < 1.5) {
          filteredLat = prevCoordRef.current.lat;
          filteredLng = prevCoordRef.current.lng;
        } else if (speedMps > 35 || accuracy > 80) {
          filteredLat = prevCoordRef.current.lat * 0.8 + latitude * 0.2;
          filteredLng = prevCoordRef.current.lng * 0.8 + longitude * 0.2;
        } else {
          filteredLat = prevCoordRef.current.lat * 0.4 + latitude * 0.6;
          filteredLng = prevCoordRef.current.lng * 0.4 + longitude * 0.6;
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
      setCurrentUser((prev) =>
        prev ? { ...prev, latitude: filteredLat, longitude: filteredLng } : null
      );

      const meId = currentUserRef.current?.id;
      if (!hasJoinedRoom || !meId) return;

      const lastSent = lastSentCoordsRef.current;
      const timeSinceLastSend = now - lastCoordsSentRef.current;
      const distSinceLastSend = lastSent
        ? calculateDistanceMeters(lastSent.lat, lastSent.lng, filteredLat, filteredLng)
        : 999;

      if ((timeSinceLastSend >= 3000 && distSinceLastSend >= 2.0) || timeSinceLastSend >= 10000) {
        pushCoordinates(roomCodeRef.current, meId, filteredLat, filteredLng);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => {
        console.log('GPS watch status:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 4000,
      }
    );

    // Periodic heartbeat so coordinates never go stale if watchPosition pauses while stationary
    const heartbeatInterval = setInterval(() => {
      const meId = currentUserRef.current?.id;
      const loc = userLocationRef.current;
      if (!hasJoinedRoom || !meId || !loc) return;

      const now = Date.now();
      if (now - lastCoordsSentRef.current >= 8000) {
        pushCoordinates(roomCodeRef.current, meId, loc.lat, loc.lng);
      }

      // If no live GPS update arrived in >15s, nudge with getCurrentPosition
      if (!prevCoordRef.current || now - prevCoordRef.current.time > 15000) {
        navigator.geolocation.getCurrentPosition(
          handlePosition,
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
        );
      }
    }, 8000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(heartbeatInterval);
    };
  }, [hasJoinedRoom, pushCoordinates]);

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
  }, [activeCheckpointZone?.id, currentUser?.id, sendRoomAction]);

  // Actions
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setSoundEnabled(next);
  };

  const createRoom = async (hostName: string) => {
    const code = generateRoomCode();
    const actualHostName = hostName.trim() || 'Host Operator';
    const myId = currentUserRef.current?.id || `p_${Date.now()}`;

    if (typeof window !== 'undefined') {
      localStorage.setItem('shadowpulse_uname', actualHostName);
    }

    lastCoordsSentRef.current = 0;
    lastSentCoordsRef.current = null;

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: code,
          hostName: actualHostName,
          hostId: myId,
          lat: userLocationRef.current?.lat || DEFAULT_COORDS.lat,
          lng: userLocationRef.current?.lng || DEFAULT_COORDS.lng,
          headStartMinutes: timersRef.current.headStartMinutes,
          gameDurationMinutes: timersRef.current.gameDurationMinutes,
          pingIntervalSeconds: timersRef.current.pingIntervalSeconds,
          revealDurationSeconds: timersRef.current.revealDurationSeconds,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        roomCodeRef.current = code;
        setRoomCode(code);
        setCurrentUser(data.player);
        setHasJoinedRoom(true);
        applyRoomData(data.room);
      }
    } catch (e) {
      console.error('Create room error:', e);
      roomCodeRef.current = code;
      setRoomCode(code);
    }
  };

  const joinRoom = async (code: string, playerName: string): Promise<boolean> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return false;
    const actualName = playerName.trim() || `Operative-${Math.floor(Math.random() * 100)}`;
    const myId = currentUserRef.current?.id || `p_${Date.now()}`;

    if (typeof window !== 'undefined') {
      localStorage.setItem('shadowpulse_uname', actualName);
    }

    lastCoordsSentRef.current = 0;
    lastSentCoordsRef.current = null;

    try {
      const res = await fetch(`/api/rooms/${cleanCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: actualName,
          playerId: myId,
          lat: userLocationRef.current?.lat || DEFAULT_COORDS.lat,
          lng: userLocationRef.current?.lng || DEFAULT_COORDS.lng,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        roomCodeRef.current = cleanCode;
        setRoomCode(cleanCode);
        setCurrentUser(data.player);
        setHasJoinedRoom(true);
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
    const me = currentUserRef.current;
    if (!cleanName || !me) return;

    if (typeof window !== 'undefined') {
      localStorage.setItem('shadowpulse_uname', cleanName);
    }

    setCurrentUser((prev) => (prev ? { ...prev, name: cleanName } : null));
    setPlayers((prev) =>
      prev.map((p) => (p.id === me.id ? { ...p, name: cleanName } : p))
    );

    await sendRoomAction('UPDATE_PLAYER_NAME', {
      playerId: me.id,
      newName: cleanName,
    });
  };

  const scheduleTimerSync = () => {
    if (timerDebounceRef.current) {
      clearTimeout(timerDebounceRef.current);
    }
    timerDebounceRef.current = setTimeout(() => {
      sendRoomAction('UPDATE_TIMERS', { ...timersRef.current });
    }, 150);
  };

  const setHeadStartMinutes = (mins: number) => {
    setHeadStartMinutesState(mins);
    timersRef.current = { ...timersRef.current, headStartMinutes: mins };
    scheduleTimerSync();
  };

  const setGameDurationMinutes = (mins: number) => {
    setGameDurationMinutesState(mins);
    timersRef.current = { ...timersRef.current, gameDurationMinutes: mins };
    scheduleTimerSync();
  };

  const setPingIntervalSeconds = (secs: number) => {
    setPingIntervalSecondsState(secs);
    timersRef.current = { ...timersRef.current, pingIntervalSeconds: secs };
    scheduleTimerSync();
  };

  const setRevealDurationSeconds = (secs: number) => {
    setRevealDurationSecondsState(secs);
    timersRef.current = { ...timersRef.current, revealDurationSeconds: secs };
    scheduleTimerSync();
  };

  const startGame = () => {
    sendRoomAction('START_GAME');
  };

  const dismissRoleReveal = () => {
    sendRoomAction('DISMISS_REVEAL');
  };

  const requestCapture = (targetId: string) => {
    const me = currentUserRef.current;
    if (!me) return;
    sendRoomAction('REQUEST_CAPTURE', {
      targetId,
      seekerId: me.id,
      seekerName: me.name,
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

  const terminateMatch = async (): Promise<boolean> => {
    const me = currentUserRef.current;
    if (!me) return false;
    try {
      const res = await fetch(`/api/rooms/${roomCodeRef.current}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: me.id }),
      });
      if (res.ok) {
        handleRoomTerminated('Match terminated. All server data was permanently erased.');
        return true;
      }
    } catch (e) {
      console.error('Terminate match error:', e);
    }
    return false;
  };

  const switchViewRole = (newRole: Role, newStatus: PlayerStatus = 'ACTIVE') => {
    const me = currentUserRef.current;
    if (!me) return;
    sendRoomAction('SWITCH_VIEW_ROLE', {
      playerId: me.id,
      role: newRole,
      status: newStatus,
    });
  };

  const completeCheckpoint = async (checkpointId: string) => {
    const me = currentUserRef.current;
    if (!me) return;
    soundManager.playCheckpointSecured();
    await sendRoomAction('COMPLETE_CHECKPOINT', {
      playerId: me.id,
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
    if (!isValidCoordinate(lat, lng)) return;
    hasRealGpsFixRef.current = true;
    setUserLocation({ lat, lng, accuracy: 5 });
    setCurrentUser((prev) => (prev ? { ...prev, latitude: lat, longitude: lng } : null));
    if (currentUserRef.current?.id) {
      pushCoordinates(roomCodeRef.current, currentUserRef.current.id, lat, lng);
    }
  };

  const transmitVoiceBurst = async (audioData: string, durationMs: number): Promise<boolean> => {
    const me = currentUserRef.current;
    if (!me || me.role !== 'HIDER' || me.status !== 'ACTIVE') {
      return false;
    }
    unlockAudio();
    try {
      const res = await fetch(`/api/rooms/${roomCodeRef.current}/radio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: me.id,
          senderName: me.name,
          targetType: radioTarget.type,
          targetPlayerId: radioTarget.targetPlayerId,
          messageType: 'VOICE',
          audioData,
          durationMs,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.transmission) {
          seenTransmissionIdsRef.current.add(data.transmission.id);
          setRadioHistory((prev) => [data.transmission, ...prev].slice(0, 15));
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Radio transmit error:', err);
      return false;
    }
  };

  const transmitTextAlert = async (textMessage: string): Promise<boolean> => {
    const me = currentUserRef.current;
    const cleanText = textMessage.trim();
    if (!me || me.role !== 'HIDER' || me.status !== 'ACTIVE' || !cleanText) {
      return false;
    }
    unlockAudio();
    try {
      const res = await fetch(`/api/rooms/${roomCodeRef.current}/radio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: me.id,
          senderName: me.name,
          targetType: radioTarget.type,
          targetPlayerId: radioTarget.targetPlayerId,
          messageType: 'TEXT',
          textMessage: cleanText,
          durationMs: 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.transmission) {
          seenTransmissionIdsRef.current.add(data.transmission.id);
          setRadioHistory((prev) => [data.transmission, ...prev].slice(0, 15));
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Radio text transmit error:', err);
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
        radioHistory,
        playingTransmissionId,
        audioUnlocked,
        unlockAudio,
        transmitVoiceBurst,
        transmitTextAlert,
        replayTransmission,
        focusTargetsNonce,
        triggerFocusTargets,
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
        terminateMatch,
        terminationNotice,
        dismissTerminationNotice,
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

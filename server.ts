import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  Checkpoint,
  generateCheckpoints,
  checkGameEnd,
  calculateDistanceMeters,
  RadioTransmission,
  RadioTargetType,
} from './src/game/radarRules.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type Role = 'DENNER' | 'HIDER';
export type PlayerStatus = 'ACTIVE' | 'FOUND';

export interface Player {
  id: string;
  name: string;
  role: Role;
  status: PlayerStatus;
  isHost: boolean;
  isBot?: boolean;
  latitude: number;
  longitude: number;
  lastFoundAt?: number;
  lastSeen?: number;
  pendingCapture?: {
    seekerId: string;
    seekerName: string;
    timestamp: number;
  } | null;
  cooldownRemainingSec?: number;
  checkpoints?: Checkpoint[];
  allCheckpointsCompletedAt?: number;
  checkpointCompletionTimeSec?: number;
}

export type GameState = 'LOBBY' | 'ROLE_REVEAL' | 'HIDING' | 'ACTIVE_SEEKING' | 'GAME_OVER';

export interface RoomData {
  roomCode: string;
  hostId: string;
  gameState: GameState;
  players: Player[];
  headStartMinutes: number;
  gameDurationMinutes: number;
  pingIntervalSeconds: number;
  revealDurationSeconds: number;
  remainingHeadStartSeconds: number;
  remainingGameSeconds: number;
  cycleSeconds: number;
  gameOverData?: { winner: 'DENNER' | 'HIDERS' | null; reason: string } | null;
  matchStartTime?: number;
  recentTransmissions?: RadioTransmission[];
  lastUpdated: number;
}

const TOTAL_CYCLE_SECONDS = 310;
const BOT_NAMES = ['Ghost', 'Viper', 'Shadow', 'Spectre', 'Echo', 'Phantom', 'Tracker', 'Recon'];
// Default center coordinates: JNTUH Campus, Kukatpally, Hyderabad
const DEFAULT_COORDS = { lat: 17.4933, lng: 78.3914 };

// In-memory room storage and SSE client connections
interface ConnectedClient {
  res: Response;
  playerId?: string;
}

const rooms: Map<string, RoomData> = new Map();
const roomClients: Map<string, Set<ConnectedClient>> = new Map();

function broadcastRoom(code: string) {
  const room = rooms.get(code);
  if (!room) return;
  room.lastUpdated = Date.now();

  const clients = roomClients.get(code);
  if (clients && clients.size > 0) {
    const dataString = `data: ${JSON.stringify(room)}\n\n`;
    for (const client of clients) {
      try {
        client.res.write(dataString);
      } catch {
        clients.delete(client);
      }
    }
  }
}

function broadcastRadio(code: string, transmission: RadioTransmission) {
  const room = rooms.get(code);
  if (!room) return;

  const clients = roomClients.get(code);
  if (!clients || clients.size === 0) return;

  const eventPayload = `event: radio_transmission\ndata: ${JSON.stringify(transmission)}\n\n`;

  for (const client of clients) {
    const player = room.players.find((p) => p.id === client.playerId);

    // STRICT MILITARY SECURITY: Only active hiders receive radio transmissions! Seekers and caught players are barred.
    if (!player || player.role !== 'HIDER' || player.status !== 'ACTIVE') {
      continue;
    }

    // Do not echo back audio to sender
    if (client.playerId === transmission.senderId) {
      continue;
    }

    // 1-to-1 direct filter: only send to specified target
    if (transmission.targetType === 'DIRECT') {
      if (client.playerId !== transmission.targetPlayerId) {
        continue;
      }
    }

    try {
      client.res.write(eventPayload);
    } catch {
      clients.delete(client);
    }
  }
}

function assignRandomDenner(players: Player[]): Player[] {
  if (players.length === 0) return [];
  const dennerIndex = Math.floor(Math.random() * players.length);
  const updated = players.map((p, index) => ({
    ...p,
    role: index === dennerIndex ? ('DENNER' as const) : ('HIDER' as const),
    status: 'ACTIVE' as const,
  }));

  // Identify the seeker's starting location as center
  const seeker = updated.find((p) => p.role === 'DENNER');
  const centerLat =
    seeker && Math.abs(seeker.latitude) > 0.001 ? seeker.latitude : DEFAULT_COORDS.lat;
  const centerLng =
    seeker && Math.abs(seeker.longitude) > 0.001 ? seeker.longitude : DEFAULT_COORDS.lng;

  // "Each hider should get 3 random spots under 500m inside jntuh campus for which the center is the place where the seeker starts from"
  return updated.map((p) => {
    if (p.role === 'HIDER') {
      return {
        ...p,
        checkpoints: generateCheckpoints(centerLat, centerLng, 3),
      };
    }
    return { ...p, checkpoints: [] };
  });
}

function checkRoomGameEnd(
  players: Player[],
  overallTimeRemainingSec: number
): { isGameOver: boolean; winner: 'DENNER' | 'HIDERS' | null; reason: string } {
  return checkGameEnd(players, overallTimeRemainingSec);
}

// Global 1-second server game loop for active matches
setInterval(() => {
  for (const [code, room] of rooms.entries()) {
    if (room.gameState === 'HIDING') {
      room.remainingHeadStartSeconds -= 1;
      if (room.remainingHeadStartSeconds <= 0) {
        room.gameState = 'ACTIVE_SEEKING';
        room.cycleSeconds = 0;
      }
      broadcastRoom(code);
    } else if (room.gameState === 'ACTIVE_SEEKING') {
      room.remainingGameSeconds = Math.max(0, room.remainingGameSeconds - 1);
      const totalCycle = (room.pingIntervalSeconds || 300) + (room.revealDurationSeconds || 10);
      room.cycleSeconds = (room.cycleSeconds + 1) % totalCycle;

      // Realistic drift for simulated bots
      room.players = room.players.map((p) => {
        if (!p.isBot || p.status === 'FOUND') return p;
        const dLat = (Math.random() - 0.5) * 0.00012;
        const dLng = (Math.random() - 0.5) * 0.00012;
        return {
          ...p,
          latitude: p.latitude + dLat,
          longitude: p.longitude + dLng,
        };
      });

      // AI Bots checkpoint progress simulation
      room.players = room.players.map((p) => {
        if (!p.isBot || p.role !== 'HIDER' || p.status !== 'ACTIVE' || !p.checkpoints) return p;
        // Small chance per tick for active bot to complete next uncompleted checkpoint
        if (Math.random() < 0.02) {
          const nextCp = p.checkpoints.find((cp) => !cp.completed);
          if (nextCp) {
            nextCp.completed = true;
            nextCp.completedAt = Date.now();
            const allDone = p.checkpoints.every((c) => c.completed);
            if (allDone && !p.allCheckpointsCompletedAt) {
              p.allCheckpointsCompletedAt = Date.now();
              const matchStart = room.matchStartTime || (Date.now() - 30000);
              p.checkpointCompletionTimeSec = Math.max(
                1,
                Math.round((Date.now() - matchStart) / 1000)
              );
              console.log(
                `[ShadowPulse] Bot ${p.name} completed ALL checkpoints in ${p.checkpointCompletionTimeSec}s!`
              );
            }
          }
        }
        return p;
      });

      // Manage 30s Cooldown for captured hiders converting to Seekers
      room.players = room.players.map((p) => {
        if (p.status === 'FOUND' && p.role === 'HIDER') {
          const currentCooldown = p.cooldownRemainingSec !== undefined ? p.cooldownRemainingSec : 30;
          if (currentCooldown <= 1) {
            console.log(`[ShadowPulse] Cooldown completed for ${p.name}. Converted to SEEKER!`);
            return {
              ...p,
              role: 'DENNER' as const,
              status: 'ACTIVE' as const,
              cooldownRemainingSec: 0,
            };
          } else {
            return {
              ...p,
              cooldownRemainingSec: currentCooldown - 1,
            };
          }
        }
        return p;
      });

      // Check win condition
      const endCheck = checkRoomGameEnd(room.players, room.remainingGameSeconds);
      if (endCheck.isGameOver) {
        room.gameState = 'GAME_OVER';
        room.gameOverData = { winner: endCheck.winner, reason: endCheck.reason };
      }

      broadcastRoom(code);
    }
  }
}, 1000);

function getOrCreateRoom(
  code: string,
  creatorName: string = 'Host Operator',
  hostId?: string,
  lat?: number,
  lng?: number
): RoomData {
  const cleanCode = code.toUpperCase();
  let room = rooms.get(cleanCode);
  if (!room) {
    const actualHostId = hostId || `player_host_${Date.now()}`;
    const hostPlayer: Player = {
      id: actualHostId,
      name: creatorName,
      role: 'DENNER',
      status: 'ACTIVE',
      isHost: true,
      latitude: lat || DEFAULT_COORDS.lat,
      longitude: lng || DEFAULT_COORDS.lng,
      lastSeen: Date.now(),
    };

    room = {
      roomCode: cleanCode,
      hostId: actualHostId,
      gameState: 'LOBBY',
      players: [hostPlayer],
      headStartMinutes: 3,
      gameDurationMinutes: 30,
      pingIntervalSeconds: 300,
      revealDurationSeconds: 10,
      remainingHeadStartSeconds: 180,
      remainingGameSeconds: 1800,
      cycleSeconds: 0,
      gameOverData: null,
      lastUpdated: Date.now(),
    };
    rooms.set(cleanCode, room);
    console.log(`[ShadowPulse] Room auto-initialized: ${cleanCode} with host ${creatorName}`);
  }
  return room;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // === MULTIPLAYER ROOMS API ===

  // 1. Create room
  app.post('/api/rooms', (req: Request, res: Response) => {
    const {
      roomCode,
      hostName,
      hostId,
      lat,
      lng,
      headStartMinutes,
      gameDurationMinutes,
      pingIntervalSeconds,
      revealDurationSeconds,
    } = req.body;
    const code = (roomCode || Math.random().toString(36).substring(2, 8)).toUpperCase();

    const actualHostId = hostId || `player_${Date.now()}`;
    const hostPlayer: Player = {
      id: actualHostId,
      name: (hostName || 'Host Operator').trim(),
      role: 'DENNER',
      status: 'ACTIVE',
      isHost: true,
      latitude: lat || DEFAULT_COORDS.lat,
      longitude: lng || DEFAULT_COORDS.lng,
      lastSeen: Date.now(),
    };

    const newRoom: RoomData = {
      roomCode: code,
      hostId: actualHostId,
      gameState: 'LOBBY',
      players: [hostPlayer],
      headStartMinutes: headStartMinutes || 3,
      gameDurationMinutes: gameDurationMinutes || 30,
      pingIntervalSeconds: pingIntervalSeconds || 300,
      revealDurationSeconds: revealDurationSeconds || 10,
      remainingHeadStartSeconds: (headStartMinutes || 3) * 60,
      remainingGameSeconds: (gameDurationMinutes || 30) * 60,
      cycleSeconds: 0,
      gameOverData: null,
      lastUpdated: Date.now(),
    };

    rooms.set(code, newRoom);
    console.log(`[ShadowPulse] Room created: ${code} by ${hostPlayer.name} (${actualHostId})`);

    res.json({ success: true, room: newRoom, player: hostPlayer });
  });

  // 2. Fetch room state (auto-initializes room if not present so no 404 occurs)
  app.get('/api/rooms/:code', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const room = getOrCreateRoom(code);
    res.json({ room });
  });

  // 3. Join room
  app.post('/api/rooms/:code/join', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const { playerName, playerId, lat, lng } = req.body;
    const actualPlayerId = playerId || `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const actualName = (playerName || `Operative-${Math.floor(Math.random() * 100)}`).trim();

    const room = getOrCreateRoom(code, actualName, actualPlayerId, lat, lng);

    const existingIndex = room.players.findIndex((p) => p.id === actualPlayerId);
    let player: Player;

    if (existingIndex >= 0) {
      room.players[existingIndex].name = actualName;
      if (lat !== undefined && lng !== undefined) {
        room.players[existingIndex].latitude = lat;
        room.players[existingIndex].longitude = lng;
      }
      room.players[existingIndex].lastSeen = Date.now();
      player = room.players[existingIndex];
    } else {
      player = {
        id: actualPlayerId,
        name: actualName,
        role: 'HIDER',
        status: 'ACTIVE',
        isHost: false,
        latitude: lat || DEFAULT_COORDS.lat + (Math.random() - 0.5) * 0.002,
        longitude: lng || DEFAULT_COORDS.lng + (Math.random() - 0.5) * 0.002,
        lastSeen: Date.now(),
      };
      room.players.push(player);
    }

    console.log(
      `[ShadowPulse] Player joined room ${code}: ${player.name} (${player.id}). Total players: ${room.players.length}`
    );
    broadcastRoom(code);

    res.json({ success: true, room, player });
  });

  // 4. Update player coordinates
  app.post('/api/rooms/:code/coords', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const { playerId, lat, lng } = req.body;
    const player = room.players.find((p) => p.id === playerId);
    if (player && typeof lat === 'number' && typeof lng === 'number') {
      player.latitude = lat;
      player.longitude = lng;
      player.lastSeen = Date.now();
      // Broadcast periodically
      broadcastRoom(code);
    }

    res.json({ success: true });
  });

  // 5. Room Actions (Start game, Mark Found, Timer sliders, Add bot, Reset)
  app.post('/api/rooms/:code/action', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const { action, payload } = req.body;

    switch (action) {
      case 'START_GAME': {
        room.players = assignRandomDenner(room.players);
        room.remainingHeadStartSeconds = room.headStartMinutes * 60;
        room.remainingGameSeconds = room.gameDurationMinutes * 60;
        room.cycleSeconds = 0;
        room.gameOverData = null;
        room.matchStartTime = Date.now();
        room.gameState = 'ROLE_REVEAL';
        break;
      }

      case 'DISMISS_REVEAL': {
        if (room.gameState === 'ROLE_REVEAL') {
          room.gameState = 'HIDING';
        }
        break;
      }

      case 'UPDATE_TIMERS': {
        if (payload?.headStartMinutes) {
          room.headStartMinutes = payload.headStartMinutes;
          room.remainingHeadStartSeconds = payload.headStartMinutes * 60;
        }
        if (payload?.gameDurationMinutes) {
          room.gameDurationMinutes = payload.gameDurationMinutes;
          room.remainingGameSeconds = payload.gameDurationMinutes * 60;
        }
        if (payload?.pingIntervalSeconds !== undefined) {
          room.pingIntervalSeconds = Math.max(30, Math.min(600, payload.pingIntervalSeconds));
        }
        if (payload?.revealDurationSeconds !== undefined) {
          room.revealDurationSeconds = Math.max(3, Math.min(30, payload.revealDurationSeconds));
        }
        break;
      }

      case 'REQUEST_CAPTURE':
      case 'MARK_FOUND': {
        const targetId = payload?.targetId;
        const seekerId = payload?.seekerId || 'seeker';
        const seekerName = payload?.seekerName || 'Seeker';
        const target = room.players.find((p) => p.id === targetId);

        if (target && target.role === 'HIDER') {
          // If target is simulated bot, bots auto-confirm immediately
          if (target.isBot) {
            target.status = 'FOUND';
            target.lastFoundAt = Date.now();
            target.cooldownRemainingSec = 30;
            target.pendingCapture = null;
            console.log(`[ShadowPulse] Bot ${target.name} auto-confirmed capture by ${seekerName}. 30s cooldown started.`);
          } else {
            // Real human player gets confirmation prompt
            target.pendingCapture = {
              seekerId,
              seekerName,
              timestamp: Date.now(),
            };
            console.log(`[ShadowPulse] Seeker ${seekerName} requested capture on ${target.name}. Awaiting player confirmation.`);
          }
        }

        const win = checkRoomGameEnd(room.players, room.remainingGameSeconds);
        if (win.isGameOver) {
          room.gameState = 'GAME_OVER';
          room.gameOverData = { winner: win.winner, reason: win.reason };
        }
        break;
      }

      case 'CONFIRM_CAPTURE': {
        const playerId = payload?.playerId;
        const player = room.players.find((p) => p.id === playerId);
        if (player) {
          player.status = 'FOUND';
          player.lastFoundAt = Date.now();
          player.cooldownRemainingSec = 30;
          player.pendingCapture = null;
          console.log(`[ShadowPulse] Player ${player.name} confirmed capture! 30s cooldown started.`);
        }
        const win = checkRoomGameEnd(room.players, room.remainingGameSeconds);
        if (win.isGameOver) {
          room.gameState = 'GAME_OVER';
          room.gameOverData = { winner: win.winner, reason: win.reason };
        }
        break;
      }

      case 'DISPUTE_CAPTURE': {
        const playerId = payload?.playerId;
        const player = room.players.find((p) => p.id === playerId);
        if (player) {
          player.pendingCapture = null;
          console.log(`[ShadowPulse] Player ${player.name} disputed/rejected capture tag.`);
        }
        break;
      }

      case 'ACCELERATE_COOLDOWN': {
        const playerId = payload?.playerId;
        const player = room.players.find((p) => p.id === playerId);
        if (player && player.status === 'FOUND') {
          player.cooldownRemainingSec = 1;
        }
        break;
      }

      case 'COMPLETE_CHECKPOINT': {
        const { playerId, checkpointId } = payload || {};
        const player = room.players.find((p) => p.id === playerId);
        if (player && player.checkpoints) {
          const cp = player.checkpoints.find((c) => c.id === checkpointId);
          if (cp && !cp.completed) {
            cp.completed = true;
            cp.completedAt = Date.now();
            console.log(
              `[ShadowPulse] Player ${player.name} completed waypoint ${cp.code} (${cp.name})!`
            );
            const allDone = player.checkpoints.every((c) => c.completed);
            if (allDone && !player.allCheckpointsCompletedAt) {
              player.allCheckpointsCompletedAt = Date.now();
              const matchStart = room.matchStartTime || (Date.now() - 30000);
              player.checkpointCompletionTimeSec = Math.max(
                1,
                Math.round((Date.now() - matchStart) / 1000)
              );
              console.log(
                `[ShadowPulse] 🏆 Player ${player.name} completed ALL checkpoints in ${player.checkpointCompletionTimeSec}s!`
              );
            }
          }
        }
        const win = checkRoomGameEnd(room.players, room.remainingGameSeconds);
        if (win.isGameOver) {
          room.gameState = 'GAME_OVER';
          room.gameOverData = { winner: win.winner, reason: win.reason };
        }
        break;
      }

      case 'ADD_BOT': {
        const botIndex = room.players.filter((p) => p.isBot).length;
        const botName = `${BOT_NAMES[botIndex % BOT_NAMES.length]} (AI)`;
        const hostPlayer = room.players.find((p) => p.isHost) || room.players[0];
        const baseLat = hostPlayer?.latitude || DEFAULT_COORDS.lat;
        const baseLng = hostPlayer?.longitude || DEFAULT_COORDS.lng;

        const newBot: Player = {
          id: `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          name: botName,
          role: 'HIDER',
          status: 'ACTIVE',
          isHost: false,
          isBot: true,
          latitude: baseLat + (Math.random() - 0.5) * 0.0025,
          longitude: baseLng + (Math.random() - 0.5) * 0.0025,
          lastSeen: Date.now(),
        };
        room.players.push(newBot);
        break;
      }

      case 'REMOVE_PLAYER': {
        const playerId = payload?.playerId;
        if (playerId) {
          room.players = room.players.filter((p) => p.id !== playerId);
        }
        break;
      }

      case 'RESTART_GAME': {
        room.gameState = 'LOBBY';
        room.gameOverData = null;
        room.remainingHeadStartSeconds = room.headStartMinutes * 60;
        room.remainingGameSeconds = room.gameDurationMinutes * 60;
        room.cycleSeconds = 0;
        room.players = room.players.map((p) => ({
          ...p,
          status: 'ACTIVE' as const,
          role: p.isHost ? 'DENNER' : 'HIDER',
        }));
        break;
      }

      case 'DEBUG_SKIP_35S': {
        room.gameState = 'ACTIVE_SEEKING';
        room.remainingHeadStartSeconds = 0;
        room.cycleSeconds = 265;
        break;
      }

      case 'DEBUG_TRIGGER_10S': {
        room.gameState = 'ACTIVE_SEEKING';
        room.remainingHeadStartSeconds = 0;
        room.cycleSeconds = 300;
        break;
      }

      case 'SWITCH_VIEW_ROLE': {
        const { playerId, role, status } = payload || {};
        const p = room.players.find((player) => player.id === playerId);
        if (p) {
          if (role) p.role = role;
          if (status) p.status = status;
        }
        break;
      }

      case 'UPDATE_PLAYER_NAME': {
        const { playerId, newName } = payload || {};
        const p = room.players.find((player) => player.id === playerId);
        if (p && newName && typeof newName === 'string' && newName.trim().length > 0) {
          p.name = newName.trim();
          p.lastSeen = Date.now();
        }
        break;
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    broadcastRoom(code);
    res.json({ success: true, room });
  });

  // 6. Server-Sent Events (SSE) Stream
  app.get('/api/rooms/:code/events', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const playerId = (req.query.playerId as string) || '';
    const room = rooms.get(code);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    if (!roomClients.has(code)) {
      roomClients.set(code, new Set());
    }
    const clientSet = roomClients.get(code)!;
    const clientRecord: ConnectedClient = { res, playerId };
    clientSet.add(clientRecord);

    // Send current state immediately on connect
    if (room) {
      res.write(`data: ${JSON.stringify(room)}\n\n`);
    }

    // Keepalive ping every 15 seconds
    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      clientSet.delete(clientRecord);
      if (clientSet.size === 0) {
        roomClients.delete(code);
      }
    });
  });

  // 7. Tactical Push-to-Talk Radio Endpoint (Opus Audio Relay)
  app.post('/api/rooms/:code/radio', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const { senderId, senderName, targetType, targetPlayerId, audioData, durationMs } = req.body;
    if (!senderId || !audioData) {
      return res.status(400).json({ error: 'Missing senderId or audioData' });
    }

    // Verify sender is in room
    const sender = room.players.find((p) => p.id === senderId);
    if (!sender) {
      return res.status(404).json({ error: 'Sender not in room' });
    }

    // STRICT MILITARY SECURITY: Radio only functions for active Hiders! Seekers and caught players are barred.
    if (sender.role !== 'HIDER' || sender.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'Radio jammed. Only active stealth operatives can access the hider comm frequency.',
      });
    }

    let targetPlayerName: string | undefined;
    if (targetType === 'DIRECT') {
      if (!targetPlayerId) {
        return res.status(400).json({ error: 'Missing targetPlayerId for direct transmission' });
      }
      const target = room.players.find((p) => p.id === targetPlayerId);
      if (!target || target.role !== 'HIDER' || target.status !== 'ACTIVE') {
        return res.status(400).json({ error: 'Target operative unavailable or captured' });
      }
      targetPlayerName = target.name;
    }

    const transmission: RadioTransmission = {
      id: `radio_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      senderId,
      senderName: senderName || sender.name,
      targetType: targetType === 'DIRECT' ? 'DIRECT' : 'GROUP',
      targetPlayerId,
      targetPlayerName,
      audioData,
      durationMs: durationMs || 2000,
      timestamp: Date.now(),
    };

    if (!room.recentTransmissions) {
      room.recentTransmissions = [];
    }
    room.recentTransmissions.push(transmission);
    if (room.recentTransmissions.length > 20) {
      room.recentTransmissions.shift();
    }

    console.log(
      `[ShadowPulse Radio] 🎙️ ${transmission.senderName} -> ${
        transmission.targetType === 'DIRECT'
          ? `Direct (${targetPlayerName})`
          : 'Squad Net (All Hiders)'
      } [${transmission.durationMs}ms]`
    );

    broadcastRadio(code, transmission);

    res.json({ success: true, transmission });
  });

  // 8. Fetch recent radio transmissions (backup sync)
  app.get('/api/rooms/:code/radio', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const playerId = (req.query.playerId as string) || '';
    const since = parseInt((req.query.since as string) || '0', 10);

    const player = room.players.find((p) => p.id === playerId);
    if (!player || player.role !== 'HIDER' || player.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Unauthorized frequency access' });
    }

    const transmissions = (room.recentTransmissions || []).filter((t) => {
      if (t.timestamp <= since) return false;
      if (t.senderId === playerId) return false;
      if (t.targetType === 'DIRECT' && t.targetPlayerId !== playerId) return false;
      return true;
    });

    res.json({ transmissions });
  });

  // Tactical Intel / Scout AI Endpoint
  app.post('/api/tactical-intel', async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(200).json({
          intel:
            'Tactical Field Advice: Seek elevation or dense tree cover. Avoid dead-ends with single exits. Maintain line of sight to open escape routes.',
          source: 'offline-tactical-manual',
        });
      }

      const { role, lat, lng, remainingTime, unfoundCount } = req.body;
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are the Tactical Dispatcher for a high-stakes outdoor live Hide and Seek game called ShadowPulse.
The player asking for intel has the role: ${role || 'HIDER'}.
Current coordinates: Latitude ${lat || '37.7749'}, Longitude ${lng || '-122.4194'}.
Overall game time remaining: ${remainingTime || '15:00'}.
Active unfound hiders: ${unfoundCount || 3}.
The radar cycle has a 30s warning and a 10s live GPS flash every 5 minutes.
Provide 2-3 concise, bulleted, high-intensity tactical recommendations for this player right now (e.g. stealth repositioning during safe phases, cover selection, prediction of Denner sweeping arcs, or search perimeter strategies).
Keep it punchy, military-dispatch tone, and under 90 words.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text || 'Maintain stealth and observe enemy sweep vectors.';
      return res.json({ intel: text, source: 'gemini-tactical-ai' });
    } catch (error: any) {
      console.error('Tactical Intel API error:', error);
      return res.status(200).json({
        intel:
          'Tactical Dispatch: Maintain low profile. Reposition during the 4-minute radar silence. At 30s warning, freeze in dense cover.',
        source: 'fallback-tactical-protocol',
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      activeRooms: rooms.size,
      time: new Date().toISOString(),
    });
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ShadowPulse server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

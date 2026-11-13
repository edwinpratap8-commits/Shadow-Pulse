/**
 * Core mathematical and game state rules for ShadowPulse Tactical Hide and Seek.
 * Fully decoupled for deterministic unit testing.
 */

export type Role = 'DENNER' | 'HIDER';
export type PlayerStatus = 'ACTIVE' | 'FOUND';

export interface Checkpoint {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number; // 50m
  completed: boolean;
  completedAt?: number;
}

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
  batteryLevel?: number;
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

export type RadioTargetType = 'GROUP' | 'DIRECT';
export type RadioMessageType = 'VOICE' | 'TEXT';

export interface RadioTransmission {
  id: string;
  senderId: string;
  senderName: string;
  targetType: RadioTargetType;
  targetPlayerId?: string;
  targetPlayerName?: string;
  messageType?: RadioMessageType;
  audioData?: string;
  textMessage?: string;
  durationMs: number;
  timestamp: number;
}

export type RadarPhase = 'SAFE' | 'WARNING' | 'REVEAL';

export interface RadarPhaseState {
  phase: RadarPhase;
  secondsIntoCycle: number;
  secondsRemainingInCycle: number;
  warningCountdown: number;
  revealCountdown: number;
  isWarningActive: boolean;
  isRevealActive: boolean;
  totalCycleSeconds: number;
  pingIntervalSeconds: number;
  revealDurationSeconds: number;
}

export const RADAR_CYCLE_DURATION = 300; // Default 5 minutes
export const WARNING_DURATION = 30;      // Default 30 seconds
export const REVEAL_DURATION = 10;       // Default 10 seconds live flash
export const TOTAL_CYCLE_SECONDS = 310;
export const SAFE_THRESHOLD = 270;
export const WARNING_THRESHOLD = 300;

export function getRadarPhaseState(
  cycleSecond: number,
  pingIntervalSec: number = 300,
  revealDurationSec: number = 10
): RadarPhaseState {
  const safePingInterval = Math.max(30, pingIntervalSec);
  const safeRevealDuration = Math.max(3, revealDurationSec);
  const warningDuration = Math.min(30, Math.max(5, Math.floor(safePingInterval * 0.25)));
  const totalCycle = safePingInterval + safeRevealDuration;
  const safeThreshold = Math.max(0, safePingInterval - warningDuration);
  const warningThreshold = safePingInterval;

  // Normalize cycleSecond within [0, totalCycle)
  const sec = Math.max(0, cycleSecond % totalCycle);

  if (sec < safeThreshold) {
    const secondsRemainingToWarning = safeThreshold - sec;
    const secondsRemainingToReveal = warningThreshold - sec;
    return {
      phase: 'SAFE',
      secondsIntoCycle: sec,
      secondsRemainingInCycle: secondsRemainingToReveal,
      warningCountdown: secondsRemainingToWarning,
      revealCountdown: 0,
      isWarningActive: false,
      isRevealActive: false,
      totalCycleSeconds: totalCycle,
      pingIntervalSeconds: safePingInterval,
      revealDurationSeconds: safeRevealDuration,
    };
  } else if (sec < warningThreshold) {
    const countdown = warningThreshold - sec;
    return {
      phase: 'WARNING',
      secondsIntoCycle: sec,
      secondsRemainingInCycle: countdown,
      warningCountdown: countdown,
      revealCountdown: 0,
      isWarningActive: true,
      isRevealActive: false,
      totalCycleSeconds: totalCycle,
      pingIntervalSeconds: safePingInterval,
      revealDurationSeconds: safeRevealDuration,
    };
  } else {
    const remainingReveal = totalCycle - sec;
    return {
      phase: 'REVEAL',
      secondsIntoCycle: sec,
      secondsRemainingInCycle: 0,
      warningCountdown: 0,
      revealCountdown: remainingReveal,
      isWarningActive: false,
      isRevealActive: true,
      totalCycleSeconds: totalCycle,
      pingIntervalSeconds: safePingInterval,
      revealDurationSeconds: safeRevealDuration,
    };
  }
}

export interface HiderLeaderboardEntry {
  rank: number;
  player: Player;
  checkpointsCompleted: number;
  totalCheckpoints: number;
  completionTimeSec: number | null;
  formattedTime: string;
  isAllCompleted: boolean;
}

/**
 * Ranks hiders by checkpoint completion speed for the end-of-game summary
 */
export function rankHidersByCheckpointSpeed(
  players: Player[],
  matchStartTime?: number
): HiderLeaderboardEntry[] {
  // All players who are or were hiders
  const hiders = players.filter((p) => p.role === 'HIDER' || p.checkpoints?.length);

  const entries = hiders.map((p) => {
    const cps = p.checkpoints || [];
    const completedList = cps.filter((c) => c.completed);
    const completedCount = completedList.length;
    const totalCount = cps.length || 3;
    const isAll = completedCount >= totalCount && totalCount > 0;

    let timeSec: number | null = null;
    if (p.checkpointCompletionTimeSec !== undefined) {
      timeSec = p.checkpointCompletionTimeSec;
    } else if (isAll && p.allCheckpointsCompletedAt && matchStartTime) {
      timeSec = Math.max(1, Math.round((p.allCheckpointsCompletedAt - matchStartTime) / 1000));
    } else if (completedCount > 0 && matchStartTime) {
      // Find latest completed checkpoint
      const latestCp = completedList.reduce((latest, c) => {
        return (c.completedAt || 0) > (latest.completedAt || 0) ? c : latest;
      }, completedList[0]);
      if (latestCp?.completedAt) {
        timeSec = Math.max(1, Math.round((latestCp.completedAt - matchStartTime) / 1000));
      }
    }

    return {
      player: p,
      checkpointsCompleted: completedCount,
      totalCheckpoints: totalCount,
      completionTimeSec: timeSec,
      formattedTime: timeSec !== null ? formatSeconds(timeSec) : '--:--',
      isAllCompleted: isAll,
    };
  });

  // Sort criteria:
  // 1. All completed (3/3) come before partial
  // 2. Faster completion time comes first
  // 3. More completed checkpoints comes first
  entries.sort((a, b) => {
    if (a.isAllCompleted && !b.isAllCompleted) return -1;
    if (!a.isAllCompleted && b.isAllCompleted) return 1;

    if (a.isAllCompleted && b.isAllCompleted) {
      return (a.completionTimeSec || 99999) - (b.completionTimeSec || 99999);
    }

    if (a.checkpointsCompleted !== b.checkpointsCompleted) {
      return b.checkpointsCompleted - a.checkpointsCompleted;
    }

    return (a.completionTimeSec || 99999) - (b.completionTimeSec || 99999);
  });

  return entries.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));
}

/**
 * Format seconds into mm:ss
 */
export function formatSeconds(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check game end conditions
 */
export function checkGameEnd(
  players: Player[],
  overallTimeRemainingSec: number
): { isGameOver: boolean; winner: 'DENNER' | 'HIDERS' | null; reason: string } {
  if (players.length === 0) {
    return { isGameOver: false, winner: null, reason: 'Waiting for players' };
  }

  const activeHiders = players.filter((p) => p.role === 'HIDER' && p.status === 'ACTIVE');
  const hasSeeker = players.some((p) => p.role === 'DENNER');

  // Condition 1: Checkpoint Objective Completion
  // "Therefore once every hider left completes all three check point , the hiders win."
  if (activeHiders.length > 0) {
    const allRemainingCompletedAll = activeHiders.every(
      (hider) =>
        hider.checkpoints &&
        hider.checkpoints.length >= 3 &&
        hider.checkpoints.every((cp) => cp.completed)
    );
    if (allRemainingCompletedAll) {
      return {
        isGameOver: true,
        winner: 'HIDERS',
        reason: 'Mission Accomplished! All active hiders completed all 3 checkpoints.',
      };
    }
  }

  // Condition 2: All hiders are found or converted -> Denner team wins!
  if (hasSeeker && activeHiders.length === 0) {
    return {
      isGameOver: true,
      winner: 'DENNER',
      reason: 'All hiders have been successfully captured!',
    };
  }

  // Condition 3: Overall timer expires and at least 1 hider remains -> Hiders win!
  if (overallTimeRemainingSec <= 0) {
    if (activeHiders.length > 0) {
      return {
        isGameOver: true,
        winner: 'HIDERS',
        reason: `Time expired! ${activeHiders.length} hider(s) evaded capture.`,
      };
    } else {
      return {
        isGameOver: true,
        winner: 'DENNER',
        reason: 'All hiders have been successfully captured!',
      };
    }
  }

  return { isGameOver: false, winner: null, reason: 'Game in progress' };
}


export const JNTUH_CAMPUS_BOUNDS = {
  minLat: 17.4900,
  maxLat: 17.4965,
  minLng: 78.3885,
  maxLng: 78.3945,
};

export const JNTUH_VERIFIED_CHECKPOINTS = [
  { code: 'A', name: 'JNTU Central Library', latitude: 17.4947, longitude: 78.3912, sector: 'Academic Core' },
  { code: 'B', name: 'JNTU Main Ground & Pavilion', latitude: 17.4918, longitude: 78.3895, sector: 'Sports Wing' },
  { code: 'C', name: 'BR Ambedkar Statue Plaza', latitude: 17.4938, longitude: 78.3915, sector: 'Central Quad' },
  { code: 'D', name: 'Mechanical & Civil Blocks', latitude: 17.4942, longitude: 78.3902, sector: 'Engineering Sector' },
  { code: 'E', name: 'JN Auditorium (Audi)', latitude: 17.4916, longitude: 78.3917, sector: 'Cultural Sector' },
  { code: 'F', name: 'CRC Building & SBI Plaza', latitude: 17.4928, longitude: 78.3925, sector: 'Commercial Sector' },
  { code: 'G', name: 'IST / SIT Campus Building', latitude: 17.4922, longitude: 78.3932, sector: 'Tech Complex' },
  { code: 'H', name: 'Examination Branch Quad', latitude: 17.4958, longitude: 78.3925, sector: 'Admin Sector' },
  { code: 'J', name: 'Indoor Sports Complex & Courts', latitude: 17.4912, longitude: 78.3908, sector: 'Athletic Wing' },
  { code: 'K', name: 'Godavari Student Hostels Area', latitude: 17.4908, longitude: 78.3890, sector: 'Hostel Sector' },
  { code: 'L', name: 'PG Block & Staff Quarters Area', latitude: 17.4905, longitude: 78.3925, sector: 'Residential Sector' },
  { code: 'M', name: 'Admin Block Front Grounds', latitude: 17.4963, longitude: 78.3938, sector: 'Front Gate Sector' },
];

/**
 * Generates 3 verified spots strictly inside the JNTUH campus territory under 500m
 */
export function generateCheckpoints(
  centerLat: number,
  centerLng: number,
  count = 3
): Checkpoint[] {
  const safeLat =
    typeof centerLat === 'number' && !isNaN(centerLat) && Math.abs(centerLat) > 0.001
      ? centerLat
      : 17.4933;
  const safeLng =
    typeof centerLng === 'number' && !isNaN(centerLng) && Math.abs(centerLng) > 0.001
      ? centerLng
      : 78.3914;

  // Filter landmarks strictly inside campus bounds and within 500m of seeker center
  const candidates = JNTUH_VERIFIED_CHECKPOINTS.map((item) => {
    // Clamp to ensure zero coordinates ever escape campus boundaries
    const lat = Math.max(JNTUH_CAMPUS_BOUNDS.minLat, Math.min(JNTUH_CAMPUS_BOUNDS.maxLat, item.latitude));
    const lng = Math.max(JNTUH_CAMPUS_BOUNDS.minLng, Math.min(JNTUH_CAMPUS_BOUNDS.maxLng, item.longitude));
    const dist = calculateDistanceMeters(safeLat, safeLng, lat, lng);
    return { ...item, latitude: lat, longitude: lng, dist };
  }).filter((item) => item.dist <= 500);

  // Shuffle candidates deterministically or randomly to provide distinct sectors
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const selectedPool = shuffled.length >= count ? shuffled.slice(0, count) : JNTUH_VERIFIED_CHECKPOINTS.slice(0, count);

  const sectorLetters = ['A', 'B', 'C', 'D', 'E'];

  return selectedPool.map((item, index) => {
    const dist = calculateDistanceMeters(safeLat, safeLng, item.latitude, item.longitude);
    return {
      id: `cp_${index + 1}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      code: sectorLetters[index % sectorLetters.length] || item.code,
      name: `${item.name} (${Math.round(dist)}m)`,
      latitude: parseFloat(item.latitude.toFixed(6)),
      longitude: parseFloat(item.longitude.toFixed(6)),
      radiusMeters: 50,
      completed: false,
    };
  });
}

/**
 * Generates a clean 6-character room code
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous characters (0, O, 1, I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Calculate distance in meters using Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Pick a random denner from players list
 */
export function assignRandomDenner(players: Player[]): Player[] {
  if (players.length === 0) return [];
  const dennerIndex = Math.floor(Math.random() * players.length);
  return players.map((p, index) => ({
    ...p,
    role: index === dennerIndex ? ('DENNER' as const) : ('HIDER' as const),
    status: 'ACTIVE' as const,
  }));
}

/**
 * Validates that a GPS latitude/longitude pair is a real, finite coordinate
 * (rejects NaN, Infinity, or uninitialized 0,0 coordinates).
 */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001)
  );
}

/**
 * Pure visibility rule determining whether `viewer` should see `target` on the tactical map.
 */
export function shouldPlayerSeeTarget(
  viewer: Pick<Player, 'id' | 'role' | 'status'>,
  target: Pick<Player, 'id' | 'role' | 'status'>,
  isRevealActive: boolean
): boolean {
  if (target.id === viewer.id) {
    return true;
  }

  // Active Hiders ONLY see themselves
  if (viewer.role === 'HIDER' && viewer.status === 'ACTIVE') {
    return false;
  }

  // Seekers (DENNER) see fellow seekers, found players, and active hiders ONLY during reveal flash
  if (viewer.role === 'DENNER') {
    if (target.role === 'DENNER') return true;
    if (target.status === 'FOUND') return true;
    return isRevealActive;
  }

  // Caught hiders during 30s cooldown only see themselves until converted to Seeker
  return false;
}

/**
 * Computes the exact cycleSeconds value for debug jump actions regardless of custom pingIntervalSeconds.
 */
export function getDebugCycleTargetSeconds(
  pingIntervalSec: number,
  mode: 'SKIP_TO_WARNING' | 'TRIGGER_REVEAL'
): number {
  const safePing = Math.max(30, pingIntervalSec || 300);
  if (mode === 'TRIGGER_REVEAL') {
    return safePing;
  }
  const warningDuration = Math.min(30, Math.max(5, Math.floor(safePing * 0.25)));
  const warnStart = Math.max(0, safePing - warningDuration);
  return Math.max(0, warnStart - 5);
}

/**
 * Clears all per-match capture, cooldown, and checkpoint fields when starting a new match.
 */
export function preparePlayerForNewMatch(
  player: Player,
  role: Role,
  checkpoints: Checkpoint[] = []
): Player {
  return {
    ...player,
    role,
    status: 'ACTIVE',
    lastFoundAt: undefined,
    pendingCapture: null,
    cooldownRemainingSec: undefined,
    checkpoints,
    allCheckpointsCompletedAt: undefined,
    checkpointCompletionTimeSec: undefined,
  };
}

/**
 * Resets a player's per-match fields when returning to the lobby.
 */
export function resetPlayerForLobby(player: Player): Player {
  return preparePlayerForNewMatch(player, player.isHost ? 'DENNER' : 'HIDER', []);
}

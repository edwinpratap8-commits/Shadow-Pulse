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

export interface RadioTransmission {
  id: string;
  senderId: string;
  senderName: string;
  targetType: RadioTargetType;
  targetPlayerId?: string;
  targetPlayerName?: string;
  audioData: string;
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

const CHECKPOINT_SECTORS = [
  { code: 'A', name: 'Waypoint Alpha' },
  { code: 'B', name: 'Waypoint Bravo' },
  { code: 'C', name: 'Waypoint Charlie' },
];

/**
 * Generates 3 random spots under 500m around the seeker's starting location inside JNTUH campus area
 */
export function generateCheckpoints(
  centerLat: number,
  centerLng: number,
  count = 3
): Checkpoint[] {
  const checkpoints: Checkpoint[] = [];
  // Default to JNTUH campus center if coordinates are uninitialized
  const safeLat =
    typeof centerLat === 'number' && !isNaN(centerLat) && Math.abs(centerLat) > 0.001
      ? centerLat
      : 17.4933;
  const safeLng =
    typeof centerLng === 'number' && !isNaN(centerLng) && Math.abs(centerLng) > 0.001
      ? centerLng
      : 78.3914;

  const latRad = (safeLat * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(latRad);

  for (let i = 0; i < count; i++) {
    const meta = CHECKPOINT_SECTORS[i % CHECKPOINT_SECTORS.length];
    // Spread in distinct directional quadrants/angles under 500m
    const baseAngle = (i * (2 * Math.PI / count)) + (Math.random() - 0.5) * 0.8;
    // Radius between 70m and 460m (strictly under 500m)
    const distanceMeters = 70 + Math.random() * 380;

    const dy = distanceMeters * Math.sin(baseAngle);
    const dx = distanceMeters * Math.cos(baseAngle);

    const cpLat = safeLat + dy / metersPerDegLat;
    const cpLng = safeLng + dx / metersPerDegLng;

    checkpoints.push({
      id: `cp_${i + 1}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      code: meta.code,
      name: `${meta.name} (${Math.round(distanceMeters)}m)`,
      latitude: parseFloat(cpLat.toFixed(6)),
      longitude: parseFloat(cpLng.toFixed(6)),
      radiusMeters: 50,
      completed: false,
    });
  }

  return checkpoints;
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

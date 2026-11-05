/**
 * Core mathematical and game state rules for ShadowPulse Tactical Hide and Seek.
 * Fully decoupled for deterministic unit testing.
 */

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
  batteryLevel?: number;
}

export type RadarPhase = 'SAFE' | 'WARNING' | 'REVEAL';

export interface RadarPhaseState {
  phase: RadarPhase;
  secondsIntoCycle: number;
  secondsRemainingInCycle: number;
  warningCountdown: number; // 30 down to 0
  revealCountdown: number;  // 10 down to 0
  isWarningActive: boolean;
  isRevealActive: boolean;
}

export const RADAR_CYCLE_DURATION = 300; // 5 minutes = 300 seconds
export const WARNING_DURATION = 30;      // 30 seconds before 300s mark (at 270s)
export const REVEAL_DURATION = 10;       // 10 seconds live flash (from 300s to 310s or 290-300)

/**
 * Radar Cycle Architecture:
 * Total cycle = 300 seconds.
 * 0s to 270s (4m 30s): SAFE phase (locations hidden from Denner).
 * 270s to 300s (last 30s): WARNING phase (screen warning banner, pulse, vibration).
 * At 300s, for 10 seconds: REVEAL phase (live GPS broadcast with pulsing radar pins).
 * Total cycle period = 310s (or 300s with 290-300s reveal).
 * Per spec:
 * "Standard State (0:00 to 4:30 of cycle)" -> 270 seconds
 * "30-Second Warning Alert (at 4:30 mark / 30 seconds before reveal)" -> 270s to 300s
 * "10-Second Live Location Flash (at 5:00 mark): For exactly 10 seconds..." -> 10s flash
 * After 10-second reveal window ends, pins disappear and 5-minute countdown resets.
 * Thus: Total repeating cycle = 310 seconds (270s safe + 30s warning + 10s flash).
 */
export const TOTAL_CYCLE_SECONDS = 310;
export const SAFE_THRESHOLD = 270;
export const WARNING_THRESHOLD = 300;

export function getRadarPhaseState(cycleSecond: number): RadarPhaseState {
  // Normalize cycleSecond within [0, TOTAL_CYCLE_SECONDS)
  const sec = Math.max(0, cycleSecond % TOTAL_CYCLE_SECONDS);

  if (sec < SAFE_THRESHOLD) {
    // 0 to 269: Safe period
    const secondsRemainingToWarning = SAFE_THRESHOLD - sec;
    const secondsRemainingToReveal = WARNING_THRESHOLD - sec;
    return {
      phase: 'SAFE',
      secondsIntoCycle: sec,
      secondsRemainingInCycle: secondsRemainingToReveal,
      warningCountdown: secondsRemainingToWarning,
      revealCountdown: 0,
      isWarningActive: false,
      isRevealActive: false,
    };
  } else if (sec < WARNING_THRESHOLD) {
    // 270 to 299: 30-Second Warning Alert
    const countdown = WARNING_THRESHOLD - sec;
    return {
      phase: 'WARNING',
      secondsIntoCycle: sec,
      secondsRemainingInCycle: countdown,
      warningCountdown: countdown,
      revealCountdown: 0,
      isWarningActive: true,
      isRevealActive: false,
    };
  } else {
    // 300 to 309: 10-Second Live Location Flash
    const remainingReveal = TOTAL_CYCLE_SECONDS - sec;
    return {
      phase: 'REVEAL',
      secondsIntoCycle: sec,
      secondsRemainingInCycle: 0,
      warningCountdown: 0,
      revealCountdown: remainingReveal,
      isWarningActive: false,
      isRevealActive: true,
    };
  }
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
  const hiders = players.filter((p) => p.role === 'HIDER');

  if (hiders.length === 0) {
    return { isGameOver: false, winner: null, reason: 'Waiting for players' };
  }

  const unfoundHiders = hiders.filter((p) => p.status === 'ACTIVE');

  // Condition 1: All hiders are found -> Denner wins!
  if (unfoundHiders.length === 0) {
    return {
      isGameOver: true,
      winner: 'DENNER',
      reason: 'All hiders have been successfully captured!',
    };
  }

  // Condition 2: Overall timer expires and at least 1 hider remains -> Hiders win!
  if (overallTimeRemainingSec <= 0) {
    return {
      isGameOver: true,
      winner: 'HIDERS',
      reason: `Time expired! ${unfoundHiders.length} hider(s) evaded capture.`,
    };
  }

  return { isGameOver: false, winner: null, reason: 'Game in progress' };
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

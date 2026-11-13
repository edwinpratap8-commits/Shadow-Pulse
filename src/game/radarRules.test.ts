import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRadarPhaseState,
  formatSeconds,
  checkGameEnd,
  assignRandomDenner,
  calculateDistanceMeters,
  generateCheckpoints,
  rankHidersByCheckpointSpeed,
  isValidCoordinate,
  shouldPlayerSeeTarget,
  getDebugCycleTargetSeconds,
  preparePlayerForNewMatch,
  resetPlayerForLobby,
  Player,
} from './radarRules';

test('getRadarPhaseState transitions correctly through cycle', () => {
  // At 0 seconds: Safe phase
  const at0 = getRadarPhaseState(0);
  assert.equal(at0.phase, 'SAFE');
  assert.equal(at0.isWarningActive, false);
  assert.equal(at0.isRevealActive, false);
  assert.equal(at0.secondsRemainingInCycle, 300);

  // At 269 seconds: Still safe
  const at269 = getRadarPhaseState(269);
  assert.equal(at269.phase, 'SAFE');
  assert.equal(at269.isWarningActive, false);

  // At 270 seconds: 30-Second Warning triggers!
  const at270 = getRadarPhaseState(270);
  assert.equal(at270.phase, 'WARNING');
  assert.equal(at270.isWarningActive, true);
  assert.equal(at270.warningCountdown, 30);
  assert.equal(at270.isRevealActive, false);

  // At 299 seconds: Last second of warning
  const at299 = getRadarPhaseState(299);
  assert.equal(at299.phase, 'WARNING');
  assert.equal(at299.warningCountdown, 1);

  // At 300 seconds: 10-Second Live Location Flash starts!
  const at300 = getRadarPhaseState(300);
  assert.equal(at300.phase, 'REVEAL');
  assert.equal(at300.isRevealActive, true);
  assert.equal(at300.revealCountdown, 10);
  assert.equal(at300.isWarningActive, false);

  // At 309 seconds: Last second of reveal
  const at309 = getRadarPhaseState(309);
  assert.equal(at309.phase, 'REVEAL');
  assert.equal(at309.revealCountdown, 1);

  // At 310 seconds: Resets automatically to next cycle (0s = SAFE)
  const at310 = getRadarPhaseState(310);
  assert.equal(at310.phase, 'SAFE');
  assert.equal(at310.isWarningActive, false);
  assert.equal(at310.isRevealActive, false);
});

test('formatSeconds formats minutes and seconds cleanly', () => {
  assert.equal(formatSeconds(0), '00:00');
  assert.equal(formatSeconds(59), '00:59');
  assert.equal(formatSeconds(60), '01:00');
  assert.equal(formatSeconds(300), '05:00');
  assert.equal(formatSeconds(3599), '59:59');
});

test('checkGameEnd handles win conditions', () => {
  const mockPlayers: Player[] = [
    {
      id: 'p1',
      name: 'Seeker One',
      role: 'DENNER',
      status: 'ACTIVE',
      isHost: true,
      latitude: 0,
      longitude: 0,
    },
    {
      id: 'p2',
      name: 'Hider Alpha',
      role: 'HIDER',
      status: 'ACTIVE',
      isHost: false,
      latitude: 0,
      longitude: 0,
    },
    {
      id: 'p3',
      name: 'Hider Bravo',
      role: 'HIDER',
      status: 'ACTIVE',
      isHost: false,
      latitude: 0,
      longitude: 0,
    },
  ];

  // In progress
  const inProgress = checkGameEnd(mockPlayers, 1000);
  assert.equal(inProgress.isGameOver, false);
  assert.equal(inProgress.winner, null);

  // Denner wins when all hiders marked found
  const allFoundPlayers: Player[] = mockPlayers.map((p) =>
    p.role === 'HIDER' ? { ...p, status: 'FOUND' as const } : p
  );
  const dennerWon = checkGameEnd(allFoundPlayers, 500);
  assert.equal(dennerWon.isGameOver, true);
  assert.equal(dennerWon.winner, 'DENNER');

  // Hiders win when time runs out with active hiders
  const timeExpired = checkGameEnd(mockPlayers, 0);
  assert.equal(timeExpired.isGameOver, true);
  assert.equal(timeExpired.winner, 'HIDERS');
});

test('assignRandomDenner assigns exactly one Denner and sets others to HIDER', () => {
  const players: Player[] = [
    { id: '1', name: 'Alice', role: 'HIDER', status: 'ACTIVE', isHost: true, latitude: 0, longitude: 0 },
    { id: '2', name: 'Bob', role: 'HIDER', status: 'ACTIVE', isHost: false, latitude: 0, longitude: 0 },
    { id: '3', name: 'Charlie', role: 'HIDER', status: 'ACTIVE', isHost: false, latitude: 0, longitude: 0 },
  ];

  const assigned = assignRandomDenner(players);
  const denners = assigned.filter((p) => p.role === 'DENNER');
  const hiders = assigned.filter((p) => p.role === 'HIDER');

  assert.equal(denners.length, 1);
  assert.equal(hiders.length, 2);
});

test('calculateDistanceMeters measures distance between coordinates', () => {
  // Distance from New York (40.7128, -74.0060) to nearby point ~111m north (approx 0.001 deg lat)
  const dist = calculateDistanceMeters(40.7128, -74.006, 40.7138, -74.006);
  assert.ok(dist >= 100 && dist <= 125, `Expected ~111m, got ${dist}`);
});

test('generateCheckpoints creates 3 points under 500m radius around seeker center', () => {
  const centerLat = 17.4933;
  const centerLng = 78.3914;
  const checkpoints = generateCheckpoints(centerLat, centerLng, 3);

  assert.equal(checkpoints.length, 3);
  for (const cp of checkpoints) {
    assert.equal(cp.completed, false);
    assert.equal(cp.radiusMeters, 50);
    const dist = calculateDistanceMeters(centerLat, centerLng, cp.latitude, cp.longitude);
    assert.ok(dist < 500, `Checkpoint ${cp.name} distance ${dist}m must be under 500m`);
    assert.ok(dist > 50, `Checkpoint ${cp.name} distance ${dist}m should be outside immediate spawn`);
  }
});

test('checkGameEnd triggers hiders win when all active hiders complete all 3 checkpoints', () => {
  const centerLat = 17.4933;
  const centerLng = 78.3914;
  const cpSet1 = generateCheckpoints(centerLat, centerLng, 3);
  const cpSet2 = generateCheckpoints(centerLat, centerLng, 3);

  const players: Player[] = [
    {
      id: 'denner1',
      name: 'Seeker',
      role: 'DENNER',
      status: 'ACTIVE',
      isHost: true,
      latitude: centerLat,
      longitude: centerLng,
    },
    {
      id: 'hider1',
      name: 'Hider One',
      role: 'HIDER',
      status: 'ACTIVE',
      isHost: false,
      latitude: centerLat + 0.001,
      longitude: centerLng + 0.001,
      checkpoints: cpSet1.map((cp) => ({ ...cp, completed: true })),
    },
    {
      id: 'hider2',
      name: 'Hider Two',
      role: 'HIDER',
      status: 'ACTIVE',
      isHost: false,
      latitude: centerLat + 0.002,
      longitude: centerLng + 0.002,
      checkpoints: cpSet2.map((cp) => ({ ...cp, completed: false })),
    },
  ];

  // Only 1 of 2 hiders completed: Not over yet
  const partial = checkGameEnd(players, 800);
  assert.equal(partial.isGameOver, false);

  // Both completed all 3 checkpoints: Hiders Win!
  players[2].checkpoints = cpSet2.map((cp) => ({ ...cp, completed: true }));
  const completedWin = checkGameEnd(players, 800);
  assert.equal(completedWin.isGameOver, true);
  assert.equal(completedWin.winner, 'HIDERS');
  assert.match(completedWin.reason, /checkpoints/i);
});

test('getRadarPhaseState works with custom ping intervals and reveal durations', () => {
  // Test 30s ping frequency with 5s flash duration -> 35s total cycle
  // warningDuration = min(30, max(5, floor(30 * 0.25))) = 7s
  // safe: 0..22s, warning: 23..29s, reveal: 30..34s
  const stateAt0 = getRadarPhaseState(0, 30, 5);
  assert.equal(stateAt0.phase, 'SAFE');
  assert.equal(stateAt0.totalCycleSeconds, 35);
  assert.equal(stateAt0.secondsRemainingInCycle, 30);

  const stateAt25 = getRadarPhaseState(25, 30, 5);
  assert.equal(stateAt25.phase, 'WARNING');
  assert.equal(stateAt25.isWarningActive, true);

  const stateAt31 = getRadarPhaseState(31, 30, 5);
  assert.equal(stateAt31.phase, 'REVEAL');
  assert.equal(stateAt31.isRevealActive, true);
  assert.equal(stateAt31.revealCountdown, 4); // 35 - 31 = 4
});

test('rankHidersByCheckpointSpeed correctly ranks hiders by fastest completion', () => {
  const matchStart = 100000;
  const mockPlayers: Player[] = [
    {
      id: 'hider1',
      name: 'Slow Hider',
      role: 'HIDER',
      status: 'ACTIVE',
      isHost: false,
      latitude: 0,
      longitude: 0,
      checkpointCompletionTimeSec: 180, // 3 mins
      checkpoints: [
        { id: '1', code: 'A', name: 'A', latitude: 0, longitude: 0, radiusMeters: 50, completed: true },
        { id: '2', code: 'B', name: 'B', latitude: 0, longitude: 0, radiusMeters: 50, completed: true },
        { id: '3', code: 'C', name: 'C', latitude: 0, longitude: 0, radiusMeters: 50, completed: true },
      ],
    },
    {
      id: 'hider2',
      name: 'Speedy Hider',
      role: 'HIDER',
      status: 'ACTIVE',
      isHost: false,
      latitude: 0,
      longitude: 0,
      checkpointCompletionTimeSec: 85, // 1 min 25s
      checkpoints: [
        { id: '1', code: 'A', name: 'A', latitude: 0, longitude: 0, radiusMeters: 50, completed: true },
        { id: '2', code: 'B', name: 'B', latitude: 0, longitude: 0, radiusMeters: 50, completed: true },
        { id: '3', code: 'C', name: 'C', latitude: 0, longitude: 0, radiusMeters: 50, completed: true },
      ],
    },
    {
      id: 'hider3',
      name: 'Partial Hider',
      role: 'HIDER',
      status: 'ACTIVE',
      isHost: false,
      latitude: 0,
      longitude: 0,
      checkpoints: [
        { id: '1', code: 'A', name: 'A', latitude: 0, longitude: 0, radiusMeters: 50, completed: true },
        { id: '2', code: 'B', name: 'B', latitude: 0, longitude: 0, radiusMeters: 50, completed: false },
        { id: '3', code: 'C', name: 'C', latitude: 0, longitude: 0, radiusMeters: 50, completed: false },
      ],
    },
  ];

  const ranked = rankHidersByCheckpointSpeed(mockPlayers, matchStart);
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].player.name, 'Speedy Hider');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[0].formattedTime, '01:25');
  assert.equal(ranked[1].player.name, 'Slow Hider');
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[2].player.name, 'Partial Hider');
  assert.equal(ranked[2].rank, 3);
});

test('shouldPlayerSeeTarget enforces strict stealth for active hiders and reveal-only visibility for seekers', () => {
  const seeker: Player = { id: 's1', name: 'Seeker', role: 'DENNER', status: 'ACTIVE', isHost: true, latitude: 17.493, longitude: 78.391 };
  const coSeeker: Player = { id: 's2', name: 'CoSeeker', role: 'DENNER', status: 'ACTIVE', isHost: false, latitude: 17.494, longitude: 78.392 };
  const hider1: Player = { id: 'h1', name: 'Hider1', role: 'HIDER', status: 'ACTIVE', isHost: false, latitude: 17.492, longitude: 78.390 };
  const hider2: Player = { id: 'h2', name: 'Hider2', role: 'HIDER', status: 'ACTIVE', isHost: false, latitude: 17.495, longitude: 78.393 };
  const caughtHider: Player = { id: 'h3', name: 'Caught', role: 'HIDER', status: 'FOUND', isHost: false, latitude: 17.491, longitude: 78.389 };

  // Active hider sees ONLY self even during reveal
  assert.equal(shouldPlayerSeeTarget(hider1, hider1, true), true);
  assert.equal(shouldPlayerSeeTarget(hider1, hider2, true), false);
  assert.equal(shouldPlayerSeeTarget(hider1, seeker, true), false);
  assert.equal(shouldPlayerSeeTarget(hider1, caughtHider, true), false);

  // Seeker outside reveal: sees self, co-seeker, and caught hider, NOT active hiders
  assert.equal(shouldPlayerSeeTarget(seeker, seeker, false), true);
  assert.equal(shouldPlayerSeeTarget(seeker, coSeeker, false), true);
  assert.equal(shouldPlayerSeeTarget(seeker, caughtHider, false), true);
  assert.equal(shouldPlayerSeeTarget(seeker, hider1, false), false);

  // Seeker during reveal: sees active hiders!
  assert.equal(shouldPlayerSeeTarget(seeker, hider1, true), true);
  assert.equal(shouldPlayerSeeTarget(seeker, hider2, true), true);

  // Caught hider during cooldown only sees self
  assert.equal(shouldPlayerSeeTarget(caughtHider, caughtHider, true), true);
  assert.equal(shouldPlayerSeeTarget(caughtHider, hider1, true), false);
});

test('getDebugCycleTargetSeconds hits REVEAL and pre-WARNING across custom ping intervals', () => {
  for (const pingSec of [30, 60, 120, 300, 600]) {
    const revealStart = getDebugCycleTargetSeconds(pingSec, 'TRIGGER_REVEAL');
    const revealState = getRadarPhaseState(revealStart, pingSec, 10);
    assert.equal(revealState.phase, 'REVEAL', `Expected REVEAL for ping=${pingSec}s at cycle=${revealStart}`);
    assert.equal(revealState.isRevealActive, true);
    assert.equal(revealState.revealCountdown, 10);

    const preWarn = getDebugCycleTargetSeconds(pingSec, 'SKIP_TO_WARNING');
    const preWarnState = getRadarPhaseState(preWarn, pingSec, 10);
    assert.equal(preWarnState.phase, 'SAFE', `Expected SAFE 5s before warning for ping=${pingSec}s`);
  }
});

test('preparePlayerForNewMatch and resetPlayerForLobby clear all stale match metadata', () => {
  const dirtyPlayer: Player = {
    id: 'p1',
    name: 'Shadow',
    role: 'HIDER',
    status: 'FOUND',
    isHost: true,
    latitude: 17.4933,
    longitude: 78.3914,
    lastFoundAt: 123456789,
    pendingCapture: { seekerId: 's1', seekerName: 'Hunter', timestamp: 123456 },
    cooldownRemainingSec: 12,
    allCheckpointsCompletedAt: 123459,
    checkpointCompletionTimeSec: 95,
    checkpoints: [
      { id: 'c1', code: 'A', name: 'Lib', latitude: 17.494, longitude: 78.391, radiusMeters: 50, completed: true },
    ],
  };

  const reset = resetPlayerForLobby(dirtyPlayer);
  assert.equal(reset.role, 'DENNER'); // host defaults to DENNER in lobby
  assert.equal(reset.status, 'ACTIVE');
  assert.equal(reset.lastFoundAt, undefined);
  assert.equal(reset.pendingCapture, null);
  assert.equal(reset.cooldownRemainingSec, undefined);
  assert.equal(reset.allCheckpointsCompletedAt, undefined);
  assert.equal(reset.checkpointCompletionTimeSec, undefined);
  assert.deepEqual(reset.checkpoints, []);

  const newMatchHider = preparePlayerForNewMatch(dirtyPlayer, 'HIDER', []);
  assert.equal(newMatchHider.role, 'HIDER');
  assert.equal(newMatchHider.lastFoundAt, undefined);
  assert.equal(newMatchHider.pendingCapture, null);
});

test('isValidCoordinate rejects uninitialized zero and non-finite coordinates', () => {
  assert.equal(isValidCoordinate(17.4933, 78.3914), true);
  assert.equal(isValidCoordinate(0, 0), false);
  assert.equal(isValidCoordinate(NaN, 78.3914), false);
  assert.equal(isValidCoordinate(17.4933, Infinity), false);
  assert.equal(isValidCoordinate(95, 78.3914), false);
});


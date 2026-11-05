import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRadarPhaseState,
  formatSeconds,
  checkGameEnd,
  assignRandomDenner,
  calculateDistanceMeters,
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

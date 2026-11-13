const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isValidTankMove,
  segmentDistanceToPoint,
  segmentIntersectsWall,
  TANK_WALLS
} = require('./tankBattle');

const tank = { x: 100, y: 250, angle: 0 };
const opponentTank = { x: 700, y: 250 };

test('accepts normal movement and rotation at the 20 Hz sync rate', () => {
  assert.equal(isValidTankMove({
    tank,
    opponentTank,
    x: 109.6,
    y: 250,
    angle: 0.165,
    elapsedSeconds: 0.05
  }), true);
});

test('allows realistic movement after delayed network updates', () => {
  assert.equal(isValidTankMove({
    tank,
    opponentTank,
    x: 190,
    y: 250,
    angle: 0.9,
    elapsedSeconds: 0.5
  }), true);
});

test('rejects movement that exceeds the elapsed-time speed allowance', () => {
  assert.equal(isValidTankMove({
    tank,
    opponentTank,
    x: 140,
    y: 250,
    angle: 0,
    elapsedSeconds: 0.05
  }), false);
});

test('rejects positions inside walls, outside the arena, or through the opponent', () => {
  for (const [x, y] of [[200, 150], [10, 250], [700, 250]]) {
    assert.equal(isValidTankMove({
      tank,
      opponentTank,
      x,
      y,
      angle: 0,
      elapsedSeconds: 0.12
    }), false);
  }
});

test('keeps an unobstructed center firing lane between the starting tanks', () => {
  const blocked = TANK_WALLS.some(wall =>
    segmentIntersectsWall(130, 250, 670, 250, wall)
  );
  assert.equal(blocked, false);
});

test('detects bullets crossing obstacles or tanks between server ticks', () => {
  assert.equal(segmentIntersectsWall(160, 140, 280, 140, TANK_WALLS[0]), true);
  assert.ok(segmentDistanceToPoint(100, 250, 150, 250, 130, 263) < 18);
});

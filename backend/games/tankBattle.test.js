const test = require('node:test');
const assert = require('node:assert/strict');
const {
  advanceTank,
  createTankInput,
  createTankVolley,
  segmentDistanceToPoint,
  segmentIntersectsWall,
  TANK_WALLS
} = require('./tankBattle');

test('advances tanks from input on the server at the 20 Hz tick rate', () => {
  const tank = { x: 100, y: 250, angle: 0 };
  const opponent = { x: 700, y: 250, angle: Math.PI };
  assert.equal(advanceTank(tank, opponent, { move: 1, turn: 0, autoRotate: false }, 0.05), true);
  assert.ok(Math.abs(tank.x - 109.6) < 1e-9);
  assert.equal(tank.y, 250);
});

test('moving forward with auto-rotation disabled keeps the tank on a straight heading', () => {
  const tank = { x: 100, y: 250, angle: Math.PI / 2 };
  const opponent = { x: 700, y: 250, angle: Math.PI };
  advanceTank(tank, opponent, { move: 1, turn: 0, autoRotate: false }, 0.05);
  assert.ok(Math.abs(tank.x - 100) < 1e-9);
  assert.ok(Math.abs(tank.y - 259.6) < 1e-9);
  assert.equal(tank.angle, Math.PI / 2);
});

test('server auto-rotation and manual steering use the same controls as the client', () => {
  const tank = { x: 100, y: 250, angle: 0 };
  const opponent = { x: 700, y: 250, angle: Math.PI };
  advanceTank(tank, opponent, createTankInput(), 0.05);
  assert.ok(Math.abs(tank.angle - 0.165) < 1e-9);
  advanceTank(tank, opponent, { move: 0, turn: -1, autoRotate: false }, 0.05);
  assert.ok(Math.abs(tank.angle - (0.165 - 0.2475)) < 1e-9);
});

test('server movement stops at arena walls and other tanks', () => {
  const wallTank = { x: 168, y: 140, angle: 0 };
  advanceTank(wallTank, { x: 700, y: 250 }, { move: 1, turn: 0, autoRotate: false }, 0.1);
  assert.equal(wallTank.x, 168);

  const blockedTank = { x: 650, y: 250, angle: 0 };
  advanceTank(blockedTank, { x: 670, y: 250 }, { move: 1, turn: 0, autoRotate: false }, 0.1);
  assert.equal(blockedTank.x, 650);
});

test('creates a two-bullet volley aligned with the supplied visible aim angle', () => {
  const tank = { x: 100, y: 250, angle: 0 };
  const aimAngle = Math.PI / 3;
  const volley = createTankVolley(tank, aimAngle, 1, 4);

  assert.equal(volley.length, 2);
  assert.deepEqual(volley.map(bullet => bullet.id), [4, 5]);
  for (const bullet of volley) {
    assert.equal(bullet.ownerIndex, 1);
    assert.ok(Math.abs(Math.atan2(bullet.vy, bullet.vx) - aimAngle) < 1e-9);
  }
  assert.equal(volley[0].vx, volley[1].vx);
  assert.equal(volley[0].vy, volley[1].vy);
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

const TANK_WALLS = [
  { x: 180, y: 90, w: 70, h: 105 },
  { x: 180, y: 305, w: 70, h: 105 },
  { x: 550, y: 90, w: 70, h: 105 },
  { x: 550, y: 305, w: 70, h: 105 },
  { x: 345, y: 130, w: 45, h: 80 },
  { x: 410, y: 290, w: 45, h: 80 }
];

const TANK_RADIUS = 16;
const TANK_MAX_SPEED = 192;
const TANK_MAX_ROTATION_SPEED = 3.3;

function tankPositionBlocked(x, y) {
  if (x < TANK_RADIUS || x > 800 - TANK_RADIUS || y < TANK_RADIUS || y > 500 - TANK_RADIUS) return true;
  return TANK_WALLS.some(wall =>
    x + TANK_RADIUS > wall.x && x - TANK_RADIUS < wall.x + wall.w &&
    y + TANK_RADIUS > wall.y && y - TANK_RADIUS < wall.y + wall.h
  );
}

function segmentIntersectsWall(x1, y1, x2, y2, wall) {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(distance / 4));
  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    const x = x1 + (x2 - x1) * ratio;
    const y = y1 + (y2 - y1) * ratio;
    if (x >= wall.x && x <= wall.x + wall.w && y >= wall.y && y <= wall.y + wall.h) return true;
  }
  return false;
}

function segmentDistanceToPoint(x1, y1, x2, y2, pointX, pointY) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(pointX - x1, pointY - y1);
  const projection = Math.max(0, Math.min(1, ((pointX - x1) * dx + (pointY - y1) * dy) / lengthSquared));
  return Math.hypot(pointX - (x1 + projection * dx), pointY - (y1 + projection * dy));
}

function createTankInput() {
  return { move: 0, turn: 0, autoRotate: true };
}

function advanceTank(tank, opponentTank, input, elapsedSeconds) {
  const dt = Math.min(0.1, Math.max(0, elapsedSeconds));
  const move = Math.max(-1, Math.min(1, Number(input.move) || 0));
  const turn = Math.max(-1, Math.min(1, Number(input.turn) || 0));
  const rotation = turn
    ? turn * 1.5
    : input.autoRotate ? 1 : 0;

  tank.angle += rotation * TANK_MAX_ROTATION_SPEED * dt;
  if (!move) return rotation !== 0;

  const distance = move * TANK_MAX_SPEED * dt;
  const nextX = tank.x + Math.cos(tank.angle) * distance;
  const nextY = tank.y + Math.sin(tank.angle) * distance;
  const blockedByOpponent = (x, y) =>
    Math.hypot(x - opponentTank.x, y - opponentTank.y) < TANK_RADIUS * 2;

  let moved = false;
  if (!tankPositionBlocked(nextX, tank.y) && !blockedByOpponent(nextX, tank.y)) {
    tank.x = nextX;
    moved = true;
  }
  if (!tankPositionBlocked(tank.x, nextY) && !blockedByOpponent(tank.x, nextY)) {
    tank.y = nextY;
    moved = true;
  }
  return rotation !== 0 || moved;
}

module.exports = {
  advanceTank,
  createTankInput,
  segmentDistanceToPoint,
  segmentIntersectsWall,
  tankPositionBlocked,
  TANK_WALLS
};

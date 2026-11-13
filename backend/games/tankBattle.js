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

function isValidTankMove({ tank, opponentTank, x, y, angle, elapsedSeconds }) {
  if (![x, y, angle, elapsedSeconds].every(Number.isFinite) || elapsedSeconds < 0) return false;
  if (tankPositionBlocked(x, y) || Math.hypot(x - opponentTank.x, y - opponentTank.y) < TANK_RADIUS * 2) return false;

  const allowedDistance = TANK_MAX_SPEED * elapsedSeconds + 5;
  const angleDelta = Math.atan2(Math.sin(angle - tank.angle), Math.cos(angle - tank.angle));
  const allowedAngleDelta = TANK_MAX_ROTATION_SPEED * elapsedSeconds + 0.08;

  return Math.hypot(x - tank.x, y - tank.y) <= allowedDistance &&
    Math.abs(angleDelta) <= allowedAngleDelta;
}

module.exports = {
  isValidTankMove,
  segmentDistanceToPoint,
  segmentIntersectsWall,
  tankPositionBlocked,
  TANK_WALLS
};

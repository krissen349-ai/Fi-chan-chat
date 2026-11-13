const TANK_WALLS = [
  { x: 180, y: 120, w: 60, h: 220 },
  { x: 560, y: 160, w: 60, h: 220 },
  { x: 330, y: 210, w: 140, h: 80 }
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

function isValidTankMove({ tank, opponentTank, x, y, angle, elapsedSeconds }) {
  if (![x, y, angle, elapsedSeconds].every(Number.isFinite) || elapsedSeconds < 0) return false;
  if (tankPositionBlocked(x, y) || Math.hypot(x - opponentTank.x, y - opponentTank.y) < TANK_RADIUS * 2) return false;

  const allowedDistance = TANK_MAX_SPEED * elapsedSeconds + 5;
  const angleDelta = Math.atan2(Math.sin(angle - tank.angle), Math.cos(angle - tank.angle));
  const allowedAngleDelta = TANK_MAX_ROTATION_SPEED * elapsedSeconds + 0.08;

  return Math.hypot(x - tank.x, y - tank.y) <= allowedDistance &&
    Math.abs(angleDelta) <= allowedAngleDelta;
}

module.exports = { isValidTankMove, tankPositionBlocked, TANK_WALLS };

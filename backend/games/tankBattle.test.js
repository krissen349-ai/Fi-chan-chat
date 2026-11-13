const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidTankMove } = require('./tankBattle');

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

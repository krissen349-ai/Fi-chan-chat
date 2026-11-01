const test = require('node:test');
const assert = require('node:assert/strict');
const {
  GLASS_BRIDGE,
  RED_LIGHT_GREEN_LIGHT,
  advanceGlassBridgeState,
  advanceRedLightState,
  createSurvivalState,
  getPublicSurvivalState,
  setGlassBridgeInput,
  setRedLightInput
} = require('./survivalGames');

const players = [{ username: 'A' }, { username: 'B' }];

test('Red Light, Green Light moves only during green and eliminates movement during red', () => {
  const state = createSurvivalState(RED_LIGHT_GREEN_LIGHT, players, 1000, () => 0);
  setRedLightInput(state, 0, 1);
  advanceRedLightState(state, 1100, () => 0);
  assert.ok(Math.abs(state.positions[0] - 1.4) < 1e-9);

  advanceRedLightState(state, 4000, () => 0);
  assert.equal(state.phase, 'red');
  setRedLightInput(state, 0, 0.5);
  advanceRedLightState(state, 4050, () => 0);
  assert.equal(state.eliminated[0], true);
  assert.equal(state.winner, 1);
});

test('Red Light, Green Light ends in a draw when both players finish', () => {
  const state = createSurvivalState(RED_LIGHT_GREEN_LIGHT, players, 1000, () => 0);
  state.positions = [99, 99];
  setRedLightInput(state, 0, 1);
  setRedLightInput(state, 1, 1);
  advanceRedLightState(state, 1100, () => 0);
  assert.equal(state.status, 'finished');
  assert.equal(state.winner, 'BOTH');
});

test('a disconnected player forfeits after the reconnect grace period', () => {
  const state = createSurvivalState(RED_LIGHT_GREEN_LIGHT, players, 1000, () => 0);
  state.players[0].disconnectedUntil = 1100;
  advanceRedLightState(state, 1100, () => 0);

  assert.equal(state.status, 'finished');
  assert.equal(state.winner, 1);
});

test('Glass Bridge reveals only stepped-on panels and validates a safe crossing', () => {
  const state = createSurvivalState(GLASS_BRIDGE, players, 1000, () => 0);
  state.safeSides[0] = 0;
  assert.equal('safeSides' in getPublicSurvivalState(state), false);

  const player = state.players[0];
  player.z = 1.5;
  setGlassBridgeInput(state, 0, { type: 'move', x: 0, z: 1 });
  advanceGlassBridgeState(state, 1100);

  assert.equal(state.revealedPanels[0].safeSide, 0);
  assert.deepEqual(state.revealedPanels[0].brokenSides, []);
  assert.equal(player.progress, 1);
  assert.equal(player.eliminated, false);
});

test('Glass Bridge eliminates a player who steps on a fragile panel', () => {
  const state = createSurvivalState(GLASS_BRIDGE, players, 1000, () => 0);
  state.safeSides[0] = 0;
  const player = state.players[0];
  player.x = 1;
  player.z = 1.5;
  setGlassBridgeInput(state, 0, { type: 'move', x: 0, z: 1 });
  advanceGlassBridgeState(state, 1100);

  assert.equal(state.revealedPanels[0].safeSide, 0);
  assert.deepEqual(state.revealedPanels[0].brokenSides, [1]);
  assert.equal(player.eliminated, true);
  assert.equal(player.falling, true);
});

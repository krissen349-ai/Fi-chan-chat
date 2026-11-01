const RED_LIGHT_GREEN_LIGHT = 'red-light-green-light';
const GLASS_BRIDGE = 'glass-bridge';
const GLASS_BRIDGE_ROWS = 16;
const GLASS_BRIDGE_ROW_SPACING = 2.2;
const RED_LIGHT_MATCH_MS = 120000;
const GLASS_BRIDGE_MATCH_MS = 180000;

const randomBetween = (min, max, random) => min + Math.floor(random() * (max - min + 1));

const createPlayerState = (index) => ({
  x: index === 0 ? -0.75 : 0.75,
  y: 0,
  z: 0,
  velocityY: 0,
  progress: 0,
  stamina: 100,
  input: { x: 0, z: 0, sprint: false },
  eliminated: false,
  finished: false,
  falling: false,
  disconnectedUntil: null,
  jumpReadyAt: 0
});

const settleResult = (state) => {
  const active = state.players.filter((player) => !player.eliminated && !player.finished);
  if (active.length) return;

  const finishers = state.players
    .map((player, index) => player.finished ? index : -1)
    .filter((index) => index >= 0);

  state.status = 'finished';
  state.winner = finishers.length === 2 ? 'BOTH' : finishers.length === 1 ? finishers[0] : 'GAME_OVER';
};

const createRedLightState = (players, now = Date.now(), random = Math.random) => ({
  gameId: RED_LIGHT_GREEN_LIGHT,
  phase: 'green',
  phaseEndsAt: now + randomBetween(3000, 7000, random),
  endsAt: now + RED_LIGHT_MATCH_MS,
  lastTickAt: now,
  lastBroadcastAt: now,
  positions: [0, 0],
  inputs: [0, 0],
  eliminated: [false, false],
  finished: [false, false],
  players: players.map((player) => ({ username: player.username || 'Player', disconnectedUntil: null })),
  rematchRequests: [false, false],
  rematchDeclined: false,
  status: 'playing',
  winner: null
});

const createGlassBridgeState = (players, now = Date.now(), random = Math.random) => ({
  gameId: GLASS_BRIDGE,
  rowCount: GLASS_BRIDGE_ROWS,
  rowSpacing: GLASS_BRIDGE_ROW_SPACING,
  finishZ: 1.6 + GLASS_BRIDGE_ROWS * GLASS_BRIDGE_ROW_SPACING,
  safeSides: Array.from({ length: GLASS_BRIDGE_ROWS }, () => (random() < 0.5 ? 0 : 1)),
  revealedPanels: Array(GLASS_BRIDGE_ROWS).fill(null),
  endsAt: now + GLASS_BRIDGE_MATCH_MS,
  lastTickAt: now,
  lastBroadcastAt: now,
  players: players.map((player, index) => ({
    ...createPlayerState(index),
    username: player.username || 'Player'
  })),
  rematchRequests: [false, false],
  rematchDeclined: false,
  status: 'playing',
  winner: null
});

const createSurvivalState = (gameId, players, now = Date.now(), random = Math.random) => {
  if (gameId === RED_LIGHT_GREEN_LIGHT) return createRedLightState(players, now, random);
  if (gameId === GLASS_BRIDGE) return createGlassBridgeState(players, now, random);
  return null;
};

const setRedLightInput = (state, playerIndex, value) => {
  if (state.status !== 'playing' || state.eliminated[playerIndex] || state.finished[playerIndex]) return false;
  const input = Math.max(-1, Math.min(1, Number(value) || 0));
  state.inputs[playerIndex] = input;

  if (state.phase === 'red' && Math.abs(input) > 0.08) {
    state.eliminated[playerIndex] = true;
    settleResult(state);
  }
  return true;
};

const advanceRedLightState = (state, now = Date.now(), random = Math.random) => {
  if (state.status !== 'playing') return false;
  const elapsed = Math.min(0.1, Math.max(0, (now - state.lastTickAt) / 1000));
  state.lastTickAt = now;
  let changed = false;

  if (now >= state.endsAt) {
    state.players?.forEach((_, index) => {
      if (!state.finished[index]) state.eliminated[index] = true;
    });
    state.status = 'finished';
    const finishers = state.finished.map((finished, index) => finished ? index : -1).filter(index => index >= 0);
    state.winner = finishers.length === 2 ? 'BOTH' : finishers.length === 1 ? finishers[0] : 'GAME_OVER';
    return true;
  }

  for (let index = 0; index < 2; index += 1) {
    if (state.players[index].disconnectedUntil && now >= state.players[index].disconnectedUntil) {
      state.eliminated[index] = true;
      state.players[index].disconnectedUntil = null;
      changed = true;
    }
    if (state.eliminated[index] || state.finished[index]) continue;
    const input = state.inputs[index];
    if (state.phase === 'red' && Math.abs(input) > 0.08) {
      state.eliminated[index] = true;
      changed = true;
    } else if (state.phase === 'green' && input !== 0) {
      const next = Math.max(0, Math.min(100, state.positions[index] + input * elapsed * 14));
      if (next !== state.positions[index]) {
        state.positions[index] = next;
        changed = true;
      }
      if (next >= 100) {
        state.finished[index] = true;
        state.inputs[index] = 0;
        changed = true;
      }
    }
  }

  if (now >= state.phaseEndsAt && state.status === 'playing') {
    state.phase = state.phase === 'green' ? 'red' : 'green';
    state.phaseEndsAt = now + (state.phase === 'green'
      ? randomBetween(3000, 7000, random)
      : randomBetween(2500, 4500, random));
    changed = true;
  }

  const living = state.finished.map((finished, index) => finished || state.eliminated[index]);
  if (state.eliminated.some(Boolean) || living.every(Boolean)) {
    const finishers = state.finished.map((finished, index) => finished ? index : -1).filter(index => index >= 0);
    state.status = 'finished';
    state.winner = finishers.length === 2
      ? 'BOTH'
      : finishers.length === 1
        ? finishers[0]
        : state.eliminated.every(Boolean)
          ? 'GAME_OVER'
          : state.eliminated[0] ? 1 : 0;
    changed = true;
  }
  return changed;
};

const setGlassBridgeInput = (state, playerIndex, action, now = Date.now()) => {
  const player = state.players[playerIndex];
  if (state.status !== 'playing' || !player || player.eliminated || player.finished || player.falling) return false;

  if (action.type === 'move') {
    const x = Math.max(-1, Math.min(1, Number(action.x) || 0));
    const z = Math.max(-1, Math.min(1, Number(action.z) || 0));
    player.input = { x, z, sprint: Boolean(action.sprint) };
    return true;
  }

  if (action.type === 'jump' && player.y <= 0.02 && now >= player.jumpReadyAt) {
    player.velocityY = 5.2;
    player.jumpReadyAt = now + 650;
    return true;
  }
  return false;
};

const advanceGlassBridgeState = (state, now = Date.now()) => {
  if (state.status !== 'playing') return false;
  const elapsed = Math.min(0.1, Math.max(0, (now - state.lastTickAt) / 1000));
  state.lastTickAt = now;
  let changed = false;

  if (now >= state.endsAt) {
    state.players.forEach((player) => {
      if (!player.finished) player.eliminated = true;
    });
    settleResult(state);
    return true;
  }

  state.players.forEach((player) => {
    if (player.disconnectedUntil && now >= player.disconnectedUntil) {
      player.eliminated = true;
      player.falling = true;
      player.disconnectedUntil = null;
      changed = true;
    }
    if (player.eliminated || player.finished) {
      if (player.falling && player.y > -20) {
        player.velocityY -= 9.8 * elapsed;
        player.y += player.velocityY * elapsed;
        changed = true;
      }
      return;
    }

    const oldX = player.x;
    const oldZ = player.z;
    const oldY = player.y;
    const sprinting = player.input.sprint && player.stamina > 0;
    player.stamina = Math.max(0, Math.min(100, player.stamina + (sprinting ? -30 : 18) * elapsed));
    const speed = sprinting ? 4.8 : 3.2;
    player.x = Math.max(-2.45, Math.min(2.45, player.x + player.input.x * speed * elapsed));
    player.z = Math.max(0, Math.min(state.finishZ, player.z + player.input.z * speed * elapsed));

    if (player.y > 0 || player.velocityY > 0) {
      player.velocityY -= 9.8 * elapsed;
      player.y = Math.max(0, player.y + player.velocityY * elapsed);
      if (player.y === 0) player.velocityY = 0;
    }

    if (Math.abs(player.x) > 2.35) {
      player.eliminated = true;
      player.falling = true;
      player.velocityY = -1;
    } else {
      while (player.progress < state.rowCount) {
        const row = player.progress;
        const crossingZ = 1.6 + row * state.rowSpacing;
        if (oldZ >= crossingZ || player.z < crossingZ) break;

        const side = player.x < 0 ? 0 : 1;
        const safe = state.safeSides[row] === side;
        const reveal = state.revealedPanels[row] || { safeSide: state.safeSides[row], brokenSides: [] };
        if (!safe && !reveal.brokenSides.includes(side)) reveal.brokenSides.push(side);
        state.revealedPanels[row] = reveal;
        if (!safe) {
          player.eliminated = true;
          player.falling = true;
          player.velocityY = -1;
          break;
        }
        player.progress += 1;
      }
    }

    if (!player.eliminated && player.progress === state.rowCount && player.z >= state.finishZ) {
      player.finished = true;
      player.input = { x: 0, z: 0, sprint: false };
    }
    changed ||= player.x !== oldX || player.z !== oldZ || player.y !== oldY || player.eliminated || player.finished;
  });

  if (state.players.every(player => player.finished || player.eliminated)) {
    settleResult(state);
    changed = true;
  }
  return changed;
};

const getPublicSurvivalState = (state) => {
  if (state.gameId === RED_LIGHT_GREEN_LIGHT) {
    const { lastTickAt, lastBroadcastAt, inputs, ...publicState } = state;
    return { ...publicState, inputs: undefined, players: state.players.map(player => ({ ...player })) };
  }

  const { lastTickAt, lastBroadcastAt, safeSides, players, ...publicState } = state;
  return {
    ...publicState,
    players: players.map(({ input, jumpReadyAt, ...player }) => ({ ...player }))
  };
};

const startRematch = (game, now = Date.now(), random = Math.random) => {
  const next = createSurvivalState(game.gameId, game.players, now, random);
  return next;
};

module.exports = {
  GLASS_BRIDGE,
  RED_LIGHT_GREEN_LIGHT,
  advanceGlassBridgeState,
  advanceRedLightState,
  createSurvivalState,
  getPublicSurvivalState,
  setGlassBridgeInput,
  setRedLightInput,
  startRematch
};

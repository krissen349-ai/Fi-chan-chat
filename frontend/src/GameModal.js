import React, { useCallback, useEffect, useRef, useState } from 'react';
import './GameModal.css';
import GameFullscreenButton from './games/GameFullscreenButton';
import GlassBridge from './games/GlassBridge';
import RedLightGreenLight from './games/RedLightGreenLight';
import { GAMES } from './games/gameCatalog';

const QUIZ_QUESTIONS = [
  { question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Mercury'] },
  { question: 'How many sides does a hexagon have?', options: ['Five', 'Six', 'Seven', 'Eight'] },
  { question: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'] },
  { question: 'What is the chemical symbol for gold?', options: ['Ag', 'Go', 'Gd', 'Au'] },
  { question: 'How many colors are in a rainbow traditionally?', options: ['Five', 'Six', 'Seven', 'Eight'] }
];

const GAME_DETAILS = GAMES.reduce((acc, game) => {
  acc[game.id] = game;
  return acc;
}, {});

const CHOICES = [
  { id: 'rock', icon: '✊', label: 'Rock' },
  { id: 'paper', icon: '✋', label: 'Paper' },
  { id: 'scissors', icon: '✌️', label: 'Scissors' }
];

// Web Audio API Sound Generator
const createSoundFX = () => {
  let ctx = null;
  const init = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  };

  return {
    playShoot: () => {
      init();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    },
    playExplosion: () => {
      init();
      if (!ctx) return;
      const bufferSize = ctx.sampleRate * 0.3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.3);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    }
  };
};

const soundFX = createSoundFX();

const GameModal = ({ socket, currentUser, activeChat, onClose, gameSession, onStartGame }) => {
  const [gameState, setGameState] = useState(gameSession?.state || null);
  const [wordInput, setWordInput] = useState('');
  const [actionError, setActionError] = useState('');
  const [localChoiceSent, setLocalChoiceSent] = useState(false);
  const [tankScores, setTankScores] = useState({ p1: 0, p2: 0 });

  const canvasRef = useRef(null);
  const tankWrapRef = useRef(null);

  const gameId = gameSession?.gameId;
  const roomId = gameSession?.gameRoomId;
  const playerIndex = Number.isInteger(gameSession?.playerIndex) ? gameSession.playerIndex : (gameSession?.symbol === 'O' ? 1 : 0);
  const mySymbol = gameSession?.symbol || (playerIndex === 0 ? 'X' : 'O');
  const details = GAME_DETAILS[gameId] || GAME_DETAILS['tic-tac-toe'];

  useEffect(() => {
    setGameState(gameSession?.state || null);
    setLocalChoiceSent(false);
    setActionError('');
  }, [gameSession]);

  useEffect(() => {
    if (!socket || !roomId) return undefined;

    const handleGameState = (nextState) => {
      if (nextState.gameRoomId && nextState.gameRoomId !== roomId) return;
      if (gameId === 'tank-battle') return;
      setGameState(nextState);
      setLocalChoiceSent(Boolean(nextState.pending?.[playerIndex] && !nextState.roundComplete));
      setActionError('');
    };
    const handleGameError = (error) => {
      if (error.gameRoomId === roomId) setActionError(error.message || 'Move could not be made.');
    };
    const handleMissingSession = (error) => {
      if (error.gameRoomId === roomId) setActionError('This game session expired. Close this window and send a new invite.');
    };
    const handleOpponentLeft = (event) => {
      if (event.gameRoomId === roomId) setActionError('Your opponent returned to chat. Send a new invitation to play again.');
    };

    socket.on('game_state', handleGameState);
    socket.on('game_action_error', handleGameError);
    socket.on('game_session_missing', handleMissingSession);
    socket.on('game_opponent_left', handleOpponentLeft);
    const joinGame = () => socket.emit('join_game', { gameRoomId: roomId });
    socket.on('connect', joinGame);
    if (socket.connected) joinGame();
    return () => {
      socket.off('connect', joinGame);
      socket.off('game_state', handleGameState);
      socket.off('game_action_error', handleGameError);
      socket.off('game_session_missing', handleMissingSession);
      socket.off('game_opponent_left', handleOpponentLeft);
    };
  }, [socket, roomId, playerIndex, gameId]);

  /* ==========================================================
     ================ TANK BATTLE ENGINE SECTION ==============
     ========================================================== */
  useEffect(() => {
    if (gameId !== 'tank-battle') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    let keys = {};
    let bullets = [];
    let impactParticles = [];
    let trackMarks = [];
    let barriers = [
      { x: 180, y: 90, w: 70, h: 105 },
      { x: 180, y: 305, w: 70, h: 105 },
      { x: 550, y: 90, w: 70, h: 105 },
      { x: 550, y: 305, w: 70, h: 105 },
      { x: 345, y: 130, w: 45, h: 80 },
      { x: 410, y: 290, w: 45, h: 80 }
    ];
    const HOLD_THRESHOLD_MS = 160;
    const AUTO_ROTATION_SPEED = 0.055;
    const MOVE_SPEED = 3.2;
    const lastNetworkUpdateRef = { current: 0 };
    let rotationPausedUntil = 0;
    let lastFrameTime = performance.now();

    const pointerState = {
      pointerDown: false,
      startedAt: 0,
      holdActive: false
    };

    class Tank {
      constructor(x, y, mainColor, accentColor, angle, isMe) {
        this.x = x;
        this.y = y;
        this.mainColor = mainColor;
        this.accentColor = accentColor;
        this.size = 32;
        this.angle = angle;
        this.targetX = x;
        this.targetY = y;
        this.targetAngle = angle;
        this.speed = MOVE_SPEED;
        this.rotSpeed = AUTO_ROTATION_SPEED;
        this.cooldown = 0;
        this.maxHealth = 100;
        this.health = 100;
        this.isMe = isMe;
        this.muzzleFlash = 0;
      }

      update(controls, deltaTime = 1 / 60) {
        if (!this.isMe) return;

        const frameScale = deltaTime * 60;
        const moveStep = this.speed * frameScale;
        const rotateStep = this.rotSpeed * frameScale;

        if (
          performance.now() >= rotationPausedUntil &&
          !pointerState.pointerDown &&
          !pointerState.holdActive &&
          !controls.left &&
          !controls.right
        ) {
          this.angle += rotateStep;
        }

        if (pointerState.holdActive) {
          const nextX = this.x + Math.cos(this.angle) * moveStep;
          const nextY = this.y + Math.sin(this.angle) * moveStep;
          let moved = false;
          if (!this.checkWallCollision(nextX, this.y)) {
            trackMarks.push({ x: this.x, y: this.y, angle: this.angle, alpha: 0.6, createdAt: Date.now() });
            this.x = nextX;
            moved = true;
          }
          if (!this.checkWallCollision(this.x, nextY)) {
            if (!moved) trackMarks.push({ x: this.x, y: this.y, angle: this.angle, alpha: 0.6, createdAt: Date.now() });
            this.y = nextY;
          }
        }

        if (performance.now() >= rotationPausedUntil && (controls.left || controls.right)) {
          this.angle += controls.left ? -rotateStep * 1.5 : rotateStep * 1.5;
        }

        const direction = controls.forward ? 1 : controls.backward ? -1 : 0;
        if (direction) {
          const nextX = this.x + Math.cos(this.angle) * moveStep * direction;
          const nextY = this.y + Math.sin(this.angle) * moveStep * direction;
          let moved = false;
          if (!this.checkWallCollision(nextX, this.y)) {
            trackMarks.push({ x: this.x, y: this.y, angle: this.angle, alpha: 0.6, createdAt: Date.now() });
            this.x = nextX;
            moved = true;
          }
          if (!this.checkWallCollision(this.x, nextY)) {
            if (!moved) trackMarks.push({ x: this.x, y: this.y, angle: this.angle, alpha: 0.6, createdAt: Date.now() });
            this.y = nextY;
          }
        }

        const radius = this.size / 2;
        this.x = Math.max(radius, Math.min(canvas.width - radius, this.x));
        this.y = Math.max(radius, Math.min(canvas.height - radius, this.y));

      }

      checkWallCollision(nx, ny) {
        const radius = this.size / 2;
        if (nx < radius || nx > canvas.width - radius || ny < radius || ny > canvas.height - radius) return true;
        for (let b of barriers) {
          if (nx + radius > b.x && nx - radius < b.x + b.w &&
              ny + radius > b.y && ny - radius < b.y + b.h) return true;
        }
        const otherTank = this === p1 ? p2 : p1;
        if (otherTank && Math.hypot(nx - otherTank.x, ny - otherTank.y) < this.size) return true;
        return false;
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(-22, -this.size - 12, 44, 6);
        ctx.fillStyle = this.health > 40 ? '#10b981' : '#ef4444';
        ctx.fillRect(-22, -this.size - 12, (this.health / this.maxHealth) * 44, 6);

        ctx.rotate(this.angle);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-this.size/2 - 2, -this.size/2 - 2, this.size + 4, 8);
        ctx.fillRect(-this.size/2 - 2, this.size/2 - 6, this.size + 4, 8);

        ctx.fillStyle = this.mainColor;
        ctx.beginPath();
        ctx.roundRect(-this.size/2, -this.size/2 + 4, this.size, this.size - 8, 4);
        ctx.fill();

        ctx.fillStyle = this.accentColor;
        ctx.fillRect(-10, -8, 20, 16);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, -4, 26, 8);
        ctx.fillStyle = '#334155';
        ctx.fillRect(20, -5, 6, 10);

        if (this.muzzleFlash > 0) {
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(32, 0, 10, 0, Math.PI * 2);
          ctx.fill();
          this.muzzleFlash--;
        }

        ctx.restore();
      }
    }

    const p1 = new Tank(100, 250, '#0284c7', '#38bdf8', 0, playerIndex === 0);
    const p2 = new Tank(700, 250, '#dc2626', '#f87171', Math.PI, playerIndex === 1);

    const handleRemoteAction = (data) => {
      if (!Array.isArray(data.tanks)) return;
      [p1, p2].forEach((tank, index) => {
        const remoteTank = data.tanks[index];
        if (index === playerIndex) {
          const correctionDistance = Math.hypot(remoteTank.x - tank.x, remoteTank.y - tank.y);
          if (correctionDistance > 48) {
            tank.x = remoteTank.x;
            tank.y = remoteTank.y;
          } else {
            tank.x += (remoteTank.x - tank.x) * 0.12;
            tank.y += (remoteTank.y - tank.y) * 0.12;
          }
          const correctionAngle = Math.atan2(
            Math.sin(remoteTank.angle - tank.angle),
            Math.cos(remoteTank.angle - tank.angle)
          );
          tank.angle += correctionDistance > 48 ? correctionAngle : correctionAngle * 0.12;
        } else {
          tank.targetX = remoteTank.x;
          tank.targetY = remoteTank.y;
          tank.targetAngle = remoteTank.angle;
        }
        tank.health = remoteTank.health;
      });
      if (Array.isArray(data.bullets)) {
        const previousBullets = new Map(bullets.map(bullet => [bullet.id, bullet]));
        const nextBulletIds = new Set(data.bullets.map(bullet => bullet.id));
        bullets.forEach(bullet => {
          if (!nextBulletIds.has(bullet.id)) {
            for (let i = 0; i < 5; i += 1) {
              const angle = (Math.PI * 2 * i) / 5;
              impactParticles.push({
                x: bullet.x,
                y: bullet.y,
                vx: Math.cos(angle) * 55,
                vy: Math.sin(angle) * 55,
                life: 0.22
              });
            }
          }
        });
        bullets = data.bullets.map(bullet => {
          const previous = previousBullets.get(bullet.id);
          return {
            ...bullet,
            previousX: previous?.x ?? bullet.x,
            previousY: previous?.y ?? bullet.y
          };
        });
      } else {
        bullets = [];
      }
      if (Array.isArray(data.scores)) {
        setTankScores(previous => (
          previous.p1 === data.scores[0] && previous.p2 === data.scores[1]
            ? previous
            : { p1: data.scores[0], p2: data.scores[1] }
        ));
      }
    };
    socket.on('game_state', handleRemoteAction);

    window.triggerTankShoot = () => {
      const me = playerIndex === 0 ? p1 : p2;
      if (me.cooldown > 0) return;
      me.muzzleFlash = 4;
      rotationPausedUntil = performance.now() + 2000;
      soundFX.playShoot();

      if (socket && roomId) {
        socket.emit('game_action', {
          gameRoomId: roomId,
          action: { type: 'tank_shoot', angle: me.angle }
        });
      }
      me.cooldown = 20;
    };

    const handleTouchControl = (pressed) => {
      if (pressed) {
        pointerState.pointerDown = true;
        pointerState.startedAt = performance.now();
        pointerState.holdActive = false;
      } else {
        const elapsed = performance.now() - pointerState.startedAt;
        const shouldFire = elapsed < HOLD_THRESHOLD_MS;
        pointerState.pointerDown = false;
        pointerState.holdActive = false;
        if (shouldFire && window.triggerTankShoot) window.triggerTankShoot();
      }
    };

    window.handleTankTouchControl = handleTouchControl;

    const keyBindings = {
      w: 'forward', ArrowUp: 'forward',
      s: 'backward', ArrowDown: 'backward',
      a: 'left', ArrowLeft: 'left',
      d: 'right', ArrowRight: 'right'
    };
    const handleKeyDown = (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (keyBindings[key] || key === ' ') event.preventDefault();
      if (keyBindings[key]) keys[keyBindings[key]] = true;
      if (key === ' ' && !event.repeat && window.triggerTankShoot) window.triggerTankShoot();
    };
    const handleKeyUp = (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (keyBindings[key]) keys[keyBindings[key]] = false;
    };
    const releaseKeys = () => { keys = {}; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', releaseKeys);

    const gameLoop = () => {
      const now = Date.now();
      const me = playerIndex === 0 ? p1 : p2;
      const deltaTime = Math.min((performance.now() - lastFrameTime) / 1000, 0.033);
      lastFrameTime = performance.now();
      const controls = {
        forward: Boolean(keys.forward || keys.w || keys.ArrowUp),
        backward: Boolean(keys.backward || keys.s || keys.ArrowDown),
        left: Boolean(keys.left || keys.a || keys.ArrowLeft),
        right: Boolean(keys.right || keys.d || keys.ArrowRight)
      };

      if (pointerState.pointerDown && !pointerState.holdActive) {
        if (performance.now() - pointerState.startedAt >= HOLD_THRESHOLD_MS) {
          pointerState.holdActive = true;
        }
      }

      const input = {
        move: pointerState.holdActive ? 1 : controls.forward ? 1 : controls.backward ? -1 : 0,
        turn: now < rotationPausedUntil ? 0 : controls.left ? -1 : controls.right ? 1 : 0,
        autoRotate: now >= rotationPausedUntil &&
          !pointerState.pointerDown && !controls.left && !controls.right
      };
      const inputSignature = `${input.move}:${input.turn}:${input.autoRotate}`;
      if (socket && roomId && (
        inputSignature !== lastNetworkUpdateRef.signature ||
        now - lastNetworkUpdateRef.current >= 50
      )) {
        lastNetworkUpdateRef.current = now;
        lastNetworkUpdateRef.signature = inputSignature;
        socket.emit('game_action', {
          gameRoomId: roomId,
          action: { type: 'tank_input', input }
        });
      }

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const bgGrad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 50, canvas.width / 2, canvas.height / 2, canvas.width * 0.7);
      bgGrad.addColorStop(0, '#1e293b');
      bgGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      for (let i = trackMarks.length - 1; i >= 0; i--) {
        const mark = trackMarks[i];
        const age = (now - mark.createdAt) / 1000;
        if (age >= 2) {
          trackMarks.splice(i, 1);
          continue;
        }
        mark.alpha = 0.5 * (1 - age / 2);
        ctx.save();
        ctx.translate(mark.x, mark.y);
        ctx.rotate(mark.angle);
        ctx.fillStyle = `rgba(15, 23, 42, ${mark.alpha})`;
        ctx.fillRect(-12, -12, 10, 4);
        ctx.fillRect(-12, 8, 10, 4);
        ctx.restore();
      }

      for (let b of barriers) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(b.x + 7, b.y + 7, b.w, b.h);
        ctx.fillStyle = '#334155';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 4;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      }

      const opponent = playerIndex === 0 ? p2 : p1;
      const interpolation = 1 - Math.exp(-14 * deltaTime);
      opponent.x += (opponent.targetX - opponent.x) * interpolation;
      opponent.y += (opponent.targetY - opponent.y) * interpolation;
      const opponentAngleDelta = Math.atan2(
        Math.sin(opponent.targetAngle - opponent.angle),
        Math.cos(opponent.targetAngle - opponent.angle)
      );
      opponent.angle += opponentAngleDelta * interpolation;

      p1.update(playerIndex === 0 ? controls : {}, deltaTime);
      p2.update(playerIndex === 1 ? controls : {}, deltaTime);

      if (p1.cooldown > 0) p1.cooldown--;
      if (p2.cooldown > 0) p2.cooldown--;

      p1.draw();
      p2.draw();

      for (const bullet of bullets) {
        ctx.save();
        ctx.strokeStyle = bullet.ownerIndex === 0 ? 'rgba(56, 189, 248, 0.72)' : 'rgba(248, 113, 113, 0.72)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bullet.previousX, bullet.previousY);
        ctx.lineTo(bullet.x, bullet.y);
        ctx.stroke();
        ctx.shadowBlur = 12;
        ctx.shadowColor = bullet.ownerIndex === 0 ? '#38bdf8' : '#f87171';
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      impactParticles = impactParticles.filter(particle => {
        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;
        particle.life -= deltaTime;
        if (particle.life <= 0) return false;
        ctx.globalAlpha = Math.min(1, particle.life / 0.22);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        return true;
      });

      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(me.x, me.y);
      ctx.lineTo(me.x + Math.cos(me.angle) * 140, me.y + Math.sin(me.angle) * 140);
      ctx.stroke();
      ctx.restore();

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      socket.off('game_state', handleRemoteAction);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', releaseKeys);
      delete window.triggerTankShoot;
      delete window.handleTankTouchControl;
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameId, playerIndex, socket, roomId]);
  /* ========================================================== */

  const sendAction = useCallback((action) => {
    if (!roomId) return;
    setActionError('');
    socket.emit('game_action', { gameRoomId: roomId, action });
  }, [roomId, socket]);

  const getStatus = () => {
    if (!gameState && gameId !== 'tank-battle') return 'Setting up game...';
    if (gameState?.status === 'finished' && gameState?.winner === 'BOTH') return 'Both players won! 🎉';
    if (gameState?.status === 'finished' && gameState?.winner === 'GAME_OVER') return 'Game over';
    if (gameId === 'red-light-green-light' && gameState?.status === 'playing') {
      return gameState.phase === 'red' ? 'Red light — freeze!' : 'Green light — move!';
    }
    if (gameId === 'tank-battle') return 'Tank Battle Arena Active 🎮';
    if (gameState?.winner === 'DRAW') return 'Draw game! 🤝';
    if (gameState?.winner !== null && gameState?.winner !== undefined) {
      if (typeof gameState.winner === 'number') return gameState.winner === playerIndex ? 'You won! 🎉' : 'Opponent won!';
      return gameState.winner === mySymbol ? 'You won! 🎉' : 'Opponent won!';
    }
    return 'Game on!';
  };

  const renderLobby = () => (
    <div className="games-lobby-wrap">
      <div className="games-lobby-header">
        <div className="games-lobby-tag">PLAY TOGETHER</div>
        <h2 className="games-lobby-title">🎮 Games Lobby</h2>
        <p className="games-lobby-subtitle">Choose a game and challenge your chat partner.</p>
      </div>

      <div className="games-grid">
        {GAMES.map((game) => (
          <div className="game-choice-card" key={game.id}>
            <div className="game-choice-icon">{game.icon}</div>
            <div className="game-choice-copy">
              <h4>{game.name}</h4>
              <p>{game.description}</p>
            </div>
            <button 
              className="game-invite-btn"
              onClick={() => onStartGame && onStartGame(game.id)}
            >
              Invite / Play
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTicTacToe = () => (
    <div className="tic-tac-toe-board">
      {(gameState?.board || Array(9).fill(null)).map((cell, index) => (
        <button
          key={index}
          className={`game-cell ${cell ? 'filled' : ''}`}
          onClick={() => sendAction({ type: 'place', index })}
          disabled={gameState?.currentPlayer !== playerIndex || Boolean(cell) || gameState?.winner !== null}
        >{cell}</button>
      ))}
    </div>
  );

  const renderConnectFour = () => (
    <div className="connect-four-wrap">
      <div className="connect-four-drop-row">
        {Array.from({ length: 7 }, (_, column) => (
          <button
            key={column}
            aria-label={`Drop in column ${column + 1}`}
            onClick={() => sendAction({ type: 'drop', column })}
            disabled={gameState?.currentPlayer !== playerIndex || gameState?.winner !== null || Boolean(gameState?.board?.[column])}
          >↓</button>
        ))}
      </div>
      <div className="connect-four-grid">
        {(gameState?.board || Array(42).fill(null)).map((cell, index) => (
          <div
            key={index}
            className={`connect-four-cell ${cell === 'X' ? 'disc-x' : ''} ${cell === 'O' ? 'disc-o' : ''}`}
            role="img"
            aria-label={`Row ${Math.floor(index / 7) + 1}, column ${index % 7 + 1}: ${cell ? `${cell} disc` : 'empty'}`}
          />
        ))}
      </div>
      <div className="game-score-line">
        <span>🔴 You: {gameSession?.symbol || (playerIndex === 0 ? 'X' : 'O')}</span>
        <span>🟡 Opponent: {playerIndex === 0 ? 'O' : 'X'}</span>
      </div>
    </div>
  );

  const renderRps = () => (
    <div className="mini-game-content">
      <p className="game-round-label">Round {gameState?.round || 1} of 3</p>
      <div className="game-score-line"><span>You {gameState?.scores?.[playerIndex] || 0}</span><span>{gameState?.scores?.[1 - playerIndex] || 0} Opponent</span></div>
      {gameState?.roundComplete ? (
        <div className="rps-reveal">
          <p>{CHOICES.find(c => c.id === gameState.choices?.[playerIndex])?.icon} You</p>
          <span>VS</span>
          <p>{CHOICES.find(c => c.id === gameState.choices?.[1 - playerIndex])?.icon} Opponent</p>
        </div>
      ) : (
        <>
          <p className="game-instruction">Choose secretly.</p>
          <div className="rps-choices">
            {CHOICES.map(choice => (
              <button key={choice.id} onClick={() => sendAction({ type: 'choose', choice: choice.id })} disabled={localChoiceSent}>
                <span>{choice.icon}</span>{choice.label}
              </button>
            ))}
          </div>
        </>
      )}
      {gameState?.roundComplete && gameState.winner === null && <button className="reset-game-btn" onClick={() => sendAction({ type: 'next-round' })}>Next Round</button>}
    </div>
  );

  const renderQuiz = () => {
    const question = QUIZ_QUESTIONS[gameState?.questionIndex || 0];
    const myAnswer = gameState?.answers?.[playerIndex];
    return (
      <div className="mini-game-content">
        <p className="game-round-label">Question {(gameState?.questionIndex || 0) + 1} of {QUIZ_QUESTIONS.length}</p>
        <h4 className="quiz-question">{question.question}</h4>
        <div className="quiz-options">
          {question.options.map((option, index) => (
            <button
              key={option}
              className={gameState?.roundComplete && index === gameState.correctAnswer ? 'quiz-correct' : gameState?.roundComplete && index === myAnswer ? 'quiz-incorrect' : ''}
              onClick={() => sendAction({ type: 'answer', answerIndex: index })}
              disabled={Boolean(gameState?.answered?.[playerIndex]) || gameState?.roundComplete}
            >{option}</button>
          ))}
        </div>
        {gameState?.roundComplete && (
          <button className="reset-game-btn" onClick={() => sendAction({ type: 'next-question' })}>
            {gameState.questionIndex >= QUIZ_QUESTIONS.length - 1 ? 'Show final results' : 'Next question'}
          </button>
        )}
      </div>
    );
  };

  const renderWordChain = () => {
    const lastWord = gameState?.words?.at(-1)?.word;
    const requiredLetter = lastWord?.at(-1)?.toUpperCase();
    const isMyTurn = gameState?.currentPlayer === playerIndex;
    return (
      <div className="mini-game-content">
        <p className="game-instruction">{requiredLetter ? `Your word must start with ${requiredLetter}` : 'Start the chain.'}</p>
        <div className="word-chain-list">
          {(gameState?.words || []).map((entry, index) => (
            <span className={entry.playerIndex === playerIndex ? 'word-mine' : 'word-theirs'} key={index}>{entry.word}</span>
          ))}
        </div>
        <form className="word-chain-form" onSubmit={e => { e.preventDefault(); if (!wordInput.trim()) return; sendAction({ type: 'word', word: wordInput }); setWordInput(''); }}>
          <input value={wordInput} onChange={e => setWordInput(e.target.value)} placeholder="Type a word" disabled={!isMyTurn} maxLength={24} />
          <button type="submit" disabled={!isMyTurn || !wordInput.trim()}>Play</button>
        </form>
      </div>
    );
  };

  const renderTankBattle = () => (
    <div className="mini-game-content tank-battle-wrap" ref={tankWrapRef}>
      <div className="tank-score-board">
        <span className="p1-score">Blue (P1): {tankScores.p1}</span>
        <span className="p2-score">Red (P2): {tankScores.p2}</span>
      </div>

      <div className="canvas-container">
        <canvas ref={canvasRef} width={800} height={500} className="tank-canvas" />

        <button
          type="button"
          className="tank-tactical-button"
          aria-label="Move and fire tank"
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture?.(event.pointerId);
            if (window.handleTankTouchControl) window.handleTankTouchControl(true);
          }}
          onPointerUp={(event) => {
            event.preventDefault();
            event.currentTarget.releasePointerCapture?.(event.pointerId);
            if (window.handleTankTouchControl) window.handleTankTouchControl(false);
          }}
          onPointerLeave={(event) => {
            event.preventDefault();
            if (event.buttons === 0 && window.handleTankTouchControl) window.handleTankTouchControl(false);
          }}
          onPointerCancel={(event) => {
            event.preventDefault();
            event.currentTarget.releasePointerCapture?.(event.pointerId);
            if (window.handleTankTouchControl) window.handleTankTouchControl(false);
          }}
        >
          <span className="tank-button-emoji">⚡</span>
          <span className="tank-button-label">TAP FIRE</span>
          <span className="tank-button-sub">HOLD MOVE</span>
        </button>
      </div>

      <GameFullscreenButton targetRef={tankWrapRef} />

      <p className="tank-controls-tip">
        Tap = fire · Hold = move · Desktop: WASD / arrows + Space
      </p>
    </div>
  );

  const renderGame = () => {
    if (!gameId) return renderLobby();
    if (!gameState && gameId !== 'tank-battle') return <p className="game-instruction">Waiting for session...</p>;

    switch (gameId) {
      case 'connect-four': return renderConnectFour();
      case 'rock-paper-scissors': return renderRps();
      case 'quiz-battle': return renderQuiz();
      case 'word-chain': return renderWordChain();
      case 'tank-battle': return renderTankBattle();
      case 'red-light-green-light': return (
        <RedLightGreenLight gameState={gameState} playerIndex={playerIndex} onAction={sendAction} onClose={onClose} />
      );
      case 'glass-bridge': return (
        <GlassBridge gameState={gameState} playerIndex={playerIndex} onAction={sendAction} onClose={onClose} />
      );
      default: return renderTicTacToe();
    }
  };

  return (
    <div className="modal-overlay game-overlay">
      <div className={`game-modal-card animate-pop-in ${gameId ? `game-modal-${gameId}` : 'games-lobby-card'}`}>
        <div className="game-header">
          <h3>{gameId ? `${details.icon} ${details.name}` : '🎮 Games Lobby'}</h3>
          <button className="close-game-btn" onClick={onClose}>✕</button>
        </div>

        {gameId && !['red-light-green-light', 'glass-bridge'].includes(gameId) && (
          <div className="game-status-bar">
            <p>{getStatus()}</p>
            <span className="symbol-badge">You: {playerIndex === 0 ? 'P1' : 'P2'}</span>
          </div>
        )}

        {actionError && <p className="game-action-error">{actionError}</p>}
        {renderGame()}

        {gameId && !['red-light-green-light', 'glass-bridge'].includes(gameId) && (
          <div className="game-footer">
            <button className="reset-game-btn" onClick={() => sendAction({ type: 'restart' })}>Restart Game</button>
            <span className="game-opponent-label">Playing with {activeChat?.name || 'your friend'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameModal;
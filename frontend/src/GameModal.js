import React, { useEffect, useRef, useState } from 'react';
import './GameModal.css';

const QUIZ_QUESTIONS = [
  { question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Mercury'] },
  { question: 'How many sides does a hexagon have?', options: ['Five', 'Six', 'Seven', 'Eight'] },
  { question: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'] },
  { question: 'What is the chemical symbol for gold?', options: ['Ag', 'Go', 'Gd', 'Au'] },
  { question: 'How many colors are in a rainbow traditionally?', options: ['Five', 'Six', 'Seven', 'Eight'] }
];

const GAME_LIST = [
  { id: 'tic-tac-toe', icon: '⭕', name: 'Tic-Tac-Toe', desc: 'Classic three-in-a-row duel' },
  { id: 'connect-four', icon: '🔴', name: 'Connect Four', desc: 'Drop four discs in a row' },
  { id: 'rock-paper-scissors', icon: '✊', name: 'Rock Paper Scissors', desc: 'Quick best-of-three battle' },
  { id: 'quiz-battle', icon: '🧠', name: 'Quiz Battle', desc: 'Race to the right answers' },
  { id: 'word-chain', icon: '🔤', name: 'Word Chain', desc: 'Keep the word game going' },
  { id: 'tank-battle', icon: '🕹️', name: 'Tank Battle', desc: '1v1 tank showdown & tactical blasts' }
];

const GAME_DETAILS = GAME_LIST.reduce((acc, game) => {
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
  const fireBtnRef = useRef(null);

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

    socket.on('game_state', handleGameState);
    socket.on('game_action_error', handleGameError);
    socket.on('game_session_missing', handleMissingSession);
    socket.emit('join_game', { gameRoomId: roomId });
    return () => {
      socket.off('game_state', handleGameState);
      socket.off('game_action_error', handleGameError);
      socket.off('game_session_missing', handleMissingSession);
    };
  }, [socket, roomId, playerIndex]);

  const toggleFullScreen = () => {
    const elem = tankWrapRef.current;
    if (!elem) return;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const requestFn = elem.requestFullscreen || elem.webkitRequestFullscreen;
      if (requestFn) {
        requestFn.call(elem).then(() => {
          if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
            window.screen.orientation.lock('landscape').catch(() => {});
          }
        }).catch(err => console.error("Fullscreen error:", err.message));
      }
    } else {
      if (window.screen && window.screen.orientation && window.screen.orientation.unlock) {
        window.screen.orientation.unlock();
      }
      const exitFn = document.exitFullscreen || document.webkitExitFullscreen;
      if (exitFn) {
        exitFn.call(document);
      }
    }
  };

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
    let particles = [];
    let trackMarks = [];
    let barriers = [
      { x: 180, y: 120, w: 60, h: 220 },
      { x: 560, y: 160, w: 60, h: 220 },
      { x: 330, y: 210, w: 140, h: 80 }
    ];

    class Tank {
      constructor(x, y, mainColor, accentColor, angle, isMe) {
        this.x = x;
        this.y = y;
        this.mainColor = mainColor;
        this.accentColor = accentColor;
        this.size = 32;
        this.angle = angle;
        this.speed = 3.2;
        this.rotSpeed = 0.045;
        this.cooldown = 0;
        this.maxHealth = 100;
        this.health = 100;
        this.isMe = isMe;
        this.muzzleFlash = 0;
      }

      update(isHoldingFire) {
        if (!this.isMe) return;

        let moved = false;

        if (isHoldingFire) {
          let nextX = this.x + Math.cos(this.angle) * this.speed;
          let nextY = this.y + Math.sin(this.angle) * this.speed;
          if (!this.checkWallCollision(nextX, nextY)) {
            trackMarks.push({
              x: this.x,
              y: this.y,
              angle: this.angle,
              alpha: 0.6,
              createdAt: Date.now()
            });

            this.x = nextX;
            this.y = nextY;
            moved = true;
          }
        } else {
          this.angle += this.rotSpeed;
          moved = true;
        }

        this.x = Math.max(this.size, Math.min(canvas.width - this.size, this.x));
        this.y = Math.max(this.size, Math.min(canvas.height - this.size, this.y));

        if (moved && socket && roomId) {
          socket.emit('game_action', {
            gameRoomId: roomId,
            action: { type: 'tank_move', x: this.x, y: this.y, angle: this.angle, playerIndex }
          });
        }
      }

      checkWallCollision(nx, ny) {
        if (nx < this.size || nx > canvas.width - this.size || ny < this.size || ny > canvas.height - this.size) return true;
        for (let b of barriers) {
          if (nx + this.size/2 > b.x && nx - this.size/2 < b.x + b.w &&
              ny + this.size/2 > b.y && ny - this.size/2 < b.y + b.h) return true;
        }
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
      const { action } = data;
      if (!action) return;
      if (action.type === 'tank_move' && action.playerIndex !== playerIndex) {
        const target = action.playerIndex === 0 ? p1 : p2;
        target.x = action.x;
        target.y = action.y;
        target.angle = action.angle;
      }
      if (action.type === 'tank_shoot' && action.playerIndex !== playerIndex) {
        bullets.push({ ...action.bullet, ownerIndex: action.playerIndex });
        soundFX.playShoot();
      }
    };
    socket.on('game_state', handleRemoteAction);

    const createExplosion = (x, y, color) => {
      soundFX.playExplosion();
      for (let i = 0; i < 25; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          radius: Math.random() * 4 + 2,
          alpha: 1,
          color
        });
      }
    };

    window.triggerTankShoot = () => {
      const me = playerIndex === 0 ? p1 : p2;
      if (me.cooldown > 0) return;
      
      me.muzzleFlash = 4;
      soundFX.playShoot();

      const bulletData = {
        x: me.x + Math.cos(me.angle) * 30,
        y: me.y + Math.sin(me.angle) * 30,
        vx: Math.cos(me.angle) * 8.5,
        vy: Math.sin(me.angle) * 8.5
      };
      bullets.push({ ...bulletData, ownerIndex: playerIndex });
      
      if (socket && roomId) {
        socket.emit('game_action', { gameRoomId: roomId, action: { type: 'tank_shoot', bullet: bulletData, playerIndex } });
      }
      me.cooldown = 16;
    };

    window.setTouchKey = (key, isDown) => {
      keys[key] = isDown;
    };

    const gameLoop = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      const now = Date.now();
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
        ctx.fillStyle = `rgba(0, 0, 0, ${mark.alpha})`;
        ctx.fillRect(-12, -12, 10, 4);
        ctx.fillRect(-12, 8, 10, 4);
        ctx.restore();
      }

      for (let b of barriers) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 4;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }

      const isHoldingFire = Boolean(keys['touch_shoot'] || keys[' ']);

      p1.update(playerIndex === 0 ? isHoldingFire : false);
      p2.update(playerIndex === 1 ? isHoldingFire : false);
      
      if (p1.cooldown > 0) p1.cooldown--;
      if (p2.cooldown > 0) p2.cooldown--;

      p1.draw();
      p2.draw();

      for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
          bullets.splice(i, 1);
          continue;
        }

        let hit = false;
        for (let wall of barriers) {
          if (b.x > wall.x && b.x < wall.x + wall.w && b.y > wall.y && b.y < wall.y + wall.h) {
            createExplosion(b.x, b.y, '#94a3b8');
            bullets.splice(i, 1);
            hit = true;
            break;
          }
        }
        if (hit) continue;

        if (b.ownerIndex === 0 && Math.hypot(b.x - p2.x, b.y - p2.y) < p2.size / 2) {
          createExplosion(p2.x, p2.y, '#ef4444');
          bullets.splice(i, 1);
          p2.health -= 25;
          if (p2.health <= 0) {
            setTankScores(prev => ({ ...prev, p1: prev.p1 + 1 }));
            p1.health = 100; p2.health = 100;
            p1.x = 100; p1.y = 250; p2.x = 700; p2.y = 250;
          }
        } else if (b.ownerIndex === 1 && Math.hypot(b.x - p1.x, b.y - p1.y) < p1.size / 2) {
          createExplosion(p1.x, p1.y, '#38bdf8');
          bullets.splice(i, 1);
          p1.health -= 25;
          if (p1.health <= 0) {
            setTankScores(prev => ({ ...prev, p2: prev.p2 + 1 }));
            p1.health = 100; p1.health = 100;
            p1.x = 100; p1.y = 250; p2.x = 700; p2.y = 250;
          }
        } else {
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#f59e0b';
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      socket.off('game_state', handleRemoteAction);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameId, playerIndex, socket, roomId]);
  /* ========================================================== */

  const sendAction = (action) => {
    if (!roomId) return;
    setActionError('');
    socket.emit('game_action', { gameRoomId: roomId, action });
  };

  const getStatus = () => {
    if (!gameState && gameId !== 'tank-battle') return 'Setting up game...';
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
        {GAME_LIST.map((game) => (
          <div className="game-card" key={game.id}>
            <div className="game-card-top">
              <div className="game-icon-box">{game.icon}</div>
              <div className="game-card-info">
                <h4>{game.name}</h4>
                <p>{game.desc}</p>
              </div>
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
          <button key={column} onClick={() => sendAction({ type: 'drop', column })} disabled={gameState?.currentPlayer !== playerIndex || gameState?.winner !== null}>↓</button>
        ))}
      </div>
      <div className="connect-four-grid">
        {(gameState?.board || Array(42).fill(null)).map((cell, index) => (
          <button
            key={index}
            className={`connect-four-cell ${cell === 'X' ? 'disc-x' : ''} ${cell === 'O' ? 'disc-o' : ''}`}
            onClick={() => sendAction({ type: 'drop', column: index % 7 })}
            disabled={gameState?.currentPlayer !== playerIndex || gameState?.winner !== null}
          />
        ))}
      </div>
      <div className="game-score-line"><span>🔴 You: X</span><span>🟡 Opponent: O</span></div>
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
          ref={fireBtnRef}
          className="fire-btn-floating"
          type="button"
          onTouchStart={(e) => { 
            e.preventDefault(); 
            if (window.setTouchKey) window.setTouchKey('touch_shoot', true); 
            if (window.triggerTankShoot) window.triggerTankShoot();
          }}
          onTouchEnd={(e) => { 
            e.preventDefault(); 
            if (window.setTouchKey) window.setTouchKey('touch_shoot', false); 
          }}
          onMouseDown={() => { 
            if (window.setTouchKey) window.setTouchKey('touch_shoot', true); 
            if (window.triggerTankShoot) window.triggerTankShoot();
          }}
          onMouseUp={() => { 
            if (window.setTouchKey) window.setTouchKey('touch_shoot', false); 
          }}
        >
          🔥 FIRE
        </button>
      </div>

      <button className="fullscreen-btn" onClick={toggleFullScreen}>
        📺 Full Screen (Landscape Mode)
      </button>

      <p className="tank-controls-tip">
        👉 Tap to Fire | Hold FIRE Button to Drive Straight!
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
      default: return renderTicTacToe();
    }
  };

  return (
    <div className="modal-overlay game-overlay">
      <div className={`game-modal-card animate-pop-in ${gameId ? `game-modal-${gameId}` : 'games-lobby-modal'}`}>
        <div className="game-header">
          <h3>{gameId ? `${details.icon} ${details.name}` : '🎮 Games Lobby'}</h3>
          <button className="close-game-btn" onClick={onClose}>✕</button>
        </div>

        {gameId && (
          <div className="game-status-bar">
            <p>{getStatus()}</p>
            <span className="symbol-badge">You: {playerIndex === 0 ? 'P1' : 'P2'}</span>
          </div>
        )}

        {actionError && <p className="game-action-error">{actionError}</p>}
        {renderGame()}

        {gameId && (
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
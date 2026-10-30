import React, { useEffect, useRef, useState } from 'react';
import './GameModal.css';

const QUIZ_QUESTIONS = [
  { question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Mercury'] },
  { question: 'How many sides does a hexagon have?', options: ['Five', 'Six', 'Seven', 'Eight'] },
  { question: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'] },
  { question: 'What is the chemical symbol for gold?', options: ['Ag', 'Go', 'Gd', 'Au'] },
  { question: 'How many colors are in a rainbow traditionally?', options: ['Five', 'Six', 'Seven', 'Eight'] }
];

const GAME_DETAILS = {
  'tic-tac-toe': { icon: '⭕', name: 'Tic-Tac-Toe' },
  'connect-four': { icon: '🔴', name: 'Connect Four' },
  'rock-paper-scissors': { icon: '✊', name: 'Rock Paper Scissors' },
  'quiz-battle': { icon: '🧠', name: 'Quiz Battle' },
  'word-chain': { icon: '🔤', name: 'Word Chain' },
  'tank-battle': { icon: '🕹️', name: 'Tank Battle' }
};

const CHOICES = [
  { id: 'rock', icon: '✊', label: 'Rock' },
  { id: 'paper', icon: '✋', label: 'Paper' },
  { id: 'scissors', icon: '✌️', label: 'Scissors' }
];

const GameModal = ({ socket, currentUser, activeChat, onClose, gameSession }) => {
  const [gameState, setGameState] = useState(gameSession?.state || null);
  const [wordInput, setWordInput] = useState('');
  const [actionError, setActionError] = useState('');
  const [localChoiceSent, setLocalChoiceSent] = useState(false);
  const [tankScores, setTankScores] = useState({ p1: 0, p2: 0 });

  const canvasRef = useRef(null);
  const tankWrapRef = useRef(null);
  const fireBtnRef = useRef(null);

  const gameId = gameSession?.gameId || 'tic-tac-toe';
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
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
          }
        }).catch(err => console.error("Fullscreen error:", err.message));
      }
    } else {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
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
    let barriers = [
      { x: 200, y: 150, w: 50, h: 180 },
      { x: 550, y: 180, w: 50, h: 180 },
      { x: 340, y: 210, w: 120, h: 70 }
    ];

    class Tank {
      constructor(x, y, color, angle, isMe) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = 30;
        this.angle = angle;
        this.speed = 3.2;
        this.rotSpeed = 0.045; // Smooth continuous 360 rotation speed
        this.cooldown = 0;
        this.maxHealth = 100;
        this.health = 100;
        this.isMe = isMe;
      }

      update(isHoldingFire) {
        if (!this.isMe) return;

        let moved = false;

        // Agar fire button hold kiya hai, toh rotation ruk jayegi aur tank sidha chalega
        if (isHoldingFire) {
          let nextX = this.x + Math.cos(this.angle) * this.speed;
          let nextY = this.y + Math.sin(this.angle) * this.speed;
          if (!this.checkWallCollision(nextX, nextY)) {
            this.x = nextX;
            this.y = nextY;
            moved = true;
          }
        } else {
          // Warna tank lagatar smoothly 360 degree ghumta rahega
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

        // Health bar
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(-20, -this.size - 10, 40, 5);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(-20, -this.size - 10, (this.health / this.maxHealth) * 40, 5);

        ctx.rotate(this.angle);

        // Tracks
        ctx.fillStyle = '#333';
        ctx.fillRect(-this.size/2 - 2, -this.size/2, this.size + 4, 6);
        ctx.fillRect(-this.size/2 - 2, this.size/2 - 6, this.size + 4, 6);

        // Tank Body
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size/2, -this.size/2 + 4, this.size, this.size - 8);

        // Tank Barrel (Mundi / Turret combined as part of tank body)
        ctx.fillStyle = '#111';
        ctx.fillRect(-6, -6, 12, 12);
        ctx.fillRect(0, -3, 24, 6);

        ctx.restore();
      }
    }

    const p1 = new Tank(100, 250, '#3498db', 0, playerIndex === 0);
    const p2 = new Tank(700, 250, '#e74c3c', Math.PI, playerIndex === 1);

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
      }
    };
    socket.on('game_state', handleRemoteAction);

    const createExplosion = (x, y, color) => {
      for (let i = 0; i < 15; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          radius: Math.random() * 3 + 2,
          alpha: 1,
          color
        });
      }
    };

    // Fire action handler (Click to fire)
    window.triggerTankShoot = () => {
      const me = playerIndex === 0 ? p1 : p2;
      if (me.cooldown > 0) return;
      
      const bulletData = {
        x: me.x + Math.cos(me.angle) * 28,
        y: me.y + Math.sin(me.angle) * 28,
        vx: Math.cos(me.angle) * 7.5,
        vy: Math.sin(me.angle) * 7.5
      };
      bullets.push({ ...bulletData, ownerIndex: playerIndex });
      
      if (socket && roomId) {
        socket.emit('game_action', { gameRoomId: roomId, action: { type: 'tank_shoot', bullet: bulletData, playerIndex } });
      }
      me.cooldown = 18;
    };

    window.setTouchKey = (key, isDown) => {
      keys[key] = isDown;
    };

    const gameLoop = () => {
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let b of barriers) {
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#34495e';
        ctx.lineWidth = 3;
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
            createExplosion(b.x, b.y, '#7f8c8d');
            bullets.splice(i, 1);
            hit = true;
            break;
          }
        }
        if (hit) continue;

        if (b.ownerIndex === 0 && Math.hypot(b.x - p2.x, b.y - p2.y) < p2.size / 2) {
          createExplosion(p2.x, p2.y, '#e74c3c');
          bullets.splice(i, 1);
          p2.health -= 25;
          if (p2.health <= 0) {
            setTankScores(prev => ({ ...prev, p1: prev.p1 + 1 }));
            p1.health = 100; p2.health = 100;
            p1.x = 100; p1.y = 250; p2.x = 700; p2.y = 250;
          }
        } else if (b.ownerIndex === 1 && Math.hypot(b.x - p1.x, b.y - p1.y) < p1.size / 2) {
          createExplosion(p1.x, p1.y, '#3498db');
          bullets.splice(i, 1);
          p1.health -= 25;
          if (p1.health <= 0) {
            setTankScores(prev => ({ ...prev, p2: prev.p2 + 1 }));
            p1.health = 100; p2.health = 100;
            p1.x = 100; p1.y = 250; p2.x = 700; p2.y = 250;
          }
        } else {
          ctx.fillStyle = '#f1c40f';
          ctx.beginPath();
          ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
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

        {/* Sirf FIRE button bacha hai - Hold karne par tank sidha chalega, Click karne par fire hoga */}
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
        📺 Full Screen Mode
      </button>

      <p className="tank-controls-tip">
        👉 Tap to Fire | Hold FIRE Button to Drive Straight!
      </p>
    </div>
  );

  const renderGame = () => {
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
      <div className={`game-modal-card animate-pop-in game-modal-${gameId}`}>
        <div className="game-header">
          <h3>{details.icon} {details.name}</h3>
          <button className="close-game-btn" onClick={onClose}>✕</button>
        </div>

        <div className="game-status-bar">
          <p>{getStatus()}</p>
          <span className="symbol-badge">You: {playerIndex === 0 ? 'P1' : 'P2'}</span>
        </div>

        {actionError && <p className="game-action-error">{actionError}</p>}
        {renderGame()}

        <div className="game-footer">
          <button className="reset-game-btn" onClick={() => sendAction({ type: 'restart' })}>Restart Game</button>
          <span className="game-opponent-label">Playing with {activeChat?.name || 'your friend'}</span>
        </div>
      </div>
    </div>
  );
};

export default GameModal;
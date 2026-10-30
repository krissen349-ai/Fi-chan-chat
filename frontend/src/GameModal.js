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
  const joystickBaseRef = useRef(null);
  const joystickStickRef = useRef(null);
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

    let joystickActive = false;
    let joystickTouchId = null;
    let joystickVector = { x: 0, y: 0 };
    const joystickMaxRadius = 38;

    const handleKeyDown = (e) => { keys[e.key] = true; };
    const handleKeyUp = (e) => { keys[e.key] = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    class Tank {
      constructor(x, y, color, angle, isMe) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = 30;
        this.angle = angle;
        this.turretAngle = 0;
        this.speed = 3.2; /* Fast movement speed */
        this.rotSpeed = 0.07;
        this.cooldown = 0;
        this.maxHealth = 100;
        this.health = 100;
        this.isMe = isMe;
        this.lastTurretRotate = Date.now();
      }

      update() {
        if (!this.isMe) return;

        if (Date.now() - this.lastTurretRotate > 3000) {
          this.turretAngle += Math.PI / 4;
          this.lastTurretRotate = Date.now();
        }

        let moved = false;
        const controls = playerIndex === 0 ? {
          forward: 'w', backward: 's', left: 'a', right: 'd', shoot: ' '
        } : {
          forward: 'ArrowUp', backward: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', shoot: 'Enter'
        };

        if (keys[controls.forward]) {
          let nextX = this.x + Math.cos(this.angle) * this.speed;
          let nextY = this.y + Math.sin(this.angle) * this.speed;
          if (!this.checkWallCollision(nextX, nextY)) { this.x = nextX; this.y = nextY; moved = true; }
        }
        if (keys[controls.backward]) {
          let nextX = this.x - Math.cos(this.angle) * this.speed;
          let nextY = this.y - Math.sin(this.angle) * this.speed;
          if (!this.checkWallCollision(nextX, nextY)) { this.x = nextX; this.y = nextY; moved = true; }
        }

        if (keys[controls.left]) { this.angle -= this.rotSpeed; moved = true; }
        if (keys[controls.right]) { this.angle += this.rotSpeed; moved = true; }

        if (joystickActive) {
          let vx = joystickVector.x;
          let vy = joystickVector.y;
          if (document.fullscreenElement || document.webkitFullscreenElement) {
            vx = -joystickVector.y;
            vy = joystickVector.x;
          }

          const joystickAngle = Math.atan2(vy, vx);
          const magnitude = Math.hypot(vx, vy);

          if (magnitude > 0.1) {
            let angleDiff = joystickAngle - this.angle;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

            if (Math.abs(angleDiff) > 0.08) {
              this.angle += (angleDiff > 0 ? 1 : -1) * this.rotSpeed;
            }
            let nextX = this.x + Math.cos(this.angle) * this.speed * magnitude;
            let nextY = this.y + Math.sin(this.angle) * this.speed * magnitude;
            if (!this.checkWallCollision(nextX, nextY)) {
              this.x = nextX;
              this.y = nextY;
            }
            moved = true;
          }
        }

        if (this.cooldown > 0) this.cooldown--;
        
        if ((keys[controls.shoot] || keys['touch_shoot']) && this.cooldown === 0) {
          let totalAngle = this.angle + this.turretAngle;
          const bulletData = {
            x: this.x + Math.cos(totalAngle) * 25,
            y: this.y + Math.sin(totalAngle) * 25,
            vx: Math.cos(totalAngle) * 7.5,
            vy: Math.sin(totalAngle) * 7.5
          };
          bullets.push({ ...bulletData, ownerIndex: playerIndex });
          
          if (socket && roomId) {
            socket.emit('game_action', { gameRoomId: roomId, action: { type: 'tank_shoot', bullet: bulletData, playerIndex } });
          }
          this.cooldown = 18;
        }

        this.x = Math.max(this.size, Math.min(canvas.width - this.size, this.x));
        this.y = Math.max(this.size, Math.min(canvas.height - this.size, this.y));

        if (moved && socket && roomId) {
          socket.emit('game_action', {
            gameRoomId: roomId,
            action: { type: 'tank_move', x: this.x, y: this.y, angle: this.angle, turretAngle: this.turretAngle, playerIndex }
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

        ctx.fillStyle = '#c0392b';
        ctx.fillRect(-20, -this.size - 10, 40, 5);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(-20, -this.size - 10, (this.health / this.maxHealth) * 40, 5);

        ctx.rotate(this.angle);
        ctx.fillStyle = '#333';
        ctx.fillRect(-this.size/2 - 2, -this.size/2, this.size + 4, 6);
        ctx.fillRect(-this.size/2 - 2, this.size/2 - 6, this.size + 4, 6);

        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size/2, -this.size/2 + 4, this.size, this.size - 8);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-2, 0, 4, 0, Math.PI * 2);
        ctx.moveTo(-6, 0); ctx.lineTo(4, 0);
        ctx.stroke();

        ctx.rotate(this.turretAngle);
        ctx.fillStyle = '#111';
        ctx.fillRect(-6, -6, 12, 12);
        ctx.fillRect(0, -3, 22, 6);

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
        target.turretAngle = action.turretAngle;
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

    const stickEl = joystickStickRef.current;
    const baseEl = joystickBaseRef.current;

    const updateJoystickPos = (clientX, clientY) => {
      if (!baseEl || !stickEl) return;
      const rect = baseEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const distance = Math.hypot(dx, dy);

      if (distance > joystickMaxRadius) {
        dx = (dx / distance) * joystickMaxRadius;
        dy = (dy / distance) * joystickMaxRadius;
      }

      joystickVector.x = dx / joystickMaxRadius;
      joystickVector.y = dy / joystickMaxRadius;
      stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    const resetJoystick = () => {
      joystickActive = false;
      joystickTouchId = null;
      joystickVector = { x: 0, y: 0 };
      if (stickEl) stickEl.style.transform = `translate(0px, 0px)`;
    };

    const handleTouchStart = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (baseEl && baseEl.contains(touch.target)) {
          joystickActive = true;
          joystickTouchId = touch.identifier;
          updateJoystickPos(touch.clientX, touch.clientY);
        }
      }
    };

    const handleTouchMove = (e) => {
      if (!joystickActive) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === joystickTouchId) {
          updateJoystickPos(touch.clientX, touch.clientY);
        }
      }
    };

    const handleTouchEnd = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === joystickTouchId) {
          resetJoystick();
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    const handleMouseDown = (e) => {
      if (baseEl && baseEl.contains(e.target)) {
        joystickActive = true;
        updateJoystickPos(e.clientX, e.clientY);
      }
    };
    const handleMouseMove = (e) => {
      if (joystickActive && joystickTouchId === null) {
        updateJoystickPos(e.clientX, e.clientY);
      }
    };
    const handleMouseUp = () => {
      if (joystickTouchId === null) resetJoystick();
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

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

      p1.update();
      p2.update();
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

      for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.03;
        if (p.alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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
    if (gameId === 'rock-paper-scissors' && gameState?.roundComplete) return 'Round complete!';
    if (gameId === 'quiz-battle' && gameState?.roundComplete) return 'Answers are in!';
    if (gameId === 'rock-paper-scissors' && localChoiceSent) return 'Waiting for opponent...';
    if (gameId === 'quiz-battle' && gameState?.answered?.[playerIndex]) return 'Answer locked. Waiting for opponent...';
    if (gameState?.currentPlayer !== undefined) return gameState.currentPlayer === playerIndex ? 'Your turn' : "Opponent's turn";
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
          aria-label={`Cell ${index + 1}${cell ? ` ${cell}` : ''}`}
        >{cell}</button>
      ))}
    </div>
  );

  const renderConnectFour = () => (
    <div className="connect-four-wrap">
      <div className="connect-four-drop-row">
        {Array.from({ length: 7 }, (_, column) => (
          <button key={column} onClick={() => sendAction({ type: 'drop', column })} disabled={gameState?.currentPlayer !== playerIndex || gameState?.winner !== null} aria-label={`Drop in column ${column + 1}`}>↓</button>
        ))}
      </div>
      <div className="connect-four-grid">
        {(gameState?.board || Array(42).fill(null)).map((cell, index) => (
          <button
            key={index}
            className={`connect-four-cell ${cell === 'X' ? 'disc-x' : ''} ${cell === 'O' ? 'disc-o' : ''}`}
            onClick={() => sendAction({ type: 'drop', column: index % 7 })}
            disabled={gameState?.currentPlayer !== playerIndex || gameState?.winner !== null}
            aria-label={`Row ${Math.floor(index / 7) + 1}, column ${(index % 7) + 1}${cell ? ` ${cell}` : ''}`}
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
          <p>{CHOICES.find(choice => choice.id === gameState.choices?.[playerIndex])?.icon} You</p>
          <span>VS</span>
          <p>{CHOICES.find(choice => choice.id === gameState.choices?.[1 - playerIndex])?.icon} Opponent</p>
        </div>
      ) : (
        <>
          <p className="game-instruction">Choose secretly. Reveal happens when both players pick.</p>
          <div className="rps-choices">
            {CHOICES.map(choice => (
              <button key={choice.id} onClick={() => sendAction({ type: 'choose', choice: choice.id })} disabled={localChoiceSent} aria-label={choice.label}>
                <span>{choice.icon}</span>{choice.label}
              </button>
            ))}
          </div>
          {localChoiceSent && <p className="game-waiting-note">Choice locked. Waiting for your opponent...</p>}
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
        <div className="game-score-line"><span>You {gameState?.scores?.[playerIndex] || 0}</span><span>{gameState?.scores?.[1 - playerIndex] || 0} Opponent</span></div>
        <h4 className="quiz-question">{question.question}</h4>
        <div className="quiz-options">
          {question.options.map((option, index) => (
            <button
              key={option}
              className={gameState?.roundComplete && index === gameState.correctAnswer ? 'quiz-correct' : gameState?.roundComplete && index === myAnswer ? 'quiz-incorrect' : ''}
              onClick={() => sendAction({ type: 'answer', answerIndex: index })}
              disabled={Boolean(gameState?.answered?.[playerIndex]) || gameState?.roundComplete || gameState?.winner !== null}
            >{option}</button>
          ))}
        </div>
        {gameState?.roundComplete && gameState.winner === null && <button className="reset-game-btn" onClick={() => sendAction({ type: 'next-question' })}>{gameState.questionIndex === QUIZ_QUESTIONS.length - 1 ? 'Show Result' : 'Next Question'}</button>}
      </div>
    );
  };

  const renderWordChain = () => {
    const lastWord = gameState?.words?.at(-1)?.word;
    const requiredLetter = lastWord?.at(-1)?.toUpperCase();
    const isMyTurn = gameState?.currentPlayer === playerIndex;
    return (
      <div className="mini-game-content">
        <p className="game-instruction">{requiredLetter ? `Your word must start with ${requiredLetter}` : 'Start the chain with any English word.'}</p>
        <div className="word-chain-list">
          {(gameState?.words || []).length === 0 && <p className="game-empty-state">No words yet. Start the chain!</p>}
          {(gameState?.words || []).map((entry, index) => (
            <span className={entry.playerIndex === playerIndex ? 'word-mine' : 'word-theirs'} key={`${entry.word}-${index}`}>{entry.word}</span>
          ))}
        </div>
        <form className="word-chain-form" onSubmit={event => { event.preventDefault(); if (!wordInput.trim()) return; sendAction({ type: 'word', word: wordInput }); setWordInput(''); }}>
          <input value={wordInput} onChange={event => setWordInput(event.target.value)} placeholder={requiredLetter ? `Word starting with ${requiredLetter}` : 'Type a word'} disabled={!isMyTurn} maxLength={24} />
          <button type="submit" disabled={!isMyTurn || !wordInput.trim()}>Play</button>
        </form>
        {!isMyTurn && <p className="game-waiting-note">Opponent is choosing a word...</p>}
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

        <div ref={joystickBaseRef} className="joystick-base">
          <div ref={joystickStickRef} className="joystick-stick"></div>
        </div>

        <button 
          ref={fireBtnRef}
          className="fire-btn-floating"
          type="button"
          onTouchStart={(e) => { e.preventDefault(); if (window.setTouchKey) window.setTouchKey('touch_shoot', true); }}
          onTouchEnd={(e) => { e.preventDefault(); if (window.setTouchKey) window.setTouchKey('touch_shoot', false); }}
          onMouseDown={() => { if (window.setTouchKey) window.setTouchKey('touch_shoot', true); }}
          onMouseUp={() => { if (window.setTouchKey) window.setTouchKey('touch_shoot', false); }}
        >
          🔥 FIRE
        </button>
      </div>

      <button className="fullscreen-btn" onClick={toggleFullScreen}>
        📺 Full Screen Mode
      </button>

      <p className="tank-controls-tip">
        👉 Drag Joystick to Move | FIRE to Shoot
      </p>
    </div>
  );

  const renderGame = () => {
    if (!gameState && gameId !== 'tank-battle') return <p className="game-instruction">Waiting for the game session...</p>;
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
          <button className="close-game-btn" onClick={onClose} aria-label="Close game">✕</button>
        </div>

        <div className="game-status-bar">
          <p>{getStatus()}</p>
          <span className="symbol-badge">{gameId === 'quiz-battle' || gameId === 'rock-paper-scissors' || gameId === 'tank-battle' ? `You: ${playerIndex === 0 ? 'P1' : 'P2'}` : `You: ${mySymbol}`}</span>
        </div>

        {actionError && <p className="game-action-error" role="alert">{actionError}</p>}
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
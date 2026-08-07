import React, { useState, useEffect, useRef } from 'react';

const BirthdayGame = ({ onFinish }) => {
  const canvasRef = useRef(null);

  // States only for React UI overlays
  const [currentNumber, setCurrentNumber] = useState(1);
  const [gameOver, setGameOver] = useState(false);

  // Core Game State Engine via Refs
  const gameState = useRef({
    currentNumber: 1,
    isShooting: false,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragCurrent: { x: 0, y: 0 },
    arrowPos: { x: 0, y: 0 },
    arrowVel: { vx: 0, vy: 0 },
    arrowAngle: 0,
    particles: [],
    confetti: [],
    floatOffset: 0
  });

  // Sound Engine
  const playPopSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  };

  const playWinSong = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const notes = [261.63, 261.63, 293.66, 261.63, 349.23, 329.63, 392.00];
      notes.forEach((freq, index) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        }, index * 250);
      });
    } catch (e) {}
  };

  // Create Pop Particle Burst Effect
  const spawnPopParticles = (x, y, color) => {
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      gameState.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 4 + 2,
        color,
        alpha: 1,
        life: 1.0
      });
    }
  };

  // Create Win Celebration Confetti
  const triggerWinConfetti = () => {
    const colors = ['#f43f5e', '#fbbf24', '#3b82f6', '#10b981', '#a855f7', '#ec4899'];
    for (let i = 0; i < 120; i++) {
      gameState.current.confetti.push({
        x: Math.random() * 800,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 4 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10
      });
    }
  };

  // Canvas Main Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    const gravity = 0.22;

    const render = () => {
      const state = gameState.current;
      const currNum = state.currentNumber;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Background Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGrad.addColorStop(0, '#111827');
      bgGrad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Positions Calculation
      const bowX = canvas.width * 0.15;
      const bowY = canvas.height * 0.65;

      // Floating Balloon Offset
      state.floatOffset += 0.04;
      const floatY = Math.sin(state.floatOffset) * 12;

      const baseTargetX = currNum === 21 
        ? canvas.width * 0.8 
        : canvas.width * 0.58 + ((currNum * 7) % 3) * (canvas.width * 0.08);
      
      const baseTargetY = currNum === 21 
        ? canvas.height * 0.3 
        : canvas.height * 0.55 - ((currNum * 23) % (canvas.height * 0.3));

      const targetX = baseTargetX;
      const targetY = baseTargetY + floatY;
      const balloonRadius = currNum === 21 ? 30 : 26;
      const balloonColor = currNum === 21 ? '#fbbf24' : '#e11d48';

      // 2. Render Target Balloon
      if (!gameOver) {
        // String
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(targetX, targetY + balloonRadius * 1.2);
        ctx.bezierCurveTo(targetX - 5, targetY + 40, targetX + 5, targetY + 60, targetX, targetY + 75);
        ctx.stroke();

        // Balloon Body Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(targetX + 4, targetY + 4, balloonRadius, balloonRadius * 1.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // 🎯 Solid Clean Color Fill (HIGHLIGHTS REMOVED)
        ctx.fillStyle = balloonColor;
        ctx.beginPath();
        ctx.ellipse(targetX, targetY, balloonRadius, balloonRadius * 1.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Balloon Knot
        ctx.fillStyle = balloonColor;
        ctx.beginPath();
        ctx.moveTo(targetX - 4, targetY + balloonRadius * 1.2);
        ctx.lineTo(targetX + 4, targetY + balloonRadius * 1.2);
        ctx.lineTo(targetX, targetY + balloonRadius * 1.2 - 4);
        ctx.fill();

        if (currNum === 21) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // Balloon Text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(currNum, targetX, targetY);
      }

      // Calculate Pull Angles & Distance
      let pullAngle = 0;
      let pullDistance = 0;
      if (state.isDragging) {
        const dx = state.dragStart.x - state.dragCurrent.x;
        const dy = state.dragStart.y - state.dragCurrent.y;
        pullAngle = Math.atan2(dy, dx);
        pullDistance = Math.min(Math.hypot(dx, dy), 100);
      }

      // 3. Render Bow
      ctx.save();
      ctx.translate(bowX, bowY);
      ctx.rotate(pullAngle);

      // Wooden Arch Body
      ctx.strokeStyle = '#854d0e';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 42, -Math.PI / 2.2, Math.PI / 2.2, false);
      ctx.stroke();

      // Grip Center
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(0, 0, 42, -Math.PI / 12, Math.PI / 12, false);
      ctx.stroke();

      // Metallic Bow Nocks
      ctx.fillStyle = '#e4e4e7';
      const topNockX = 42 * Math.cos(-Math.PI / 2.2);
      const topNockY = 42 * Math.sin(-Math.PI / 2.2);
      const botNockX = 42 * Math.cos(Math.PI / 2.2);
      const botNockY = 42 * Math.sin(Math.PI / 2.2);

      ctx.beginPath();
      ctx.arc(topNockX, topNockY, 4, 0, Math.PI * 2);
      ctx.arc(botNockX, botNockY, 4, 0, Math.PI * 2);
      ctx.fill();

      // String Logic
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(topNockX, topNockY);
      
      if (state.isDragging) {
        ctx.lineTo(-pullDistance * 0.8, 0);
      } else {
        ctx.lineTo(0, 0);
      }
      
      ctx.lineTo(botNockX, botNockY);
      ctx.stroke();
      ctx.restore();

      // Helper function to draw an Arrow
      const drawArrow = (x, y, angle) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Arrow Shaft
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-35, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();

        // Metallic Head
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(10, -5);
        ctx.lineTo(22, 0);
        ctx.lineTo(10, 5);
        ctx.closePath();
        ctx.fill();

        // Feathers (Fletching)
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.moveTo(-35, 0);
        ctx.lineTo(-43, -6);
        ctx.lineTo(-30, 0);
        ctx.lineTo(-43, 6);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      };

      // 4. Trajectory Line & Aiming Arrow
      if (state.isDragging && !state.isShooting) {
        const dx = state.dragStart.x - state.dragCurrent.x;
        const dy = state.dragStart.y - state.dragCurrent.y;
        
        const simVx = dx * 0.35;
        const simVy = dy * 0.35;

        // Trajectory Guide Dots
        ctx.fillStyle = 'rgba(244, 63, 94, 0.7)';
        let simX = bowX - (pullDistance * 0.8) * Math.cos(pullAngle);
        let simY = bowY - (pullDistance * 0.8) * Math.sin(pullAngle);
        let currVx = simVx;
        let currVy = simVy;

        for (let i = 0; i < 20; i++) {
          simX += currVx;
          simY += currVy;
          currVy += gravity;

          ctx.beginPath();
          ctx.arc(simX, simY, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw Ready Arrow attached to bow string
        const arrowX = bowX - (pullDistance * 0.8) * Math.cos(pullAngle);
        const arrowY = bowY - (pullDistance * 0.8) * Math.sin(pullAngle);
        drawArrow(arrowX, arrowY, pullAngle);
      }

      // Idle Bow Arrow (When waiting to shoot)
      if (!state.isDragging && !state.isShooting && !gameOver) {
        drawArrow(bowX, bowY, 0);
      }

      // 5. Shot Arrow Flight Physics & Collision
      if (state.isShooting) {
        state.arrowPos.x += state.arrowVel.vx;
        state.arrowPos.y += state.arrowVel.vy;
        state.arrowVel.vy += gravity;

        state.arrowAngle = Math.atan2(state.arrowVel.vy, state.arrowVel.vx);
        drawArrow(state.arrowPos.x, state.arrowPos.y, state.arrowAngle);

        // Hit Detection Calculation
        const dist = Math.hypot(state.arrowPos.x - targetX, state.arrowPos.y - targetY);
        if (dist < balloonRadius + 10) {
          playPopSound();
          spawnPopParticles(targetX, targetY, balloonColor);
          state.isShooting = false;

          if (state.currentNumber < 21) {
            state.currentNumber += 1;
            setCurrentNumber(state.currentNumber);
          } else {
            setGameOver(true);
            playWinSong();
            triggerWinConfetti();
          }
        }

        // Canvas Boundary Check
        if (
          state.arrowPos.x > canvas.width + 50 || 
          state.arrowPos.y > canvas.height + 50 || 
          state.arrowPos.y < -100
        ) {
          state.isShooting = false;
        }
      }

      // 6. Update & Render Pop Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // Particle Gravity
        p.life -= 0.03;

        if (p.life <= 0) {
          state.particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // 7. Update & Render Win Confetti
      for (let i = state.confetti.length - 1; i >= 0; i--) {
        const c = state.confetti[i];
        c.x += c.vx;
        c.y += c.vy;
        c.rotation += c.rotSpeed;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate((c.rotation * Math.PI) / 180);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
        ctx.restore();

        if (c.y > canvas.height + 20) {
          state.confetti.splice(i, 1);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [gameOver]);

  // Canvas Touches/Mouse Coords Converter
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const handleStart = (e) => {
    if (gameState.current.isShooting || gameOver) return;
    const coords = getCanvasCoords(e);
    gameState.current.isDragging = true;
    gameState.current.dragStart = coords;
    gameState.current.dragCurrent = coords;
  };

  const handleMove = (e) => {
    if (!gameState.current.isDragging || gameState.current.isShooting) return;
    gameState.current.dragCurrent = getCanvasCoords(e);
  };

  const handleEnd = () => {
    const state = gameState.current;
    if (!state.isDragging || state.isShooting) return;
    state.isDragging = false;

    const dx = state.dragStart.x - state.dragCurrent.x;
    const dy = state.dragStart.y - state.dragCurrent.y;

    if (Math.hypot(dx, dy) > 12) {
      const bowX = canvasRef.current.width * 0.15;
      const bowY = canvasRef.current.height * 0.65;
      const pullAngle = Math.atan2(dy, dx);
      const pullDist = Math.min(Math.hypot(dx, dy), 100);

      state.arrowPos = {
        x: bowX - (pullDist * 0.8) * Math.cos(pullAngle),
        y: bowY - (pullDist * 0.8) * Math.sin(pullAngle)
      };

      state.arrowVel = {
        vx: dx * 0.35,
        vy: dy * 0.35
      };
      
      state.isShooting = true;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        width: '100%',
        userSelect: 'none',
        touchAction: 'none'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '800px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
          🎈 Pop Balloon: <span style={{ color: '#f43f5e' }}>{currentNumber}/21</span>
        </h3>

        <button
          onClick={onFinish}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            color: '#fff',
            padding: '8px 18px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Skip ✕
        </button>
      </div>

      {gameOver ? (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            padding: '40px 24px',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            textAlign: 'center',
            margin: '20px 0',
            width: '90%',
            maxWidth: '450px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}
        >
          <h2 style={{ color: '#fbbf24', fontSize: '28px', margin: '0 0 12px 0' }}>
            🎉 HAPPY 21st BIRTHDAY! 🎉
          </h2>
          <p style={{ fontSize: '15px', opacity: 0.9, lineHeight: '1.5' }}>
            Awesome! Aapne saare 21 balloons pop kar diye hain! Gift Unlock ho gaya hai ✨
          </p>

          <button
            onClick={onFinish}
            style={{
              marginTop: '20px',
              padding: '14px 36px',
              backgroundColor: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: '30px',
              fontSize: '16px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: '0 10px 25px rgba(251, 191, 36, 0.4)'
            }}
          >
            🎁 Open My Gift ✨
          </button>
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
            style={{
              width: '100%',
              maxWidth: '800px',
              height: 'auto',
              maxHeight: '65vh',
              borderRadius: '20px',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
              touchAction: 'none',
              cursor: 'crosshair'
            }}
          />

          <p
            style={{
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.75)',
              marginTop: '12px',
              textAlign: 'center'
            }}
          >
            🎯 <strong>Bow ko peeche kheencho (Pull back) aur chhod do!</strong>
          </p>
        </>
      )}
    </div>
  );
};

export default BirthdayGame;
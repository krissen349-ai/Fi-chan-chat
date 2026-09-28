import React, { useState, useEffect, useRef, useCallback } from 'react';

const BirthdayGame = ({ onFinish }) => {
  const canvasRef = useRef(null);

  const [currentNumber, setCurrentNumber] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [feedbackText, setFeedbackText] = useState(null);
  const [comboCount, setComboCount] = useState(0);

  const gameState = useRef({
    currentNumber: 1,
    isShooting: false,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragCurrent: { x: 0, y: 0 },
    arrowPos: { x: 0, y: 0 },
    arrowVel: { vx: 0, vy: 0 },
    arrowAngle: 0,
    arrowTrail: [],
    particles: [],
    shockwaves: [],
    confetti: [],
    stars: [],
    shakeTime: 0,
    floatOffset: 0,
    balloonAngle: 0,
    combo: 0,
    timeDilation: 1,
    lastPullDist: 0
  });

  // High-Quality Studio Sound Generator Engine
  const playHDAudio = (type, param = 0) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'stretch') {
        // High-Quality Wooden Tension Creak Simulation (Granular noise + resonance)
        const bufferSize = ctx.sampleRate * 0.08;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300 + param * 8, ctx.currentTime);
        filter.Q.value = 12.0;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
      } else if (type === 'release') {
        // Heavy Snap + Low Punch Whoosh
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(380, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.16);

        gain.gain.setValueAtTime(0.6, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);

        // Sub-bass Thump
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(150, ctx.currentTime);
        sub.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.18);
        subGain.gain.setValueAtTime(0.8, ctx.currentTime);
        subGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        sub.connect(subGain);
        subGain.connect(ctx.destination);

        osc.start();
        sub.start();
        osc.stop(ctx.currentTime + 0.16);
        sub.stop(ctx.currentTime + 0.18);
      } else if (type === 'pop') {
        // Punchy Glass/Balloon Crash Noise
        const bufferSize = ctx.sampleRate * 0.12;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1);
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800 + param * 200, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.12);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.9, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
      } else if (type === 'miss') {
        // Disappointed Metallic Thud
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.22);

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } else if (type === 'win') {
        // Epic Celebration Synth Chord
        const freqs = [261.63, 329.63, 392.00, 523.25, 659.25];
        freqs.forEach((f, index) => {
          setTimeout(() => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = f;
            gain.gain.setValueAtTime(0.35, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.8);
          }, index * 90);
        });
      }
    } catch (e) {}
  };

  const showFeedback = (text, type = 'miss') => {
    setFeedbackText({ text, type, id: Date.now() });
    setTimeout(() => {
      setFeedbackText(null);
    }, 1100);
  };

  // Shockwave Explosions
  const spawnShockwave = useCallback((x, y, color) => {
    gameState.current.shockwaves.push({
      x,
      y,
      radius: 5,
      maxRadius: 65,
      alpha: 1.0,
      color
    });
  }, []);

  // High Density Particles
  const spawnPopParticles = useCallback((x, y, color) => {
    gameState.current.shakeTime = 18; // Massive Shake
    spawnShockwave(x, y, color);

    for (let i = 0; i < 55; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 14 + 4;
      gameState.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 6 + 2,
        color,
        alpha: 1,
        life: 1.0,
        decay: Math.random() * 0.035 + 0.018
      });
    }
  }, [spawnShockwave]);

  const triggerWinConfetti = () => {
    const colors = ['#f43f5e', '#fbbf24', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#38bdf8'];
    for (let i = 0; i < 350; i++) {
      gameState.current.confetti.push({
        x: Math.random() * 800,
        y: -20 - Math.random() * 400,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 10 + 4,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 16
      });
    }
  };

  useEffect(() => {
    const stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * 800,
        y: Math.random() * 500,
        size: Math.random() * 2.5 + 1,
        alpha: Math.random(),
        speed: Math.random() * 0.03 + 0.008
      });
    }
    gameState.current.stars = stars;
  }, []);

  // Main Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    const gravity = 0.22;

    const render = () => {
      const state = gameState.current;
      const currNum = state.currentNumber;
      const dt = state.timeDilation;

      ctx.save();

      // Screen Shake
      if (state.shakeTime > 0) {
        const dx = (Math.random() - 0.5) * state.shakeTime * 1.6;
        const dy = (Math.random() - 0.5) * state.shakeTime * 1.6;
        ctx.translate(dx, dy);
        state.shakeTime -= 1;
      }

      ctx.clearRect(-30, -30, canvas.width + 60, canvas.height + 60);

      // Sci-Fi Dynamic BG
      const bgGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 50,
        canvas.width / 2, canvas.height / 2, 550
      );
      bgGrad.addColorStop(0, '#1e1b4b');
      bgGrad.addColorStop(0.5, '#0f172a');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(-30, -30, canvas.width + 60, canvas.height + 60);

      // Stars
      state.stars.forEach((star) => {
        star.alpha += star.speed;
        if (star.alpha > 1 || star.alpha < 0) star.speed = -star.speed;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(star.alpha)})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      });

      // Target Movement Logic
      state.floatOffset += 0.05 * dt;
      let floatY = Math.sin(state.floatOffset) * 16;
      let floatX = 0;

      if (currNum > 7) {
        state.balloonAngle += 0.04 * dt;
        floatX = Math.cos(state.balloonAngle) * (currNum > 14 ? 38 : 22);
      }

      const bowX = canvas.width * 0.15;
      const bowY = canvas.height * 0.65;

      const baseTargetX = currNum === 21 
        ? canvas.width * 0.78 
        : canvas.width * 0.55 + ((currNum * 9) % 4) * (canvas.width * 0.075);
      
      const baseTargetY = currNum === 21 
        ? canvas.height * 0.35 
        : canvas.height * 0.52 - ((currNum * 17) % (canvas.height * 0.28));

      const targetX = baseTargetX + floatX;
      const targetY = baseTargetY + floatY;
      const balloonRadius = currNum === 21 ? 38 : 27;
      const balloonColor = currNum === 21 ? '#fbbf24' : currNum % 2 === 0 ? '#ec4899' : '#f43f5e';

      // Draw Balloon
      if (!gameOver) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(targetX, targetY + balloonRadius * 1.2);
        ctx.bezierCurveTo(targetX - 8, targetY + 40, targetX + 8, targetY + 60, targetX, targetY + 80);
        ctx.stroke();

        ctx.shadowBlur = currNum === 21 ? 35 : 20;
        ctx.shadowColor = balloonColor;

        ctx.fillStyle = balloonColor;
        ctx.beginPath();
        ctx.ellipse(targetX, targetY, balloonRadius, balloonRadius * 1.25, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.ellipse(targetX - balloonRadius * 0.3, targetY - balloonRadius * 0.4, balloonRadius * 0.3, balloonRadius * 0.18, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#000';
        ctx.font = '900 22px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(currNum, targetX, targetY);
        ctx.shadowBlur = 0;
      }

      // Drag Angle Math
      let pullAngle = 0;
      let pullDistance = 0;
      if (state.isDragging) {
        const dx = state.dragStart.x - state.dragCurrent.x;
        const dy = state.dragStart.y - state.dragCurrent.y;
        pullAngle = Math.atan2(dy, dx);
        pullDistance = Math.min(Math.hypot(dx, dy), 125);

        // Sound Trigger on Pull Thresholds
        if (Math.abs(pullDistance - state.lastPullDist) > 12) {
          playHDAudio('stretch', pullDistance);
          state.lastPullDist = pullDistance;
        }
      }

      // Render Bow
      ctx.save();
      ctx.translate(bowX, bowY);
      ctx.rotate(pullAngle);

      ctx.strokeStyle = '#38bdf8';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#0284c7';
      ctx.lineWidth = 8.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 50, -Math.PI / 2.1, Math.PI / 2.1, false);
      ctx.stroke();

      ctx.strokeStyle = '#0f172a';
      ctx.shadowBlur = 0;
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.arc(0, 0, 50, -Math.PI / 10, Math.PI / 10, false);
      ctx.stroke();

      const topNockX = 50 * Math.cos(-Math.PI / 2.1);
      const topNockY = 50 * Math.sin(-Math.PI / 2.1);
      const botNockX = 50 * Math.cos(Math.PI / 2.1);
      const botNockY = 50 * Math.sin(Math.PI / 2.1);

      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(topNockX, topNockY);
      ctx.lineTo(state.isDragging ? -pullDistance * 0.85 : 0, 0);
      ctx.lineTo(botNockX, botNockY);
      ctx.stroke();
      ctx.restore();

      // Draw Arrow
      const drawArrow = (x, y, angle) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f43f5e';

        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-38, 0);
        ctx.lineTo(14, 0);
        ctx.stroke();

        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.moveTo(14, -7);
        ctx.lineTo(28, 0);
        ctx.lineTo(14, 7);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-38, 0);
        ctx.lineTo(-48, -8);
        ctx.lineTo(-32, 0);
        ctx.lineTo(-48, 8);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      };

      // Trajectory Line
      if (state.isDragging && !state.isShooting) {
        const dx = state.dragStart.x - state.dragCurrent.x;
        const dy = state.dragStart.y - state.dragCurrent.y;
        
        const simVx = dx * 0.38;
        const simVy = dy * 0.38;

        let simX = bowX - (pullDistance * 0.85) * Math.cos(pullAngle);
        let simY = bowY - (pullDistance * 0.85) * Math.sin(pullAngle);
        let currVx = simVx;
        let currVy = simVy;

        for (let i = 0; i < 26; i++) {
          simX += currVx;
          simY += currVy;
          currVy += gravity;

          ctx.fillStyle = `rgba(244, 63, 94, ${1 - i / 26})`;
          ctx.beginPath();
          ctx.arc(simX, simY, 4 - (i / 26) * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        const arrowX = bowX - (pullDistance * 0.85) * Math.cos(pullAngle);
        const arrowY = bowY - (pullDistance * 0.85) * Math.sin(pullAngle);
        drawArrow(arrowX, arrowY, pullAngle);
      }

      if (!state.isDragging && !state.isShooting && !gameOver) {
        drawArrow(bowX, bowY, 0);
      }

      // Flight Physics
      if (state.isShooting) {
        state.arrowPos.x += state.arrowVel.vx * dt;
        state.arrowPos.y += state.arrowVel.vy * dt;
        state.arrowVel.vy += gravity * dt;

        state.arrowAngle = Math.atan2(state.arrowVel.vy, state.arrowVel.vx);

        state.arrowTrail.push({
          x: state.arrowPos.x,
          y: state.arrowPos.y,
          alpha: 1.0
        });

        for (let i = state.arrowTrail.length - 1; i >= 0; i--) {
          const t = state.arrowTrail[i];
          t.alpha -= 0.08;
          if (t.alpha <= 0) {
            state.arrowTrail.splice(i, 1);
            continue;
          }
          ctx.fillStyle = `rgba(56, 189, 248, ${t.alpha})`;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        drawArrow(state.arrowPos.x, state.arrowPos.y, state.arrowAngle);

        // Hit Detection
        const dist = Math.hypot(state.arrowPos.x - targetX, state.arrowPos.y - targetY);
        if (dist < balloonRadius + 14) {
          state.combo += 1;
          setComboCount(state.combo);
          
          playHDAudio('pop', state.combo);
          spawnPopParticles(targetX, targetY, balloonColor);
          
          if (state.combo > 1) {
            showFeedback(`${state.combo}x ULTRA COMBO!`, 'hit');
          } else {
            showFeedback('TARGET DESTROYED!', 'hit');
          }

          state.isShooting = false;
          state.arrowTrail = [];

          if (state.currentNumber < 21) {
            state.currentNumber += 1;
            setCurrentNumber(state.currentNumber);
          } else {
            state.timeDilation = 0.2; // Slow Motion
            setTimeout(() => {
              setGameOver(true);
              playHDAudio('win');
              triggerWinConfetti();
            }, 800);
          }
        }

        // Missed
        if (
          state.arrowPos.x > canvas.width + 60 || 
          state.arrowPos.y > canvas.height + 60 || 
          state.arrowPos.y < -100
        ) {
          state.isShooting = false;
          state.arrowTrail = [];
          state.combo = 0;
          setComboCount(0);
          
          playHDAudio('miss');
          showFeedback('MISSED!', 'miss');
        }
      }

      // Render Shockwaves
      for (let i = state.shockwaves.length - 1; i >= 0; i--) {
        const sw = state.shockwaves[i];
        sw.radius += 3.5;
        sw.alpha -= 0.04;

        if (sw.alpha <= 0) {
          state.shockwaves.splice(i, 1);
          continue;
        }

        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = sw.alpha;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // Render Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.2 * dt;
        p.life -= p.decay;

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

      // Render Confetti
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

        if (c.y > canvas.height + 40) {
          state.confetti.splice(i, 1);
        }
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameOver, spawnPopParticles]);

  // Touch/Mouse Controls
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

    if (Math.hypot(dx, dy) > 15) {
      playHDAudio('release');
      const bowX = canvasRef.current.width * 0.15;
      const bowY = canvasRef.current.height * 0.65;
      const pullAngle = Math.atan2(dy, dx);
      const pullDist = Math.min(Math.hypot(dx, dy), 125);

      state.arrowPos = {
        x: bowX - (pullDist * 0.85) * Math.cos(pullAngle),
        y: bowY - (pullDist * 0.85) * Math.sin(pullAngle)
      };

      state.arrowVel = {
        vx: dx * 0.38,
        vy: dy * 0.38
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
        touchAction: 'none',
        position: 'relative'
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
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '0.5px' }}>
          🎯 TARGET: <span style={{ color: '#f43f5e' }}>{currentNumber}/21</span>
          {comboCount > 1 && (
            <span style={{ marginLeft: '12px', color: '#38bdf8', fontSize: '15px' }}>
              🔥 {comboCount}x COMBO!
            </span>
          )}
        </h3>

        <button
          onClick={onFinish}
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#fff',
            padding: '8px 18px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)'
          }}
        >
          Skip ✕
        </button>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: '800px' }}>
        {/* Dynamic Screen Feedback Overlay */}
        {feedbackText && (
          <div
            key={feedbackText.id}
            style={{
              position: 'absolute',
              top: '20%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              pointerEvents: 'none',
              fontSize: '38px',
              fontWeight: '900',
              letterSpacing: '2px',
              color: feedbackText.type === 'hit' ? '#10b981' : '#f43f5e',
              textShadow: feedbackText.type === 'hit' 
                ? '0 0 25px rgba(16, 185, 129, 0.9), 0 0 50px rgba(16, 185, 129, 0.6)' 
                : '0 0 25px rgba(244, 63, 94, 0.9), 0 0 50px rgba(244, 63, 94, 0.6)',
              animation: 'popFade 1.1s forwards ease-out'
            }}
          >
            {feedbackText.text}
          </div>
        )}

        <style>{`
          @keyframes popFade {
            0% { opacity: 0; transform: translate(-50%, -30%) scale(0.5); }
            18% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
            80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -65%) scale(0.85); }
          }
        `}</style>

        {gameOver ? (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(25px)',
              padding: '40px 28px',
              borderRadius: '28px',
              border: '1px solid rgba(251, 191, 36, 0.5)',
              textAlign: 'center',
              margin: '20px auto',
              width: '90%',
              maxWidth: '460px',
              boxShadow: '0 0 60px rgba(251, 191, 36, 0.35)'
            }}
          >
            <h2 style={{ color: '#fbbf24', fontSize: '32px', margin: '0 0 12px 0', textShadow: '0 0 15px rgba(251,191,36,0.6)' }}>
              👑 HAPPY 21st BIRTHDAY! 👑
            </h2>
            <p style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: '1.6' }}>
              Supreme Victory! Aapne saare 21 balloons sharp precision ke saath pop kar diye! Gift Unlock ho gaya hai ✨
            </p>

            <button
              onClick={onFinish}
              style={{
                marginTop: '24px',
                padding: '16px 42px',
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                color: '#000',
                border: 'none',
                borderRadius: '30px',
                fontSize: '17px',
                fontWeight: '900',
                cursor: 'pointer',
                boxShadow: '0 10px 30px rgba(245, 158, 11, 0.5)'
              }}
            >
              🎁 OPEN YOUR GIFT ✨
            </button>
          </div>
        ) : (
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
              borderRadius: '24px',
              border: '2px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
              touchAction: 'none',
              cursor: 'crosshair'
            }}
          />
        )}
      </div>

      {!gameOver && (
        <p
          style={{
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.7)',
            marginTop: '14px',
            textAlign: 'center'
          }}
        >
          🏹 <strong>Teer peeche kheencho, mechanical tension feel karo aur target destroy karo!</strong>
        </p>
      )}
    </div>
  );
};

export default BirthdayGame;
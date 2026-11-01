import React, { useEffect, useRef, useState } from 'react';
import './SurvivalGames.css';
import GameFullscreenButton from './GameFullscreenButton';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const RedLightGreenLight = ({ gameState, playerIndex, onAction, onClose }) => {
  const stageRef = useRef(null);
  const axisRef = useRef(0);
  const pointerRef = useRef(null);
  const previousPhaseRef = useRef(gameState?.phase);
  const canMoveRef = useRef(false);
  const [joystickY, setJoystickY] = useState(0);
  const [clock, setClock] = useState(Date.now());
  canMoveRef.current = gameState?.status === 'playing' && !gameState.eliminated?.[playerIndex] && !gameState.finished?.[playerIndex];

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (gameState?.status === 'playing') return;
    axisRef.current = 0;
    setJoystickY(0);
  }, [gameState?.status]);

  useEffect(() => {
    if (!gameState || previousPhaseRef.current === gameState.phase) return;
    previousPhaseRef.current = gameState.phase;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(
      gameState.phase === 'green' ? 'Green light' : 'Red light'
    ));
  }, [gameState?.phase, gameState]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (canMoveRef.current) {
        onAction({ type: 'move', axis: axisRef.current });
      }
    }, 70);
    return () => window.clearInterval(interval);
  }, [onAction]);

  useEffect(() => {
    const heldKeys = new Set();
    const updateAxis = () => {
      axisRef.current = heldKeys.has('ArrowUp') || heldKeys.has('w') ? 1
        : heldKeys.has('ArrowDown') || heldKeys.has('s') ? -1
          : 0;
    };
    const onKeyDown = (event) => {
      if (['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S'].includes(event.key)) {
        event.preventDefault();
        heldKeys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
        updateAxis();
      }
    };
    const onKeyUp = (event) => {
      heldKeys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
      updateAxis();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const setPointerAxis = (event) => {
    if (pointerRef.current === null) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const distance = Math.max(20, bounds.height * 0.38);
    const delta = event.clientY - bounds.top - bounds.height / 2;
    const next = clamp(-delta / distance, -1, 1);
    axisRef.current = next;
    setJoystickY(next * distance);
  };

  const finishPointer = (event) => {
    if (pointerRef.current !== event.pointerId) return;
    pointerRef.current = null;
    axisRef.current = 0;
    setJoystickY(0);
  };

  const secondsLeft = Math.max(0, Math.ceil(((gameState?.phaseEndsAt || clock) - clock) / 1000));
  const matchSeconds = Math.max(0, Math.ceil(((gameState?.endsAt || clock) - clock) / 1000));
  const opponentIndex = 1 - playerIndex;
  const rematchRequests = gameState?.rematchRequests || [false, false];
  const isFinished = gameState?.status === 'finished';
  const opponentAskedForRematch = rematchRequests[opponentIndex] && !rematchRequests[playerIndex];
  const winner = gameState?.winner;
  const result = winner === 'BOTH' ? 'BOTH PLAYERS WON'
    : winner === 'GAME_OVER' ? 'GAME OVER'
      : winner === playerIndex ? 'YOU WON'
        : 'YOU LOST';

  return (
    <section className="survival-game-shell rlgl-shell" ref={stageRef}>
      <header className="survival-hud">
        <div>
          <span className="survival-eyebrow">SQUID GAME · 1V1</span>
          <h2>Red Light, Green Light</h2>
        </div>
        <div className="survival-hud-stats">
          <span>TIME <strong>{Math.floor(matchSeconds / 60)}:{String(matchSeconds % 60).padStart(2, '0')}</strong></span>
          <span>YOU <strong>{Math.round(gameState?.positions?.[playerIndex] || 0)}%</strong></span>
          <span>RIVAL <strong>{Math.round(gameState?.positions?.[opponentIndex] || 0)}%</strong></span>
        </div>
      </header>

      <div className={`rlgl-arena phase-${gameState?.phase || 'green'}`}>
        <div className="rlgl-sky">
          <div className="rlgl-cloud rlgl-cloud-one" />
          <div className="rlgl-cloud rlgl-cloud-two" />
          <div className="rlgl-sun" />
          <div className="rlgl-tree"><span /></div>
          <div className={`rlgl-doll ${gameState?.phase === 'red' ? 'doll-facing' : ''}`}>
            <div className="doll-head"><i /><i /><b /></div>
            <div className="doll-body" />
            <div className="doll-arm doll-arm-left" />
            <div className="doll-arm doll-arm-right" />
          </div>
        </div>
        <div className="rlgl-field">
          <div className="rlgl-track" />
          <div className="rlgl-finish-line"><span>FINISH</span></div>
          <div className="rlgl-start-line"><span>START</span></div>
          {[0, 1].map((index) => (
            <div
              className={`rlgl-runner ${index === playerIndex ? 'runner-local' : 'runner-opponent'} ${gameState?.eliminated?.[index] ? 'runner-eliminated' : ''}`}
              key={index}
              style={{ left: `${8 + (gameState?.positions?.[index] || 0) * 0.78}%` }}
              aria-label={`${gameState?.players?.[index]?.username || `Player ${index + 1}`} position`}
            >
              <span className="runner-head" />
              <span className="runner-body" />
              <span className="runner-label">{gameState?.players?.[index]?.username || `P${index + 1}`}</span>
            </div>
          ))}
        </div>
        <div className={`rlgl-signal signal-${gameState?.phase || 'green'}`}>
          <span>{gameState?.phase === 'red' ? '🔴 RED LIGHT' : '🟢 GREEN LIGHT'}</span>
          <strong>{secondsLeft}</strong>
        </div>
        <div className="rlgl-match-clock">{matchSeconds}s left</div>

        {!isFinished && (
          <div
            className="rlgl-joystick"
            role="slider"
            aria-label="Move forward or backward"
            aria-valuemin={-1}
            aria-valuemax={1}
            aria-valuenow={axisRef.current}
            onPointerDown={(event) => {
              pointerRef.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
              setPointerAxis(event);
            }}
            onPointerMove={setPointerAxis}
            onPointerUp={finishPointer}
            onPointerCancel={finishPointer}
          >
            <span className="joystick-arrow joystick-up">▲</span>
            <span className="joystick-arrow joystick-down">▼</span>
            <span className="rlgl-joystick-thumb" style={{ transform: `translateY(${-joystickY}px)` }} />
          </div>
        )}
      </div>

      <footer className="survival-game-footer">
        <span>Desktop: W / ↑ to move forward · S / ↓ to reverse</span>
        <GameFullscreenButton targetRef={stageRef} />
      </footer>

      {isFinished && (
        <div className="survival-result-overlay">
          <div className="survival-result-card">
            <span className="survival-eyebrow">MATCH COMPLETE</span>
            <h2>{result}</h2>
            <p>{gameState.players?.[playerIndex]?.username} vs {gameState.players?.[opponentIndex]?.username}</p>
            {opponentAskedForRematch ? (
              <div className="survival-result-actions">
                <button onClick={() => onAction({ type: 'rematch-request' })}>Accept rematch</button>
                <button className="result-secondary" onClick={() => onAction({ type: 'rematch-decline' })}>Decline</button>
              </div>
            ) : gameState.rematchDeclined ? (
              <p>Your opponent declined the rematch.</p>
            ) : (
              <button disabled={rematchRequests[playerIndex]} onClick={() => onAction({ type: 'rematch-request' })}>
                {rematchRequests[playerIndex] ? 'Rematch requested · waiting…' : 'Play again'}
              </button>
            )}
            <button className="result-secondary" onClick={onClose}>Return to chat</button>
          </div>
        </div>
      )}
    </section>
  );
};

export default RedLightGreenLight;

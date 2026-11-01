import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './SurvivalGames.css';
import GameFullscreenButton from './GameFullscreenButton';

const ROWS = 16;
const ROW_SPACING = 2.2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const makeNameTag = (name, color) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(8, 15, 28, 0.78)';
  context.beginPath();
  context.roundRect(10, 10, 492, 108, 24);
  context.fill();
  context.font = 'bold 48px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.fillText(name.slice(0, 18), 256, 65);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(2.2, 0.55, 1);
  sprite.position.y = 2.4;
  return sprite;
};

const GlassBridge = ({ gameState, playerIndex, onAction, onClose }) => {
  const shellRef = useRef(null);
  const canvasRef = useRef(null);
  const targetsRef = useRef([]);
  const inputsRef = useRef({ x: 0, z: 0, sprint: false });
  const pointerRef = useRef(null);
  const canMoveRef = useRef(false);
  const panelMeshesRef = useRef([]);
  const playerGroupsRef = useRef([]);
  const [joystick, setJoystick] = useState({ x: 0, y: 0 });
  const [renderError, setRenderError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const localPlayer = gameState?.players?.[playerIndex];
  canMoveRef.current = gameState?.status === 'playing' && !localPlayer?.eliminated && !localPlayer?.finished;

  useEffect(() => {
    targetsRef.current = gameState?.players || [];
    panelMeshesRef.current.forEach((panels, rowIndex) => {
      const reveal = gameState?.revealedPanels?.[rowIndex];
      if (!reveal) {
        panels.forEach(panel => {
          panel.userData.broken = false;
          panel.position.y = panel.userData.baseY;
          panel.material.color.set('#a5eaff');
          panel.material.emissive.set('#000000');
          panel.material.opacity = 0.53;
        });
        return;
      }
      panels.forEach((panel, side) => {
        const safe = reveal.safeSide === side;
        panel.userData.broken = reveal.brokenSides?.includes(side) || false;
        panel.material.color.set(safe ? '#53e6c1' : '#ff647c');
        panel.material.emissive.set(safe ? '#0c806c' : '#92233a');
        panel.material.opacity = safe ? 0.76 : 0.35;
        panel.material.needsUpdate = true;
      });
    });
  }, [gameState]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (canMoveRef.current) return;
    inputsRef.current = { x: 0, z: 0, sprint: false };
    setJoystick({ x: 0, y: 0 });
  }, [gameState?.status, localPlayer?.eliminated, localPlayer?.finished]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let renderer;
    let animationFrame;
    let resizeObserver;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#a9d8ed');
    scene.fog = new THREE.Fog('#b9dbe9', 34, 95);
    const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 150);
    camera.position.set(0, 7, 11);

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: window.devicePixelRatio < 2,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.shadowMap.enabled = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    } catch (error) {
      setRenderError(`3D rendering is unavailable in this browser: ${error.message}`);
      return undefined;
    }

    scene.add(new THREE.HemisphereLight('#e7f7ff', '#284264', 2.2));
    const sun = new THREE.DirectionalLight('#fff1d2', 2.8);
    sun.position.set(-7, 15, 8);
    scene.add(sun);

    const addBox = (parent, width, height, depth, material, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    const metal = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.76, roughness: 0.32 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: '#243247', metalness: 0.7, roughness: 0.4 });
    const bridgeLength = ROWS * ROW_SPACING + 4;
    addBox(scene, 0.22, 0.36, bridgeLength, metal, -2.72, -0.34, -bridgeLength / 2);
    addBox(scene, 0.22, 0.36, bridgeLength, metal, 2.72, -0.34, -bridgeLength / 2);

    const rows = [];
    for (let row = 0; row < ROWS; row += 1) {
      const z = -(1.6 + row * ROW_SPACING);
      const pair = [];
      for (let side = 0; side < 2; side += 1) {
        const x = side === 0 ? -1.28 : 1.28;
        const material = new THREE.MeshPhysicalMaterial({
          color: '#a5eaff',
          metalness: 0.16,
          roughness: 0.16,
          transmission: 0.18,
          transparent: true,
          opacity: 0.53,
          clearcoat: 0.9,
          side: THREE.DoubleSide
        });
        const panel = addBox(scene, 2.44, 0.13, 2.04, material, x, 0, z);
        panel.userData.baseY = 0;
        pair.push(panel);
        addBox(scene, 2.5, 0.1, 0.12, darkMetal, x, -0.15, z - 1.04);
        addBox(scene, 2.5, 0.1, 0.12, darkMetal, x, -0.15, z + 1.04);
      }
      rows.push(pair);
      addBox(scene, 0.12, 0.12, 0.14, metal, 0, -0.28, z);
    }
    panelMeshesRef.current = rows;

    addBox(scene, 5.2, 0.5, 2.2, darkMetal, 0, -0.25, 0.5);
    addBox(scene, 5.2, 0.5, 2.4, darkMetal, 0, -0.25, -bridgeLength + 2.4);
    addBox(scene, 0.14, 1.4, bridgeLength, metal, -2.68, 0.58, -bridgeLength / 2);
    addBox(scene, 0.14, 1.4, bridgeLength, metal, 2.68, 0.58, -bridgeLength / 2);

    const groundMaterial = new THREE.MeshStandardMaterial({ color: '#9ac2d0', roughness: 1 });
    addBox(scene, 100, 0.2, 100, groundMaterial, 0, -26, -bridgeLength / 2);
    for (let cloud = 0; cloud < 18; cloud += 1) {
      const cloudGroup = new THREE.Group();
      const cloudMaterial = new THREE.MeshStandardMaterial({ color: '#f4fbff', roughness: 1, transparent: true, opacity: 0.76 });
      const cloudX = (cloud % 2 ? 1 : -1) * (4 + (cloud % 5) * 2.4);
      const cloudZ = -2 - cloud * 2.5;
      for (let puff = 0; puff < 4; puff += 1) {
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.3 + puff % 2 * 0.3, 10, 8), cloudMaterial);
        sphere.position.set(puff * 1.35 - 2, 0, 0);
        cloudGroup.add(sphere);
      }
      cloudGroup.position.set(cloudX, -2.5 + (cloud % 3) * 1.3, cloudZ);
      scene.add(cloudGroup);
    }

    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.52, 4.2, 10), new THREE.MeshStandardMaterial({ color: '#633f2b' }));
    trunk.position.y = 2.1;
    tree.add(trunk);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(2.3, 14, 12), new THREE.MeshStandardMaterial({ color: '#347f58', roughness: 1 }));
    leaves.position.set(0, 4.1, 0);
    tree.add(leaves);
    tree.position.set(4.5, 0, -bridgeLength + 1);
    scene.add(tree);

    const players = [0, 1].map((index) => {
      const group = new THREE.Group();
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: index === playerIndex ? '#35d5b0' : '#ff7584',
        roughness: 0.66
      });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.76, 4, 8), bodyMaterial);
      body.position.y = 0.82;
      group.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 10),
        new THREE.MeshStandardMaterial({ color: '#f1c5a5', roughness: 0.8 })
      );
      head.position.y = 1.55;
      group.add(head);
      const username = targetsRef.current[index]?.username || `Player ${index + 1}`;
      group.add(makeNameTag(username, index === playerIndex ? '#a2ffe8' : '#ffc3cb'));
      group.position.set(index === 0 ? -0.75 : 0.75, 0, 0);
      scene.add(group);
      return group;
    });
    playerGroupsRef.current = players;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      camera.aspect = bounds.width / bounds.height;
      camera.updateProjectionMatrix();
      renderer.setSize(bounds.width, bounds.height, false);
    };
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    }
    window.addEventListener('resize', resize);

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      const activePlayers = targetsRef.current;
      const local = activePlayers[playerIndex] || { x: 0, y: 0, z: 0 };
      const opponentIndex = 1 - playerIndex;
      const followIndex = local.eliminated && !activePlayers[opponentIndex]?.finished && !activePlayers[opponentIndex]?.eliminated
        ? opponentIndex
        : playerIndex;

      players.forEach((group, index) => {
        const target = activePlayers[index] || { x: index === 0 ? -0.75 : 0.75, y: 0, z: 0 };
        group.position.x = THREE.MathUtils.lerp(group.position.x, target.x, 0.24);
        group.position.z = THREE.MathUtils.lerp(group.position.z, -target.z, 0.24);
        group.position.y = THREE.MathUtils.lerp(group.position.y, target.y, 0.24);
        group.rotation.y = Math.atan2(inputsRef.current.x, -inputsRef.current.z) || group.rotation.y;
      });

      panelMeshesRef.current.forEach((pair) => pair.forEach((panel) => {
        if (panel.userData.broken) panel.position.y = Math.max(-4, panel.position.y - 0.025);
      }));

      const follow = players[followIndex];
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, follow.position.x + inputsRef.current.x * 2, 0.1);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 6.3 + Math.max(0, follow.position.y), 0.1);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, follow.position.z + 10.5, 0.1);
      camera.lookAt(follow.position.x, Math.max(0.8, follow.position.y + 0.7), follow.position.z - 3.8);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
        else object.material?.dispose();
        object.material?.map?.dispose();
      });
      renderer.dispose();
      panelMeshesRef.current = [];
      playerGroupsRef.current = [];
    };
  }, [playerIndex]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (canMoveRef.current) onAction({ type: 'move', ...inputsRef.current });
    }, 70);
    return () => window.clearInterval(interval);
  }, [gameState?.status, onAction]);

  useEffect(() => {
    const keys = new Set();
    const sync = () => {
      inputsRef.current = {
        x: (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0),
        z: (keys.has('ArrowUp') || keys.has('w') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('s') ? 1 : 0),
        sprint: keys.has('Shift')
      };
    };
    const onKeyDown = (event) => {
      if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', ' ', 'Shift', 'a', 'A', 'd', 'D', 'w', 'W', 's', 'S'].includes(event.key)) {
        event.preventDefault();
        if (event.key === ' ' && !event.repeat && canMoveRef.current) onAction({ type: 'jump' });
        keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
        sync();
      }
    };
    const onKeyUp = (event) => {
      keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
      sync();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onAction]);

  const updateJoystick = (event) => {
    if (pointerRef.current === null) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const half = Math.min(bounds.width, bounds.height) * 0.34;
    const dx = event.clientX - bounds.left - bounds.width / 2;
    const dy = event.clientY - bounds.top - bounds.height / 2;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const scale = Math.min(1, half / distance);
    const x = clamp((dx * scale) / half, -1, 1);
    const y = clamp((-dy * scale) / half, -1, 1);
    inputsRef.current = { ...inputsRef.current, x, z: y };
    setJoystick({ x: x * half, y: -y * half });
  };

  const finishJoystick = (event) => {
    if (pointerRef.current !== event.pointerId) return;
    pointerRef.current = null;
    inputsRef.current = { ...inputsRef.current, x: 0, z: 0 };
    setJoystick({ x: 0, y: 0 });
  };

  const secondsLeft = Math.max(0, Math.ceil(((gameState?.endsAt || clock) - clock) / 1000));
  const me = gameState?.players?.[playerIndex];
  const opponentIndex = 1 - playerIndex;
  const opponent = gameState?.players?.[opponentIndex];
  const rematchRequests = gameState?.rematchRequests || [false, false];
  const isFinished = gameState?.status === 'finished';
  const result = gameState?.winner === 'BOTH' ? 'BOTH PLAYERS WON'
    : gameState?.winner === 'GAME_OVER' ? 'GAME OVER'
      : gameState?.winner === playerIndex ? 'YOU WON'
        : 'YOU LOST';

  return (
    <section className="survival-game-shell glass-bridge-shell" ref={shellRef}>
      <header className="survival-hud">
        <div>
          <span className="survival-eyebrow">1V1 SURVIVAL · 3D</span>
          <h2>Glass Bridge</h2>
        </div>
        <div className="survival-hud-stats">
          <span>TIME <strong>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</strong></span>
          <span>YOU <strong>{me?.progress || 0}/{ROWS}</strong></span>
          <span>RIVAL <strong>{opponent?.progress || 0}/{ROWS}</strong></span>
          <span>STAMINA <strong>{Math.round(me?.stamina ?? 100)}%</strong></span>
        </div>
      </header>

      {renderError ? (
        <div className="glass-render-error" role="alert">{renderError}</div>
      ) : (
        <div className="glass-scene-wrap">
          <canvas className="glass-scene" ref={canvasRef} aria-label="Three-dimensional suspended glass bridge" />
          <div className="glass-scene-vignette" />
          <div className="glass-progress">
            <span>{me?.eliminated ? 'ELIMINATED · SPECTATING' : me?.finished ? 'FINISH REACHED' : `${me?.username || 'You'} · ${me?.progress || 0} / ${ROWS}`}</span>
            <div><i style={{ width: `${((me?.progress || 0) / ROWS) * 100}%` }} /></div>
            <span>{opponent?.username || 'Opponent'} · {opponent?.eliminated ? 'FALLEN' : `${opponent?.progress || 0} / ${ROWS}`}</span>
          </div>
          {gameState?.status === 'playing' && !me?.eliminated && !me?.finished && (
            <>
              <div
                className="glass-joystick"
                role="group"
                aria-label="Bridge movement joystick"
                onPointerDown={(event) => {
                  pointerRef.current = event.pointerId;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateJoystick(event);
                }}
                onPointerMove={updateJoystick}
                onPointerUp={finishJoystick}
                onPointerCancel={finishJoystick}
              >
                <span className="joystick-arrow joystick-up">▲</span>
                <span className="joystick-arrow joystick-down">▼</span>
                <span className="joystick-arrow joystick-left">◀</span>
                <span className="joystick-arrow joystick-right">▶</span>
                <span className="glass-joystick-thumb" style={{ transform: `translate(${joystick.x}px, ${joystick.y}px)` }} />
              </div>
              <div className="glass-action-buttons">
                <button type="button" className={`glass-sprint ${inputsRef.current.sprint ? 'is-active' : ''}`} onPointerDown={() => { inputsRef.current = { ...inputsRef.current, sprint: true }; }} onPointerUp={() => { inputsRef.current = { ...inputsRef.current, sprint: false }; }} onPointerLeave={() => { inputsRef.current = { ...inputsRef.current, sprint: false }; }}>SPRINT</button>
                <button type="button" className="glass-jump" onPointerDown={(event) => { event.preventDefault(); onAction({ type: 'jump' }); }}>JUMP</button>
              </div>
            </>
          )}
          {me?.eliminated && !isFinished && <div className="glass-spectator-banner">You fell — watching {opponent?.username || 'your opponent'}</div>}
        </div>
      )}

      <footer className="survival-game-footer">
        <span>WASD / arrows · Space to jump · Shift to sprint</span>
        <GameFullscreenButton targetRef={shellRef} />
      </footer>

      {isFinished && (
        <div className="survival-result-overlay">
          <div className="survival-result-card">
            <span className="survival-eyebrow">BRIDGE COMPLETE</span>
            <h2>{result}</h2>
            <p>{me?.username} vs {opponent?.username}</p>
            {rematchRequests[opponentIndex] && !rematchRequests[playerIndex] ? (
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

export default GlassBridge;

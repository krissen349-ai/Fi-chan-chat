import React, { useEffect, useState } from 'react';

const GameFullscreenButton = ({ targetRef }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const updateFullscreen = () => {
      const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(active);
      if (!active) window.screen?.orientation?.unlock?.();
    };
    document.addEventListener('fullscreenchange', updateFullscreen);
    document.addEventListener('webkitfullscreenchange', updateFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreen);
      document.removeEventListener('webkitfullscreenchange', updateFullscreen);
    };
  }, []);

  const toggleFullscreen = async () => {
    const target = targetRef.current;
    if (!target) return;
    setError('');

    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        window.screen?.orientation?.unlock?.();
        return;
      }

      const request = target.requestFullscreen || target.webkitRequestFullscreen;
      if (!request) throw new Error('Fullscreen is not supported by this browser.');
      await request.call(target);
      try {
        await window.screen?.orientation?.lock?.('landscape');
      } catch {
        // Fullscreen still works on browsers that do not allow orientation locking.
      }
    } catch (fullscreenError) {
      setError(fullscreenError.message || 'Could not enter fullscreen mode.');
    }
  };

  return (
    <div className="game-fullscreen-control">
      <button type="button" className="fullscreen-btn" onClick={toggleFullscreen}>
        {isFullscreen ? 'Exit fullscreen' : '⛶ Fullscreen · Landscape'}
      </button>
      {error && <span className="game-action-error" role="alert">{error}</span>}
    </div>
  );
};

export default GameFullscreenButton;

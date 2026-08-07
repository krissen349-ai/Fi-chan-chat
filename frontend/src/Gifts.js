import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import BirthdayGame from './BirthdayGame'; 
import './Gifts.css';

const Gifts = ({ onClose, onClaimReward, socket, currentUserId }) => {
  const [isPlayingVideo, setIsPlayingVideo] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [theme, setTheme] = useState('purple'); 
  
  const [giftsList, setGiftsList] = useState([]);
  const [activeGift, setActiveGift] = useState(null);
  
  const [showGame, setShowGame] = useState(false);
  const [isOpened, setIsOpened] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Password Verification State
  const [passwordGift, setPasswordGift] = useState(null);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Delete Modal State
  const [deletingGiftId, setDeletingGiftId] = useState(null);

  // Form States
  const [senderName, setSenderName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [giftUrl, setGiftUrl] = useState('');
  const [password, setPassword] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [enableBalloonGame, setEnableBalloonGame] = useState(true);
  const [targetAge, setTargetAge] = useState(21);

  const videoRef = useRef(null);
  const myUserId = currentUserId || socket?.id || "guest-user";

  // Initial Gifts Load & Socket Listeners
  useEffect(() => {
    const localSavedGifts = localStorage.getItem('backup_gifts');
    if (localSavedGifts) {
      try {
        setGiftsList(JSON.parse(localSavedGifts));
      } catch (e) {
        console.error("LocalStorage parse error", e);
      }
    }

    if (socket) {
      socket.emit('get_gifts');

      const handleUpdateGifts = (gifts) => {
        if (Array.isArray(gifts)) {
          setGiftsList(gifts);
          localStorage.setItem('backup_gifts', JSON.stringify(gifts));
        }
      };

      socket.on('update_gifts', handleUpdateGifts);

      return () => {
        socket.off('update_gifts', handleUpdateGifts);
      };
    }
  }, [socket]);

  // Video Autoplay
  useEffect(() => {
    if (videoRef.current && isPlayingVideo) {
      videoRef.current.muted = false;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play();
          }
        });
      }
    }
  }, [isPlayingVideo]);

  const handleVideoEnd = () => setIsPlayingVideo(false);

  const toggleSound = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const giftAssets = {
    pink: "/gift-box.png",
    purple: "/gift-box1.png",
    white: "/gift-box2.png"
  };

  const handleAddGiftSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!senderName.trim() || !receiverName.trim() || !giftUrl.trim()) {
      alert("Please fill in all required fields!");
      return;
    }

    const newGiftPayload = {
      _id: `gift-${Date.now()}`,
      senderName: senderName.trim(),
      receiverName: receiverName.trim(),
      receiverEmail: receiverEmail.trim(),
      giftUrl: giftUrl.trim(),
      password: password.trim(),
      scheduledTime: scheduledTime,
      enableBalloonGame: Boolean(enableBalloonGame),
      targetAge: enableBalloonGame ? (Number(targetAge) || 21) : 0,
      createdBy: myUserId
    };

    setGiftsList((prevList) => {
      const updated = [...prevList, newGiftPayload];
      localStorage.setItem('backup_gifts', JSON.stringify(updated));
      return updated;
    });

    if (socket) {
      socket.emit('add_gift', newGiftPayload);
      socket.emit('create_gift', newGiftPayload);
    }

    setSenderName('');
    setReceiverName('');
    setReceiverEmail('');
    setGiftUrl('');
    setPassword('');
    setScheduledTime('');
    setEnableBalloonGame(true);
    setTargetAge(21);
    setShowAddModal(false);
  };

  const promptDeleteGift = (e, giftId) => {
    e.stopPropagation();
    setDeletingGiftId(giftId);
  };

  const confirmDeleteGift = () => {
    if (!deletingGiftId) return;

    setGiftsList((prev) => {
      const filtered = prev.filter(g => (g._id || g.id) !== deletingGiftId);
      localStorage.setItem('backup_gifts', JSON.stringify(filtered));
      return filtered;
    });

    if (socket) {
      socket.emit('delete_gift', { giftId: deletingGiftId, userId: myUserId });
    }

    setDeletingGiftId(null);
  };

  const launchGift = (gift) => {
    setActiveGift(gift);
    if (gift.enableBalloonGame) {
      setShowGame(true);
    } else {
      setIsOpened(true);
    }
  };

  const handleOpenGiftClick = (gift) => {
    if (gift.scheduledTime && new Date() < new Date(gift.scheduledTime)) {
      alert(`⏳ This gift is locked! Unlocks on: ${new Date(gift.scheduledTime).toLocaleString()}`);
      return;
    }

    if (gift.password) {
      setPasswordGift(gift);
      setEnteredPassword('');
      setPasswordError('');
      return;
    }

    launchGift(gift);
  };

  const handleVerifyPassword = (e) => {
    e.preventDefault();
    if (enteredPassword.trim() === passwordGift.password) {
      const g = passwordGift;
      setPasswordGift(null);
      setEnteredPassword('');
      setPasswordError('');
      launchGift(g);
    } else {
      setPasswordError('❌ Incorrect password! Try again.');
    }
  };

  const handleGameFinish = () => {
    setShowGame(false);
    setIsOpened(true);
  };

  const handleClaimReward = () => {
    if (activeGift?.giftUrl) {
      window.open(activeGift.giftUrl, '_blank');
    }
    setIsOpened(false);
    setActiveGift(null);
    if (onClaimReward) onClaimReward();
  };

  const giftsUI = (
    <div className={`gifts-master-wrapper theme-${theme}`}>
      
      {/* Intro Video Overlay */}
      {isPlayingVideo && (
        <div className="full-screen-video-modal">
          <div className="video-controls-overlay">
            <button className="close-gifts-btn" onClick={toggleSound}>
              {isMuted ? '🔊 Sound ON' : '🔇 Mute'}
            </button>
            <button className="close-gifts-btn" onClick={handleVideoEnd}>
              Skip ⏭️
            </button>
          </div>
          <video
            ref={videoRef}
            src="/butterfly-gift.mp4"
            autoPlay
            playsInline
            webkit-playsinline="true"
            preload="auto"
            onEnded={handleVideoEnd}
            onError={handleVideoEnd}
            className="high-quality-video"
          />
        </div>
      )}

      {/* Main Viewport */}
      {!isPlayingVideo && (
        <div className="gifts-luxury-viewport animate-fade-in">
          
          {/* Top Navbar */}
          <header className="top-nav">
            <div className="nav-left">
              <button className="back-arrow-btn" onClick={onClose}>
                ←
              </button>
              <div className="nav-title">
                <span className="gift-sticker">🎁</span>
                <div>
                  <h1>Gifts</h1>
                  <p className="subtitle">Something special awaits you ✨</p>
                </div>
              </div>
            </div>

            <div className="glass-theme-pill">
              <span className="theme-label">Theme</span>
              <div className="theme-switches">
                <button 
                  className={`theme-circle white-circle ${theme === 'white' ? 'active' : ''}`}
                  onClick={() => setTheme('white')} 
                />
                <button 
                  className={`theme-circle purple-circle ${theme === 'purple' ? 'active' : ''}`}
                  onClick={() => setTheme('purple')} 
                />
                <button 
                  className={`theme-circle pink-circle ${theme === 'pink' ? 'active' : ''}`}
                  onClick={() => setTheme('pink')} 
                />
              </div>
            </div>
          </header>

          {/* Center Stage Content */}
          <main className="center-stage-simple">
            {showGame && activeGift ? (
              <div className="glass-modal-card animate-pop-in minigame-card-container">
                <BirthdayGame targetAge={activeGift.targetAge} onFinish={handleGameFinish} />
              </div>
            ) : isOpened && activeGift ? (
              <div className="revealed-gift-card glass-vip-card animate-pop-in">
                <div className="gift-reward-badge">
                  <span className="gift-reward-icon">🎉</span>
                </div>
                <h2 className="vip-title">Gift Unlocked!</h2>
                <div className="vip-description">
                  <p><strong>To:</strong> {activeGift.receiverName}</p>
                  <p><strong>From:</strong> {activeGift.senderName}</p>
                </div>
                <button className="claim-card-btn luxury-btn" onClick={handleClaimReward}>
                  <span>Open Gift Link 🚀</span>
                </button>
              </div>
            ) : (
              <div className="gifts-grid-container">
                {giftsList.length === 0 ? (
                  <div className="gift-box-wrapper">
                    <div className="gift-container-3d">
                      <div className="radial-floor-glow"></div>
                      <img 
                        src={giftAssets[theme] || giftAssets.purple} 
                        alt="3D Gift Box" 
                        className="gift-render-img"
                      />
                    </div>
                    <p style={{ color: '#fff', marginTop: '10px' }}>No gifts added yet! Click + below to add one.</p>
                  </div>
                ) : (
                  giftsList.map((gift) => {
                    const giftId = gift._id || gift.id;
                    const isOwner = gift.createdBy === myUserId;
                    return (
                      <div 
                        key={giftId} 
                        className="glass-modal-card gift-item-card animate-pop-in" 
                        onClick={() => handleOpenGiftClick(gift)}
                      >
                        {isOwner && (
                          <button 
                            type="button"
                            onClick={(e) => promptDeleteGift(e, giftId)}
                            className="delete-gift-btn"
                            title="Delete Gift"
                          >
                            🗑️
                          </button>
                        )}

                        <div className="gift-card-icon">
                          {gift.password ? '🔐' : '🎁'}
                        </div>
                        <h3 className="gift-card-to">To: {gift.receiverName}</h3>
                        <p className="gift-card-from">From: {gift.senderName}</p>
                        
                        <button className="tap-to-open-btn" type="button">
                          <span>{gift.password ? 'Unlock Gift 🔐' : 'Unwrap Gift ✨'}</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </main>

          {/* Floating Plus Button */}
          <div className="floating-add-wrapper">
            <button className="floating-glass-sphere" onClick={() => setShowAddModal(true)}>
              <span className="plus-icon">+</span>
              <span className="btn-label">Add</span>
            </button>
          </div>

          {/* Password Unlock Modal */}
          {passwordGift && (
            <div className="glass-modal-overlay" onClick={() => setPasswordGift(null)}>
              <div className="glass-modal-card modal-content-box animate-pop-in" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>🔐 Secret Password Protected</h3>
                  <button className="close-x" onClick={() => setPasswordGift(null)}>✕</button>
                </div>
                <form onSubmit={handleVerifyPassword} className="modal-body" style={{ marginTop: '10px' }}>
                  <p style={{ color: '#ddd', fontSize: '14px', marginBottom: '10px' }}>
                    Enter password set by <strong>{passwordGift.senderName}</strong> to unlock this gift:
                  </p>
                  <input 
                    type="password" 
                    placeholder="Enter Secret Password" 
                    className="glass-input" 
                    value={enteredPassword} 
                    onChange={(e) => setEnteredPassword(e.target.value)}
                    autoFocus 
                    required 
                  />
                  {passwordError && (
                    <p style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '4px' }}>
                      {passwordError}
                    </p>
                  )}
                  <button type="submit" className="submit-gift-btn" style={{ marginTop: '15px' }}>
                    Unlock Gift 🔓
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Add Gift Modal */}
          {showAddModal && (
            <div className="glass-modal-overlay" onClick={() => setShowAddModal(false)}>
              <div className="glass-modal-card modal-content-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>🎁 Create Custom Gift</h3>
                  <button className="close-x" onClick={() => setShowAddModal(false)}>✕</button>
                </div>

                <form onSubmit={handleAddGiftSubmit} className="modal-body">
                  <div className="input-group-row">
                    <input 
                      type="text" 
                      placeholder="Sender Name" 
                      className="glass-input" 
                      value={senderName} 
                      onChange={(e) => setSenderName(e.target.value)} 
                      required 
                    />
                    <input 
                      type="text" 
                      placeholder="Receiver Name" 
                      className="glass-input" 
                      value={receiverName} 
                      onChange={(e) => setReceiverName(e.target.value)} 
                      required 
                    />
                  </div>

                  <input 
                    type="email" 
                    placeholder="Receiver Email (Optional)" 
                    className="glass-input" 
                    value={receiverEmail} 
                    onChange={(e) => setReceiverEmail(e.target.value)} 
                  />

                  <input 
                    type="url" 
                    placeholder="Gift Link (https://...)" 
                    className="glass-input" 
                    value={giftUrl} 
                    onChange={(e) => setGiftUrl(e.target.value)} 
                    required 
                  />

                  <input 
                    type="password" 
                    placeholder="Set Lock Password (Optional)" 
                    className="glass-input" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                  />

                  <div style={{ textAlign: 'left' }}>
                    <label style={{ fontSize: '11px', color: '#ccc', marginLeft: '4px' }}>Unlock Date/Time (Optional):</label>
                    <input 
                      type="datetime-local" 
                      className="glass-input" 
                      value={scheduledTime} 
                      onChange={(e) => setScheduledTime(e.target.value)} 
                    />
                  </div>

                  <div className="checkbox-container">
                    <span>🎈 Enable Balloon Minigame</span>
                    <input 
                      type="checkbox" 
                      checked={enableBalloonGame} 
                      onChange={(e) => setEnableBalloonGame(e.target.checked)} 
                    />
                  </div>

                  {enableBalloonGame && (
                    <input 
                      type="number" 
                      min="1" 
                      max="100" 
                      placeholder="Target Age (Balloon Count)" 
                      className="glass-input" 
                      value={targetAge} 
                      onChange={(e) => setTargetAge(e.target.value)} 
                      required={enableBalloonGame} 
                    />
                  )}

                  <button type="submit" className="submit-gift-btn">
                    Add Gift ✨
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deletingGiftId && (
            <div className="glass-modal-overlay" onClick={() => setDeletingGiftId(null)}>
              <div className="glass-modal-card delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="delete-modal-icon">⚠️</div>
                <h3>Delete Gift?</h3>
                <p>Are you sure you want to delete this gift?</p>
                <div className="delete-modal-actions">
                  <button type="button" className="cancel-btn" onClick={() => setDeletingGiftId(null)}>Cancel</button>
                  <button type="button" className="confirm-delete-btn" onClick={confirmDeleteGift}>Delete</button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );

  return ReactDOM.createPortal(giftsUI, document.body);
};

export default Gifts;
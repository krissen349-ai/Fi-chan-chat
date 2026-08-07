import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./BirthdayCeremony.css";


import cakeImage from "./assets/cake.png";

export default function BirthdayCeremony() {
  const [scene, setScene] = useState(0);
  const [candleBlown, setCandleBlown] = useState(false);
  const [cakeCut, setCakeCut] = useState(false);
  const [giftOpened, setGiftOpened] = useState(false);

  const audioRef = useRef(null);

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.volume = 0;
      audioRef.current.play().then(() => {
        let vol = 0;
        const fadeInterval = setInterval(() => {
          if (vol < 0.25) {
            vol += 0.02;
            audioRef.current.volume = Math.min(vol, 0.25);
          } else {
            clearInterval(fadeInterval);
          }
        }, 100);
      }).catch((err) => console.log("Audio play blocked:", err));
    }
  };

  const handleClaimReward = () => {
    playAudio();
    setScene(1);
    setTimeout(() => {
      setScene(2);
    }, 1000);
  };

  useEffect(() => {
    if (scene === 2) {
      const timer = setTimeout(() => {
        setScene(3);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [scene]);

  useEffect(() => {
    if (scene === 3) {
      const timer = setTimeout(() => {
        setScene(4);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [scene]);

  const handleCandleBlow = () => {
    if (candleBlown) return;
    setCandleBlown(true);
    setTimeout(() => {
      setScene(5);
    }, 2500);
  };

  const handleCutCake = () => {
    setCakeCut(true);
    setTimeout(() => {
      setScene(6);
    }, 1800);
  };

  useEffect(() => {
    if (scene === 6) {
      const timer = setTimeout(() => {
        setScene(7);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [scene]);

  useEffect(() => {
    if (scene === 7) {
      const timer = setTimeout(() => {
        setScene(8);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [scene]);

  useEffect(() => {
    if (scene === 8) {
      const timer = setTimeout(() => {
        setScene(9);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [scene]);

  const handleOpenGift = () => {
    setGiftOpened(true);
    setScene(10);
  };

  // ELLIPSE POSITIONING FOR 3D PERSPECTIVE TOP TIER
  // Generate 6 candles mathematically positioned on an oval matching the cake's top tier
  const totalCandles = 6;
  const candlePositions = Array.from({ length: totalCandles }).map((_, i) => {
    const angle = (i * (2 * Math.PI)) / totalCandles;
    // rx = horizontal radius, ry = vertical perspective radius
    const rx = 22; // width percentage
    const ry = 8;  // height percentage for 3D perspective depth
    
    // Center of top tier
    const centerX = 50; 
    const centerY = 24; 

    const x = centerX + rx * Math.cos(angle);
    const y = centerY + ry * Math.sin(angle);
    const scale = 0.85 + (Math.sin(angle) + 1) * 0.15; // Front candles look slightly bigger

    return { x: `${x}%`, y: `${y}%`, scale, zIndex: Math.round(y * 10) };
  });

  return (
    <div className={`ceremony-wrapper ${scene === 7 || scene >= 8 ? "darker-bg" : ""}`}>


      <div className="vignette-overlay" />
      <div className="fog-layer" />
      <div className="stars-container">
        {[...Array(25)].map((_, i) => (
          <div key={i} className={`star star-${i % 5}`} />
        ))}
      </div>

      {scene === 0 && (
        <motion.div 
          className="claim-screen"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
        >
          <button className="luxury-btn pulse-glow" onClick={handleClaimReward}>
            ✨ Claim Reward ✨
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {scene === 1 && (
          <motion.div
            className="black-fade-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* CAKE & CANDLE STAGE */}
      {scene >= 2 && scene <= 7 && (
        <motion.div 
          className="cake-stage"
          initial={{ opacity: 0, y: 150, scale: 0.8 }}
          animate={{ 
            opacity: scene === 7 ? 0 : 1, 
            y: 0, 
            scale: scene >= 3 ? 1.05 : 1 
          }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          <div className="cake-wrapper">
            <img src={cakeImage} alt="Birthday Cake" className={`cake-img ${cakeCut ? "sliced" : ""}`} />
            
            {/* Realistically Placed Candles */}
            {!cakeCut && (
              <div className="candles-layer" onClick={handleCandleBlow}>
                {candlePositions.map((pos, idx) => (
                  <div 
                    key={idx} 
                    className="individual-candle"
                    style={{ 
                      left: pos.x, 
                      top: pos.y, 
                      transform: `translate(-50%, -100%) scale(${pos.scale})`,
                      zIndex: pos.zIndex 
                    }}
                  >
                    {!candleBlown ? (
                      <div className="flame-wrapper">
                        <motion.div 
                          className="flame"
                          animate={{ 
                            scale: [1, 1.25, 0.9, 1.15, 1], 
                            rotate: [-2, 3, -3, 2, 0] 
                          }}
                          transition={{ 
                            repeat: Infinity, 
                            duration: 0.4 + (idx % 3) * 0.1,
                            ease: "easeInOut" 
                          }}
                        />
                        <div className="flame-glow" />
                      </div>
                    ) : (
                      <motion.div 
                        className="smoke-container"
                        initial={{ opacity: 0, y: 0 }}
                        animate={{ opacity: [0, 1, 0], y: -30 }}
                        transition={{ duration: 1.2, delay: idx * 0.05 }}
                      >
                        <div className="smoke-particle" />
                      </motion.div>
                    )}
                    
                    {/* Realistic Candle Stick */}
                    <div className="candle-wick" />
                    <div className="candle-body" />
                    <div className="candle-shadow" />
                  </div>
                ))}
              </div>
            )}

            {cakeCut && (
              <motion.div 
                className="knife-element"
                initial={{ x: 200, y: -100, opacity: 0, rotate: -45 }}
                animate={{ x: 0, y: 50, opacity: 1, rotate: 0 }}
                transition={{ duration: 1, ease: "easeInOut" }}
              />
            )}
          </div>
        </motion.div>
      )}

      {/* MAKE A WISH TEXT */}
      <AnimatePresence>
        {(scene === 3 || scene === 4) && !candleBlown && (
          <motion.div 
            className="wish-text-box"
            initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -20, filter: "blur(6px)" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.h2 
              className="glow-handwriting"
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            >
              ✨ Make a Wish ✨
            </motion.h2>

            <p className="sub-wish-text">Close your eyes and make your birthday wish.</p>

            {scene === 4 && (
              <motion.div 
                className="instruction-badge"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, type: "spring" }}
              >
                <span>💨 Tap on the candles to blow them out</span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ACTION BUTTONS */}
      {scene === 5 && !cakeCut && (
        <motion.div 
          className="action-btn-container"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <button className="luxury-btn pulse-glow" onClick={handleCutCake}>
            🔪 Cut the Cake
          </button>
        </motion.div>
      )}

      {scene === 6 && (
        <motion.div 
          className="greeting-container"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 100 }}
        >
          <span className="party-emoji">🎉</span>
          <h1 className="greeting-text">Happy 21st Birthday Sofia</h1>
          <span className="party-emoji">🎉</span>
        </motion.div>
      )}

      {scene >= 8 && (
        <motion.div 
          className="gift-stage"
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5 }}
        >
          <motion.div 
            className={`luxury-gift-box ${giftOpened ? "opened" : ""}`}
            animate={{ rotateY: giftOpened ? 0 : [0, 10, -10, 0] }}
            transition={{ repeat: giftOpened ? 0 : Infinity, duration: 6, ease: "easeInOut" }}
          >
            <div className={`gift-lid ${giftOpened ? "open-lid" : ""}`}>
              <div className="golden-bow">🎀</div>
            </div>
            <div className="gift-body">
              <div className="golden-ribbon-v" />
              <div className="golden-ribbon-h" />
            </div>

            {giftOpened && (
              <motion.div 
                className="gift-burst-light"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0.8], scale: [0, 3, 2.5] }}
                transition={{ duration: 1.5 }}
              />
            )}
          </motion.div>

          {scene === 9 && (
            <motion.div 
              className="action-btn-container"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <button className="luxury-btn pulse-glow" onClick={handleOpenGift}>
                🎁 Open Your Main Gift
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Crosshair } from 'lucide-react';

/* ─────────────────────────────────────────────
   Animated scanline / grid canvas background
───────────────────────────────────────────── */
const GridCanvas = () => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let t = 0;

    const draw = () => {
      const W = canvas.width = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = 'rgba(0,255,170,0.04)';
      ctx.lineWidth = 1;
      const cellW = 50, cellH = 50;
      for (let x = 0; x < W; x += cellW) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += cellH) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Sweeping scanline
      const scanY = ((t * 0.4) % H);
      const grad = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 8);
      grad.addColorStop(0, 'rgba(0,255,170,0)');
      grad.addColorStop(1, 'rgba(0,255,170,0.06)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 60, W, 68);

      // Random glitch dots
      if (Math.random() > 0.97) {
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = 'rgba(0,255,170,0.6)';
          ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
        }
      }

      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
};

/* ─────────────────────────────────────────────
   Typewriter hook
───────────────────────────────────────────── */
const useTypewriter = (text, speed = 35) => {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) { clearInterval(interval); setDone(true); }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  return { displayed, done };
};

/* ─────────────────────────────────────────────
   Screenshot card
───────────────────────────────────────────── */
const ScreenshotCard = ({ src, label, fallbackLabel, delay }) => {
  const [hasError, setHasError] = useState(false);
  return (
    <motion.div
      className="home-screenshot-card"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ scale: 1.03, y: -4 }}
    >
      {!hasError ? (
        <img
          src={src}
          alt={label}
          className="home-screenshot-img"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="home-screenshot-placeholder">
          <Crosshair size={28} style={{ color: 'var(--c-accent)', marginBottom: 8 }} />
          <span className="home-screenshot-placeholder-label">{fallbackLabel}</span>
        </div>
      )}
      <div className="home-screenshot-label">{label}</div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────
   Main HomeScreen
───────────────────────────────────────────── */
const HomeScreen = ({ onPlay }) => {
  const [phase, setPhase] = useState(0); // 0=boot, 1=ready
  const { displayed: bootText } = useTypewriter(
    '> INITIALIZING SHADOW PROTOCOL... SECURE CHANNEL ESTABLISHED.',
    25
  );

  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 1800);
    return () => clearTimeout(t);
  }, []);

  const screenshots = [
    {
      src: '/assets/screenshots/scenario_select.png',
      label: 'MISSION SELECT',
      fallbackLabel: 'Scenario selection screen listing available operations',
    },
    {
      src: '/assets/screenshots/tactical_hud.png',
      label: 'TACTICAL HUD',
      fallbackLabel: 'Tactical map HUD — city nodes, agent positions & scan overlays',
    },
    {
      src: '/assets/screenshots/intel_dossier.png',
      label: 'INTEL DOSSIER',
      fallbackLabel: 'Suspect dossier / clue timeline — tracked operative sightings',
    },
    {
      src: '/assets/screenshots/raid_ops.png',
      label: 'RAID OPERATIONS',
      fallbackLabel: 'Raid confirmation / combat result after safehouse assault',
    },
  ];

  return (
    <div className="home-root">
      <GridCanvas />

      {/* BOOT TEXT */}
      <AnimatePresence>
        {phase === 0 && (
          <motion.div
            className="home-boot-overlay"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="home-boot-text">{bootText}<span className="home-boot-cursor">█</span></span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT */}
      <AnimatePresence>
        {phase === 1 && (
          <motion.div
            className="home-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7 }}
          >
            {/* ── HERO ── */}
            <div className="home-hero">
              {/* App Logo */}
              <motion.div
                className="home-app-icon-container"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 140, damping: 15, delay: 0.1 }}
              >
                <div className="home-icon-frame">
                  <img src="/hi_res_icon.png" alt="Shadow Protocol Logo" className="home-app-icon" />
                  <div className="home-icon-radar-glow" />
                </div>
              </motion.div>

              {/* Title & Tagline */}
              <motion.div
                className="home-title-block"
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
              >
                <h1 className="home-title">
                  <span className="home-title-shadow">SHADOW</span>
                  <span className="home-title-protocol">PROTOCOL</span>
                </h1>
                <p className="home-tagline">
                  Hunt. Intercept. Neutralize. <br />
                  <em>Before they reach the Target.</em>
                </p>
              </motion.div>

              {/* Action Button */}
              <div className="home-cta-block">
                <motion.button
                  id="home-play-btn"
                  className="home-play-btn"
                  onClick={onPlay}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring', stiffness: 220 }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                >
                  <div className="home-play-btn-primary">
                    <Play size={20} fill="currentColor" />
                    <span>INITIATE OPERATION</span>
                  </div>
                  <span className="home-play-btn-glow" />
                </motion.button>

                <motion.p
                  className="home-hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  transition={{ delay: 0.7 }}
                >
                  Authenticate to access classified mission files
                </motion.p>
              </div>
            </div>

            {/* ── SCREENSHOTS ── */}
            <div className="home-screenshots-section">
              <motion.div
                className="home-section-header"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <span className="home-section-line" />
                <span className="home-section-label">OPERATION PREVIEW</span>
                <span className="home-section-line" />
              </motion.div>
              <div className="home-screenshots-grid">
                {screenshots.map((s, i) => (
                  <ScreenshotCard key={s.label} {...s} delay={0.9 + i * 0.1} />
                ))}
              </div>
            </div>

            {/* ── FOOTER ── */}
            <motion.div
              className="home-footer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 1.2 }}
            >
              <span>SHADOW PROTOCOL</span>
              <span className="home-footer-dot">·</span>
              <span>CYBER-ESPIONAGE TACTICAL SIMULATOR</span>
              <span className="home-footer-dot">·</span>
              <span>TOP SECRET</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomeScreen;

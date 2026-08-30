import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Shield, Eye, Crosshair, Radio, Lock } from 'lucide-react';

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
      const cellW = 60, cellH = 60;
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
const useTypewriter = (text, speed = 40) => {
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
   Feature pill card
───────────────────────────────────────────── */
const FeaturePill = ({ icon: Icon, label, delay }) => (
  <motion.div
    className="home-feature-pill"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
  >
    <Icon size={16} className="home-feature-icon" />
    <span>{label}</span>
  </motion.div>
);

/* ─────────────────────────────────────────────
   Screenshot card
───────────────────────────────────────────── */
const ScreenshotCard = ({ src, label, fallbackLabel, delay }) => {
  const [hasError, setHasError] = useState(false);
  return (
    <motion.div
      className="home-screenshot-card"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5 }}
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
    28
  );

  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 2200);
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
            transition={{ duration: 0.6 }}
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
            transition={{ duration: 0.8 }}
          >
            {/* ── HERO ── */}
            <div className="home-hero">
              {/* Logo mark */}
              <motion.div
                className="home-logo-mark"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 120, delay: 0.1 }}
              >
                <Shield size={52} />
                <div className="home-logo-ring" />
              </motion.div>

              {/* Title */}
              <motion.div
                className="home-title-block"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.5 }}
              >
                <span className="home-eyebrow">CLASSIFIED · EYES ONLY</span>
                <h1 className="home-title">
                  <span className="home-title-shadow">SHADOW</span>
                  <span className="home-title-protocol">PROTOCOL</span>
                </h1>
                <p className="home-tagline">
                  Hunt. Intercept. Neutralize. <br />
                  <em>Before they reach the Target.</em>
                </p>
              </motion.div>

              {/* Feature pills */}
              <div className="home-features">
                <FeaturePill icon={Eye}       label="INTELLIGENCE OPS"   delay={0.4} />
                <FeaturePill icon={Crosshair} label="TACTICAL RAIDS"     delay={0.5} />
                <FeaturePill icon={Radio}     label="SIGNAL INTERCEPTS"  delay={0.6} />
                <FeaturePill icon={Lock}      label="COVERT SAFEHOUSES"  delay={0.7} />
              </div>

              {/* CTA */}
              <motion.button
                id="home-play-btn"
                className="home-play-btn"
                onClick={onPlay}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.85, type: 'spring', stiffness: 200 }}
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.96 }}
              >
                <Play size={22} fill="currentColor" />
                <span>INITIATE OPERATION</span>
                <span className="home-play-btn-glow" />
              </motion.button>

              <motion.p
                className="home-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.45 }}
                transition={{ delay: 1.2 }}
              >
                Authenticate to access classified mission files
              </motion.p>
            </div>

            {/* ── SCREENSHOTS ── */}
            <div className="home-screenshots-section">
              <motion.div
                className="home-section-header"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
              >
                <span className="home-section-line" />
                <span className="home-section-label">OPERATION PREVIEW</span>
                <span className="home-section-line" />
              </motion.div>
              <div className="home-screenshots-grid">
                {screenshots.map((s, i) => (
                  <ScreenshotCard key={s.label} {...s} delay={1.0 + i * 0.12} />
                ))}
              </div>
            </div>

            {/* ── FOOTER ── */}
            <motion.div
              className="home-footer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ delay: 1.5 }}
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

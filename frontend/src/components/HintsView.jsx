import React, { useState, useEffect } from 'react';
import { Lightbulb, AlertTriangle, Radar, Target, Shield, RefreshCw } from 'lucide-react';
import { GAME_API_BASE } from '../config';
import { fetchWithRetry } from '../utils/api';

const CATEGORY_CONFIG = {
  'EARLY GAME': { icon: Lightbulb, color: '#00f0ff', bg: 'rgba(0,240,255,0.06)', border: 'rgba(0,240,255,0.2)' },
  'MID GAME': { icon: Radar, color: '#a855f7', bg: 'rgba(168,85,247,0.06)', border: 'rgba(168,85,247,0.2)' },
  'LATE GAME': { icon: Shield, color: '#ff3b30', bg: 'rgba(255,59,48,0.06)', border: 'rgba(255,59,48,0.2)' },
  'SURVEILLANCE': { icon: Radar, color: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)' },
  'TACTICAL': { icon: Target, color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' },
  'WARNING': { icon: AlertTriangle, color: '#ff8c00', bg: 'rgba(255,140,0,0.06)', border: 'rgba(255,140,0,0.2)' },
  'INTEL': { icon: Lightbulb, color: '#00f0ff', bg: 'rgba(0,240,255,0.06)', border: 'rgba(0,240,255,0.2)' },
};

export default function HintsView({ session }) {
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHints = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetchWithRetry(`${GAME_API_BASE}/${session.id}/hints`, {}, (a, m) => null);
      if (res.ok) {
        setHints(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch hints", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHints();
  }, [session?.currentTurn, session?.id]);

  const grouped = {};
  hints.forEach(h => {
    if (!grouped[h.category]) grouped[h.category] = [];
    grouped[h.category].push(h);
  });

  const categoryOrder = ['EARLY GAME', 'MID GAME', 'LATE GAME', 'SURVEILLANCE', 'TACTICAL', 'INTEL', 'WARNING'];

  return (
    <div className="clues-view">
      <div className="clues-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="clues-header-left">
          <h2>STRATEGIC ADVISORY — TACTICAL HINTS</h2>
          <p className="clues-subtitle">Context-aware recommendations based on current operation status</p>
        </div>
        <button
          onClick={fetchHints}
          className="cyber-btn sm"
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          REFRESH
        </button>
      </div>

      <div className="clues-grouped-container">
        {hints.length === 0 && !loading && (
          <div className="empty-state">
            <Lightbulb size={48} />
            <p>No tactical recommendations available at this time.</p>
          </div>
        )}

        {loading && (
          <div className="empty-state">
            <div style={{ width: 32, height: 32, border: '3px solid rgba(0,240,255,0.1)', borderTopColor: 'var(--cyan)', borderRadius: '50%', animation: 'retry-spin 1s linear infinite' }} />
            <p>Generating strategic advisory...</p>
          </div>
        )}

        {!loading && categoryOrder.map(cat => {
          if (!grouped[cat]) return null;
          const cfg = CATEGORY_CONFIG[cat] || { icon: Lightbulb, color: '#888', bg: 'rgba(136,136,136,0.06)', border: 'rgba(136,136,136,0.2)' };
          const Icon = cfg.icon;
          return (
            <div key={cat} className="clue-group-section">
              <h3 className="clue-group-title" style={{ color: cfg.color, borderBottomColor: cfg.border }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon size={14} />
                  {cat}
                </span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {grouped[cat].map((h, idx) => (
                  <div key={idx} style={{
                    padding: '14px 16px',
                    borderRadius: '6px',
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    borderLeft: `3px solid ${cfg.color}`,
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px',
                    }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: cfg.color,
                        letterSpacing: '0.05em',
                      }}>
                        {h.title}
                      </span>
                      {h.turnGenerated && (
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: '9px',
                          color: 'var(--text-dim)',
                          background: 'rgba(255,255,255,0.03)',
                          padding: '2px 6px',
                          borderRadius: '3px',
                        }}>
                          TURN {h.turnGenerated}
                        </span>
                      )}
                    </div>
                    <p style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.65',
                      margin: 0,
                    }}>
                      {h.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

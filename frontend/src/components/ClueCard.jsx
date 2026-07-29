import React from 'react';
import { motion } from 'framer-motion';
import { getSuspectImage } from '../assets/suspectImages';

export default function ClueCard({ clue, index, assessment, onSetAssessment, suspects = [] }) {
  const isSweepAlert = clue.source === 'SECURITY_SWEEP_ALERT';

  // Match suspect by scanning clue text for their first name
  const matchedSuspect = suspects.find(name =>
    clue.clueText && clue.clueText.toLowerCase().includes(name.split(' ')[0].toLowerCase())
  );
  const suspectImg = getSuspectImage(matchedSuspect);

  const getAssessmentClass = (status) => {
    switch (status) {
      case 'ACCEPT': return 'accept';
      case 'REJECT': return 'reject';
      case 'DOUBT': return 'doubt';
      default: return '';
    }
  };

  return (
    <motion.div
      className={`clue-card ${getAssessmentClass(assessment)}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={isSweepAlert ? {
        borderColor: 'rgba(255, 0, 64, 0.55)',
        background: 'rgba(255, 0, 64, 0.06)',
        boxShadow: '0 0 16px rgba(255, 0, 64, 0.15), inset 0 0 10px rgba(255, 0, 64, 0.05)'
      } : {}}
    >
      {/* Top row: meta info + suspect portrait aligned on same line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div className="clue-meta" style={{ flex: 1, marginBottom: 0 }}>
          <span className="clue-turn">ROUND: {clue.turnDiscovered}</span>
          {isSweepAlert ? (
            <span className="clue-source" style={{
              background: 'rgba(255, 0, 64, 0.15)',
              color: '#ff0040',
              border: '1px solid rgba(255, 0, 64, 0.4)',
              fontWeight: 900,
              letterSpacing: '0.06em',
              animation: 'blink 1.2s infinite'
            }}>
              ⚠ SWEEP ALERT
            </span>
          ) : (
            <>
              {clue.cityName && (
                <span className="clue-source default">
                  {clue.cityName.replace(/_/g, ' ').toUpperCase()}
                </span>
              )}
              {clue.discoveredByAgent && (
                <span className="clue-source historical">
                  BY: {clue.discoveredByAgent}
                </span>
              )}
            </>
          )}
        </div>

        {/* Suspect portrait — aligned to the right of meta row */}
        {suspectImg && (
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '5px',
            overflow: 'hidden',
            border: '1px solid rgba(255,59,48,0.45)',
            boxShadow: '0 0 8px rgba(255,59,48,0.2)',
            flexShrink: 0,
          }}>
            <img
              src={suspectImg}
              alt={matchedSuspect}
              title={matchedSuspect}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', filter: 'grayscale(20%) contrast(1.1)' }}
            />
          </div>
        )}
      </div>

      <div className="clue-text" style={isSweepAlert ? { color: '#ff7090', fontWeight: 600 } : {}}>
        {clue.clueText}
      </div>

      <div className="clue-actions">
        <div className="clue-assessment-label">
          {assessment}
        </div>
        <div className="clue-buttons">
          <button
            className={`assess-btn ${assessment === 'ACCEPT' ? 'active-accept' : ''}`}
            onClick={() => onSetAssessment(index, 'ACCEPT')}
          >
            ACCEPT
          </button>
          <button
            className={`assess-btn ${assessment === 'REJECT' ? 'active-reject' : ''}`}
            onClick={() => onSetAssessment(index, 'REJECT')}
          >
            REJECT
          </button>
          <button
            className={`assess-btn ${assessment === 'DOUBT' ? 'active-doubt' : ''}`}
            onClick={() => onSetAssessment(index, 'DOUBT')}
          >
            DOUBT
          </button>
        </div>
      </div>
    </motion.div>
  );
}

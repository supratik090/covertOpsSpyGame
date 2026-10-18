import React from 'react';
import { Shield, ChevronRight, ChevronLeft, X, AlertTriangle } from 'lucide-react';

export default function TourCard({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  position = 'top'
}) {
  if (!step) return null;

  return (
    <div className={`tour-card-container position-${position} animate-fade-in`}>
      <div className="tour-card cyber-panel">
        {/* Terminal Header */}
        <div className="tour-card-header">
          <div className="tour-header-left">
            <Shield size={14} className="text-cyan animate-pulse" />
            <span className="tour-step-badge font-mono text-cyan">
              DIRECTIVE {stepIndex + 1} / {totalSteps}
            </span>
          </div>
          <button 
            className="tour-close-btn"
            onClick={onSkip}
            title="Dismiss Field Tour"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="tour-card-body">
          <h4 className="tour-card-title text-cyber font-mono font-bold">
            {step.title}
          </h4>

          <div className="tour-card-text font-mono text-[11px]">
            {step.guidance.split('\n').map((line, idx) => {
              if (line.startsWith('•')) {
                const parts = line.split(':');
                if (parts.length > 1) {
                  return (
                    <div key={idx} className="tour-bullet-line">
                      <span className="text-cyan font-bold">{parts[0]}:</span>
                      <span>{parts.slice(1).join(':')}</span>
                    </div>
                  );
                }
                return <div key={idx} className="tour-bullet-line">{line}</div>;
              }
              if (line.includes('⚠️') || line.includes('GOLDEN RULE') || line.includes('CRITICAL')) {
                return (
                  <div key={idx} className="tour-warning-line">
                    <AlertTriangle size={13} className="text-amber flex-shrink-0" />
                    <span>{line.replace('⚠️', '')}</span>
                  </div>
                );
              }
              return line ? <p key={idx} className="tour-paragraph">{line}</p> : <div key={idx} className="h-1.5" />;
            })}
          </div>
        </div>

        {/* Controls Footer */}
        <div className="tour-card-footer">
          <button 
            className="cyber-btn sm red tour-btn-skip"
            onClick={onSkip}
          >
            DISMISS
          </button>

          <div className="tour-footer-nav">
            {stepIndex > 0 && (
              <button 
                className="cyber-btn sm tour-btn-prev"
                onClick={onPrev}
              >
                <ChevronLeft size={14} />
                <span>PREV</span>
              </button>
            )}

            <button 
              className="cyber-btn sm cyan tour-btn-next"
              onClick={onNext}
            >
              <span>{stepIndex === totalSteps - 1 ? 'COMPLETE' : 'NEXT'}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

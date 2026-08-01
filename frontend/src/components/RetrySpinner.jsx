import React, { useEffect, useState } from 'react';
import { Radio, ShieldAlert } from 'lucide-react';

export default function RetrySpinner({ attempt, max }) {
  const [subStatus, setSubStatus] = useState('ESTABLISHING ENCRYPTED LINK...');

  useEffect(() => {
    const statuses = [
      'ESTABLISHING ENCRYPTED LINK...',
      'BYPASSING FIREWALL PROTOCOLS...',
      'RE-ROUTING SIGNAL THROUGH PROXIES...',
      'TUNNELING SECURE SEC-COM CHANNEL...',
      'SYNCHRONIZING TELEMETRY STRATA...'
    ];
    setSubStatus(statuses[(attempt - 1) % statuses.length]);
  }, [attempt]);

  return (
    <div className="retry-spinner-overlay">
      <div className="retry-cyber-grid" />
      
      <div className="retry-container">
        {/* Animated Scanline */}
        <div className="retry-scanline" />

        <div className="retry-radar-wrapper">
          <div className="retry-radar-circle outer" />
          <div className="retry-radar-circle middle" />
          <div className="retry-radar-circle inner" />
          <div className="retry-radar-sweep" />
          
          <div className="retry-radar-node">
            <Radio className="retry-radar-icon" size={24} />
          </div>
        </div>

        <div className="retry-intel-box">
          <div className="retry-header">
            <ShieldAlert size={14} className="retry-alert-icon" />
            <span>SECURE SIGNAL INTERRUPTED</span>
          </div>

          <div className="retry-progress-bar">
            <div 
              className="retry-progress-fill" 
              style={{ width: `${(attempt / max) * 100}%` }}
            />
          </div>

          <div className="retry-stats">
            <div className="retry-stat-item">
              <span className="label">ATTEMPT:</span>
              <span className="value cyan">{attempt} / {max}</span>
            </div>
            <div className="retry-stat-item">
              <span className="label">STATUS:</span>
              <span className="value amber">RECONNECTING...</span>
            </div>
          </div>

          <div className="retry-subtext">
            {subStatus}
          </div>
        </div>
      </div>
    </div>
  );
}

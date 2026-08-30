import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const CityActionDrawer = ({
  cityId,
  isFriendly,
  hasSafehouse,
  onBuildSafehouse,
  onDeployTech,
  onClose,
  playerRole,
  isWaiting
}) => {
  const formatCityName = (name) => name.replace('_', ' ');
  const isAttacker = playerRole === 'ATTACKER';

  return (
    <motion.div 
      className="city-drawer"
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <div className="city-drawer-info">
        <h3>{formatCityName(cityId)}</h3>
        <span style={{ color: isFriendly ? '#00f0ff' : '#ff3b30' }}>
          {isFriendly ? 'HOME TERRITORY' : 'HOSTILE TERRITORY'}
        </span>
      </div>

      <div className="city-drawer-actions">
        {isWaiting ? (
          <div style={{ color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '11px', textAlign: 'center', width: '100%', padding: '10px 0', letterSpacing: '0.05em' }}>
            🔒 INPUT LOCKED: WAITING FOR OPPONENT
          </div>
        ) : isAttacker ? (
          <>
            {!hasSafehouse && (
              <>
                <button 
                  className="cyber-btn sm green" 
                  onClick={() => onBuildSafehouse(cityId, false)}
                >
                  BUILD SAFEHOUSE ({isFriendly ? '$50K' : '$150K'})
                </button>
                <button 
                  className="cyber-btn sm green" 
                  onClick={() => onBuildSafehouse(cityId, true)}
                >
                  BUILD SECURE SAFEHOUSE ({isFriendly ? '$100K' : '$300K'})
                </button>
              </>
            )}
            <button className="cyber-btn sm amber" onClick={() => onDeployTech('DECOY_CCTV', cityId)}>
              DEPLOY DECOY CCTV ($20,000)
            </button>
            <button className="cyber-btn sm amber" onClick={() => onDeployTech('DECOY_SATELLITE', cityId)}>
              DEPLOY DECOY SATELLITE ($40,000)
            </button>
            <button className="cyber-btn sm amber" onClick={() => onDeployTech('JAMMER', cityId)}>
              DEPLOY ACTIVE JAMMER ($30,000)
            </button>
          </>
        ) : (
          <>
            {!hasSafehouse && (
              <button 
                className="cyber-btn sm" 
                onClick={() => onBuildSafehouse(cityId, false)}
              >
                BUILD SAFEHOUSE ({isFriendly ? '$40K' : '$100K'})
              </button>
            )}
            <button className="cyber-btn sm amber" onClick={() => onDeployTech('CCTV', cityId)}>
              DEPLOY CCTV ($30,000)
            </button>
            <button className="cyber-btn sm amber" onClick={() => onDeployTech('WIRE_TAP', cityId)}>
              DEPLOY WIRE TAP ($20,000)
            </button>
            <button className="cyber-btn sm amber" onClick={() => onDeployTech('PHONE_TAP', cityId)}>
              DEPLOY PHONE TAP ($20,000)
            </button>
            <button className="cyber-btn sm amber" onClick={() => onDeployTech('SATELLITE', cityId)}>
              DEPLOY SATELLITE ($50,000)
            </button>
            <button className="cyber-btn sm amber" onClick={() => onDeployTech('FINANCE_MONITOR', cityId)}>
              DEPLOY FINANCE MONITOR ($50,000)
            </button>
          </>
        )}
      </div>

      <button className="city-drawer-close" onClick={onClose}>
        <X size={20} />
      </button>
    </motion.div>
  );
};

export default CityActionDrawer;

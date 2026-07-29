import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const CityActionDrawer = ({
  cityId,
  isFriendly,
  hasSafehouse,
  onBuildSafehouse,
  onDeployTech,
  onClose
}) => {
  const formatCityName = (name) => name.replace('_', ' ');

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
        {!hasSafehouse && (
          <button 
            className="cyber-btn sm" 
            onClick={() => onBuildSafehouse(cityId)}
          >
            BUILD SAFEHOUSE ({isFriendly ? '$50K' : '$150K'})
          </button>
        )}
        
        <button className="cyber-btn sm amber" onClick={() => onDeployTech('CCTV', cityId)}>
          DEPLOY CCTV ($50,000)
        </button>
        <button className="cyber-btn sm amber" onClick={() => onDeployTech('WIRE_TAP', cityId)}>
          DEPLOY WIRE TAP ($30,000)
        </button>
        <button className="cyber-btn sm amber" onClick={() => onDeployTech('PHONE_TAP', cityId)}>
          DEPLOY PHONE TAP ($60,000)
        </button>
        <button className="cyber-btn sm amber" onClick={() => onDeployTech('SATELLITE', cityId)}>
          DEPLOY SATELLITE ($120,000)
        </button>
        <button className="cyber-btn sm amber" onClick={() => onDeployTech('FINANCE_MONITOR', cityId)}>
          DEPLOY FINANCE MONITOR ($80,000)
        </button>
      </div>

      <button className="city-drawer-close" onClick={onClose}>
        <X size={20} />
      </button>
    </motion.div>
  );
};

export default CityActionDrawer;

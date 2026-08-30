import React, { useState } from 'react';
import { DollarSign, Shield, Radio, Crosshair } from 'lucide-react';

export default function ResourcesView({ session, nodes, onBuildSafehouse, onDeployTech, addToast }) {
  const [selectedDeployCity, setSelectedDeployCity] = useState(nodes[0]?.id || '');

  const techOptions = [
    { type: 'SATELLITE', cost: 50000 },
    { type: 'CCTV', cost: 30000 },
    { type: 'WIRE_TAP', cost: 20000 },
    { type: 'FINANCE_MONITOR', cost: 50000 },
    { type: 'PHONE_TAP', cost: 20000 }
  ];

  return (
    <div className="resources-view">
      <div className="resource-grid">
        
        {/* Budget Section */}
        <div className="resource-section">
          <div className="resource-header">
            <DollarSign className="icon" />
            <h3>BUDGET</h3>
          </div>
          <div className="budget-display">
            ${session.budget.toLocaleString()}
          </div>
        </div>

        {/* Safehouses Section */}
        <div className="resource-section">
          <div className="resource-header">
            <Shield className="icon" />
            <h3>SAFEHOUSES</h3>
          </div>
          <div className="safehouse-list">
            {session.safehouses.map((sh, idx) => (
              <div key={idx} className="safehouse-item">
                <span>{sh.cityNode.toUpperCase()}</span>
                <span className={`badge ${sh.faction === 'DEFENDER' ? 'cyan' : 'red'}`}>
                  {sh.faction}
                </span>
                {(sh.uncovered || sh.status === 'EXPOSED') && (
                  <span className="tag-exposed">EXPOSED</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Deployed Tech Section */}
        <div className="resource-section full-width">
          <div className="resource-header">
            <Radio className="icon" />
            <h3>SURVEILLANCE RESOURCES</h3>
          </div>
          <div className="resource-grid-inner">
            {session.espionageResources.map((res, idx) => (
              <div key={idx} className="resource-item">
                <span className="type-label">{res.type.replace(/_/g, ' ')}</span>
                <span className="city-value">{res.cityNode?.toUpperCase() || res.city?.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Deploy New Tech Section */}
        <div className="resource-section full-width">
          <div className="resource-header">
            <Crosshair className="icon" />
            <h3>DEPLOY EQUIPMENT</h3>
          </div>
          
          <div className="deploy-controls">
            <select 
              className="city-select"
              value={selectedDeployCity}
              onChange={e => setSelectedDeployCity(e.target.value)}
            >
              {nodes.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <button 
              className="cyber-btn"
              onClick={() => onBuildSafehouse(selectedDeployCity)}
            >
              BUILD SAFEHOUSE
            </button>
          </div>

          <div className="deploy-grid">
            {techOptions.map(tech => (
              <div key={tech.type} className="deploy-card">
                <h4>{tech.type.replace(/_/g, ' ')}</h4>
                <p>${tech.cost.toLocaleString()}</p>
                <button 
                  className="cyber-btn sm"
                  onClick={() => onDeployTech(tech.type, selectedDeployCity)}
                >
                  DEPLOY
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

const ScenarioSelect = ({
  scenarios,
  selectedScenarioId,
  setSelectedScenarioId,
  onStartNewGame,
  onContinueGame,
  loading,
  errorMsg
}) => {
  return (
    <div className="select-screen">
      <motion.div 
        className="select-card cyber-panel"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="auth-brand">
            <span className="auth-brand-line">PROTOCOL</span>
            <span className="auth-brand-name">NIGHTFALL</span>
          </div>
        <h1 className="select-title">COMMAND DESK: CAMPAIGN SELECTION — PROTOCOL NIGHTFALL</h1>
        
        {errorMsg && <div className="error-msg">{errorMsg}</div>}
        
        <div className="scenario-list">
          {scenarios.map(scenario => (
            <div 
              key={scenario.scenarioId}
              className={`scenario-card ${selectedScenarioId === scenario.scenarioId ? 'selected' : ''}`}
              onClick={() => setSelectedScenarioId(scenario.scenarioId)}
            >
              <h3>{scenario.title} <span>({scenario.scenarioId})</span></h3>

              <div className="scenario-meta">
                <div>TARGET VIP: [CLASSIFIED]</div>
                <div>BUDGET: ${scenario.startingBudget?.toLocaleString()}</div>
                <div>TURN LIMIT: {scenario.maxTurns}</div>
                <div>ATTACK FORM: [REDACTED]</div>
              </div>
            </div>
          ))}
        </div>

        <div className="select-actions">
          <button 
            className="cyber-btn lg" 
            onClick={onStartNewGame}
            disabled={!selectedScenarioId || loading}
          >
            <Activity size={20} />
            <span>START NEW OPERATION</span>
          </button>
          
          <button 
            className="cyber-btn lg green" 
            onClick={onContinueGame}
            disabled={loading}
          >
            <RefreshCw size={20} />
            <span>CONTINUE ACTIVE OPERATION</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ScenarioSelect;

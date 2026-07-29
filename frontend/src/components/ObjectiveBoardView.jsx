import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, X, Target, Shield, Radio } from 'lucide-react';

export default function ObjectiveBoardView({ session, activeScenario, onClose }) {
  const [currentPage, setCurrentPage] = useState(0);

  if (!session) return null;

  const scenarioTitle = activeScenario?.title?.toUpperCase() || session.scenarioId?.replace(/_/g, ' ').toUpperCase() || 'CLASSIFIED OPERATION';
  const briefingText = activeScenario?.briefing || session.aiMasterPlan?.briefing || "Hostile threat cell is plotting a strike.";

  const homeSafehouseCost = activeScenario?.safehouseBuildCosts?.HOME_TERRITORY 
    ? `$${(activeScenario.safehouseBuildCosts.HOME_TERRITORY / 1000)}K` 
    : '$50K';
  const hostileSafehouseCost = activeScenario?.safehouseBuildCosts?.HOSTILE_TERRITORY 
    ? `$${(activeScenario.safehouseBuildCosts.HOSTILE_TERRITORY / 1000)}K` 
    : '$150K';

  const hostileCities = activeScenario?.nodes
    ?.filter(n => n.territory === 'HOSTILE_TERRITORY')
    ?.map(n => n.name)
    ?.join(', ') || 'Karachi, Quetta, Peshawar, Lahore';

  const friendlyCities = activeScenario?.nodes
    ?.filter(n => n.territory === 'HOME_TERRITORY')
    ?.map(n => n.name)
    ?.join(', ') || 'Srinagar, Jammu, Amritsar, Chandigarh, New Delhi';

  const targetCityName = activeScenario?.nodes?.find(n => n.id === activeScenario.targetCity)?.name || 'New Delhi';
  const targetVipName = activeScenario?.targetVip || 'High-Profile Minister';

  const slides = [
    {
      title: "1. SITUATION REPORT (SITREP)",
      icon: Target,
      color: "var(--cyan)",
      content: (
        <div className="flex-col-container">
          <div className="sitrep-box">
            <div>
              <span className="sitrep-title">OPERATION SYSTEM:</span>
              <span className="text-cyber font-bold text-lg tracking-widest block">{scenarioTitle}</span>
            </div>
            
            <div className="sitrep-item">
              <span className="sitrep-title white">a. AREA OF INTEREST (AOI)</span>
              <p className="sitrep-text">
                Cross-border corridors connecting Hostile Territory stations (<span className="highlight">{hostileCities}</span>) to friendly Home Territory sectors (<span className="highlight">{friendlyCities}</span>).
              </p>
            </div>

            <div className="sitrep-item">
              <span className="sitrep-title white">b. ENEMY FORCES (INTEL DISPOSITION)</span>
              <p className="sitrep-text">
                <strong className="text-threat">Most Likely Course of Action (MLCOA):</strong> The threat cell is projected to source capital and collect logistical resources in hostile territory, cross the border, and move towards <span className="highlight">{targetCityName}</span> to compromise the target VIP (<span className="highlight">{targetVipName}</span>).
              </p>
            </div>
            
            <div className="sitrep-item briefing-alert">
              <span className="sitrep-title amber">c. HIGHER COMMAND INTEL (BRIEFING)</span>
              <p className="sitrep-text" style={{ fontStyle: 'italic', color: 'var(--amber)' }}>
                "{briefingText}"
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "2. EXECUTION (CONCEPT OF OPS)",
      icon: Shield,
      color: "var(--red)",
      content: (
        <div className="flex-col-container">
          <div className="sitrep-box">
            <div className="sitrep-item">
              <span className="sitrep-title white">PHASE I: INTELLIGENCE RECONNAISSANCE</span>
              <p className="sitrep-text">
                Deploy Agents to suspect cities. Assign them to <strong className="text-cyber">GATHER INTELLIGENCE</strong> to intercept communication foot logs. Mark verified logs as <strong className="text-success">ACCEPTED</strong> to lock coordinates.
              </p>
            </div>
            
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--red)' }}>
              <span className="sitrep-title" style={{ color: 'var(--red)' }}>PHASE II: TACTICAL DISRUPTION</span>
              <p className="sitrep-text">
                Deploy Combat Teams to active nodes. Assign <strong className="text-threat">FREEZE FINANCE</strong> or <strong className="text-threat">RAID LOGISTICS</strong> to disrupt sourcing. This forces the suspect cell to pivot to emergency fallback routes, buying us time.
              </p>
            </div>

            <div className="sitrep-item" style={{ borderLeftColor: 'var(--red)' }}>
              <span className="sitrep-title" style={{ color: 'var(--red)' }}>PHASE III: SAFEHOUSE INTERCEPTION</span>
              <p className="sitrep-text">
                Expose hostile base nodes via the agent task <strong className="text-cyber">UNCOVER SAFEHOUSE</strong>. Send combat units to execute a <strong className="text-threat">RAID SAFEHOUSE</strong> using the uncovered 3-digit security key to eliminate the cell.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "3. COMMAND & SIGNAL (ROE)",
      icon: Radio,
      color: "var(--red)",
      content: (
        <div className="flex-col-container">
          <div className="sitrep-box">
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--red)' }}>
              <span className="sitrep-title" style={{ color: 'var(--red)' }}>a. RAID VERIFICATION PROTOCOL (ROE)</span>
              <p className="sitrep-text">
                The Safehouse in the target city needs to be discovered first before raiding. A raid must NOT be launched at a hostile base without confirming the 3-digit access code via tap intercepts. Incorrect codes trigger alert warnings and suspect escapes.
              </p>
            </div>

            <div className="sitrep-item">
              <span className="sitrep-title white">b. ACTIVE TAB TELEMETRY</span>
              <p className="sitrep-text">
                Signal feeds (MAP, AGENTS, CLUES, DOSSIER, RESOURCES) must be tracked constantly in the left sidebar console to evaluate budget and agent cooldown statuses.
              </p>
            </div>

            <div className="sitrep-item briefing-alert" style={{ borderLeftColor: 'var(--emerald)' }}>
              <span className="sitrep-title" style={{ color: 'var(--emerald)' }}>c. SUCCESS PARAMETERS</span>
              <p className="sitrep-text" style={{ fontStyle: 'italic', color: 'var(--emerald-light)' }}>
                Mission objective: Neutralize the target at the correct safehouse node with the correct security code to complete the operation.
              </p>
            </div>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentPage < slides.length - 1) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const CurrentIcon = slides[currentPage].icon;
  const currentSlide = slides[currentPage];

  return (
    <div className="objective-board-view flex flex-col h-full w-full max-w-[1100px] mx-auto p-4 md:p-6 font-mono text-[var(--text-primary)]">
      {onClose && (
        <button onClick={onClose} className="cyber-btn sm text-dim hover:text-threat objective-board-close-btn" title="Close Objectives">
          <X size={14} />
        </button>
      )}

      {/* Header */}
      <div className="flex justify-center items-center border-b border-[rgba(0,240,255,0.25)] pb-8 mb-8 flex-shrink-0">
        <div>
          <h2 className="text-cyber text-xl md:text-2xl font-bold tracking-wider text-center" style={{ textShadow: '0 0 10px rgba(0,240,255,0.4)', textAlign: 'center' }}>
            TACTICAL OPERATIONS BOARD
          </h2>
        </div>
      </div>

      {/* Main Content Pane — fills space between header and footer */}
      <div className="flex-1 flex flex-col gap-6 mb-6 min-h-0 overflow-hidden">
        {/* Swipable text panel - Full Widescreen Width */}
        <div className="flex-1 flex flex-col justify-between cyber-panel bg-[rgba(5,10,24,0.85)] p-6 border border-[rgba(0,240,255,0.2)] rounded-lg overflow-y-auto shadow-[0_0_30px_rgba(0,0,0,0.8)]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[rgba(255,255,255,0.08)]">
              <CurrentIcon size={16} style={{ color: currentSlide.color }} />
              <h3 className="font-bold text-sm tracking-wide" style={{ color: currentSlide.color }}>
                {currentSlide.title}
              </h3>
            </div>

            <div className="animate-fade-in mt-2">
              {currentSlide.content}
            </div>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-2 mt-6 flex-shrink-0 border-t border-[rgba(255,255,255,0.05)] pt-4">
            {slides.map((_, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentPage(idx)}
                className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all duration-300 ${
                  idx === currentPage ? 'bg-cyber scale-125 shadow-[0_0_8px_rgba(0,240,255,0.8)]' : 'bg-dim opacity-40'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="objective-board-footer flex-shrink-0">
        <button
          onClick={handlePrev}
          disabled={currentPage === 0}
          className={`cyber-btn sm flex items-center gap-1.5 ${currentPage === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          <ChevronLeft size={14} /> BACK
        </button>

        {currentPage < slides.length - 1 ? (
          <button
            onClick={handleNext}
            className="cyber-btn sm flex items-center gap-1.5"
          >
            NEXT <ChevronRight size={14} />
          </button>
        ) : (
          onClose && (
            <button
              onClick={onClose}
              className="cyber-btn sm flex items-center gap-1.5 border-emerald-500 text-emerald-400 bg-[rgba(16,185,129,0.08)] hover:bg-[rgba(16,185,129,0.15)]"
            >
              INITIALIZE COMMAND CONSOLE <ChevronRight size={14} />
            </button>
          )
        )}
      </div>
    </div>
  );
}

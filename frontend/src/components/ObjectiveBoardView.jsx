import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, X, Target, Shield, Radio } from 'lucide-react';

export default function ObjectiveBoardView({ session, activeScenario, onClose }) {
  const [currentPage, setCurrentPage] = useState(0);

  if (!session) return null;

  const scenarioTitle = activeScenario?.title?.toUpperCase() || session.scenarioId?.replace(/_/g, ' ').toUpperCase() || 'CLASSIFIED OPERATION';
  const isAttacker = session.playerRole === 'ATTACKER';
  const briefingText = isAttacker
    ? (activeScenario?.attackerBriefing || "Major terrorist attack planned on North Indian cities. Execute attack with precision.")
    : (activeScenario?.briefing || session.aiMasterPlan?.briefing || "Hostile threat cell is plotting a strike.");

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

  const slides = isAttacker ? [
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
              <span className="sitrep-title white">a. AREA OF OPERATIONS (AO)</span>
              <p className="sitrep-text">
                Friendly home soil zones (<span className="highlight">{hostileCities}</span>) connecting to hostile Target sectors (<span className="highlight">{friendlyCities}</span>).
              </p>
            </div>

            <div className="sitrep-item">
              <span className="sitrep-title white">b. TACTICAL OBJECTIVE</span>
              <p className="sitrep-text">
                Establish safehouse networks, cross the border undetected, and relocate the active threat agent to <span className="highlight">{targetCityName}</span> to initiate strike payload against the VIP (<span className="highlight">{targetVipName}</span>).
              </p>
            </div>
            
            <div className="sitrep-item briefing-alert">
              <span className="sitrep-title amber">c. CELL LEADER DIRECTIVE (BRIEFING)</span>
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
              <span className="sitrep-title white">PHASE I: SOURCING & PREPARATION</span>
              <p className="sitrep-text">
                Utilize local channels to build base safehouses. Source sniper payloads and transaction funds in friendly cities.
              </p>
            </div>
            
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--red)' }}>
              <span className="sitrep-title" style={{ color: 'var(--red)' }}>PHASE II: BORDER CROSSING</span>
              <p className="sitrep-text">
                After completing Logistics Sourcing, transition to Handover phase and request Border Infiltration Clearance from HQ. Once approved, cross the border checkpoints.
              </p>
            </div>

            <div className="sitrep-item" style={{ borderLeftColor: 'var(--red)' }}>
              <span className="sitrep-title" style={{ color: 'var(--red)' }}>PHASE III: PAYLOAD STRIKE & EXFILTRATION</span>
              <p className="sitrep-text">
                Infiltrate the target city, request Strike Authorization, and detonate the payload. You must then exfiltrate the operative back to home soil undetected to secure final victory.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "3. COUNTER-INTELLIGENCE PROTOCOLS",
      icon: Radio,
      color: "var(--red)",
      content: (
        <div className="flex-col-container">
          <div className="sitrep-box">
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--red)' }}>
              <span className="sitrep-title" style={{ color: 'var(--red)' }}>a. RADAR DEFLECTION (DECOYS & JAMMERS)</span>
              <p className="sitrep-text">
                Friendly CCTV, wire taps, and satellites will increase your heat level. Deploy Decoy sensors and Active Jammers to mask your locations and prevent tactical team raids.
              </p>
            </div>

            <div className="sitrep-item">
              <span className="sitrep-title white">b. SECURE SAFEHOUSE NETWORKS</span>
              <p className="sitrep-text">
                Construct Secure Safehouses to fully hide the suspect and block active defender scans for up to 5 turns.
              </p>
            </div>

            <div className="sitrep-item briefing-alert" style={{ borderLeftColor: 'var(--emerald)' }}>
              <span className="sitrep-title" style={{ color: 'var(--emerald)' }}>c. VICTORY PARAMETERS</span>
              <p className="sitrep-text" style={{ fontStyle: 'italic', color: 'var(--emerald-light)' }}>
                Target objective: Execute strike on the target VIP and safely return back to home soil undetected.
              </p>
            </div>
          </div>
        </div>
      )
    }
  ] : [
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
      title: "2. HOW TO ATTACK THE ENEMY BASE",
      icon: Shield,
      color: "var(--red)",
      content: (
        <div className="flex-col-container">
          <div className="sitrep-box">
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--cyan)' }}>
              <span className="sitrep-title" style={{ color: 'var(--cyan)' }}>STEP 1 — FIND THE SAFEHOUSE</span>
              <p className="sitrep-text">
                Deploy an <strong className="text-cyber">Intelligence Agent</strong> to a hostile city node. Assign the task <strong className="text-cyber">UNCOVER SAFEHOUSE</strong>. On success, the agent returns the hidden <strong className="text-cyber">3-digit security code</strong> for that safehouse — this code is required to execute a raid.
              </p>
            </div>
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--amber)' }}>
              <span className="sitrep-title" style={{ color: 'var(--amber)' }}>STEP 2 — CONFIRM WITH SCANS</span>
              <p className="sitrep-text">
                Run <strong className="text-cyber">CCTV</strong>, <strong className="text-cyber">SATELLITE</strong>, <strong className="text-cyber">PHONE TAP</strong>, or <strong className="text-cyber">WIRE TAP</strong> scans on the city to generate clues confirming suspect presence. Accepted clues update the Dossier timeline and help narrow down which safehouse the operative is hiding in.
              </p>
            </div>
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--red)' }}>
              <span className="sitrep-title" style={{ color: 'var(--red)' }}>STEP 3 — RAID OR STRIKE</span>
              <p className="sitrep-text">
                <strong className="text-threat">Option A — Team Raid:</strong> Send a <strong className="text-cyber">Tactical Team</strong> to the city and execute <strong className="text-threat">RAID SAFEHOUSE</strong> using the uncovered 3-digit code. The team's Combat Skill determines success odds. Secure Safehouses always have a flat 50% chance.
                <br /><br />
                <strong className="text-threat">Option B — Drone Strike:</strong> Deploy a <strong className="text-cyber">Drone</strong> with the <strong className="text-threat">STRIKE</strong> action on the city to destroy safehouses remotely — no code needed, but may not eliminate all operatives inside.
              </p>
            </div>
            <div className="sitrep-item briefing-alert" style={{ borderLeftColor: 'var(--red)' }}>
              <span className="sitrep-title" style={{ color: 'var(--red)' }}>⚠ WARNING</span>
              <p className="sitrep-text" style={{ color: 'var(--red-dim)' }}>
                Never raid without the correct code — a wrong code triggers an alert and the suspect escapes. Every raid destroys the safehouse regardless of outcome; surviving operatives will flee and rebuild.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "3. BORDER & FRIENDLY SECTOR DEFENCE",
      icon: Radio,
      color: "var(--amber)",
      content: (
        <div className="flex-col-container">
          <div className="sitrep-box">
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--cyan)' }}>
              <span className="sitrep-title" style={{ color: 'var(--cyan)' }}>BORDER PATROL — BLOCK THE CROSSING</span>
              <p className="sitrep-text">
                Assign an <strong className="text-cyber">Intelligence Agent</strong> to a border city node with the task <strong className="text-cyber">BORDER PATROL</strong>. The agent monitors crossing requests and has a high chance of flagging and intercepting any operative that attempts to infiltrate from hostile territory.
              </p>
            </div>
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--cyan)' }}>
              <span className="sitrep-title" style={{ color: 'var(--cyan)' }}>DRONE RECON — WATCH FRIENDLY CITIES</span>
              <p className="sitrep-text">
                Deploy a <strong className="text-cyber">Drone</strong> to a friendly city with the <strong className="text-cyber">RECON</strong> action. The drone sweeps the city passively each turn and auto-generates sighting clues if a suspect is present — giving you early warning before the operative reaches the target.
              </p>
            </div>
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--amber)' }}>
              <span className="sitrep-title" style={{ color: 'var(--amber)' }}>SECURITY SWEEP — EXPOSE HIDDEN BASES</span>
              <p className="sitrep-text">
                Run a <strong className="text-cyber">SECURITY SWEEP</strong> scan on any friendly node to raise local heat, surface safehouses the AI has constructed inside friendly territory, and force suspects to react. Use this when you suspect an operative has already crossed the border.
              </p>
            </div>
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--red)' }}>
              <span className="sitrep-title" style={{ color: 'var(--red)' }}>TACTICAL TEAMS — LAST LINE OF DEFENCE</span>
              <p className="sitrep-text">
                Station <strong className="text-cyber">Combat Teams</strong> in friendly cities near the target (<span className="highlight">{targetCityName}</span>). If an operative crosses and builds a safehouse inside, your team can immediately execute a <strong className="text-threat">RAID SAFEHOUSE</strong> before the strike is triggered.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "4. YOUR ASSETS — AGENTS, TEAMS & DRONES",
      icon: Shield,
      color: "var(--cyan)",
      content: (
        <div className="flex-col-container">
          <div className="sitrep-box">
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--cyan)' }}>
              <span className="sitrep-title" style={{ color: 'var(--cyan)' }}>INTELLIGENCE AGENT</span>
              <p className="sitrep-text">
                Covert operative deployable to any city. Available tasks:
                <br />— <strong className="text-cyber">GATHER INTELLIGENCE</strong> — generates passive clues each turn
                <br />— <strong className="text-cyber">UNCOVER SAFEHOUSE</strong> — reveals the 3-digit security code
                <br />— <strong className="text-cyber">BORDER PATROL</strong> — intercepts crossing attempts at border nodes
                <br />— <strong className="text-cyber">SURVEILLANCE</strong> — extended observation generating higher-confidence clues
              </p>
            </div>
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--red)' }}>
              <span className="sitrep-title" style={{ color: 'var(--red)' }}>TACTICAL TEAM</span>
              <p className="sitrep-text">
                Combat unit for direct action. Available tasks:
                <br />— <strong className="text-threat">RAID SAFEHOUSE</strong> — destroys safehouse using 3-digit code (success depends on Combat Skill)
                <br />— <strong className="text-threat">FREEZE FINANCE</strong> — disrupts suspect's funding sourcing phase
                <br />— <strong className="text-threat">RAID LOGISTICS</strong> — disrupts suspect's equipment sourcing phase
                <br />Teams enter a cooldown period after each action.
              </p>
            </div>
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--amber)' }}>
              <span className="sitrep-title" style={{ color: 'var(--amber)' }}>DRONE + DRONE BASE</span>
              <p className="sitrep-text">
                Aerial asset requiring a <strong className="text-cyber">Drone Base</strong> built in a city first. Available actions:
                <br />— <strong className="text-cyber">RECON</strong> — passive city sweep each turn, auto-generates sighting clues
                <br />— <strong className="text-threat">STRIKE</strong> — destroys safehouses remotely (no code required)
                <br />— <strong className="text-threat">INTERCEPT</strong> — targets a moving suspect directly
                <br />Build multiple bases to extend drone coverage across the map.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "5. INTEL TOOLS — DOSSIER, HINTS & SCANS",
      icon: Radio,
      color: "var(--cyan)",
      content: (
        <div className="flex-col-container">
          <div className="sitrep-box">
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--cyan)' }}>
              <span className="sitrep-title" style={{ color: 'var(--cyan)' }}>DOSSIER TAB</span>
              <p className="sitrep-text">
                Shows a <strong className="text-cyber">turn-by-turn timeline</strong> of all suspect sightings per operative. Use it to trace movement patterns, spot sourcing phase transitions, and predict which city the operative will move to next. Only <strong className="text-success">ACCEPTED</strong> clues appear in the dossier — mark clues in the Clues tab to populate it.
              </p>
            </div>
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--cyan)' }}>
              <span className="sitrep-title" style={{ color: 'var(--cyan)' }}>HINTS TAB</span>
              <p className="sitrep-text">
                AI-generated <strong className="text-cyber">tactical suggestions</strong> based on your accumulated clues and game state. Check the Hints tab each turn for nudges on where to deploy agents, which city to scan next, or when to escalate to a raid.
              </p>
            </div>
            <div className="sitrep-item" style={{ borderLeftColor: 'var(--amber)' }}>
              <span className="sitrep-title" style={{ color: 'var(--amber)' }}>THE 5 SCAN TYPES</span>
              <p className="sitrep-text">
                Deploy scans from the city action panel on the map:
                <br />— <strong className="text-cyber">CCTV</strong> — traffic logs for current turn T and previous turn T-1 (movement detection)
                <br />— <strong className="text-cyber">SATELLITE</strong> — confirms physical presence in a city this turn (imagery)
                <br />— <strong className="text-cyber">PHONE TAP</strong> — intercepts cellular activity (communication signals)
                <br />— <strong className="text-cyber">WIRE TAP</strong> — intercepts financial transactions (sourcing phase detection)
                <br />— <strong className="text-cyber">SECURITY SWEEP</strong> — active sweep: raises heat, surfaces safehouses, forces suspect reaction. Use sparingly.
              </p>
            </div>
            <div className="sitrep-item briefing-alert" style={{ borderLeftColor: 'var(--emerald)' }}>
              <span className="sitrep-title" style={{ color: 'var(--emerald)' }}>✓ SUCCESS PARAMETERS</span>
              <p className="sitrep-text" style={{ fontStyle: 'italic', color: 'var(--emerald-light)' }}>
                Neutralize all threat operatives before any one of them reaches <span className="highlight">{targetCityName}</span> and executes the strike on <span className="highlight">{targetVipName}</span>. Track the Dossier. Trust the Hints. Act before they reach the Target.
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

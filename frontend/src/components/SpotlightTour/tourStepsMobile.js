export const MOBILE_TOUR_STEPS = [
  {
    id: 'TAB_BAR',
    targetSelector: '[data-tour="vtab-bar"]',
    tab: 'TACTICAL',
    title: '1. Command Navigation (Android Tabs)',
    guidance: `Your command center is streamlined for mobile:
• TACTICAL: Real-time sector map & asset deployment.
• OBJECTIVES: Mission brief, target suspects, and win conditions.
• AGENTS: Complete roster of active and lost field operatives.
• DOSSIER: Intercepted enemy dossiers and verified clues.
• HINTS: Dynamic tactical intelligence feed.`,
    cardPosition: 'center',
    needsCityOpen: false
  },
  {
    id: 'SECTOR_INFO',
    targetSelector: '[data-tour="cia-header"]',
    tab: 'TACTICAL',
    title: '2. Sector Intelligence (CIA Box)',
    guidance: `Tapping any node on the map deploys your CIA Tactical Report.
• Check whether the sector is FRIENDLY (Home) or HOSTILE (Enemy).
• Monitor local DETECTION HEAT %—hostile forces run sweeps against hot sectors!
• Review operational and exposed safehouses in this sector.`,
    cardPosition: 'top',
    needsCityOpen: true
  },
  {
    id: 'AGENT_DIRECTIVES',
    targetSelector: '[data-tour="cia-agent-section"]',
    tab: 'TACTICAL',
    title: '3. Operative Directives & Movement',
    guidance: `Operatives require explicit orders each turn:
• Tap an agent card to expand their tactical control panel.
• GATHER INTEL: Scan the sector to intercept suspect communications.
• INVESTIGATE FINANCE / LOGISTICS: Monitor syndicate funding channels.
• MOVE TO CONNECTING CENTER: Relocate agents across sector routes.`,
    cardPosition: 'top',
    needsCityOpen: true,
    expandAgent: true
  },
  {
    id: 'FIND_SAFEHOUSE',
    targetSelector: '[data-tour="cia-agent-tasks"]',
    tab: 'TACTICAL',
    title: '4. Critical: Uncover Safehouses First!',
    guidance: `GOLDEN RULE: You cannot attack what you cannot see!
• Enemy safehouses are hidden by default (NONE REVEALED). You cannot launch blind raids.
• Assign an operative to UNCOVER SAFEHOUSE in suspect sectors.
• Once revealed, the hostile safehouse code (#SH-XX EXPOSED) unlocks for combat strike teams!`,
    cardPosition: 'top',
    needsCityOpen: true,
    expandAgent: true
  },
  {
    id: 'AVOID_SWEEPS',
    targetSelector: '[data-tour="cia-safehouse-build"], [data-tour="cia-safehouse-status"]',
    tab: 'TACTICAL',
    title: '5. Detection Heat & Sweep Avoidance',
    guidance: `Hostile forces run security sweeps every turn against operatives in hot sectors!
• Operatives caught in high-heat hostile territory risk capture or elimination.
• HOW TO AVOID SWEEPS: Build a Safehouse ($40K friendly / $100K hostile). Operatives stationed inside a safehouse remain shielded from enemy sweeps!`,
    cardPosition: 'top',
    needsCityOpen: true
  },
  {
    id: 'DRONE_OPERATIONS',
    targetSelector: '[data-tour="cia-drones"]',
    tab: 'TACTICAL',
    title: '6. Drone Recon & Strike Operations',
    guidance: `Airborne drone bases provide long-range force projection:
• RECON MODE: Scans neighboring sectors (1-2 hops away) to expose hidden safehouses without risking field agents.
• ATTACK MODE: Delivers precision airstrikes on revealed targets.
• ⚠️ SAM WARNING: Avoid sectors with Active SAM Air Defense—they will shoot down your drones!`,
    cardPosition: 'top',
    needsCityOpen: true
  },
  {
    id: 'COMBAT_RAIDS',
    targetSelector: '[data-tour="cia-combat-team"]',
    tab: 'TACTICAL',
    title: '7. Tactical Strike Teams & Combat',
    guidance: `Once an enemy safehouse is uncovered and exposed:
• Select your Tactical Team in the Combat Force list.
• Choose the revealed safehouse code (#SH-XX).
• Press LAUNCH COMBAT RAID to breach the safehouse and neutralize targets.
• In border sectors, deploy Transit Checkpoints to trap fleeing suspects!`,
    cardPosition: 'top',
    needsCityOpen: true
  },
  {
    id: 'END_TURN',
    targetSelector: '[data-tour="end-turn-btn"]',
    tab: 'TACTICAL',
    title: '8. Committing Operations (END TURN)',
    guidance: `All movement, drone flights, safehouse builds, and combat orders are staged in your local buffer.
• Review your staged plan in the top status bar.
• When ready, press END TURN to execute operations simultaneously and advance the operational clock!`,
    cardPosition: 'bottom',
    needsCityOpen: false
  }
];

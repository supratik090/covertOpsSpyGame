import { useState, useEffect, useRef } from 'react';
import { Shield, Map, BookOpen, Lightbulb, Users, Search, FolderOpen, Package, Eye } from 'lucide-react';

const VerticalTabBar = ({ activeTab, setActiveTab, clueCount, acceptedCount, hintCount = 0, actionCount, playerRole }) => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // On mobile, MAP, CLUES, GOD_MODE, RESOURCES tabs are not available — redirect to TACTICAL automatically
  useEffect(() => {
    if (isMobile && ['MAP', 'CLUES', 'GOD_MODE', 'RESOURCES'].includes(activeTab)) {
      setActiveTab('TACTICAL');
    }
  }, [isMobile, activeTab, setActiveTab]);

  // Flash animation states when new hint or dossier entry arrives
  const [flashHint, setFlashHint] = useState(false);
  const [flashDossier, setFlashDossier] = useState(false);
  const prevHintCountRef = useRef(hintCount);
  const prevAcceptedCountRef = useRef(acceptedCount);

  useEffect(() => {
    if (hintCount > (prevHintCountRef.current || 0)) {
      setFlashHint(true);
      const timer = setTimeout(() => setFlashHint(false), 4500);
      return () => clearTimeout(timer);
    }
    prevHintCountRef.current = hintCount;
  }, [hintCount]);

  useEffect(() => {
    if (acceptedCount > (prevAcceptedCountRef.current || 0)) {
      setFlashDossier(true);
      const timer = setTimeout(() => setFlashDossier(false), 4500);
      return () => clearTimeout(timer);
    }
    prevAcceptedCountRef.current = acceptedCount;
  }, [acceptedCount]);

  const isAttacker = playerRole === 'ATTACKER';
  let tabs = isAttacker ? [
    { id: 'MAP', label: 'MAP', icon: Map, badge: 0 },
    { id: 'TACTICAL', label: 'TACTICAL', icon: Shield, badge: 0 },
    { id: 'OBJECTIVES', label: 'OBJECTIVES', icon: BookOpen, badge: 0 },
    { id: 'HINTS', label: 'HINTS', icon: Lightbulb, badge: hintCount, flash: flashHint },
    { id: 'CELL_HQ', label: 'CELL HQ', icon: Users, badge: 0 },
    { id: 'CLUES', label: 'CLUES', icon: Search, badge: clueCount },
    { id: 'GOD_MODE', label: 'GOD MODE', icon: Eye, badge: 0 }
  ] : [
    { id: 'MAP', label: 'MAP', icon: Map, badge: 0 },
    { id: 'TACTICAL', label: 'TACTICAL', icon: Shield, badge: 0 },
    { id: 'OBJECTIVES', label: 'OBJECTIVES', icon: BookOpen, badge: 0 },
    { id: 'HINTS', label: 'HINTS', icon: Lightbulb, badge: hintCount, flash: flashHint },
    { id: 'AGENTS', label: 'AGENTS', icon: Users, badge: 0 },
    { id: 'CLUES', label: 'CLUES', icon: Search, badge: clueCount },
    { id: 'DOSSIER', label: 'DOSSIER', icon: FolderOpen, badge: acceptedCount, flash: flashDossier },
    { id: 'RESOURCES', label: 'RESOURCES', icon: Package, badge: 0 },
    { id: 'GOD_MODE', label: 'GOD MODE', icon: Eye, badge: 0 }
  ];

  if (isMobile) {
    tabs = tabs.filter(t => !['MAP', 'CLUES', 'GOD_MODE', 'RESOURCES'].includes(t.id));
  }

  return (
    <div className="vtab-bar">
      <div className="vtab-logo">
        <Shield />
      </div>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <div
            key={tab.id}
            className={`vtab ${isActive ? 'active' : ''} ${tab.flash ? 'flash-update' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <div className="vtab-icon">
              <Icon />
              {tab.badge > 0 && (
                <span className={`vtab-badge ${tab.flash ? 'badge-flash' : ''}`}>
                  {tab.badge}
                </span>
              )}
            </div>
            <div className="vtab-label">{tab.label}</div>
          </div>
        );
      })}
    </div>
  );
};

export default VerticalTabBar;

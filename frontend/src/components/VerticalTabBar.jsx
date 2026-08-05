import { useState, useEffect } from 'react';
import { Shield, Map, BookOpen, Lightbulb, Users, Search, FolderOpen, Package, Eye } from 'lucide-react';

const VerticalTabBar = ({ activeTab, setActiveTab, clueCount, acceptedCount, actionCount, playerRole }) => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // On mobile, MAP tab is not available — redirect to TACTICAL automatically
  useEffect(() => {
    if (isMobile && activeTab === 'MAP') {
      setActiveTab('TACTICAL');
    }
  }, [isMobile, activeTab, setActiveTab]);

  const isAttacker = playerRole === 'ATTACKER';
  let tabs = isAttacker ? [
    { id: 'MAP', label: 'MAP', icon: Map, badge: 0 },
    { id: 'TACTICAL', label: 'TACTICAL', icon: Shield, badge: 0 },
    { id: 'OBJECTIVES', label: 'OBJECTIVES', icon: BookOpen, badge: 0 },
    { id: 'HINTS', label: 'HINTS', icon: Lightbulb, badge: 0 },
    { id: 'CELL_HQ', label: 'CELL HQ', icon: Users, badge: 0 },
    { id: 'CLUES', label: 'CLUES', icon: Search, badge: clueCount },
    { id: 'GOD_MODE', label: 'GOD MODE', icon: Eye, badge: 0 }
  ] : [
    { id: 'MAP', label: 'MAP', icon: Map, badge: 0 },
    { id: 'TACTICAL', label: 'TACTICAL', icon: Shield, badge: 0 },
    { id: 'OBJECTIVES', label: 'OBJECTIVES', icon: BookOpen, badge: 0 },
    { id: 'HINTS', label: 'HINTS', icon: Lightbulb, badge: 0 },
    { id: 'AGENTS', label: 'AGENTS', icon: Users, badge: 0 },
    { id: 'CLUES', label: 'CLUES', icon: Search, badge: clueCount },
    { id: 'DOSSIER', label: 'DOSSIER', icon: FolderOpen, badge: acceptedCount },
    { id: 'RESOURCES', label: 'RESOURCES', icon: Package, badge: 0 },
    { id: 'GOD_MODE', label: 'GOD MODE', icon: Eye, badge: 0 }
  ];

  if (isMobile) {
    tabs = isAttacker
      ? tabs.filter(t => !['MAP'].includes(t.id))
      : tabs.filter(t => !['MAP', 'OBJECTIVES', 'AGENTS', 'RESOURCES'].includes(t.id));
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
            className={`vtab ${isActive ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <div className="vtab-icon">
              <Icon />
              {tab.badge > 0 && <span className="vtab-badge">{tab.badge}</span>}
            </div>
            <div className="vtab-label">{tab.label}</div>
          </div>
        );
      })}
    </div>
  );
};

export default VerticalTabBar;

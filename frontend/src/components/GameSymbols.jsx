import React from 'react';

// =============================================================================
// SAFEHOUSE ICON SYSTEM
// =============================================================================

export function SafehouseIcon({ size = 14, color = '#00f0ff', secure = false, hostile = false, className = '', style = {} }) {
  const c = hostile ? '#ff3b30' : color;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}>
      <polygon points="8,0.5 15.5,7 0.5,7" fill={c} opacity="0.95" />
      <rect x="2" y="7" width="12" height="8.5" fill={c} opacity="0.88" rx="0.8" />
      <rect x="5.5" y="10" width="5" height="5.5" fill="#030712" rx="0.8" />
      {secure && (<circle cx="8" cy="4.5" r="1.6" fill="#030712" stroke="#ffcc00" strokeWidth="1.1" />)}
    </svg>
  );
}

export function HostileSafehouseIcon({ size = 14, secure = false, className = '', style = {} }) {
  return <SafehouseIcon size={size} color="#ff3b30" secure={secure} className={className} style={style} />;
}

export function ExposedSafehouseIcon({ size = 14, secure = false, className = '', style = {} }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }} className={className}>
      <SafehouseIcon size={size} color="#f59e0b" secure={secure} />
      <span style={{ position: 'absolute', top: `${-size * 0.35}px`, right: `${-size * 0.35}px`, fontSize: `${Math.round(size * 0.65)}px`, lineHeight: 1, filter: 'drop-shadow(0 0 3px rgba(245,158,11,0.8))' }}>👁️</span>
    </span>
  );
}

export function safehouseIconHtml({ size = 14, color = '#00f0ff', secure = false, hostile = false } = {}) {
  const c = hostile ? '#ff3b30' : color;
  const lock = secure ? '<circle cx="8" cy="4.5" r="1.6" fill="#030712" stroke="#ffcc00" stroke-width="1.1"/>' : '';
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0"><polygon points="8,0.5 15.5,7 0.5,7" fill="' + c + '" opacity="0.95"/><rect x="2" y="7" width="12" height="8.5" fill="' + c + '" opacity="0.88" rx="0.8"/><rect x="5.5" y="10" width="5" height="5.5" fill="#030712" rx="0.8"/>' + lock + '</svg>';
}

export function safehouseAnimSvgGroup(cx, cy, color, size = 6) {
  const top = cy - size; const bodyY = cy - size * 0.1; const bodyH = size * 1.25;
  const doorX = cx - size * 0.22; const doorW = size * 0.44; const doorY = cy + size * 0.3; const doorH = size * 0.65;
  return [
    '<polygon points="' + cx + ',' + top + ' ' + (cx + size) + ',' + bodyY + ' ' + (cx - size) + ',' + bodyY + '" fill="' + color + '" opacity="0.95"/>',
    '<rect x="' + (cx - size) + '" y="' + bodyY + '" width="' + (size * 2) + '" height="' + bodyH + '" fill="' + color + '" opacity="0.88" rx="0.5"/>',
    '<rect x="' + doorX + '" y="' + doorY + '" width="' + doorW + '" height="' + doorH + '" fill="#030712" rx="0.3"/>',
  ].join('');
}

// =============================================================================
// AGENT ICON — Spy silhouette: fedora hat + trench coat
// =============================================================================

export function AgentIcon({ size = 14, color = '#00f0ff', className = '', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}>
      <rect x="5.2" y="1.5" width="5.6" height="4.2" fill={color} rx="1" />
      <rect x="3" y="5.2" width="10" height="1.4" fill={color} rx="0.4" />
      <rect x="5.2" y="4.8" width="5.6" height="0.8" fill="#030712" opacity="0.45" />
      <circle cx="8" cy="8.8" r="2.1" fill={color} opacity="0.9" />
      <path d="M2.5,16 L3.5,10.5 Q8,8.8 12.5,10.5 L13.5,16 Z" fill={color} opacity="0.85" />
      <line x1="8" y1="10.8" x2="6" y2="14.5" stroke="#030712" strokeWidth="0.75" strokeLinecap="round" />
      <line x1="8" y1="10.8" x2="10" y2="14.5" stroke="#030712" strokeWidth="0.75" strokeLinecap="round" />
    </svg>
  );
}

export function agentIconHtml({ size = 14, color = '#00f0ff' } = {}) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0"><rect x="5.2" y="1.5" width="5.6" height="4.2" fill="' + color + '" rx="1"/><rect x="3" y="5.2" width="10" height="1.4" fill="' + color + '" rx="0.4"/><rect x="5.2" y="4.8" width="5.6" height="0.8" fill="#030712" opacity="0.45"/><circle cx="8" cy="8.8" r="2.1" fill="' + color + '" opacity="0.9"/><path d="M2.5,16 L3.5,10.5 Q8,8.8 12.5,10.5 L13.5,16 Z" fill="' + color + '" opacity="0.85"/><line x1="8" y1="10.8" x2="6" y2="14.5" stroke="#030712" stroke-width="0.75" stroke-linecap="round"/><line x1="8" y1="10.8" x2="10" y2="14.5" stroke="#030712" stroke-width="0.75" stroke-linecap="round"/></svg>';
}

export function agentAnimSvgGroup(cx, cy, color, size = 7) {
  const s = size;
  return '<rect x="' + (cx - s*0.35) + '" y="' + (cy - s*1.15) + '" width="' + (s*0.7) + '" height="' + (s*0.53) + '" fill="' + color + '" rx="' + (s*0.07) + '"/>' +
    '<rect x="' + (cx - s*0.625) + '" y="' + (cy - s*0.67) + '" width="' + (s*1.25) + '" height="' + (s*0.175) + '" fill="' + color + '" rx="' + (s*0.025) + '"/>' +
    '<circle cx="' + cx + '" cy="' + (cy - s*0.15) + '" r="' + (s*0.26) + '" fill="' + color + '" opacity="0.9"/>' +
    '<path d="M' + (cx - s*0.6) + ',' + (cy + s*0.5) + ' L' + (cx - s*0.44) + ',' + (cy + s*0.06) + ' Q' + cx + ',' + (cy - s*0.1) + ' ' + (cx + s*0.44) + ',' + (cy + s*0.06) + ' L' + (cx + s*0.6) + ',' + (cy + s*0.5) + ' Z" fill="' + color + '" opacity="0.85"/>';
}

// =============================================================================
// COMBAT TEAM ICON — Tactical shield with crosshair sight
// =============================================================================

export function CombatTeamIcon({ size = 14, color = '#ff3b30', className = '', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}>
      {/* Upper chevron */}
      <path d="M1.5,5.5 L8,1.5 L14.5,5.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Lower chevron */}
      <path d="M1.5,9.5 L8,5.5 L14.5,9.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Base bar */}
      <rect x="3" y="11.5" width="10" height="2" fill={color} rx="0.5" opacity="0.85" />
    </svg>
  );
}

export function combatTeamIconHtml({ size = 14, color = '#ff3b30' } = {}) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M1.5,5.5 L8,1.5 L14.5,5.5" stroke="' + color + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M1.5,9.5 L8,5.5 L14.5,9.5" stroke="' + color + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><rect x="3" y="11.5" width="10" height="2" fill="' + color + '" rx="0.5" opacity="0.85"/></svg>';
}

export function combatTeamAnimSvgGroup(cx, cy, color, size = 7) {
  const s = size;
  return '<path d="M' + cx + ',' + (cy - s) + ' L' + (cx + s) + ',' + (cy - s*0.36) + ' L' + (cx + s) + ',' + (cy + s*0.12) + ' Q' + (cx + s) + ',' + (cy + s*0.88) + ' ' + cx + ',' + (cy + s) + ' Q' + (cx - s) + ',' + (cy + s*0.88) + ' ' + (cx - s) + ',' + (cy + s*0.12) + ' L' + (cx - s) + ',' + (cy - s*0.36) + ' Z" fill="' + color + '" opacity="0.9"/>' +
    '<path d="M' + cx + ',' + (cy - s*0.75) + ' L' + (cx + s*0.64) + ',' + (cy - s*0.25) + ' L' + (cx + s*0.64) + ',' + (cy + s*0.12) + ' Q' + (cx + s*0.64) + ',' + (cy + s*0.62) + ' ' + cx + ',' + (cy + s*0.73) + ' Q' + (cx - s*0.64) + ',' + (cy + s*0.62) + ' ' + (cx - s*0.64) + ',' + (cy + s*0.12) + ' L' + (cx - s*0.64) + ',' + (cy - s*0.25) + ' Z" fill="#030712"/>' +
    '<line x1="' + cx + '" y1="' + (cy - s*0.5) + '" x2="' + cx + '" y2="' + (cy + s*0.5) + '" stroke="' + color + '" stroke-width="' + (s*0.1) + '"/>' +
    '<line x1="' + (cx - s*0.5) + '" y1="' + cy + '" x2="' + (cx + s*0.5) + '" y2="' + cy + '" stroke="' + color + '" stroke-width="' + (s*0.1) + '"/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + (s*0.17) + '" fill="' + color + '"/>';
}

// =============================================================================
// DRONE ICON — Fixed-wing military UAV top-down view
// =============================================================================

export function DroneIcon({ size = 14, color = '#10b981', className = '', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}>
      <ellipse cx="8" cy="8" rx="1.3" ry="5.8" fill={color} opacity="0.95" />
      <path d="M8,7 L1,11.5 L2.2,12.8 L8,9.2 L13.8,12.8 L15,11.5 Z" fill={color} opacity="0.85" />
      <path d="M7.1,13.8 L5,15.5 L6.2,15.5 L8,14.2 L9.8,15.5 L11,15.5 L8.9,13.8 Z" fill={color} opacity="0.8" />
      <ellipse cx="8" cy="2.3" rx="0.9" ry="1.4" fill={color} />
      <circle cx="8" cy="7.8" r="1.4" fill="#030712" stroke={color} strokeWidth="0.7" />
      <circle cx="8" cy="7.8" r="0.55" fill={color} />
    </svg>
  );
}

export function droneIconHtml({ size = 14, color = '#10b981' } = {}) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0"><ellipse cx="8" cy="8" rx="1.3" ry="5.8" fill="' + color + '" opacity="0.95"/><path d="M8,7 L1,11.5 L2.2,12.8 L8,9.2 L13.8,12.8 L15,11.5 Z" fill="' + color + '" opacity="0.85"/><path d="M7.1,13.8 L5,15.5 L6.2,15.5 L8,14.2 L9.8,15.5 L11,15.5 L8.9,13.8 Z" fill="' + color + '" opacity="0.8"/><ellipse cx="8" cy="2.3" rx="0.9" ry="1.4" fill="' + color + '"/><circle cx="8" cy="7.8" r="1.4" fill="#030712" stroke="' + color + '" stroke-width="0.7"/><circle cx="8" cy="7.8" r="0.55" fill="' + color + '"/></svg>';
}

// =============================================================================
// DRONE BASE ICON — Military airfield: runway cross + radar dish
// =============================================================================

export function DroneBaseIcon({ size = 14, color = '#00f0ff', className = '', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}>
      <rect x="1" y="12.5" width="14" height="2" fill={color} opacity="0.65" rx="0.5" />
      <rect x="7" y="6" width="2" height="7" fill={color} opacity="0.9" />
      <rect x="2" y="8.8" width="12" height="1.8" fill={color} opacity="0.75" />
      <rect x="7.55" y="6.5" width="0.9" height="1.2" fill="#030712" />
      <rect x="7.55" y="9.2" width="0.9" height="1.2" fill="#030712" />
      <path d="M5,6 Q8,3 11,6" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <line x1="8" y1="5.8" x2="8" y2="7" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <circle cx="8" cy="3.5" r="1.3" fill="#030712" stroke={color} strokeWidth="1" />
      <circle cx="8" cy="3.5" r="0.55" fill={color} />
    </svg>
  );
}

export function droneBaseIconHtml({ size = 14, color = '#00f0ff' } = {}) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0"><rect x="1" y="12.5" width="14" height="2" fill="' + color + '" opacity="0.65" rx="0.5"/><rect x="7" y="6" width="2" height="7" fill="' + color + '" opacity="0.9"/><rect x="2" y="8.8" width="12" height="1.8" fill="' + color + '" opacity="0.75"/><rect x="7.55" y="6.5" width="0.9" height="1.2" fill="#030712"/><rect x="7.55" y="9.2" width="0.9" height="1.2" fill="#030712"/><path d="M5,6 Q8,3 11,6" stroke="' + color + '" stroke-width="1.4" fill="none" stroke-linecap="round"/><line x1="8" y1="5.8" x2="8" y2="7" stroke="' + color + '" stroke-width="1" stroke-linecap="round"/><circle cx="8" cy="3.5" r="1.3" fill="#030712" stroke="' + color + '" stroke-width="1"/><circle cx="8" cy="3.5" r="0.55" fill="' + color + '"/></svg>';
}

// =============================================================================
// TECH ICON REGISTRY
// =============================================================================

export const TECH_ICONS = {
  CCTV:            { emoji: '📹', label: 'CCTV Monitor' },
  WIRE_TAP:        { emoji: '🔍', label: 'Wire Tap' },
  PHONE_TAP:       { emoji: '📞', label: 'Phone Tap' },
  SATELLITE:       { emoji: '🛰️', label: 'Satellite View' },
  FINANCE_MONITOR: { emoji: '💰', label: 'Finance Monitor' },
  BIOMETRIC_SCAN:  { emoji: '🔴', label: 'Biometric Scan' },
  BORDER_GUARD:    { emoji: '🚧', label: 'Border Guard' },
  SIGNAL_JAMMER:   { emoji: '📡', label: 'Signal Jammer' },
  ATTACKER_JAMMER: { emoji: '⚡', label: 'Jammer' },
};

export function getTechEmoji(type) {
  return (TECH_ICONS[type] || { emoji: '🛰️' }).emoji;
}

export function TechIcon({ type, size = 14 }) {
  const info = TECH_ICONS[type] || { emoji: '🛰️', label: type };
  return <span style={{ fontSize: size + 'px' }} title={info.label}>{info.emoji}</span>;
}

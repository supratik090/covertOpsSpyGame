import React from 'react';

// =============================================================================
// SAFEHOUSE ICON SYSTEM — Single source of truth for all game views
// =============================================================================

/**
 * SafehouseIcon — Custom tactical bunker SVG symbol.
 * Renders a house-with-roof shape as a tactical safehouse marker.
 * Used in: CIAIntelBox, EndTurnReportModal, Tactical View city markers.
 */
export function SafehouseIcon({ size = 14, color = '#00f0ff', secure = false, hostile = false, className = '', style = {} }) {
  const c = hostile ? '#ff3b30' : color;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      {/* House roof triangle */}
      <polygon points="8,0.5 15.5,7 0.5,7" fill={c} opacity="0.95" />
      {/* House body */}
      <rect x="2" y="7" width="12" height="8.5" fill={c} opacity="0.88" rx="0.8" />
      {/* Door cutout */}
      <rect x="5.5" y="10" width="5" height="5.5" fill="#030712" rx="0.8" />
      {/* Secure padlock ring at peak */}
      {secure && (
        <circle cx="8" cy="4.5" r="1.6" fill="#030712" stroke="#ffcc00" strokeWidth="1.1" />
      )}
    </svg>
  );
}

/** Hostile safehouse variant (red) */
export function HostileSafehouseIcon({ size = 14, secure = false, className = '', style = {} }) {
  return <SafehouseIcon size={size} color="#ff3b30" secure={secure} className={className} style={style} />;
}

/** Exposed hostile safehouse — amber icon + eye badge */
export function ExposedSafehouseIcon({ size = 14, secure = false, className = '', style = {} }) {
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
      className={className}
    >
      <SafehouseIcon size={size} color="#f59e0b" secure={secure} />
      <span
        style={{
          position: 'absolute',
          top: `${-size * 0.35}px`,
          right: `${-size * 0.35}px`,
          fontSize: `${Math.round(size * 0.65)}px`,
          lineHeight: 1,
          filter: 'drop-shadow(0 0 3px rgba(245,158,11,0.8))'
        }}
      >👁️</span>
    </span>
  );
}

// =============================================================================
// HTML STRING VERSIONS — for Leaflet divIcon markers (innerHTML only)
// =============================================================================

/**
 * Returns an inline SVG HTML string for use in Leaflet marker HTML.
 */
export function safehouseIconHtml({ size = 14, color = '#00f0ff', secure = false, hostile = false } = {}) {
  const c = hostile ? '#ff3b30' : color;
  const lock = secure
    ? `<circle cx="8" cy="4.5" r="1.6" fill="#030712" stroke="#ffcc00" stroke-width="1.1"/>`
    : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0"><polygon points="8,0.5 15.5,7 0.5,7" fill="${c}" opacity="0.95"/><rect x="2" y="7" width="12" height="8.5" fill="${c}" opacity="0.88" rx="0.8"/><rect x="5.5" y="10" width="5" height="5.5" fill="#030712" rx="0.8"/>${lock}</svg>`;
}

/**
 * Returns raw SVG element strings for embedding inside an <svg> parent in the animation overlay.
 * Used by renderAnimationsSVG to draw an animated safehouse icon at a specific coordinate.
 */
export function safehouseAnimSvgGroup(cx, cy, color, size = 6) {
  const top = cy - size;
  const bodyY = cy - size * 0.1;
  const bodyH = size * 1.25;
  const doorX = cx - size * 0.22;
  const doorW = size * 0.44;
  const doorY = cy + size * 0.3;
  const doorH = size * 0.65;
  return [
    `<polygon points="${cx},${top} ${cx + size},${bodyY} ${cx - size},${bodyY}" fill="${color}" opacity="0.95"/>`,
    `<rect x="${cx - size}" y="${bodyY}" width="${size * 2}" height="${bodyH}" fill="${color}" opacity="0.88" rx="0.5"/>`,
    `<rect x="${doorX}" y="${doorY}" width="${doorW}" height="${doorH}" fill="#030712" rx="0.3"/>`,
  ].join('');
}

// =============================================================================
// DRONE & DRONE BASE ICON SYSTEM — Single source of truth for drone assets
// =============================================================================

/**
 * DroneBaseIcon — Custom military airbase & radar hangar SVG symbol.
 */
export function DroneBaseIcon({ size = 14, color = '#00f0ff', className = '', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <rect x="1" y="13" width="14" height="2" fill={color} opacity="0.9" rx="0.5" />
      <path d="M2 13L4.5 5.5H11.5L14 13H2Z" fill={color} opacity="0.8" />
      <circle cx="8" cy="3.5" r="2" fill="#030712" stroke={color} strokeWidth="1.2" />
      <circle cx="8" cy="3.5" r="0.7" fill={color} />
      <path d="M6 13V9C6 8.2 6.9 7.5 8 7.5C9.1 7.5 10 8.2 10 9V13H6Z" fill="#030712" />
    </svg>
  );
}

/**
 * DroneIcon — Custom tactical stealth quadcopter SVG symbol.
 */
export function DroneIcon({ size = 14, color = '#10b981', className = '', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <line x1="2.5" y1="2.5" x2="13.5" y2="13.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
      <line x1="13.5" y1="2.5" x2="2.5" y2="13.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
      <circle cx="2.5" cy="2.5" r="1.8" fill="#030712" stroke={color} strokeWidth="0.9" />
      <circle cx="13.5" cy="2.5" r="1.8" fill="#030712" stroke={color} strokeWidth="0.9" />
      <circle cx="2.5" cy="13.5" r="1.8" fill="#030712" stroke={color} strokeWidth="0.9" />
      <circle cx="13.5" cy="13.5" r="1.8" fill="#030712" stroke={color} strokeWidth="0.9" />
      <polygon points="8,3.5 11.5,8 8,12.5 4.5,8" fill={color} opacity="0.95" />
      <circle cx="8" cy="8" r="1.3" fill="#030712" stroke="#00f0ff" strokeWidth="0.8" />
    </svg>
  );
}

/** HTML string helpers for Leaflet map markers */
export function droneBaseIconHtml({ size = 14, color = '#00f0ff' } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0"><rect x="1" y="13" width="14" height="2" fill="${color}" opacity="0.9" rx="0.5"/><path d="M2 13L4.5 5.5H11.5L14 13H2Z" fill="${color}" opacity="0.8"/><circle cx="8" cy="3.5" r="2" fill="#030712" stroke="${color}" stroke-width="1.2"/><circle cx="8" cy="3.5" r="0.7" fill="${color}"/><path d="M6 13V9C6 8.2 6.9 7.5 8 7.5C9.1 7.5 10 8.2 10 9V13H6Z" fill="#030712"/></svg>`;
}

export function droneIconHtml({ size = 14, color = '#10b981' } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0"><line x1="2.5" y1="2.5" x2="13.5" y2="13.5" stroke="${color}" stroke-width="1.3" stroke-linecap="round" opacity="0.85"/><line x1="13.5" y1="2.5" x2="2.5" y2="13.5" stroke="${color}" stroke-width="1.3" stroke-linecap="round" opacity="0.85"/><circle cx="2.5" cy="2.5" r="1.8" fill="#030712" stroke="${color}" stroke-width="0.9"/><circle cx="13.5" cy="2.5" r="1.8" fill="${color}" stroke-width="0.9"/><circle cx="2.5" cy="13.5" r="1.8" fill="#030712" stroke="${color}" stroke-width="0.9"/><circle cx="13.5" cy="13.5" r="1.8" fill="#030712" stroke="${color}" stroke-width="0.9"/><polygon points="8,3.5 11.5,8 8,12.5 4.5,8" fill="${color}" opacity="0.95"/><circle cx="8" cy="8" r="1.3" fill="#030712" stroke="#00f0ff" stroke-width="0.8"/></svg>`;
}

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
  return <span style={{ fontSize: `${size}px` }} title={info.label}>{info.emoji}</span>;
}

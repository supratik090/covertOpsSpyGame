import React from 'react';

const CityNode = ({
  cityId,
  coords,
  isFriendly,
  isTarget,
  hasSafehouse,
  agentsCount,
  teamsCount,
  techCount,
  isSelected,
  isSweptZone,
  onClick
}) => {
  const { x, y } = coords;
  const strokeColor = isSweptZone ? '#ff0040' : (isFriendly ? '#00f0ff' : '#ff3b30');
  const fillColor = isSweptZone ? 'rgba(255,0,64,0.25)' : (isFriendly ? 'rgba(0,240,255,0.2)' : 'rgba(255,59,48,0.2)');
  const innerFill = isTarget ? '#ffd700' : fillColor;

  return (
    <g 
      transform={`translate(${x}, ${y})`} 
      onClick={() => onClick(cityId)}
      className="city-node"
      style={{ cursor: 'pointer' }}
    >
      {/* Sweep zone outer pulsing ring */}
      {isSweptZone && (
        <>
          <circle
            r="32"
            fill="none"
            stroke="#ff0040"
            strokeWidth="1.5"
            opacity="0.4"
            strokeDasharray="4 3"
            className="sweep-ring"
          />
          <circle
            r="26"
            fill="rgba(255,0,64,0.08)"
            stroke="#ff0040"
            strokeWidth="2"
            opacity="0.7"
            className="sweep-ring-inner"
          />
        </>
      )}

      <circle 
        r="22" 
        fill="none" 
        stroke={strokeColor} 
        strokeWidth={isSelected ? "2" : "1"}
        opacity={isSelected ? "1" : "0.5"}
        className="city-node-ring"
      />
      
      <circle 
        r="12" 
        fill={innerFill} 
        stroke={strokeColor} 
        strokeWidth="2"
      />
      
      {hasSafehouse && (
        <path 
          d="M -5,-15 L 0,-20 L 5,-15 L 5,-8 C 5,-4 0,0 0,0 C 0,0 -5,-4 -5,-8 Z" 
          fill="#00f0ff" 
          stroke="#000"
          strokeWidth="1"
        />
      )}
      
      {agentsCount > 0 && (
        <g transform="translate(-15, -15)">
          <circle r="6" fill="#00f0ff" />
          <text x="0" y="3" fontSize="8" fill="#000" textAnchor="middle" fontWeight="bold">
            {agentsCount}
          </text>
        </g>
      )}
      
      {teamsCount > 0 && (
        <g transform="translate(15, -15)">
          <circle r="6" fill="#ff3b30" />
          <text x="0" y="3" fontSize="8" fill="#fff" textAnchor="middle" fontWeight="bold">
            {teamsCount}
          </text>
        </g>
      )}
      
      {techCount > 0 && (
        <circle cx="0" cy="18" r="4" fill="#ffb300" />
      )}

      {/* Sweep zone warning label */}
      {isSweptZone && (
        <text
          x="0"
          y="-30"
          fontSize="7"
          fill="#ff0040"
          textAnchor="middle"
          fontFamily="monospace"
          fontWeight="bold"
        >
          ⚠ SWEEP ZONE
        </text>
      )}
      
      <text 
        x="0" 
        y="32" 
        fontSize="9" 
        fill={isSelected ? '#00f0ff' : (isSweptZone ? '#ff0040' : '#888')} 
        textAnchor="middle"
        fontFamily="monospace"
        textTransform="uppercase"
        fontWeight={isSelected ? 'bold' : 'normal'}
      >
        {cityId.replace('_', ' ')}
      </text>
    </g>
  );
};

export default CityNode;

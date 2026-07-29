import React from 'react';

const MapGeography = () => {
  return (
    <g>
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
        </pattern>
      </defs>
      
      {/* Grid */}
      <rect width="1000" height="800" fill="url(#grid)" />
      
      {/* Pakistan Territory */}
      <polygon 
        points="50,680 280,700 350,680 380,580 600,350 650,280 665,200 660,120 650,80 540,40 400,50 200,80 80,200 50,400" 
        fill="rgba(255,59,48,0.04)" 
      />
      
      {/* India Territory */}
      <polygon 
        points="380,580 600,350 650,280 665,200 660,120 680,80 750,50 900,50 950,100 950,750 700,750 500,700" 
        fill="rgba(0,240,255,0.04)" 
      />
      
      {/* International Border / LoC */}
      <polyline 
        points="350,700 380,580 600,350 650,280 665,200 660,120" 
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="2"
        strokeDasharray="5,5"
      />
      
      {/* Mountain Ridges */}
      <path d="M 500,80 Q 550,60 600,90" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
      <path d="M 520,100 Q 580,80 640,110" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
      <path d="M 580,50 Q 620,40 680,70" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
    </g>
  );
};

export default MapGeography;

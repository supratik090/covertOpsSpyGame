import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, Play, X, Crosshair } from 'lucide-react';
import TourCard from './TourCard';
import { MOBILE_TOUR_STEPS } from './tourStepsMobile';
import './SpotlightTour.css';

export default function SpotlightTour({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  selectedCityNode,
  setSelectedCityNode,
  session,
  nodesData = []
}) {
  const [isPrompting, setIsPrompting] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const animationFrameRef = useRef(null);

  const currentStep = MOBILE_TOUR_STEPS[stepIndex];

  // Helper to find a suitable starting friendly city with an agent if possible
  const getStartingCity = useCallback(() => {
    if (session?.agents?.length > 0) {
      const firstAgentCity = session.agents[0].currentCity;
      if (firstAgentCity) return firstAgentCity;
    }
    const homeNode = nodesData.find(n => n.territory === 'HOME_TERRITORY');
    if (homeNode) return homeNode.id;
    return 'srinagar';
  }, [session, nodesData]);

  // Handle step setup (tab switches, opening CIA box, finding targets)
  useEffect(() => {
    if (!isOpen || isPrompting) return;

    if (currentStep) {
      // 1. Ensure tab is correct
      if (currentStep.tab && activeTab !== currentStep.tab) {
        setActiveTab?.(currentStep.tab);
      }

      // 2. Ensure city node is open for CIA box inspection if step requires it
      if (currentStep.needsCityOpen && !selectedCityNode) {
        const startCity = getStartingCity();
        setSelectedCityNode?.(startCity);
      }

      // 3. Measure target element bounding box
      const updateRect = () => {
        if (!currentStep.targetSelector) {
          setTargetRect(null);
          return;
        }

        const el = document.querySelector(currentStep.targetSelector);
        if (el) {
          const rect = el.getBoundingClientRect();
          // Scroll into view if offscreen or partially offscreen
          if (rect.top < 0 || rect.bottom > window.innerHeight) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          setTargetRect({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          });
        } else {
          setTargetRect(null);
        }
      };

      // Delay measurement slightly to allow DOM/drawer animations to stabilize
      const timer = setTimeout(updateRect, 300);
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect, true);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect, true);
      };
    }
  }, [isOpen, isPrompting, stepIndex, currentStep, activeTab, selectedCityNode, setActiveTab, setSelectedCityNode, getStartingCity]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleDismiss();
      } else if (e.key === 'ArrowRight' && !isPrompting) {
        handleNext();
      } else if (e.key === 'ArrowLeft' && !isPrompting) {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPrompting, stepIndex]);

  const handleStartTour = () => {
    setIsPrompting(false);
    setStepIndex(0);
  };

  const handleNext = () => {
    if (stepIndex < MOBILE_TOUR_STEPS.length - 1) {
      setStepIndex(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) {
      setStepIndex(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem('covert_ops_mobile_tour_v1', 'completed');
    } catch (e) {
      console.warn("Could not save tour state to localStorage", e);
    }
    onClose?.();
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem('covert_ops_mobile_tour_v1', 'dismissed');
    } catch (e) {
      console.warn("Could not save tour state to localStorage", e);
    }
    onClose?.();
  };

  if (!isOpen) return null;

  // Render initial Opt-In Welcome Modal
  if (isPrompting) {
    return (
      <div className="tour-modal-overlay animate-fade-in">
        <div className="tour-prompt-panel cyber-panel">
          <div className="tour-prompt-header">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-cyan animate-pulse" />
              <span className="font-mono text-cyan font-bold tracking-wider text-xs">
                SECURE DISPATCH // LEVEL-4
              </span>
            </div>
            <button className="tour-close-btn" onClick={handleDismiss} title="Dismiss">
              <X size={18} />
            </button>
          </div>

          <div className="tour-prompt-body font-mono">
            <h3 className="text-cyber font-bold text-base mb-2">
              COMMANDER FIELD INDUCTION
            </h3>
            <p className="text-dim text-xs mb-3 leading-relaxed">
              First-time deployment detected on Android. Would you like a brief tactical tour covering essential field operations?
            </p>

            <div className="tour-prompt-highlights text-xs">
              <div className="highlight-item">
                <span className="text-cyan">✓</span>
                <span>Moving operatives and assigning task directives</span>
              </div>
              <div className="highlight-item">
                <span className="text-cyan">✓</span>
                <span>Uncovering enemy safehouses before launching raids</span>
              </div>
              <div className="highlight-item">
                <span className="text-cyan">✓</span>
                <span>Avoiding hostile security sweeps using safehouses</span>
              </div>
              <div className="highlight-item">
                <span className="text-cyan">✓</span>
                <span>Recon and strike missions with drone aviation</span>
              </div>
            </div>
          </div>

          <div className="tour-prompt-footer">
            <button className="cyber-btn sm red" onClick={handleDismiss}>
              SKIP BRIEFING
            </button>
            <button className="cyber-btn sm cyan font-bold" onClick={handleStartTour}>
              <Play size={14} className="mr-1 fill-current" />
              START TOUR (60s)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const padding = 6;

  return (
    <div className="spotlight-tour-overlay">
      {/* SVG Spotlight Mask */}
      <svg className="spotlight-svg-mask" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="spotlight-cutout-mask">
            {/* White background reveals the dark overlay */}
            <rect width="100%" height="100%" fill="white" />
            {/* Black hole cuts out the target spotlight */}
            {targetRect && (
              <rect
                x={Math.max(0, targetRect.x - padding)}
                y={Math.max(0, targetRect.y - padding)}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="6"
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* Semi-transparent dark overlay */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(6, 11, 20, 0.78)"
          mask="url(#spotlight-cutout-mask)"
        />
      </svg>

      {/* Target Reticle Borders & Corner Pips */}
      {targetRect && (
        <div
          className="spotlight-target-reticle"
          style={{
            left: Math.max(0, targetRect.x - padding),
            top: Math.max(0, targetRect.y - padding),
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2
          }}
        >
          <div className="reticle-corner top-left" />
          <div className="reticle-corner top-right" />
          <div className="reticle-corner bottom-left" />
          <div className="reticle-corner bottom-right" />
        </div>
      )}

      {/* Interactive Guidance Card */}
      <TourCard
        step={currentStep}
        stepIndex={stepIndex}
        totalSteps={MOBILE_TOUR_STEPS.length}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleDismiss}
        position={currentStep.cardPosition}
      />
    </div>
  );
}

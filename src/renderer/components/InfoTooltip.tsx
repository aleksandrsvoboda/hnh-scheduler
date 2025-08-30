import React, { useState, useRef, useEffect } from 'react';

interface InfoTooltipProps {
  text: string;
  className?: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && containerRef.current && tooltipRef.current) {
      const container = containerRef.current;
      const tooltip = tooltipRef.current;
      const containerRect = container.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Calculate position above the container
      let top = containerRect.top - tooltipRect.height - 8;
      let left = containerRect.left + (containerRect.width / 2) - (tooltipRect.width / 2);
      
      // Adjust if tooltip goes off the right edge
      if (left + tooltipRect.width > viewportWidth - 20) {
        left = viewportWidth - tooltipRect.width - 20;
      }
      
      // Adjust if tooltip goes off the left edge
      if (left < 20) {
        left = 20;
      }
      
      // If tooltip goes off the top, show it below instead
      if (top < 20) {
        top = containerRect.bottom + 8;
      }
      
      setPosition({ top, left });
    }
  }, [isVisible, text]);

  return (
    <div 
      ref={containerRef}
      className={`info-tooltip ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <span className="info-icon">?</span>
      {isVisible && (
        <div 
          ref={tooltipRef}
          className="tooltip-content"
          style={{
            top: position.top,
            left: position.left,
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;
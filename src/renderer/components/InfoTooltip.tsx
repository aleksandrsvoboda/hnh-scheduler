import React, { useState, useRef, useEffect } from 'react';

interface InfoTooltipProps {
  text: string;
  className?: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ left: '50%', transform: 'translateX(-50%)' });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const tooltip = tooltipRef.current;
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      const windowWidth = window.innerWidth;
      const rightEdge = tooltipRect.right;
      const leftEdge = tooltipRect.left;
      
      // Always position tooltip to extend to the left to avoid column constraints
      setPosition({ 
        left: 'auto', 
        right: '0',
        transform: 'none'
      });
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
            left: position.left,
            right: position.right,
            transform: position.transform
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;
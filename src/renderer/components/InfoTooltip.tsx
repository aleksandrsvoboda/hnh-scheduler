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
      
      const windowWidth = window.innerWidth;
      const tooltipWidth = 280; // Our fixed tooltip width
      
      // Check if we're in a table context (has more constrained space)
      const isInTable = container.closest('table') !== null;
      
      if (isInTable) {
        // In table: always position to the left to avoid column issues
        setPosition({ 
          left: 'auto', 
          right: '0',
          transform: 'none'
        });
      } else {
        // Outside table: calculate actual available space accounting for sidebar
        const sidebar = document.querySelector('.sidebar');
        const sidebarWidth = sidebar ? sidebar.getBoundingClientRect().width : 0;
        const leftBoundary = sidebarWidth + 20; // sidebar + gap
        
        const spaceOnLeft = containerRect.left - leftBoundary;
        const spaceOnRight = windowWidth - containerRect.right - 20; // window edge buffer
        
        if (spaceOnRight >= tooltipWidth) {
          // Enough space on right - extend rightward
          setPosition({ 
            left: '0', 
            transform: 'none'
          });
        } else if (spaceOnLeft >= tooltipWidth) {
          // Enough space on left - extend leftward  
          setPosition({ 
            left: 'auto', 
            right: '0',
            transform: 'none'
          });
        } else {
          // Not enough space either way - default to right
          setPosition({ 
            left: '0', 
            transform: 'none'
          });
        }
      }
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
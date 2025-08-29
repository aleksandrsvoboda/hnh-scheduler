import React, { useState } from 'react';

interface InfoTooltipProps {
  text: string;
  className?: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className={`info-tooltip ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <span className="info-icon">?</span>
      {isVisible && (
        <div className="tooltip-content">
          {text}
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;
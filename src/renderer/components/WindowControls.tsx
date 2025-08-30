import React from 'react';

const WindowControls: React.FC = () => {
  const handleMinimize = () => {
    window.api.app.minimizeWindow();
  };

  const handleMaximize = () => {
    window.api.app.toggleMaximizeWindow();
  };

  const handleClose = () => {
    window.api.app.closeWindow();
  };

  return (
    <div className="window-controls">
      <button className="window-control minimize" onClick={handleMinimize} title="Minimize">
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button className="window-control maximize" onClick={handleMaximize} title="Maximize">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect x="1" y="1" width="8" height="8" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      </button>
      <button className="window-control close" onClick={handleClose} title="Close">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1" />
          <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  );
};

export default WindowControls;
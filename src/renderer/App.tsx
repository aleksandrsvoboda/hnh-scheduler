import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import Schedules from './components/Schedules';
import ScenarioLibrary from './components/ScenarioLibrary';
import CharactersCredentials from './components/CharactersCredentials';
import RunHistory from './components/RunHistory';
import Settings from './components/Settings';
import WindowControls from './components/WindowControls';

type Screen = 'dashboard' | 'schedules' | 'scenarios' | 'characters' | 'history' | 'settings';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard />;
      case 'schedules':
        return <Schedules />;
      case 'scenarios':
        return <ScenarioLibrary />;
      case 'characters':
        return <CharactersCredentials />;
      case 'history':
        return <RunHistory />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  const isWindows = navigator.userAgent.indexOf('Windows') !== -1;

  return (
    <div className="app">
      <div className="header-container">
        {isWindows && (
          <div className="title-bar">
            <div className="title-bar-drag-area"></div>
            <WindowControls />
          </div>
        )}
        <nav className="nav">
          <div 
            className={`nav-item ${currentScreen === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('dashboard')}
          >
            Dashboard
          </div>
          <div 
            className={`nav-item ${currentScreen === 'schedules' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('schedules')}
          >
            Schedules
          </div>
          <div 
            className={`nav-item ${currentScreen === 'scenarios' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('scenarios')}
          >
            Scenario Library
          </div>
          <div 
            className={`nav-item ${currentScreen === 'characters' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('characters')}
          >
            Characters & Credentials
          </div>
          <div 
            className={`nav-item ${currentScreen === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('history')}
          >
            Run History
          </div>
          <div 
            className={`nav-item ${currentScreen === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('settings')}
          >
            Settings
          </div>
        </nav>
      </div>
      
      <main className="main-content">
        <div className="content-area">
          {renderScreen()}
        </div>
      </main>
    </div>
  );
};

export default App;
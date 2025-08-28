import React, { useState } from 'react';
import { UpcomingRun, Character, Scenario, Schedule } from '../types';

interface ScheduleGridProps {
  upcomingRuns: UpcomingRun[];
  characters: Character[];
  scenarios: Scenario[];
  schedules: Schedule[];
}

const ScheduleGrid: React.FC<ScheduleGridProps> = ({ upcomingRuns, characters, scenarios, schedules }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const getCharacterName = (characterId: string) => {
    const character = characters.find(c => c.id === characterId);
    return character?.name || characterId;
  };

  const getScenarioName = (scenarioId: number) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    return scenario?.name || `Scenario ${scenarioId}`;
  };

  const getRunDuration = (scheduleId: string, entryId: string) => {
    // Find the schedule and entry to get duration
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return null;
    
    // Extract the original entry ID (remove the -0, -1, etc. suffix we added)
    const originalEntryId = entryId.replace(/-\d+$/, '');
    const entry = schedule.entries.find(e => e.id === originalEntryId);
    if (!entry) return null;
    
    return entry.maxDurationMs;
  };

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const getScenarioColor = (scenarioId: number): { background: string; text: string } => {
    // Generate consistent colors based on scenario ID
    const colors = [
      { background: 'linear-gradient(135deg, #3498db, #2980b9)', text: '#ffffff' }, // Blue
      { background: 'linear-gradient(135deg, #e74c3c, #c0392b)', text: '#ffffff' }, // Red
      { background: 'linear-gradient(135deg, #27ae60, #229954)', text: '#ffffff' }, // Green
      { background: 'linear-gradient(135deg, #f39c12, #e67e22)', text: '#ffffff' }, // Orange
      { background: 'linear-gradient(135deg, #9b59b6, #8e44ad)', text: '#ffffff' }, // Purple
      { background: 'linear-gradient(135deg, #1abc9c, #16a085)', text: '#ffffff' }, // Teal
      { background: 'linear-gradient(135deg, #34495e, #2c3e50)', text: '#ffffff' }, // Dark
      { background: 'linear-gradient(135deg, #e91e63, #ad1457)', text: '#ffffff' }, // Pink
      { background: 'linear-gradient(135deg, #ff9800, #f57c00)', text: '#ffffff' }, // Amber
      { background: 'linear-gradient(135deg, #607d8b, #455a64)', text: '#ffffff' }, // Blue Grey
    ];
    
    return colors[scenarioId % colors.length];
  };

  // Get the next 24 hours
  const now = new Date();
  const startOfHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  const endOf24Hours = new Date(startOfHour);
  endOf24Hours.setHours(endOf24Hours.getHours() + 24);
  
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(startOfHour);
    hour.setHours(hour.getHours() + i);
    return hour;
  });

  // Filter runs to only include those within the next 24 hours
  const next24HourRuns = upcomingRuns.filter(run => {
    const runTime = new Date(run.nextRunAt);
    return runTime >= startOfHour && runTime < endOf24Hours;
  });

  // Get unique scenarios and create column mapping
  const uniqueScenarios = Array.from(new Set(next24HourRuns.map(run => run.scenarioId)))
    .sort((a, b) => a - b); // Sort by scenario ID for consistent order
  
  const scenarioColumns = new Map<number, number>();
  uniqueScenarios.forEach((scenarioId, index) => {
    scenarioColumns.set(scenarioId, index);
  });

  // Group runs by hour and scenario
  const runsByHourAndScenario = new Map<string, Map<number, UpcomingRun[]>>();
  next24HourRuns.forEach(run => {
    const runTime = new Date(run.nextRunAt);
    const hourKey = `${runTime.getFullYear()}-${runTime.getMonth()}-${runTime.getDate()}-${runTime.getHours()}`;
    
    if (!runsByHourAndScenario.has(hourKey)) {
      runsByHourAndScenario.set(hourKey, new Map());
    }
    
    const hourMap = runsByHourAndScenario.get(hourKey)!;
    if (!hourMap.has(run.scenarioId)) {
      hourMap.set(run.scenarioId, []);
    }
    
    hourMap.get(run.scenarioId)!.push(run);
  });

  const columnWidth = uniqueScenarios.length > 0 ? 100 / uniqueScenarios.length : 100;

  return (
    <div className="schedule-grid">
      {/* Collapsible Header */}
      <div 
        className="schedule-grid-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          cursor: 'pointer',
          padding: '8px 0',
          marginBottom: '12px'
        }}
      >
        <span style={{ 
          fontSize: '12px', 
          color: '#6b7280', 
          marginRight: '8px',
          transition: 'transform 0.2s ease'
        }}>
          {isCollapsed ? '▶' : '▼'}
        </span>
        <h3 style={{ margin: 0 }}>Next 24 Hours Schedule</h3>
        <span style={{ 
          fontSize: '12px', 
          color: '#9ca3af', 
          marginLeft: '12px' 
        }}>
          ({uniqueScenarios.length} scenarios, {next24HourRuns.length} runs)
        </span>
      </div>
      
      {/* Collapsible Content */}
      {!isCollapsed && (
        <>
          {/* Scenario Headers */}
          {uniqueScenarios.length > 0 && (
        <div className="scenario-headers">
          <div className="time-label-spacer"></div>
          {uniqueScenarios.map((scenarioId) => {
            const scenarioColor = getScenarioColor(scenarioId);
            return (
              <div 
                key={scenarioId} 
                className="scenario-header"
                style={{ 
                  width: `${columnWidth}%`,
                  background: scenarioColor.background,
                  color: scenarioColor.text
                }}
              >
                {getScenarioName(scenarioId)}
              </div>
            );
          })}
        </div>
      )}
      
      <div className="grid-container">
        <div className="time-labels">
          {hours.map((hour, index) => (
            <div key={index} className="time-label">
              <div className="hour">{hour.getHours().toString().padStart(2, '0')}:00</div>
            </div>
          ))}
        </div>
        
        <div className="schedule-slots">
          {hours.map((hour, index) => {
            const hourKey = `${hour.getFullYear()}-${hour.getMonth()}-${hour.getDate()}-${hour.getHours()}`;
            const hourScenarioMap = runsByHourAndScenario.get(hourKey) || new Map();
            const isCurrentHour = hour.getHours() === now.getHours() && 
                                 hour.getDate() === now.getDate() &&
                                 hour.getMonth() === now.getMonth() &&
                                 hour.getFullYear() === now.getFullYear();
            
            return (
              <div 
                key={index} 
                className={`time-slot ${isCurrentHour ? 'current-hour' : ''}`}
              >
                {uniqueScenarios.map((scenarioId) => {
                  const scenarioRuns = hourScenarioMap.get(scenarioId) || [];
                  const scenarioColor = getScenarioColor(scenarioId);
                  
                  return (
                    <div 
                      key={scenarioId}
                      className="scenario-column"
                      style={{ width: `${columnWidth}%` }}
                    >
                      {scenarioRuns.map((run, runIndex) => {
                        const runTime = new Date(run.nextRunAt);
                        const duration = getRunDuration(run.scheduleId, run.entryId);
                        
                        return (
                          <div
                            key={run.entryId}
                            className="run-block-column"
                            style={{
                              background: scenarioColor.background,
                              color: scenarioColor.text,
                              marginBottom: runIndex > 0 ? '2px' : '0'
                            }}
                            title={`${getScenarioName(run.scenarioId)} - ${getCharacterName(run.characterId)} at ${runTime.toLocaleTimeString()}${duration ? ` for ${formatDuration(duration)}` : ''}`}
                          >
                            <div className="run-time-column">{runTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                            {duration && (
                              <div className="run-duration-column">{formatDuration(duration)}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default ScheduleGrid;
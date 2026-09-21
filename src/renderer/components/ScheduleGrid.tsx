import React, { useState } from 'react';
import { UpcomingRun, Character, Scenario, Schedule } from '../types';

interface ScheduleGridProps {
  upcomingRuns: UpcomingRun[];
  characters: Character[];
  scenarios: Scenario[];
  schedules: Schedule[];
}

const ScheduleGrid: React.FC<ScheduleGridProps> = ({ upcomingRuns, characters, scenarios, schedules }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
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
      { background: 'linear-gradient(#F2B477, #C97F3C)', text: '#1a1208' }, // Orange (Nurgling accent)
      { background: 'linear-gradient(#9fd8d4, #5fa9a5)', text: '#0d1a19' }, // Teal
      { background: 'linear-gradient(#a8e0a8, #6fb86f)', text: '#0f1a0f' }, // Green
      { background: 'linear-gradient(#b6d1f7, #6f98cc)', text: '#0c1522' }, // Blue
      { background: 'linear-gradient(#d2bdea, #957bb8)', text: '#160f22' }, // Lilac
      { background: 'linear-gradient(#ebb2b2, #bf7777)', text: '#1f0d0d' }, // Rose
      { background: 'linear-gradient(#ecd48c, #bb9d4b)', text: '#1c1606' }, // Gold
      { background: 'linear-gradient(#b8c7c8, #7b8e8f)', text: '#101617' }, // Slate
      { background: 'linear-gradient(#b5e8da, #6db8a4)', text: '#0d1a16' }, // Mint
      { background: 'linear-gradient(#f3c2a0, #c98a5c)', text: '#1f1006' }, // Coral
    ];
    
    return colors[scenarioId % colors.length];
  };

  // Get the next 24 hours
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  const endOf24Hours = new Date(startOfDay);
  endOf24Hours.setHours(endOf24Hours.getHours() + 24);
  
  // Create 15-minute interval markers for the timeline (24 hours * 4 intervals = 96 markers)
  const timeIntervals = Array.from({ length: 96 }, (_, i) => {
    const interval = new Date(startOfDay);
    interval.setMinutes(interval.getMinutes() + (i * 15)); // Add 15 minutes for each interval
    return interval;
  });

  // Filter runs to only include those within the next 24 hours
  const next24HourRuns = upcomingRuns.filter(run => {
    const runTime = new Date(run.nextRunAt);
    return runTime >= startOfDay && runTime < endOf24Hours;
  });

  // Get unique scenarios and create column mapping
  const uniqueScenarios = Array.from(new Set(next24HourRuns.map(run => run.scenarioId)))
    .sort((a, b) => a - b); // Sort by scenario ID for consistent order

  // Timeline constants - using proportional scaling based on 5 minutes = 28px base unit
  const BASE_HEIGHT_5_MINUTES = 28; // Base height representing 5 minutes (minimum readable card)
  const PIXELS_PER_5_MINUTES = BASE_HEIGHT_5_MINUTES; // Height per 5-minute unit
  const PIXELS_PER_15_MINUTES = PIXELS_PER_5_MINUTES * 3; // 84px per 15-minute interval
  const PIXELS_PER_HOUR = PIXELS_PER_5_MINUTES * 12; // 12 five-minute units per hour = 336px per hour
  const TIMELINE_HEIGHT = 24 * PIXELS_PER_HOUR; // Total timeline height

  // Calculate position and duration for each run
  const runsWithLayout = next24HourRuns.map(run => {
    const runTime = new Date(run.nextRunAt);
    const duration = getRunDuration(run.scheduleId, run.entryId) || 0;
    
    // Calculate position from start of timeline
    const minutesFromStart = (runTime.getTime() - startOfDay.getTime()) / (1000 * 60);
    const topPosition = (minutesFromStart / 5) * PIXELS_PER_5_MINUTES; // Position based on 5-minute units
    
    // Calculate height based on proportional scaling: duration in 5-minute units
    const durationMinutes = duration / (1000 * 60);
    const height = Math.max((durationMinutes / 5) * PIXELS_PER_5_MINUTES, BASE_HEIGHT_5_MINUTES);
    
    return {
      ...run,
      topPosition,
      height,
      durationMinutes,
      runTime
    };
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
          color: 'var(--dim)', 
          marginRight: '8px',
          transition: 'transform 0.2s ease'
        }}>
          {isCollapsed ? '▶' : '▼'}
        </span>
        <h3 style={{ margin: 0 }}>Next 24 Hours Schedule</h3>
        <span style={{ 
          fontSize: '12px', 
          color: 'var(--dim-2)', 
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
      
      <div className="grid-container-timeline">
            {/* Time Labels */}
            <div className="time-labels-timeline" style={{ height: `${TIMELINE_HEIGHT}px` }}>
              {timeIntervals.map((interval, index) => {
                // Only show major hour labels every 4 intervals (every hour)
                const isHourMark = index % 4 === 0;
                const is15MinMark = !isHourMark;
                
                return (
                  <div 
                    key={index} 
                    className="time-label-timeline"
                    style={{
                      position: 'absolute',
                      top: `${index * PIXELS_PER_15_MINUTES}px`,
                      height: `${PIXELS_PER_15_MINUTES}px`,
                      display: 'flex',
                      alignItems: 'flex-start',
                      paddingTop: '2px'
                    }}
                  >
                    {isHourMark && (
                      <div className="hour-text">
                        {interval.getHours().toString().padStart(2, '0')}:00
                      </div>
                    )}
                    {is15MinMark && (
                      <div className="minute-text">
                        {interval.getHours().toString().padStart(2, '0')}:{interval.getMinutes().toString().padStart(2, '0')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Timeline Container */}
            <div className="timeline-container" style={{ height: `${TIMELINE_HEIGHT}px` }}>
              {/* Scenario Columns */}
              {uniqueScenarios.map((scenarioId, columnIndex) => {
                const columnRuns = runsWithLayout.filter(run => run.scenarioId === scenarioId);
                
                return (
                  <div 
                    key={scenarioId}
                    className="scenario-column-timeline"
                    style={{ 
                      width: `${columnWidth}%`,
                      left: `${columnIndex * columnWidth}%`
                    }}
                  >
                    {columnRuns.map((run) => {
                      const scenarioColor = getScenarioColor(run.scenarioId);
                      
                      return (
                        <div
                          key={run.entryId}
                          className="run-block-timeline"
                          style={{
                            position: 'absolute',
                            top: `${run.topPosition}px`,
                            height: `${run.height}px`,
                            width: 'calc(100% - 4px)',
                            left: '2px',
                            background: scenarioColor.background,
                            color: scenarioColor.text
                          }}
                          title={`${getScenarioName(run.scenarioId)} - ${getCharacterName(run.characterId)} at ${run.runTime.toLocaleTimeString()} for ${formatDuration(run.durationMinutes * 60 * 1000)}`}
                        >
                          <div className="run-content-timeline">
                            <div className="run-time-timeline">
                              {run.runTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="run-duration-timeline">
                              {formatDuration(run.durationMinutes * 60 * 1000)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              
              {/* Grid Lines - 15-minute intervals with different styles for hours vs 15-min marks */}
              {timeIntervals.map((_, index) => {
                const isHourMark = index % 4 === 0;
                return (
                  <div 
                    key={index}
                    className={isHourMark ? "hour-grid-line" : "minute-grid-line"}
                    style={{
                      position: 'absolute',
                      top: `${index * PIXELS_PER_15_MINUTES}px`,
                      left: '0',
                      right: '0',
                      height: '1px',
                      backgroundColor: isHourMark ? 'var(--line-strong)' : 'var(--line)',
                      opacity: isHourMark ? 0.9 : 0.6,
                      zIndex: 0
                    }}
                  />
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
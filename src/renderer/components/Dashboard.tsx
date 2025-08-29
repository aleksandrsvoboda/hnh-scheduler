import React, { useState, useEffect } from 'react';
import { ActiveRun, RunRecord, UpcomingRun, Character, Scenario, Schedule } from '../types';
import ScheduleGrid from './ScheduleGrid';
import InfoTooltip from './InfoTooltip';
import Toggle from './Toggle';

declare global {
  interface Window {
    api: any;
  }
}

const Dashboard: React.FC = () => {
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([]);
  const [recentFailures, setRecentFailures] = useState<RunRecord[]>([]);
  const [upcomingRuns, setUpcomingRuns] = useState<UpcomingRun[]>([]);
  const [gridUpcomingRuns, setGridUpcomingRuns] = useState<UpcomingRun[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [skippedRuns, setSkippedRuns] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if API is available (only available in Electron context)
    if (!window.api) {
      console.warn('Accessing from browser - please use the Electron application window');
      setLoading(false);
      return;
    }
    
    loadDashboardData();
    
    // Set up real-time updates
    const unsubscribeRunStarted = window.api.runs.onStarted(loadActiveRuns);
    const unsubscribeRunExit = window.api.runs.onExit(loadDashboardData);
    const unsubscribeRunSkipped = window.api.runs.onSkipped(loadDashboardData);
    
    // Refresh active runs every 5 seconds
    const interval = setInterval(loadActiveRuns, 5000);
    
    return () => {
      unsubscribeRunStarted();
      unsubscribeRunExit();
      unsubscribeRunSkipped();
      clearInterval(interval);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadActiveRuns(), 
        loadRecentFailures(), 
        loadUpcomingRuns(),
        loadGridUpcomingRuns(),
        loadCharacters(),
        loadScenarios(),
        loadSchedules(),
        loadSkippedRuns()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadCharacters = async () => {
    try {
      if (!window.api) return;
      const charactersList = await window.api.characters.list();
      setCharacters(charactersList);
    } catch (error) {
      console.error('Failed to load characters:', error);
    }
  };

  const loadSkippedRuns = async () => {
    try {
      if (!window.api) return;
      const skippedList = await window.api.skip.list();
      setSkippedRuns(new Set(skippedList));
    } catch (error) {
      console.error('Failed to load skipped runs:', error);
    }
  };

  const loadScenarios = async () => {
    try {
      if (!window.api) return;
      const scenariosList = await window.api.scenarios.get();
      setScenarios(scenariosList);
    } catch (error) {
      console.error('Failed to load scenarios:', error);
    }
  };

  const loadSchedules = async () => {
    try {
      if (!window.api) return;
      const schedulesList = await window.api.schedules.list();
      setSchedules(schedulesList);
    } catch (error) {
      console.error('Failed to load schedules:', error);
    }
  };

  const loadActiveRuns = async () => {
    try {
      if (!window.api) return;
      const runs = await window.api.runs.active();
      setActiveRuns(runs);
    } catch (error) {
      console.error('Failed to load active runs:', error);
    }
  };

  const loadRecentFailures = async () => {
    try {
      if (!window.api) return;
      const fromDate = new Date();
      fromDate.setHours(fromDate.getHours() - 24); // Last 24 hours
      
      const failures = await window.api.history.query({
        status: 'error',
        fromISO: fromDate.toISOString()
      });
      
      setRecentFailures(failures.slice(0, 5)); // Show top 5
    } catch (error) {
      console.error('Failed to load recent failures:', error);
    }
  };

  const loadUpcomingRuns = async () => {
    try {
      if (!window.api) return;
      const upcoming = await window.api.runs.upcoming(50); // Load more runs to filter from
      
      // Filter to show only the next run per scenario
      const nextRunPerScenario = new Map<number, UpcomingRun>();
      upcoming.forEach(run => {
        if (!nextRunPerScenario.has(run.scenarioId)) {
          nextRunPerScenario.set(run.scenarioId, run);
        }
      });
      
      // Convert back to array, sort by time, and take top 5
      const filteredRuns = Array.from(nextRunPerScenario.values())
        .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())
        .slice(0, 5);
      
      setUpcomingRuns(filteredRuns);
    } catch (error) {
      console.error('Failed to load upcoming runs:', error);
    }
  };

  const loadGridUpcomingRuns = async () => {
    try {
      if (!window.api) return;
      // Load many more runs for the 24-hour schedule grid
      // If schedules run every hour, we need 24+ runs per schedule
      const gridRuns = await window.api.runs.upcoming(500); // Load up to 500 runs
      setGridUpcomingRuns(gridRuns);
    } catch (error) {
      console.error('Failed to load grid upcoming runs:', error);
    }
  };

  const handleStopRun = async (runId: string) => {
    try {
      await window.api.runs.stop(runId);
      await loadActiveRuns();
    } catch (error) {
      console.error('Failed to stop run:', error);
      alert('Failed to stop run: ' + (error as Error).message);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const getCharacterName = (characterId: string) => {
    const character = characters.find(c => c.id === characterId);
    return character?.name || characterId;
  };

  const getScenarioName = (scenarioId: number) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    return scenario?.name || `Scenario ${scenarioId}`;
  };

  const handleSkipToggle = async (scheduleId: string, entryId: string, isSkipped: boolean) => {
    try {
      // Extract base entry ID by removing the -index suffix (e.g., "entry1-0" -> "entry1")
      const baseEntryId = entryId.replace(/-\d+$/, '');
      const skipKey = `${scheduleId}-${baseEntryId}`;
      
      if (isSkipped) {
        await window.api.skip.set(scheduleId, baseEntryId);
        setSkippedRuns(prev => new Set(prev).add(skipKey));
      } else {
        await window.api.skip.clear(scheduleId, baseEntryId);
        setSkippedRuns(prev => {
          const newSet = new Set(prev);
          newSet.delete(skipKey);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Failed to toggle skip:', error);
      // Revert the checkbox state on error
      const checkbox = document.querySelector(`input[data-skip-key="${scheduleId}-${entryId}"]`) as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = !isSkipped;
      }
    }
  };

  if (loading) {
    return (
      <div className="text-center mt-4">
        <div className="spinner"></div>
        <p className="mt-2">Loading dashboard...</p>
      </div>
    );
  }

  if (!window.api) {
    return (
      <div className="text-center mt-4">
        <div className="mb-4">
          <h2>⚠️ Wrong Access Method</h2>
          <p className="mb-2">You're accessing this in a web browser.</p>
          <p className="mb-2"><strong>Please use the Electron application window instead.</strong></p>
          <p className="text-muted text-small">
            Run <code>npm run dev</code> and look for the HnH Scheduler window, 
            or check your taskbar for the application.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4">Dashboard</h1>
      
      {/* Schedule Grid */}
      <ScheduleGrid 
        upcomingRuns={gridUpcomingRuns} 
        characters={characters} 
        scenarios={scenarios}
        schedules={schedules}
      />
      
      {/* 1. Upcoming Runs */}
      <div className="card mb-6">
        <div className="section-header">Upcoming Runs</div>
        <div className="section-content">
          {upcomingRuns.length === 0 ? (
            <p className="text-muted">No upcoming runs</p>
          ) : (
            <table className="table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Character</th>
                <th>Next Run</th>
                <th>Type</th>
                <th>
                  Skip
                  <InfoTooltip text="Toggle to skip the next occurrence of this scheduled run" />
                </th>
              </tr>
            </thead>
            <tbody>
              {upcomingRuns.map(run => (
                <tr key={run.entryId}>
                  <td>{getScenarioName(run.scenarioId)}</td>
                  <td>{getCharacterName(run.characterId)}</td>
                  <td>{formatDateTime(run.nextRunAt)}</td>
                  <td>
                    <span className="status status-info">{run.cadenceType}</span>
                  </td>
                  <td>
                    <Toggle
                      variant="danger"
                      checked={skippedRuns.has(`${run.scheduleId}-${run.entryId.replace(/-\d+$/, '')}`)}
                      onChange={(checked) => handleSkipToggle(run.scheduleId, run.entryId, checked)}
                      data-skip-key={`${run.scheduleId}-${run.entryId}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 2. Active Runs */}
      <div className="card mb-6">
        <div className="section-header">Active Runs</div>
        <div className="section-content">
          {activeRuns.length === 0 ? (
            <p className="text-muted">No active runs</p>
          ) : (
            <table className="table">
            <thead>
              <tr>
                <th>Entry ID</th>
                <th>PID</th>
                <th>Started</th>
                <th>Elapsed</th>
                <th>Remaining</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeRuns.map(run => (
                <tr key={run.runId}>
                  <td>{run.entryId}</td>
                  <td>{run.pid}</td>
                  <td>{formatDateTime(run.startedAt)}</td>
                  <td>{formatDuration(run.elapsedMs)}</td>
                  <td>{formatDuration(run.remainingMs)}</td>
                  <td>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleStopRun(run.runId)}
                    >
                      Stop
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 3. Recent Failures */}
      <div className="card mb-6">
        <div className="section-header">Recent Failures (Last 24h)</div>
        <div className="section-content">
          {recentFailures.length === 0 ? (
            <p className="text-muted">No recent failures</p>
          ) : (
            <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Scenario</th>
                <th>Character</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {recentFailures.map(record => (
                <tr key={record.runId}>
                  <td>{formatDateTime(record.ts)}</td>
                  <td>{getScenarioName(record.scenarioId)}</td>
                  <td>{getCharacterName(record.characterId)}</td>
                  <td>
                    <span className="status status-error">{record.status}</span>
                  </td>
                  <td>{formatDuration(record.durationMs)}</td>
                  <td className="text-error">{record.error || 'Unknown error'}</td>
                </tr>
              ))}
            </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
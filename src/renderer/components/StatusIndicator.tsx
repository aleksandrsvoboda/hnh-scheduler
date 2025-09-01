import React, { useState, useEffect } from 'react';

interface ActiveRun {
  runId: string;
  entryId: string;
  pid: number;
  startedAt: string;
  elapsedMs: number;
  remainingMs: number;
}

interface NextRun {
  scheduleId: string;
  scheduleName: string;
  nextRunAt: string;
  character: string;
  scenario: string;
}

interface StatusIndicatorProps {
  className?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ className = '' }) => {
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([]);
  const [nextRun, setNextRun] = useState<NextRun | null>(null);
  const [hasEnabledSchedules, setHasEnabledSchedules] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // Get active runs
        const activeRunsData = await window.api.runs.active();
        setActiveRuns(activeRunsData || []);

        // Get upcoming runs
        const upcomingRuns = await window.api.runs.upcoming(1);
        if (upcomingRuns && upcomingRuns.length > 0) {
          const next = upcomingRuns[0];
          setNextRun({
            scheduleId: next.scheduleId,
            scheduleName: next.scheduleName,
            nextRunAt: next.nextRunAt,
            character: next.character,
            scenario: next.scenario
          });
        } else {
          setNextRun(null);
        }

        // Check if there are any enabled schedules
        const schedulesData = await window.api.schedules.list();
        const hasEnabled = schedulesData?.some((schedule: any) => schedule.enabled) || false;
        setHasEnabledSchedules(hasEnabled);
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    };

    fetchStatus();
    
    // Update every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeUntil = (timestamp: string): string => {
    const now = new Date();
    const target = new Date(timestamp);
    const diffMs = target.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Now';
    
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const formatElapsed = (elapsedMs: number): string => {
    const minutes = Math.floor(elapsedMs / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const getStatusColor = (): string => {
    if (activeRuns.length > 0) return 'text-green-500';
    if (hasEnabledSchedules) return 'text-blue-500';
    return 'text-gray-500';
  };

  const getStatusDot = (): string => {
    if (activeRuns.length > 0) return 'bg-green-500';
    if (hasEnabledSchedules) return 'bg-blue-500';
    return 'bg-gray-500';
  };

  const renderStatus = () => {
    if (activeRuns.length > 0) {
      const run = activeRuns[0]; // Show first active run
      return (
        <>
          <div className="status-label">Status</div>
          <div className="status-details">
            {formatElapsed(run.elapsedMs)} elapsed
          </div>
        </>
      );
    }
    
    if (nextRun) {
      return (
        <>
          <div className="status-label">Status</div>
          <div className="status-details">
            next run in {formatTimeUntil(nextRun.nextRunAt)}
          </div>
        </>
      );
    }
    
    if (hasEnabledSchedules) {
      return (
        <>
          <div className="status-label">Status</div>
          <div className="status-details">Ready</div>
        </>
      );
    }
    
    return (
      <>
        <div className="status-label">Status</div>
        <div className="status-details">No schedules</div>
      </>
    );
  };

  return (
    <div className={`status-indicator ${className}`}>
      <div className="status-content">
        <div className="status-header">
          <div className="status-label">Status</div>
          <div className={`status-dot ${getStatusDot()}`}></div>
        </div>
        <div className="status-details">
          {activeRuns.length > 0 ? (
            `${formatElapsed(activeRuns[0].elapsedMs)} elapsed`
          ) : nextRun ? (
            `next run in ${formatTimeUntil(nextRun.nextRunAt)}`
          ) : hasEnabledSchedules ? (
            'ready'
          ) : (
            'no schedules'
          )}
        </div>
      </div>
    </div>
  );
};

export default StatusIndicator;
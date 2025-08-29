import React, { useState, useEffect } from 'react';
import { Schedule, ScheduleEntry, Scenario, Character, Cadence, OverlapPolicy } from '../types';
import { v4 as uuidv4 } from 'uuid';
import InfoTooltip from './InfoTooltip';
import Toggle from './Toggle';

// Helper functions to handle datetime-local without any timezone conversion
const dateToLocalInput = (isoString: string): string => {
  // Take the ISO string and treat it as if it's already in local time
  // Just strip the Z and timezone info
  return isoString.slice(0, 16); // Keep only YYYY-MM-DDTHH:MM
};

const localInputToISO = (localValue: string): string => {
  // Just store the local datetime string directly - no ISO conversion
  return localValue + ':00.000Z';
};

const Schedules: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Custom confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {}
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [schedulesList, scenariosList, charactersList] = await Promise.all([
        window.api.schedules.list(),
        window.api.scenarios.get(),
        window.api.characters.list()
      ]);
      
      setSchedules(schedulesList);
      setScenarios(scenariosList);
      setCharacters(charactersList);
      
      if (schedulesList.length > 0 && !selectedScheduleId) {
        setSelectedScheduleId(schedulesList[0].id);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedSchedule = schedules.find(s => s.id === selectedScheduleId);

  // Custom confirmation dialog helper
  const showConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleCreateSchedule = () => {
    const newSchedule: Schedule = {
      id: uuidv4(),
      name: 'New Schedule',
      enabled: true,
      entries: []
    };
    
    setSchedules(prev => [...prev, newSchedule]);
    setSelectedScheduleId(newSchedule.id);
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    const scheduleName = schedule?.name || 'this schedule';
    
    showConfirmDialog(
      'Delete Schedule',
      `Are you sure you want to delete "${scheduleName}"? This action cannot be undone.`,
      () => {
        setSchedules(prev => prev.filter(s => s.id !== scheduleId));
        
        if (selectedScheduleId === scheduleId) {
          const remaining = schedules.filter(s => s.id !== scheduleId);
          setSelectedScheduleId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    );
  };

  const handleScheduleChange = (scheduleId: string, updates: Partial<Schedule>) => {
    setSchedules(prev => prev.map(s => 
      s.id === scheduleId ? { ...s, ...updates } : s
    ));
  };

  const handleAddEntry = () => {
    if (!selectedSchedule) return;

    const newEntry: ScheduleEntry = {
      id: uuidv4(),
      scenarioId: scenarios.length > 0 ? scenarios[0].id : 1,
      characterId: characters.length > 0 ? characters[0].id : '',
      cadence: { type: 'every', unit: 'hours', n: 1 },
      maxDurationMs: 30 * 60 * 1000, // 30 minutes
      overlapPolicy: 'skip',
      enabled: true
    };

    handleScheduleChange(selectedSchedule.id, {
      entries: [...selectedSchedule.entries, newEntry]
    });
  };

  const handleUpdateEntry = (entryId: string, updates: Partial<ScheduleEntry>) => {
    if (!selectedSchedule) return;

    const updatedEntries = selectedSchedule.entries.map(e =>
      e.id === entryId ? { ...e, ...updates } : e
    );

    handleScheduleChange(selectedSchedule.id, { entries: updatedEntries });
  };

  const handleDeleteEntry = (entryId: string) => {
    if (!selectedSchedule) return;
    
    const entry = selectedSchedule.entries.find(e => e.id === entryId);
    const scenario = scenarios.find(s => s.id === entry?.scenarioId);
    const scenarioName = scenario?.name || 'this scenario';
    
    showConfirmDialog(
      'Delete Scenario',
      `Are you sure you want to delete "${scenarioName}" from this schedule? This action cannot be undone.`,
      () => {
        const updatedEntries = selectedSchedule.entries.filter(e => e.id !== entryId);
        handleScheduleChange(selectedSchedule.id, { entries: updatedEntries });
      }
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await window.api.schedules.save(schedules);
      showConfirmDialog(
        'Save Successful',
        'All schedules have been saved successfully!',
        () => {} // Just close the dialog
      );
    } catch (error) {
      console.error('Failed to save schedules:', error);
      showConfirmDialog(
        'Save Failed',
        `Failed to save schedules: ${(error as Error).message}`,
        () => {} // Just close the dialog
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTestEntry = async (entryId: string) => {
    try {
      const result = await window.api.runs.test(entryId);
      alert(`Test run started with ID: ${result.runId}`);
    } catch (error) {
      console.error('Failed to test entry:', error);
      alert('Failed to start test run: ' + (error as Error).message);
    }
  };

  const handleToggleSchedule = async (scheduleId: string, enabled: boolean) => {
    try {
      await window.api.schedules.toggle(scheduleId, enabled);
      // Update the local state
      setSchedules(prev => prev.map(schedule => 
        schedule.id === scheduleId ? { ...schedule, enabled } : schedule
      ));
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
      alert('Failed to toggle schedule: ' + (error as Error).message);
    }
  };

  const formatCadence = (cadence: Cadence): string => {
    switch (cadence.type) {
      case 'cron':
        return `Cron: ${cadence.expression}`;
      case 'every':
        return `Every ${cadence.n} ${cadence.unit}`;
      case 'once':
        return `Once at ${new Date(cadence.atISO).toLocaleString()}`;
      default:
        return 'Unknown';
    }
  };

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="text-center mt-4">
        <div className="spinner"></div>
        <p className="mt-2">Loading schedules...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <h1 className="flex-1">Schedules</h1>
        <button 
          className="btn btn-success btn-large" 
          onClick={handleSave}
          disabled={saving}
          style={{ fontWeight: '600', minWidth: '120px' }}
        >
          {saving ? 'Saving...' : '💾 Save All'}
        </button>
      </div>

      <div className="flex gap-8" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Schedule List */}
        <div className="sidebar" style={{ width: '320px' }}>
          <div className="sidebar-header">
            Schedules
          </div>
          <div className="sidebar-content">
            {/* Add New Schedule Button */}
            <div
              className="schedule-item"
              onClick={handleCreateSchedule}
              style={{
                border: '2px dashed #d1d5db',
                backgroundColor: '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3498db';
                e.currentTarget.style.backgroundColor = '#eff6ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }}
            >
              <div style={{ 
                fontSize: '24px', 
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>+</span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>New Schedule</span>
              </div>
            </div>

            {schedules.length === 0 ? (
              <p className="text-muted text-center" style={{ marginTop: '20px', fontSize: '13px' }}>
                Click above to create your first schedule
              </p>
            ) : (
              <div style={{ marginTop: '12px' }}>
                {schedules.map(schedule => (
                  <div
                    key={schedule.id}
                    className={`schedule-item ${selectedScheduleId === schedule.id ? 'selected' : ''}`}
                    onClick={() => setSelectedScheduleId(schedule.id)}
                  >
                    <div className="schedule-item-header">
                      <div className="schedule-item-title">{schedule.name}</div>
                      <div className="schedule-item-controls">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Toggle
                            checked={schedule.enabled}
                            onChange={(checked) => handleToggleSchedule(schedule.id, checked)}
                          />
                        </div>
                        <button
                          className="btn btn-danger btn-small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSchedule(schedule.id);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div className="schedule-item-meta">
                      {schedule.entries.length} {schedule.entries.length === 1 ? 'scenario' : 'scenarios'}
                      {schedule.concurrencyLimit && ` • Max ${schedule.concurrencyLimit} concurrent`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Schedule Editor */}
        <div className="flex-1" style={{ overflowY: 'auto', marginLeft: '20px' }}>
          {selectedSchedule ? (
            <div>
              <h2 className="mb-6">Edit Schedule: {selectedSchedule.name}</h2>

              {/* Schedule Settings */}
              <div className="card mb-6">
                <div className="section-header">
                  Schedule Settings
                </div>
                <div className="section-content">
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={selectedSchedule.name}
                      onChange={(e) => handleScheduleChange(selectedSchedule.id, { name: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      autoComplete="off"
                      tabIndex={0}
                      style={{ maxWidth: '300px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Concurrency Limit
                      <InfoTooltip text="Maximum number of runs that can execute simultaneously for this schedule. Leave empty for no limit." />
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      value={selectedSchedule.concurrencyLimit || ''}
                      onChange={(e) => handleScheduleChange(selectedSchedule.id, { 
                        concurrencyLimit: e.target.value ? parseInt(e.target.value) : undefined 
                      })}
                      placeholder="No limit"
                      min="1"
                      style={{ maxWidth: '200px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Schedule Entries */}
              <div className="card">
                <div className="section-header">
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">Schedule Scenarios</div>
                    <button 
                      className="btn btn-primary btn-small" 
                      onClick={handleAddEntry}
                      disabled={scenarios.length === 0 || characters.length === 0}
                    >
                      Add Scenario
                    </button>
                  </div>
                </div>
                <div className="section-content">
                  {scenarios.length === 0 && (
                    <div className="text-error mb-4 p-3 rounded" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                      No scenarios available. Configure scenarios first.
                    </div>
                  )}

                  {characters.length === 0 && (
                    <div className="text-error mb-4 p-3 rounded" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                      No characters available. Configure characters first.
                    </div>
                  )}

                  {selectedSchedule.entries.length === 0 ? (
                    <div className="text-center text-muted" style={{ padding: '40px 20px' }}>
                      <p>No scenarios in this schedule</p>
                      <p className="info-text">Click "Add Scenario" to create your first scheduled task</p>
                    </div>
                  ) : (
                    <div>
                      {selectedSchedule.entries.map(entry => (
                        <ScheduleEntryEditor
                          key={entry.id}
                          entry={entry}
                          scenarios={scenarios}
                          characters={characters}
                          onUpdate={(updates) => handleUpdateEntry(entry.id, updates)}
                          onDelete={() => handleDeleteEntry(entry.id)}
                          onTest={() => handleTestEntry(entry.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted mt-8">
              <p>Select a schedule to edit, or create a new one.</p>
            </div>
          )}
        </div>
      </div>

      {/* Custom Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={confirmDialog.onCancel}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              width: '400px',
              maxWidth: '90vw',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '16px', color: '#374151' }}>
              {confirmDialog.title}
            </h3>
            
            <p style={{ marginBottom: '24px', color: '#6b7280', lineHeight: '1.5' }}>
              {confirmDialog.message}
            </p>
            
            <div className="flex gap-2 justify-end">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={confirmDialog.onCancel}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className={confirmDialog.title.includes('Save') ? 'btn btn-primary' : 'btn btn-danger'}
                onClick={confirmDialog.onConfirm}
              >
                {confirmDialog.title.includes('Save') ? 'OK' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ScheduleEntryEditorProps {
  entry: ScheduleEntry;
  scenarios: Scenario[];
  characters: Character[];
  onUpdate: (updates: Partial<ScheduleEntry>) => void;
  onDelete: () => void;
  onTest: () => void;
}

const ScheduleEntryEditor: React.FC<ScheduleEntryEditorProps> = ({
  entry,
  scenarios,
  characters,
  onUpdate,
  onDelete,
  onTest
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const scenario = scenarios.find(s => s.id === entry.scenarioId);
  const character = characters.find(c => c.id === entry.characterId);
  
  // Auto-fix invalid character ID
  useEffect(() => {
    if (characters.length > 0 && !character && entry.characterId) {

      onUpdate({ characterId: characters[0].id });
    }
  }, [characters, character, entry.characterId, onUpdate]);

  const handleCadenceChange = (field: string, value: any) => {
    const newCadence = { ...entry.cadence };
    (newCadence as any)[field] = value;
    onUpdate({ cadence: newCadence });
  };

  return (
    <div className="schedule-entry">
      <div className="schedule-entry-header">
        <button
          className="text-left flex-1"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <div className="flex gap-3 items-center">
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{isExpanded ? '▼' : '▶'}</span>
            <div className="flex-1">
              <div className="flex gap-2 items-center mb-1">
                <span className="schedule-badge scenario">Scenario</span>
                <div style={{ fontWeight: 600, color: '#374151' }}>{scenario?.name || 'Unknown Scenario'}</div>
              </div>
              <div className="flex gap-2 items-center">
                <span className="schedule-badge character">Character</span>
                <div style={{ fontWeight: 500, color: '#6b7280' }}>{character?.name || 'Unknown Character'}</div>
              </div>
            </div>
          </div>
        </button>
        
        <div className="button-group">
          <button className="btn btn-info btn-small" onClick={onTest}>
            ▶ Test
          </button>
          <button className="btn btn-danger btn-small" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className="schedule-entry-meta">
        <span>{formatCadence(entry.cadence)}</span>
        <span>{formatDuration(entry.maxDurationMs)} max</span>
        <span>{entry.overlapPolicy} on overlap</span>
        <span className={`status ${entry.enabled ? 'status-success' : 'status-warning'}`}>
          {entry.enabled ? 'enabled' : 'disabled'}
        </span>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid #e5e7eb' }}>
          <div className="form-row mb-4">
            <div className="form-group flex-1">
              <label className="form-label">Scenario</label>
              <select
                className="form-select"
                value={entry.scenarioId}
                onChange={(e) => onUpdate({ scenarioId: parseInt(e.target.value) })}
              >
                {scenarios.map(scenario => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group flex-1">
              <label className="form-label">Character</label>
              <select
                className="form-select"
                value={character ? entry.characterId : ''}
                onChange={(e) => onUpdate({ characterId: e.target.value })}
                style={{ 
                  borderColor: !character && entry.characterId ? '#e74c3c' : undefined,
                  backgroundColor: !character && entry.characterId ? '#fdf2f2' : undefined
                }}
              >
                {!character && entry.characterId && (
                  <option value="" disabled>
                    Invalid character (select a valid one)
                  </option>
                )}
                {characters.map(character => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cadence Configuration */}
          <div className="form-group mb-3">
            <label className="form-label">Schedule Type</label>
            <select
              className="form-select"
              value={entry.cadence.type}
              onChange={(e) => {
                if (e.target.value === 'cron') {
                  onUpdate({ cadence: { type: 'cron', expression: '0 * * * *' } });
                } else if (e.target.value === 'every') {
                  onUpdate({ cadence: { type: 'every', unit: 'hours', n: 1 } });
                } else if (e.target.value === 'once') {
                  const now = new Date();
                  onUpdate({ cadence: { type: 'once', atISO: now.toISOString() } });
                }
              }}
            >
              <option value="every">Every N minutes/hours</option>
              <option value="cron">Cron expression</option>
              <option value="once">Once at specific time</option>
            </select>
          </div>

          {entry.cadence.type === 'every' && (
            <div className="form-row mb-4">
              <div className="form-group" style={{ maxWidth: '120px' }}>
                <label className="form-label">Every</label>
                <input
                  type="number"
                  className="form-input"
                  value={entry.cadence.n}
                  onChange={(e) => handleCadenceChange('n', parseInt(e.target.value))}
                  min="1"
                />
              </div>
              <div className="form-group" style={{ maxWidth: '150px' }}>
                <label className="form-label">Unit</label>
                <select
                  className="form-select"
                  value={entry.cadence.unit}
                  onChange={(e) => handleCadenceChange('unit', e.target.value)}
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                </select>
              </div>
            </div>
          )}

          {entry.cadence.type === 'cron' && (
            <div className="form-group mb-3">
              <label className="form-label">Cron Expression</label>
              <input
                type="text"
                className="form-input"
                value={entry.cadence.expression}
                onChange={(e) => handleCadenceChange('expression', e.target.value)}
                placeholder="0 * * * * (every hour)"
              />
            </div>
          )}

          {entry.cadence.type === 'once' && (
            <div className="form-group mb-3">
              <label className="form-label">Run At</label>
              <input
                type="datetime-local"
                className="form-input"
                value={dateToLocalInput(entry.cadence.atISO)}
                onChange={(e) => handleCadenceChange('atISO', localInputToISO(e.target.value))}
              />
            </div>
          )}

          {/* Optional Start Time for recurring schedules */}
          {(entry.cadence.type === 'every' || entry.cadence.type === 'cron') && (
            <div className="form-group mb-3">
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={!!(entry.cadence as any).startTimeISO}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const now = new Date();
                      handleCadenceChange('startTimeISO', now.toISOString());
                    } else {
                      const newCadence = { ...entry.cadence };
                      delete (newCadence as any).startTimeISO;
                      onUpdate({ cadence: newCadence });
                    }
                  }}
                  style={{ marginRight: '8px' }}
                />
                Set specific start time (optional)
              </label>
              {(entry.cadence as any).startTimeISO && (
                <input
                  type="datetime-local"
                  className="form-input"
                  value={dateToLocalInput((entry.cadence as any).startTimeISO)}
                  onChange={(e) => handleCadenceChange('startTimeISO', localInputToISO(e.target.value))}
                  placeholder="When should this schedule start running?"
                />
              )}
              {(entry.cadence as any).startTimeISO && (
                <p className="text-muted text-small mt-1">
                  Schedule will start executing at this time, then follow the cadence pattern.
                </p>
              )}
            </div>
          )}

          <div className="form-row mb-4">
            <div className="form-group" style={{ maxWidth: '200px' }}>
              <label className="form-label">Max Duration (minutes)</label>
              <input
                type="number"
                className="form-input"
                value={Math.floor(entry.maxDurationMs / (1000 * 60))}
                onChange={(e) => onUpdate({ maxDurationMs: parseInt(e.target.value) * 1000 * 60 })}
                min="1"
              />
            </div>

            <div className="form-group" style={{ maxWidth: '220px' }}>
              <label className="form-label">Overlap Policy</label>
              <select
                className="form-select"
                value={entry.overlapPolicy}
                onChange={(e) => onUpdate({ overlapPolicy: e.target.value as OverlapPolicy })}
              >
                <option value="skip">Skip if busy</option>
                <option value="queue">Queue until free</option>
                <option value="kill-previous">Kill previous run</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <Toggle
                checked={entry.enabled}
                onChange={(checked) => onUpdate({ enabled: checked })}
              />
              <span className="form-label" style={{ margin: 0 }}>Scenario Enabled</span>
            </label>
            <div className="info-text">
              When disabled, this scenario will not execute but remains saved in the schedule
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions moved outside component to avoid re-creation
function formatCadence(cadence: Cadence): string {
  switch (cadence.type) {
    case 'cron':
      return `Cron: ${cadence.expression}`;
    case 'every':
      return `Every ${cadence.n} ${cadence.unit}`;
    case 'once':
      return `Once at ${new Date(cadence.atISO).toLocaleString()}`;
    default:
      return 'Unknown';
  }
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

export default Schedules;
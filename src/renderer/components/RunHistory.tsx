import React, { useState, useEffect } from 'react';
import { RunRecord, HistoryFilter, Scenario, Character } from '../types';

const RunHistory: React.FC = () => {
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<HistoryFilter>({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadHistory();
  }, [filter]);

  const loadData = async () => {
    try {
      const [scenariosList, charactersList] = await Promise.all([
        window.api.scenarios.get(),
        window.api.characters.list()
      ]);
      setScenarios(scenariosList);
      setCharacters(charactersList);
    } catch (error) {
      console.error('Failed to load reference data:', error);
    }
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      const historyRecords = await window.api.history.query(filter);
      setRecords(historyRecords);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: keyof HistoryFilter, value: string) => {
    let processedValue: any = value || undefined;
    
    // Convert scenarioId to number
    if (field === 'scenarioId' && value) {
      processedValue = parseInt(value);
    }
    
    setFilter(prev => ({
      ...prev,
      [field]: processedValue
    }));
  };

  const clearFilters = () => {
    setFilter({});
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
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

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'success':
        return 'status status-success';
      case 'error':
        return 'status status-error';
      case 'timeout':
        return 'status status-warning';
      case 'killed':
        return 'status status-info';
      case 'skipped':
        return 'status status-skipped';
      default:
        return 'status';
    }
  };

  const getScenarioName = (scenarioId: number) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    return scenario ? scenario.name : `Scenario ${scenarioId}`;
  };

  const getCharacterName = (characterId: string) => {
    const character = characters.find(c => c.id === characterId);
    return character ? character.name : characterId;
  };

  return (
    <div>
      <h1 className="mb-4">Run History</h1>

      {/* Filters */}
      <div className="mb-4 p-4 border rounded">
        <h3 className="mb-3">Filters</h3>
        
        <div className="flex gap-4 mb-3">
          <div className="form-group">
            <label className="form-label">From Date</label>
            <input
              type="datetime-local"
              className="form-input"
              value={filter.fromISO ? new Date(filter.fromISO).toISOString().slice(0, 16) : ''}
              onChange={(e) => handleFilterChange('fromISO', e.target.value ? new Date(e.target.value).toISOString() : '')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">To Date</label>
            <input
              type="datetime-local"
              className="form-input"
              value={filter.toISO ? new Date(filter.toISO).toISOString().slice(0, 16) : ''}
              onChange={(e) => handleFilterChange('toISO', e.target.value ? new Date(e.target.value).toISOString() : '')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Scenario</label>
            <select
              className="form-select"
              value={filter.scenarioId || ''}
              onChange={(e) => handleFilterChange('scenarioId', e.target.value)}
            >
              <option value="">All scenarios</option>
              {scenarios.map(scenario => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Character</label>
            <select
              className="form-select"
              value={filter.characterId || ''}
              onChange={(e) => handleFilterChange('characterId', e.target.value)}
            >
              <option value="">All characters</option>
              {characters.map(character => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={filter.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value as any)}
            >
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="timeout">Timeout</option>
              <option value="killed">Killed</option>
            </select>
          </div>
        </div>

        <button className="btn btn-secondary" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center">
          <div className="spinner"></div>
          <p className="mt-2">Loading history...</p>
        </div>
      ) : (
        <div>
          <p className="text-muted mb-3">{records.length} record(s) found</p>
          
          {records.length === 0 ? (
            <p className="text-center text-muted mt-8">No records found matching your filters.</p>
          ) : (
            <div style={{ 
              maxHeight: 'calc(100vh - 400px)', 
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}>
              <table className="table" style={{ marginBottom: 0 }}>
                <thead style={{ 
                  position: 'sticky', 
                  top: 0, 
                  backgroundColor: '#f8f9fa',
                  zIndex: 1
                }}>
                  <tr>
                    <th>Time</th>
                    <th>Scenario</th>
                    <th>Character</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Exit Code</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => (
                    <tr key={record.runId}>
                      <td>{formatDateTime(record.ts)}</td>
                      <td>{getScenarioName(record.scenarioId)}</td>
                      <td>{getCharacterName(record.characterId)}</td>
                      <td>
                        <span className={getStatusClass(record.status)}>
                          {record.status}
                        </span>
                      </td>
                      <td>{formatDuration(record.durationMs)}</td>
                      <td>
                        {record.exitCode !== undefined ? (
                          <code>{record.exitCode}</code>
                        ) : record.signal ? (
                          <code>{record.signal}</code>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        {record.error ? (
                          <span className="text-error" title={record.error}>
                            {record.error.length > 50 ? 
                              `${record.error.substring(0, 50)}...` : 
                              record.error
                            }
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RunHistory;
import React, { useState, useEffect } from 'react';
import { Scenario } from '../types';

const ScenarioLibrary: React.FC = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedScenarios, setExpandedScenarios] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadScenarios();
    
    // Listen for scenario updates
    const unsubscribeUpdated = window.api.scenarios.onUpdated((updatedScenarios: Scenario[]) => {
      setScenarios(updatedScenarios);
      setError(null);
    });
    
    const unsubscribeError = window.api.scenarios.onError((errorMessage: string) => {
      setError(errorMessage);
    });
    
    return () => {
      unsubscribeUpdated();
      unsubscribeError();
    };
  }, []);

  const loadScenarios = async () => {
    try {
      setLoading(true);
      const scenarioList = await window.api.scenarios.get();
      setScenarios(scenarioList);
      setError(null);
    } catch (err) {
      console.error('Failed to load scenarios:', err);
      setError('Failed to load scenarios: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };


  const handleReload = () => {
    loadScenarios();
  };

  const toggleScenario = (scenarioId: number) => {
    setExpandedScenarios(prev => {
      const newSet = new Set(prev);
      if (newSet.has(scenarioId)) {
        newSet.delete(scenarioId);
      } else {
        newSet.add(scenarioId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedScenarios(new Set(scenarios.map(s => s.id)));
  };

  const collapseAll = () => {
    setExpandedScenarios(new Set());
  };

  if (loading) {
    return (
      <div className="text-center mt-4">
        <div className="spinner"></div>
        <p className="mt-2">Loading scenarios...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <h1 className="flex-1">Scenario Library</h1>
        <button className="btn btn-outline btn-small" onClick={expandAll}>
          Expand All
        </button>
        <button className="btn btn-outline btn-small" onClick={collapseAll}>
          Collapse All
        </button>
        <button className="btn btn-secondary" onClick={handleReload}>
          Reload
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3" style={{ 
          backgroundColor: '#f8d7da', 
          border: '1px solid #f5c6cb', 
          borderRadius: '4px',
          color: '#721c24' 
        }}>
          <strong>Validation Error:</strong> {error}
        </div>
      )}

      {scenarios.length === 0 ? (
        <div className="text-center text-muted mt-4">
          <p>No scenarios found.</p>
          <p>Scenarios are loaded from your Haven and Hearth AppData folder.</p>
        </div>
      ) : (
        <div>
          <p className="text-muted mb-4">{scenarios.length} scenario(s) loaded</p>
          
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Steps</th>
                <th>Step Details</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map(scenario => {
                const isExpanded = expandedScenarios.has(scenario.id);
                const showSteps = isExpanded || scenario.steps.length <= 1;
                const displaySteps = showSteps ? scenario.steps : scenario.steps.slice(0, 1);
                
                return (
                  <React.Fragment key={scenario.id}>
                    <tr>
                      <td style={{ verticalAlign: 'top' }}>
                        <code>{scenario.id}</code>
                      </td>
                      <td style={{ verticalAlign: 'top' }}>
                        <strong>{scenario.name}</strong>
                      </td>
                      <td style={{ verticalAlign: 'top' }}>
                        <button 
                          className="btn btn-outline btn-small"
                          onClick={() => toggleScenario(scenario.id)}
                          style={{ padding: '2px 8px', fontSize: '12px' }}
                        >
                          {isExpanded ? '▼' : '▶'} {scenario.steps.length} step(s)
                        </button>
                      </td>
                      <td>
                        <div>
                          {scenario.steps.length > 1 && (
                            <button
                              className="btn btn-small mb-2"
                              onClick={() => toggleScenario(scenario.id)}
                              style={{
                                background: 'none',
                                border: '1px solid #ddd',
                                padding: '2px 8px',
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                            >
                              {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
                            </button>
                          )}
                          <div>
                            {displaySteps.map((step, index) => (
                              <div key={index} className="mb-1">
                                <strong>{index + 1}.</strong> <code>{step.id}</code>
                                {Object.keys(step.params).length > 0 && (
                                  <div className="text-small text-muted ml-2">
                                    {Object.entries(step.params).map(([key, value]) => (
                                      <span key={key} className="mr-2">
                                        {key}: {JSON.stringify(value)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                            {!showSteps && scenario.steps.length > 1 && (
                              <div className="text-muted text-small">
                                ... and {scenario.steps.length - 1} more steps
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScenarioLibrary;
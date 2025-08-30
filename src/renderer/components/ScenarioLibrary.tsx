import React, { useState, useEffect } from 'react';
import { Scenario } from '../types';

const ScenarioLibrary: React.FC = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedScenarios, setExpandedScenarios] = useState<Set<number>>(new Set());
  const [areaNames, setAreaNames] = useState<Record<number, string>>({});

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

  // Function to get area name, with caching
  const getAreaName = async (areaId: number): Promise<string> => {
    if (areaNames[areaId]) {
      return areaNames[areaId];
    }
    
    try {
      const name = await window.api.scenarios.getAreaName(areaId);
      setAreaNames(prev => ({ ...prev, [areaId]: name }));
      return name;
    } catch (error) {
      console.error('Failed to get area name for', areaId, error);
      return `${areaId}`;
    }
  };

  // Component to render a parameter key and value, handling area IDs specially
  const ParameterEntry: React.FC<{ paramKey: string; value: any }> = ({ paramKey, value }) => {
    const [displayKey, setDisplayKey] = useState<string>(paramKey);
    const [displayValue, setDisplayValue] = useState<string>(JSON.stringify(value));
    
    useEffect(() => {
      if (paramKey === 'areaId' && typeof value === 'number') {
        getAreaName(value).then(areaName => {
          setDisplayKey('area name');
          setDisplayValue(areaName);
        });
      } else {
        setDisplayKey(paramKey);
        setDisplayValue(JSON.stringify(value));
      }
    }, [paramKey, value]);
    
    return (
      <>
        <span style={{ fontWeight: '500' }}>{displayKey}:</span> {displayValue}
      </>
    );
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
          
          <div>
            <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '80px' }}>ID</th>
                <th style={{ width: '200px', paddingRight: '400px' }}>Name</th>
                <th style={{ width: 'auto' }}>Steps</th>
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
                        {!isExpanded ? (
                          <button 
                            className="btn btn-outline btn-small"
                            onClick={() => toggleScenario(scenario.id)}
                            style={{ padding: '4px 12px', fontSize: '12px' }}
                          >
                            ▶ {scenario.steps.length} step(s)
                          </button>
                        ) : (
                          <div>
                            <button 
                              className="btn btn-outline btn-small mb-2"
                              onClick={() => toggleScenario(scenario.id)}
                              style={{ padding: '4px 12px', fontSize: '12px' }}
                            >
                              ▼ Collapse
                            </button>
                            <div>
                              {scenario.steps.map((step, index) => (
                                <div key={index} className="mb-2" style={{ paddingLeft: '8px', borderLeft: '2px solid #e5e7eb' }}>
                                  <div>
                                    <strong>{index + 1}.</strong> <code style={{ color: '#059669', fontWeight: '500' }}>{step.id}</code>
                                  </div>
                                  {Object.keys(step.params).length > 0 && (
                                    <div className="text-small text-muted" style={{ marginTop: '4px', paddingLeft: '16px' }}>
                                      {Object.entries(step.params).map(([key, value]) => (
                                        <div key={key} style={{ marginBottom: '2px' }}>
                                          <ParameterEntry paramKey={key} value={value} />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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
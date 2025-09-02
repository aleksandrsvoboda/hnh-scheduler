import React from 'react';

const Help: React.FC = () => {
  return (
    <div className="help-container">
      <div className="help-grid">
        <div className="help-card hero-card">
          <h2>What is HnH Scheduler?</h2>
          <p>
            Automatically runs your Haven and Hearth scenarios on a schedule using the Nurgling client. 
            Works with your existing scenarios and runs completely offline with secure credential storage.
          </p>
        </div>

        <div className="help-card">
          <div className="card-icon">📋</div>
          <h2>Prerequisites</h2>
          <div className="prereq-list">
            <div className="prereq-item">
              <span className="prereq-check">✓</span>
              <span><strong>Java Runtime Environment (JRE) 21</strong> (recommended)</span>
            </div>
            <div className="prereq-item">
              <span className="prereq-check">✓</span>
              <span><strong>Nurgling client</strong> (hafen.jar)</span>
            </div>
            <div className="prereq-item">
              <span className="prereq-check">✓</span>
              <span><strong>Existing scenarios</strong> created in Nurgling</span>
            </div>
          </div>
        </div>

        <div className="help-card setup-card">
          <div className="card-icon">⚙️</div>
          <h2>First Time Setup</h2>
          
          <div className="setup-steps">
            <div className="setup-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Configure Settings</h4>
                <ul>
                  <li><strong>Java Path:</strong> Enter "java" or browse to executable</li>
                  <li><strong>Hafen JAR Path:</strong> Browse to your hafen.jar file</li>
                  <li><strong>Java Version:</strong> Check "Java 18+" if needed</li>
                </ul>
              </div>
            </div>

            <div className="setup-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Add Characters & Credentials</h4>
                <ul>
                  <li>Click <span className="btn btn-primary btn-small">Add Credential</span> for login info</li>
                  <li>Click <span className="btn btn-primary btn-small">Add Character</span> and link to credential</li>
                  <li>Passwords stored securely in system keychain</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="help-card schedule-card">
          <div className="card-icon">📅</div>
          <h2>Creating Schedules</h2>
          <div className="schedule-flow">
            <div className="flow-step">
              <strong>1.</strong> Click <span className="btn btn-outline btn-small">+ New Schedule</span>
            </div>
            <div className="flow-arrow">↓</div>
            <div className="flow-step">
              <strong>2.</strong> Set name and concurrency limit
            </div>
            <div className="flow-arrow">↓</div>
            <div className="flow-step">
              <strong>3.</strong> Click <span className="btn btn-info btn-small">Add Scenario</span> and configure
            </div>
            <div className="flow-arrow">↓</div>
            <div className="flow-step">
              <strong>4.</strong> Toggle on and <span className="btn btn-success btn-small">💾 Save All</span>
            </div>
          </div>
        </div>

        <div className="help-card">
          <div className="card-icon">📊</div>
          <h2>Monitoring</h2>
          <div className="monitoring-items">
            <div className="monitor-item">
              <div className="monitor-icon">📊</div>
              <div>
                <strong>Dashboard</strong>
                <p>Upcoming runs, active scenarios, recent failures</p>
              </div>
            </div>
            <div className="monitor-item">
              <div className="monitor-icon">📜</div>
              <div>
                <strong>Run History</strong>
                <p>Detailed logs with filtering options</p>
              </div>
            </div>
            <div className="monitor-item">
              <div className="monitor-icon">🏷️</div>
              <div>
                <strong>Status Codes</strong>
                <p>SUCCESS, FAILED, TIMEOUT, KILLED</p>
              </div>
            </div>
          </div>
        </div>

        <div className="help-card tips-card">
          <div className="card-icon">💡</div>
          <h2>Best Practices</h2>
          <div className="tips-grid">
            <div className="tip">
              <span className="tip-icon">🔍</span>
              <span><strong>Start small:</strong> Test with 1-2 scenarios</span>
            </div>
            <div className="tip">
              <span className="tip-icon">⏰</span>
              <span><strong>Avoid conflicts:</strong> Space scenarios apart</span>
            </div>
            <div className="tip">
              <span className="tip-icon">⏱️</span>
              <span><strong>Realistic timeouts:</strong> Allow completion time</span>
            </div>
            <div className="tip">
              <span className="tip-icon">⏸️</span>
              <span><strong>Use "Skip" policy:</strong> Safest option</span>
            </div>
          </div>
        </div>

        <div className="help-card troubleshoot-card">
          <div className="card-icon">🛠️</div>
          <h2>Troubleshooting</h2>
          <div className="troubleshoot-list">
            <div className="trouble-item">
              <div className="trouble-icon">🚫</div>
              <div>
                <strong>Scenarios not starting:</strong>
                <span>Check Settings for correct Java and Hafen paths</span>
              </div>
            </div>
            <div className="trouble-item">
              <div className="trouble-icon">🔐</div>
              <div>
                <strong>Login failures:</strong>
                <span>Verify credentials in Characters & Credentials</span>
              </div>
            </div>
            <div className="trouble-item">
              <div className="trouble-icon">⏰</div>
              <div>
                <strong>Timeouts:</strong>
                <span>Increase max duration or check for stuck scenarios</span>
              </div>
            </div>
          </div>
        </div>

        <div className="help-card security-card">
          <div className="card-icon">🔒</div>
          <h2>Security & Privacy</h2>
          <div className="security-features">
            <div className="security-item">
              <span className="security-check">🔐</span>
              <span>Credentials encrypted in system keychain</span>
            </div>
            <div className="security-item">
              <span className="security-check">🏠</span>
              <span>Runs completely offline</span>
            </div>
            <div className="security-item">
              <span className="security-check">🚫</span>
              <span>No external server communication</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;
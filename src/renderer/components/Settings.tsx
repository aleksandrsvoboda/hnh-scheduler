import React, { useState, useEffect } from 'react';
import { Config } from '../types';

const Settings: React.FC = () => {
  const [config, setConfig] = useState<Config | null>(null);
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
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const currentConfig = await window.api.settings.get();
      setConfig(currentConfig);
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSave = async () => {
    if (!config) return;

    try {
      setSaving(true);
      await window.api.settings.set(config);
      showConfirmDialog(
        'Settings Saved',
        'All settings have been saved successfully!',
        () => {} // Just close the dialog
      );
    } catch (error) {
      console.error('Failed to save settings:', error);
      showConfirmDialog(
        'Save Failed',
        `Failed to save settings: ${(error as Error).message}`,
        () => {} // Just close the dialog
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfigChange = (field: keyof Config, value: any) => {
    if (!config) return;
    setConfig(prev => ({
      ...prev!,
      [field]: value
    }));
  };

  const handleOpenDataDir = async () => {
    try {
      await window.api.app.openDataDir();
    } catch (error) {
      console.error('Failed to open data directory:', error);
    }
  };

  const handleJavaPathChange = async (javaPath: string) => {
    try {
      const updatedConfig = await window.api.settings.updateJavaPath(javaPath);
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update Java path:', error);
      showConfirmDialog(
        'Update Failed',
        `Failed to update Java path: ${(error as Error).message}`,
        () => {} // Just close the dialog
      );
    }
  };

  const handleHafenPathChange = async (hafenPath: string) => {
    try {
      const updatedConfig = await window.api.settings.updateHafenPath(hafenPath);
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update Hafen path:', error);
      showConfirmDialog(
        'Update Failed',
        `Failed to update Hafen path: ${(error as Error).message}`,
        () => {} // Just close the dialog
      );
    }
  };

  const handleJavaVersionChange = async (isJava18: boolean) => {
    try {
      const updatedConfig = await window.api.settings.updateJavaVersion(isJava18);
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update Java version:', error);
      showConfirmDialog(
        'Update Failed',
        `Failed to update Java version: ${(error as Error).message}`,
        () => {} // Just close the dialog
      );
    }
  };

  const handleBrowseJavaPath = async () => {
    try {
      const filePath = await window.api.app.browseFile({
        title: 'Select Java Executable',
        filters: [
          { name: 'Executable Files', extensions: ['exe'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (filePath) {
        await handleJavaPathChange(filePath);
      }
    } catch (error) {
      console.error('Failed to browse for Java path:', error);
      showConfirmDialog(
        'Browse Failed',
        'Failed to browse for Java executable.',
        () => {} // Just close the dialog
      );
    }
  };

  const handleBrowseHafenPath = async () => {
    try {
      const filePath = await window.api.app.browseFile({
        title: 'Select Hafen JAR File',
        filters: [
          { name: 'JAR Files', extensions: ['jar'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (filePath) {
        await handleHafenPathChange(filePath);
      }
    } catch (error) {
      console.error('Failed to browse for Hafen path:', error);
      showConfirmDialog(
        'Browse Failed',
        'Failed to browse for Hafen JAR file.',
        () => {} // Just close the dialog
      );
    }
  };


  if (loading) {
    return (
      <div className="text-center mt-4">
        <div className="spinner"></div>
        <p className="mt-2">Loading settings...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center mt-4">
        <p className="text-error">Failed to load configuration</p>
        <button className="btn btn-primary mt-2" onClick={loadConfig}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <h1 className="flex-1">Settings</h1>
        <button 
          className="btn btn-success btn-large" 
          onClick={handleSave}
          disabled={saving}
          style={{ fontWeight: '600', minWidth: '120px' }}
        >
          {saving ? 'Saving...' : '💾 Save Settings'}
        </button>
      </div>

      <div className="max-w-2xl">
        {/* Scenarios Information */}
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <h3 className="mb-3">Scenarios</h3>
          <p className="text-muted text-small">
            Scenarios are automatically loaded from Haven and Hearth AppData folder:
            <br />
            <code>%APPDATA%/Haven and Hearth/scenarios.nurgling.json</code>
          </p>
        </div>

        {/* Execution Settings */}
        <div className="mb-6 p-4 border rounded">
          <h3 className="mb-3">Execution Settings</h3>
          
          <div className="form-group">
            <label className="form-label">Global Concurrency Limit</label>
            <input
              type="number"
              className="form-input"
              value={config.globalConcurrencyLimit}
              onChange={(e) => handleConfigChange('globalConcurrencyLimit', parseInt(e.target.value))}
              min="1"
              max="50"
            />
            <p className="text-muted text-small mt-1">
              Maximum number of scenarios that can run simultaneously across all schedules.
            </p>
          </div>
        </div>

        {/* Game Configuration */}
        <div className="mb-6 p-4 border rounded">
          <h3 className="mb-3">Game Configuration</h3>
          
          <div className="form-group">
            <label className="form-label">Java Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="form-input flex-1"
                value={config.javaPath || ''}
                onChange={(e) => handleJavaPathChange(e.target.value)}
                placeholder="java"
              />
              <button className="btn btn-secondary" onClick={handleBrowseJavaPath}>
                Browse
              </button>
            </div>
            <p className="text-muted text-small mt-1">
              Path to Java executable. Use "java" if it's in your system PATH, or browse to select java.exe.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Hafen JAR Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="form-input flex-1"
                value={config.hafenPath || ''}
                onChange={(e) => handleHafenPathChange(e.target.value)}
                placeholder="hafen.jar"
              />
              <button className="btn btn-secondary" onClick={handleBrowseHafenPath}>
                Browse
              </button>
            </div>
            <p className="text-muted text-small mt-1">
              Path to the hafen.jar client file. Use relative or absolute path, or browse to select the JAR file.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">
              <input
                type="checkbox"
                checked={config.isJava18 || false}
                onChange={(e) => handleJavaVersionChange(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Java 18+ (Oracle)
            </label>
            <p className="text-muted text-small mt-1">
              Enable if using Java 18 or newer. Adds required export flags for modern Java versions.
            </p>
          </div>
        </div>

        {/* System Settings */}
        <div className="mb-6 p-4 border rounded">
          <h3 className="mb-3">System Settings</h3>
          
          <div className="form-group">
            <label className="form-label">
              <input
                type="checkbox"
                checked={config.autostartOnLogin}
                onChange={(e) => handleConfigChange('autostartOnLogin', e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Start HnH Scheduler automatically on login
            </label>
            <p className="text-muted text-small mt-1">
              Automatically launch the application when you log in to your computer.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Log Retention (Days)</label>
            <input
              type="number"
              className="form-input"
              value={config.logRetentionDays}
              onChange={(e) => handleConfigChange('logRetentionDays', parseInt(e.target.value))}
              min="1"
              max="365"
            />
            <p className="text-muted text-small mt-1">
              Number of days to keep run history logs before automatic cleanup.
            </p>
          </div>

          {config.dataDir && (
            <div className="form-group">
              <label className="form-label">Custom Data Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="form-input flex-1"
                  value={config.dataDir}
                  onChange={(e) => handleConfigChange('dataDir', e.target.value)}
                  placeholder="Leave empty for default location"
                />
                <button className="btn btn-secondary" onClick={handleOpenDataDir}>
                  Open
                </button>
              </div>
              <p className="text-muted text-small mt-1">
                Override the default data directory location. Restart required after changing.
              </p>
            </div>
          )}
        </div>

        {/* Data Management */}
        <div className="mb-6 p-4 border rounded">
          <h3 className="mb-3">Data Management</h3>
          
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={handleOpenDataDir}>
              Open Data Folder
            </button>
          </div>
          
          <p className="text-muted text-small mt-2">
            Access your configuration files, logs, and backup files.
          </p>
        </div>

        {/* Status Information */}
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <h3 className="mb-3">System Information</h3>
          
          <div className="text-small">
            <div className="mb-1">
              <strong>Schema Version:</strong> {config.schemaVersion}
            </div>
            <div className="mb-1">
              <strong>Data Directory:</strong> {config.dataDir || 'Default (AppData)'}
            </div>
            <div className="mb-1">
              <strong>Scenarios File:</strong> Haven and Hearth AppData folder (fixed location)
            </div>
          </div>
        </div>
      </div>

      {/* Custom Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#374151' }}>
              {confirmDialog.title}
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#6b7280', lineHeight: '1.5' }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={confirmDialog.onCancel}
              >
                Cancel
              </button>
              <button
                className={`btn ${confirmDialog.title.includes('Save') || confirmDialog.title.includes('Update') ? 'btn-primary' : 'btn-danger'}`}
                onClick={confirmDialog.onConfirm}
              >
                {confirmDialog.title.includes('Save') || confirmDialog.title.includes('Update') ? 'OK' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
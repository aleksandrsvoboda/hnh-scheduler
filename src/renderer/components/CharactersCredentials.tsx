import React, { useState, useEffect } from 'react';
import { Character, CredentialRef } from '../types';

interface CredentialFormData {
  id?: string;
  label: string;
  username: string;
  password: string;
}

interface CharacterFormData {
  id?: string;
  name: string;
  credentialId: string;
  meta: Record<string, any>;
}

const CharactersCredentials: React.FC = () => {
  const [credentials, setCredentials] = useState<CredentialRef[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Credential form state
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [credentialForm, setCredentialForm] = useState<CredentialFormData>({
    label: '',
    username: '',
    password: ''
  });
  const [credentialFormType, setCredentialFormType] = useState<'create' | 'edit' | 'setSecret'>('create');
  
  // Character form state
  const [showCharacterForm, setShowCharacterForm] = useState(false);
  const [characterForm, setCharacterForm] = useState<CharacterFormData>({
    name: '',
    credentialId: '',
    meta: {}
  });
  const [characterFormType, setCharacterFormType] = useState<'create' | 'edit'>('create');

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

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowCredentialForm(false);
        setShowCharacterForm(false);
      }
    };

    if (showCredentialForm || showCharacterForm) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [showCredentialForm, showCharacterForm]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [credentialsList, charactersList] = await Promise.all([
        window.api.credentials.list(),
        window.api.characters.list()
      ]);
      setCredentials(credentialsList);
      setCharacters(charactersList);
    } catch (error) {
      console.error('Failed to load data:', error);
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

  // Credential handlers
  const handleCreateCredential = () => {
    setCredentialForm({ label: '', username: '', password: '' });
    setCredentialFormType('create');
    setShowCredentialForm(true);
  };

  const handleEditCredential = (credential: CredentialRef) => {
    setCredentialForm({ 
      id: credential.id, 
      label: credential.label, 
      username: '', 
      password: '' 
    });
    setCredentialFormType('edit');
    setShowCredentialForm(true);
  };

  const handleSetSecret = (credential: CredentialRef) => {
    setCredentialForm({ 
      id: credential.id, 
      label: credential.label, 
      username: '', 
      password: '' 
    });
    setCredentialFormType('setSecret');
    setShowCredentialForm(true);
  };

  const handleSubmitCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (credentialFormType === 'create') {
        const newCredential = await window.api.credentials.create(credentialForm.label);
        if (credentialForm.username && credentialForm.password) {
          await window.api.credentials.setSecret(newCredential.id, {
            username: credentialForm.username,
            password: credentialForm.password
          });
        }
      } else if (credentialFormType === 'edit') {
        await window.api.credentials.updateLabel(credentialForm.id!, credentialForm.label);
      } else if (credentialFormType === 'setSecret') {
        await window.api.credentials.setSecret(credentialForm.id!, {
          username: credentialForm.username,
          password: credentialForm.password
        });
      }
      
      setShowCredentialForm(false);
      await loadData();
      showConfirmDialog(
        'Credential Saved',
        'Credential has been saved successfully!',
        () => {} // Just close the dialog
      );
    } catch (error) {
      console.error('Failed to save credential:', error);
      showConfirmDialog(
        'Save Failed',
        `Failed to save credential: ${(error as Error).message}`,
        () => {} // Just close the dialog
      );
    }
  };

  const handleDeleteCredential = async (id: string) => {
    const credential = credentials.find(c => c.id === id);
    const credentialLabel = credential?.label || 'this credential';
    const usageCount = getCharacterUsageCount(id);
    
    const message = usageCount > 0
      ? `Are you sure you want to delete "${credentialLabel}"? This credential is currently used by ${usageCount} character(s). This action cannot be undone.`
      : `Are you sure you want to delete "${credentialLabel}"? This action cannot be undone.`;
    
    showConfirmDialog(
      'Delete Credential',
      message,
      async () => {
        try {
          await window.api.credentials.delete(id);
          await loadData();
        } catch (error) {
          console.error('Failed to delete credential:', error);
          showConfirmDialog(
            'Delete Failed',
            `Failed to delete credential: ${(error as Error).message}`,
            () => {} // Just close the dialog
          );
        }
      }
    );
  };

  // Character handlers
  const handleCreateCharacter = () => {
    setCharacterForm({ name: '', credentialId: '', meta: {} });
    setCharacterFormType('create');
    setShowCharacterForm(true);
  };

  const handleEditCharacter = (character: Character) => {
    setCharacterForm({ 
      ...character,
      meta: character.meta || {}
    });
    setCharacterFormType('edit');
    setShowCharacterForm(true);
  };

  const handleSubmitCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (characterFormType === 'create') {
        await window.api.characters.create({
          name: characterForm.name,
          credentialId: characterForm.credentialId,
          meta: characterForm.meta
        });
      } else {
        await window.api.characters.update({
          id: characterForm.id!,
          name: characterForm.name,
          credentialId: characterForm.credentialId,
          meta: characterForm.meta
        });
      }
      
      setShowCharacterForm(false);
      await loadData();
      showConfirmDialog(
        'Character Saved',
        'Character has been saved successfully!',
        () => {} // Just close the dialog
      );
    } catch (error) {
      console.error('Failed to save character:', error);
      showConfirmDialog(
        'Save Failed',
        `Failed to save character: ${(error as Error).message}`,
        () => {} // Just close the dialog
      );
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    const character = characters.find(c => c.id === id);
    const characterName = character?.name || 'this character';
    
    showConfirmDialog(
      'Delete Character',
      `Are you sure you want to delete "${characterName}"? This action cannot be undone.`,
      async () => {
        try {
          await window.api.characters.delete(id);
          await loadData();
        } catch (error) {
          console.error('Failed to delete character:', error);
          showConfirmDialog(
            'Delete Failed',
            `Failed to delete character: ${(error as Error).message}`,
            () => {} // Just close the dialog
          );
        }
      }
    );
  };

  const getCredentialLabel = (credentialId: string) => {
    const credential = credentials.find(c => c.id === credentialId);
    return credential ? credential.label : 'Unknown';
  };

  const getCharacterUsageCount = (credentialId: string) => {
    return characters.filter(c => c.credentialId === credentialId).length;
  };

  // Generate consistent colors for credential badges
  const getCredentialBadgeStyle = (label: string) => {
    const colors = [
      { bg: '#d4edda', color: '#155724', border: '#c3e6cb' }, // green
      { bg: '#fff3cd', color: '#856404', border: '#ffeaa7' }, // yellow  
      { bg: '#d1ecf1', color: '#0c5460', border: '#bee5eb' }, // blue
      { bg: '#f8d7da', color: '#721c24', border: '#f5c6cb' }, // red
      { bg: '#e2e3e5', color: '#383d41', border: '#d6d8db' }, // gray
      { bg: '#d1f2eb', color: '#0c5460', border: '#bce2d6' }, // teal
      { bg: '#fce4ec', color: '#880e4f', border: '#f8bbd9' }, // pink
      { bg: '#e8f5e8', color: '#2e7d32', border: '#c8e6c9' }, // light green
    ];
    
    // Generate consistent index based on label
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = ((hash << 5) - hash + label.charCodeAt(i)) & 0xffffffff;
    }
    const colorIndex = Math.abs(hash) % colors.length;
    
    return colors[colorIndex];
  };

  if (loading) {
    return (
      <div className="text-center mt-4">
        <div className="spinner"></div>
        <p className="mt-2">Loading data...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4">Characters & Credentials</h1>

      {/* Credentials Section */}
      <div className="card mb-6">
        <div className="section-header">
          <div className="flex gap-2 items-center">
            <div className="flex-1">Credentials</div>
            <button className="btn btn-primary btn-small" onClick={handleCreateCredential}>
              Add Credential
            </button>
          </div>
        </div>
        <div className="section-content">
          {credentials.length === 0 ? (
            <div className="text-center text-muted" style={{ padding: '40px 20px' }}>
              <p>No credentials configured</p>
              <p className="info-text">Click "Add Credential" to create your first credential set</p>
            </div>
          ) : (
            <table className="table" style={{ marginBottom: 0, tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '300px' }}>Label</th>
                  <th style={{ width: '250px' }}>Used by Characters</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map(credential => (
                  <tr key={credential.id}>
                    <td style={{ verticalAlign: 'top' }}>
                      <span 
                        className="schedule-badge" 
                        style={{
                          textTransform: 'none',
                          backgroundColor: getCredentialBadgeStyle(credential.label).bg,
                          color: getCredentialBadgeStyle(credential.label).color,
                          border: `1px solid ${getCredentialBadgeStyle(credential.label).border}`
                        }}
                      >
                        {credential.label}
                      </span>
                    </td>
                    <td style={{ verticalAlign: 'top' }}>
                      <span className="status status-info">
                        {getCharacterUsageCount(credential.id)} character(s)
                      </span>
                    </td>
                    <td style={{ verticalAlign: 'top' }}>
                      <div className="button-group">
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => handleEditCredential(credential)}
                        >
                          Edit Label
                        </button>
                        <button
                          className="btn btn-primary btn-small"
                          onClick={() => handleSetSecret(credential)}
                        >
                          Set Secret
                        </button>
                        <button
                          className="btn btn-danger btn-small"
                          onClick={() => handleDeleteCredential(credential.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Characters Section */}
      <div className="card">
        <div className="section-header">
          <div className="flex gap-2 items-center">
            <div className="flex-1">Characters</div>
            <button 
              className="btn btn-primary btn-small" 
              onClick={handleCreateCharacter}
              disabled={credentials.length === 0}
            >
              Add Character
            </button>
          </div>
        </div>
        <div className="section-content">
          {credentials.length === 0 ? (
            <div className="text-center text-muted" style={{ padding: '40px 20px' }}>
              <p>Create credentials first before adding characters</p>
              <p className="info-text">Characters need credentials to access Haven and Hearth accounts</p>
            </div>
          ) : characters.length === 0 ? (
            <div className="text-center text-muted" style={{ padding: '40px 20px' }}>
              <p>No characters configured</p>
              <p className="info-text">Click "Add Character" to create your first character</p>
            </div>
          ) : (
            <table className="table" style={{ marginBottom: 0, tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '300px' }}>Name</th>
                  <th style={{ width: '250px' }}>Credential</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {characters.map(character => (
                  <tr key={character.id}>
                    <td style={{ verticalAlign: 'top' }}><strong>{character.name}</strong></td>
                    <td style={{ verticalAlign: 'top' }}>
                      <span 
                        className="schedule-badge" 
                        style={{
                          textTransform: 'none',
                          backgroundColor: getCredentialBadgeStyle(getCredentialLabel(character.credentialId)).bg,
                          color: getCredentialBadgeStyle(getCredentialLabel(character.credentialId)).color,
                          border: `1px solid ${getCredentialBadgeStyle(getCredentialLabel(character.credentialId)).border}`
                        }}
                      >
                        {getCredentialLabel(character.credentialId)}
                      </span>
                    </td>
                    <td style={{ verticalAlign: 'top' }}>
                      <div className="button-group">
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => handleEditCharacter(character)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-small"
                          onClick={() => handleDeleteCharacter(character.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Credential Form Modal */}
      {showCredentialForm && (
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
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCredentialForm(false);
            }
          }}
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
            <h3 className="mb-4">
              {credentialFormType === 'create' ? 'Create Credential' :
               credentialFormType === 'edit' ? 'Edit Credential Label' : 'Set Credential Secret'}
            </h3>
            
            <form onSubmit={handleSubmitCredential}>
              {credentialFormType !== 'setSecret' && (
                <div className="form-group">
                  <label className="form-label">Label</label>
                  <input
                    type="text"
                    className="form-input"
                    value={credentialForm.label}
                    onChange={(e) => setCredentialForm(prev => ({ ...prev, label: e.target.value }))}
                    onFocus={(e) => e.target.select()}
                    autoFocus
                    required
                    placeholder="Enter credential label..."
                  />
                </div>
              )}
              
              {credentialFormType !== 'edit' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-input"
                      value={credentialForm.username}
                      onChange={(e) => setCredentialForm(prev => ({ ...prev, username: e.target.value }))}
                      onFocus={(e) => e.target.select()}
                      autoFocus={credentialFormType === 'setSecret'}
                      required={credentialFormType === 'setSecret'}
                      placeholder="Enter username..."
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-input"
                      value={credentialForm.password}
                      onChange={(e) => setCredentialForm(prev => ({ ...prev, password: e.target.value }))}
                      onFocus={(e) => e.target.select()}
                      required={credentialFormType === 'setSecret'}
                      placeholder="Enter password..."
                    />
                  </div>
                </>
              )}
              
              <div className="flex gap-2 mt-4">
                <button type="submit" className="btn btn-primary">
                  {credentialFormType === 'create' ? 'Create' : 'Save'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowCredentialForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Character Form Modal */}
      {showCharacterForm && (
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
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCharacterForm(false);
            }
          }}
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
            <h3 className="mb-4">
              {characterFormType === 'create' ? 'Create Character' : 'Edit Character'}
            </h3>
            
            <form onSubmit={handleSubmitCharacter}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={characterForm.name}
                  onChange={(e) => setCharacterForm(prev => ({ ...prev, name: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  autoFocus
                  required
                  placeholder="Enter character name..."
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Credential</label>
                <select
                  className="form-select"
                  value={characterForm.credentialId}
                  onChange={(e) => setCharacterForm(prev => ({ ...prev, credentialId: e.target.value }))}
                  required
                >
                  <option value="">Select credential...</option>
                  {credentials.map(credential => (
                    <option key={credential.id} value={credential.id}>
                      {credential.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-2 mt-4">
                <button type="submit" className="btn btn-primary">
                  {characterFormType === 'create' ? 'Create' : 'Save'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowCharacterForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              width: '450px',
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
                className={confirmDialog.title.includes('Saved') || confirmDialog.title.includes('Save Failed') || confirmDialog.title.includes('Delete Failed') ? 'btn btn-primary' : 'btn btn-danger'}
                onClick={confirmDialog.onConfirm}
              >
                {confirmDialog.title.includes('Saved') || confirmDialog.title.includes('Failed') ? 'OK' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharactersCredentials;
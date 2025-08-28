import { app } from 'electron';
import * as path from 'path';
import { JsonStore } from './json-store';
import { CredentialsFile, CredentialRef } from '../types';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_CREDENTIALS: CredentialsFile = {
  schemaVersion: 1,
  credentials: [],
};

export class CredentialsStore extends JsonStore<CredentialsFile> {
  constructor(dataDir?: string) {
    const configDir = dataDir || app.getPath('userData');
    const credentialsPath = path.join(configDir, 'credentials.json');
    
    super(credentialsPath, DEFAULT_CREDENTIALS, 1);
  }

  async create(label: string): Promise<CredentialRef> {
    const newCredential: CredentialRef = {
      id: uuidv4(),
      label: label.trim(),
    };

    await this.update(data => ({
      ...data,
      credentials: [...data.credentials, newCredential]
    }));

    return newCredential;
  }

  async updateLabel(id: string, label: string): Promise<void> {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      throw new Error('Label cannot be empty');
    }

    await this.update(data => {
      const index = data.credentials.findIndex(c => c.id === id);
      if (index === -1) {
        throw new Error(`Credential with id ${id} not found`);
      }

      const updated = [...data.credentials];
      updated[index] = { ...updated[index], label: trimmedLabel };

      return {
        ...data,
        credentials: updated
      };
    });
  }

  async delete(id: string): Promise<void> {
    await this.update(data => {
      const index = data.credentials.findIndex(c => c.id === id);
      if (index === -1) {
        throw new Error(`Credential with id ${id} not found`);
      }

      return {
        ...data,
        credentials: data.credentials.filter(c => c.id !== id)
      };
    });
  }

  list(): CredentialRef[] {
    return this.get().credentials;
  }

  findById(id: string): CredentialRef | undefined {
    return this.get().credentials.find(c => c.id === id);
  }
}
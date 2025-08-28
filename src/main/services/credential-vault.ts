import * as keytar from 'keytar';
import { EventEmitter } from 'events';

const SERVICE_NAME = 'HnH-Scheduler';

export interface CredentialSecret {
  username: string;
  password: string;
}

export class CredentialVault extends EventEmitter {
  private fallbackMode = false;

  constructor() {
    super();
    this.checkKeytarAvailability();
  }

  private async checkKeytarAvailability(): Promise<void> {
    try {
      // Test if keytar is working
      await keytar.findCredentials(SERVICE_NAME);
      this.fallbackMode = false;
    } catch (error) {
      console.warn('Keytar not available, entering fallback mode:', error);
      this.fallbackMode = true;
      this.emit('fallback-mode', true);
    }
  }

  async setSecret(credentialId: string, secret: CredentialSecret): Promise<void> {
    if (this.fallbackMode) {
      // In fallback mode, we don't store secrets
      console.warn('Cannot store secrets in fallback mode');
      return;
    }

    try {
      const serialized = JSON.stringify(secret);
      await keytar.setPassword(SERVICE_NAME, credentialId, serialized);
    } catch (error) {
      console.error('Failed to store credential:', error);
      throw new Error('Failed to store credential securely');
    }
  }

  async getSecret(credentialId: string): Promise<CredentialSecret | null> {
    if (this.fallbackMode) {
      // In fallback mode, return null so UI will prompt for credentials
      return null;
    }

    try {
      const stored = await keytar.getPassword(SERVICE_NAME, credentialId);
      if (!stored) {
        return null;
      }

      return JSON.parse(stored) as CredentialSecret;
    } catch (error) {
      console.error('Failed to retrieve credential:', error);
      return null;
    }
  }

  async deleteSecret(credentialId: string): Promise<void> {
    if (this.fallbackMode) {
      return;
    }

    try {
      await keytar.deletePassword(SERVICE_NAME, credentialId);
    } catch (error) {
      console.error('Failed to delete credential:', error);
      // Don't throw - deletion failure shouldn't block other operations
    }
  }

  async listCredentials(): Promise<Array<{ account: string; service: string }>> {
    if (this.fallbackMode) {
      return [];
    }

    try {
      const credentials = await keytar.findCredentials(SERVICE_NAME);
      // keytar.findCredentials returns Array<{account: string, password: string}>
      // but we want Array<{account: string, service: string}> for our interface
      return credentials.map(cred => ({
        account: cred.account,
        service: SERVICE_NAME
      }));
    } catch (error) {
      console.error('Failed to list credentials:', error);
      return [];
    }
  }

  isFallbackMode(): boolean {
    return this.fallbackMode;
  }
}
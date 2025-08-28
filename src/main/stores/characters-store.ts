import { app } from 'electron';
import * as path from 'path';
import { JsonStore } from './json-store';
import { CharactersFile, Character } from '../types';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_CHARACTERS: CharactersFile = {
  schemaVersion: 1,
  characters: [],
};

export class CharactersStore extends JsonStore<CharactersFile> {
  constructor(dataDir?: string) {
    const configDir = dataDir || app.getPath('userData');
    const charactersPath = path.join(configDir, 'characters.json');
    
    super(charactersPath, DEFAULT_CHARACTERS, 1);
  }

  async create(character: Omit<Character, 'id'>): Promise<Character> {
    if (!character.name?.trim()) {
      throw new Error('Character name is required');
    }
    if (!character.credentialId?.trim()) {
      throw new Error('Credential ID is required');
    }

    const newCharacter: Character = {
      id: uuidv4(),
      name: character.name.trim(),
      credentialId: character.credentialId,
      meta: character.meta || {},
    };

    await this.update(data => ({
      ...data,
      characters: [...data.characters, newCharacter]
    }));

    return newCharacter;
  }

  async updateCharacter(character: Character): Promise<void> {
    if (!character.name?.trim()) {
      throw new Error('Character name is required');
    }
    if (!character.credentialId?.trim()) {
      throw new Error('Credential ID is required');
    }

    await this.update(data => {
      const index = data.characters.findIndex(c => c.id === character.id);
      if (index === -1) {
        throw new Error(`Character with id ${character.id} not found`);
      }

      const updated = [...data.characters];
      updated[index] = {
        ...character,
        name: character.name.trim(),
      };

      return {
        ...data,
        characters: updated
      };
    });
  }

  async delete(id: string): Promise<void> {
    await this.update(data => {
      const index = data.characters.findIndex(c => c.id === id);
      if (index === -1) {
        throw new Error(`Character with id ${id} not found`);
      }

      return {
        ...data,
        characters: data.characters.filter(c => c.id !== id)
      };
    });
  }

  list(): Character[] {
    return this.get().characters;
  }

  findById(id: string): Character | undefined {
    return this.get().characters.find(c => c.id === id);
  }

  findByCredentialId(credentialId: string): Character[] {
    return this.get().characters.filter(c => c.credentialId === credentialId);
  }
}
import { db } from './db';
import type { Settings } from '@/types';

const DEFAULT_SETTINGS: Omit<Settings, 'id'> = {
  theme: 'light',
  soundEnabled: true,
  sortBy: 'priority',
};

export async function getSettings(): Promise<Settings> {
  try {
    const settings = await db.settings.toCollection().first();
    if (settings) return settings;
    const id = await db.settings.add({ ...DEFAULT_SETTINGS });
    return { id, ...DEFAULT_SETTINGS };
  } catch {
    return { id: 0, ...DEFAULT_SETTINGS };
  }
}

export async function updateSettings(updates: Partial<Omit<Settings, 'id'>>) {
  try {
    const settings = await getSettings();
    if (settings.id) {
      await db.settings.update(settings.id, updates);
    }
  } catch {
    // ignore
  }
}

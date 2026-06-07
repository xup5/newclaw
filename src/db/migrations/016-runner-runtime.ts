import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration016: Migration = {
  version: 16,
  name: 'runner-runtime',
  up(_db: Database.Database) {
    // Host-native runners are the only runtime.
  },
};

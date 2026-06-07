import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration015: Migration = {
  version: 15,
  name: 'cli-scope',
  up(_db: Database.Database) {
    // Folded into migration 014 for the host-native rebuild.
  },
};

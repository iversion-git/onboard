/**
 * Test setup utilities
 */

import { beforeEach } from 'vitest';
import { resetConfig } from './config.js';

// Reset configuration before each test
beforeEach(() => {
  resetConfig();
});
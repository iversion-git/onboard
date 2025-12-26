import { describe, it, expect } from 'vitest';

describe('Project Setup', () => {
  it('should have a working test environment', () => {
    expect(true).toBe(true);
  });

  it('should be able to import Node.js modules', () => {
    const path = require('path');
    expect(typeof path.join).toBe('function');
  });
});
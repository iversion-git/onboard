/**
 * Unit tests for logging utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLogger, createLoggerFromCorrelationId } from './logging.js';
import { LogContext } from './types.js';

describe('Logging Utilities', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {})
    };
  });

  describe('createLogger', () => {
    it('should create logger with context', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
        operation: 'test-operation',
        stage: 'test',
        staffId: 'staff-123'
      };

      const logger = createLogger(context);
      expect(logger).toBeDefined();
    });

    it('should log info messages with structured format', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
        operation: 'test-operation',
        stage: 'test'
      };

      const logger = createLogger(context);
      logger.info('Test message', { key: 'value' });

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('"level":"INFO"')
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Test message"')
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('"correlationId":"test-correlation-id"')
      );
    });

    it('should mask sensitive data in logs', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
        operation: 'test-operation',
        stage: 'test'
      };

      const logger = createLogger(context);
      logger.info('Test message', { 
        password: 'secret123',
        email: 'test@example.com',
        normalField: 'normal-value'
      });

      const logCall = consoleSpy.info.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      
      expect(logData.data.password).toBe('[MASKED]');
      expect(logData.data.email).toBe('[MASKED]');
      expect(logData.data.normalField).toBe('normal-value');
    });

    it('should mask PII in message text', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
        operation: 'test-operation',
        stage: 'test'
      };

      const logger = createLogger(context);
      logger.info('User email is test@example.com');

      const logCall = consoleSpy.info.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      
      expect(logData.message).toBe('User email is [MASKED]');
    });
  });

  describe('createLoggerFromCorrelationId', () => {
    it('should create logger from correlation ID', () => {
      const logger = createLoggerFromCorrelationId('test-id', 'test-op', 'staff-123');
      expect(logger).toBeDefined();
      
      logger.info('Test message');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('"correlationId":"test-id"')
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('"operation":"test-op"')
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('"staffId":"staff-123"')
      );
    });

    it('should create logger without staff ID', () => {
      const logger = createLoggerFromCorrelationId('test-id', 'test-op');
      expect(logger).toBeDefined();
      
      logger.info('Test message');
      
      const logCall = consoleSpy.info.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      
      expect(logData.staffId).toBeUndefined();
    });
  });
});
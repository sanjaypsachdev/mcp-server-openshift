import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ProgressLogger,
  createProgressLogger,
  createLegacyProgressLogger,
} from '../../src/utils/progress-logger.js';

describe('ProgressLogger', () => {
  let logger: ProgressLogger;

  beforeEach(() => {
    logger = new ProgressLogger();
  });

  describe('basic functionality', () => {
    it('should add progress entries with correct format', () => {
      logger.addProgress('Test message');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Test message');
      expect(entries[0].level).toBe('INFO');
      expect(entries[0].formattedMessage).toMatch(/^\[[\d.]+s\] INFO: Test message$/);
    });

    it('should support different log levels', () => {
      logger.addProgress('Info message', 'INFO');
      logger.addProgress('Success message', 'SUCCESS');
      logger.addProgress('Warning message', 'WARNING');
      logger.addProgress('Error message', 'ERROR');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(4);
      expect(entries[0].level).toBe('INFO');
      expect(entries[1].level).toBe('SUCCESS');
      expect(entries[2].level).toBe('WARNING');
      expect(entries[3].level).toBe('ERROR');
    });

    it('should track elapsed time correctly', () => {
      const startTime = Date.now();
      logger.addProgress('First message');

      // Mock time passage
      vi.spyOn(Date, 'now').mockReturnValue(startTime + 1500);
      logger.addProgress('Second message');

      const entries = logger.getEntries();
      expect(entries[0].elapsed).toBeCloseTo(0, 1);
      expect(entries[1].elapsed).toBeCloseTo(1.5, 1);
    });
  });

  describe('filtering and querying', () => {
    beforeEach(() => {
      logger.addProgress('Info message', 'INFO');
      logger.addProgress('Success message', 'SUCCESS');
      logger.addProgress('Warning message', 'WARNING');
      logger.addProgress('Error message', 'ERROR');
    });

    it('should filter entries by log level', () => {
      const errorEntries = logger.getEntriesByLevel('ERROR');
      const warningEntries = logger.getEntriesByLevel('WARNING');

      expect(errorEntries).toHaveLength(1);
      expect(errorEntries[0].level).toBe('ERROR');
      expect(warningEntries).toHaveLength(1);
      expect(warningEntries[0].level).toBe('WARNING');
    });

    it('should detect errors and warnings', () => {
      expect(logger.hasErrors()).toBe(true);
      expect(logger.hasWarnings()).toBe(true);
    });

    it('should generate correct summary statistics', () => {
      const summary = logger.getSummary();

      expect(summary.totalEntries).toBe(4);
      expect(summary.errors).toBe(1);
      expect(summary.warnings).toBe(1);
      expect(summary.successes).toBe(1);
      expect(summary.info).toBe(1);
      expect(summary.totalTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('formatted output', () => {
    it('should return formatted log as string array', () => {
      logger.addProgress('Test message', 'INFO');

      const formatted = logger.getFormattedLog();
      expect(formatted).toHaveLength(1);
      expect(formatted[0]).toMatch(/^\[[\d.]+s\] INFO: Test message$/);
    });
  });

  describe('utility methods', () => {
    it('should add completion message with success', () => {
      logger.addCompletion('Test operation', true);

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('SUCCESS');
      expect(entries[0].message).toMatch(/🎉 Test operation completed successfully/);
    });

    it('should add completion message with failure', () => {
      logger.addCompletion('Test operation', false);

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('ERROR');
      expect(entries[0].message).toMatch(/💥 Test operation failed/);
    });

    it('should add standard validation messages', () => {
      logger.addValidationStart();
      logger.addValidationError('Invalid parameter');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].message).toBe('📋 Parameters validated successfully');
      expect(entries[1].message).toBe('❌ Parameter validation failed: Invalid parameter');
      expect(entries[1].level).toBe('ERROR');
    });

    it('should add operation start message', () => {
      logger.addOperationStart('test operation');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('🚀 Starting test operation');
    });

    it('should add resource verification messages', () => {
      logger.addResourceVerification('pod', 'test-pod');
      logger.addResourceVerified('pod', 'test-pod');
      logger.addResourceNotFound('service', 'missing-svc', 'Service not found');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0].message).toBe('🔍 Verifying pod/test-pod exists...');
      expect(entries[1].message).toBe('✅ Resource verified: pod/test-pod');
      expect(entries[1].level).toBe('SUCCESS');
      expect(entries[2].message).toBe(
        '❌ Resource service/missing-svc verification failed: Service not found'
      );
      expect(entries[2].level).toBe('ERROR');
    });
  });

  describe('clear functionality', () => {
    it('should clear all entries and reset start time', () => {
      logger.addProgress('Test message');
      expect(logger.getEntries()).toHaveLength(1);

      logger.clear();
      expect(logger.getEntries()).toHaveLength(0);
      expect(logger.getTotalElapsedTime()).toBeCloseTo(0, 1);
    });
  });
});

describe('createProgressLogger', () => {
  it('should create a new ProgressLogger instance', () => {
    const logger = createProgressLogger();
    expect(logger).toBeInstanceOf(ProgressLogger);
  });
});

describe('createLegacyProgressLogger', () => {
  it('should create legacy-compatible progress logger', () => {
    const { addProgress, getProgressLog, getLogger } = createLegacyProgressLogger();

    addProgress('Test message', 'INFO');
    addProgress('Error message', 'ERROR');

    const log = getProgressLog();
    expect(log).toHaveLength(2);
    expect(log[0]).toMatch(/^\[[\d.]+s\] INFO: Test message$/);
    expect(log[1]).toMatch(/^\[[\d.]+s\] ERROR: Error message$/);

    const logger = getLogger();
    expect(logger).toBeInstanceOf(ProgressLogger);
    expect(logger.getEntries()).toHaveLength(2);
  });
});

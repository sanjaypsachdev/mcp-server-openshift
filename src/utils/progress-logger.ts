/**
 * Shared progress logging utility for OpenShift tools
 * Provides consistent progress tracking with timestamps and log levels
 */

export type LogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface ProgressEntry {
  timestamp: number;
  elapsed: number;
  level: LogLevel;
  message: string;
  formattedMessage: string;
}

export class ProgressLogger {
  private progressLog: ProgressEntry[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Add a progress log entry with timestamp and elapsed time
   */
  addProgress(message: string, level: LogLevel = 'INFO'): void {
    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000;
    const formattedMessage = `[${elapsed.toFixed(1)}s] ${level}: ${message}`;

    const entry: ProgressEntry = {
      timestamp: now,
      elapsed,
      level,
      message,
      formattedMessage,
    };

    this.progressLog.push(entry);
  }

  /**
   * Get all progress log entries
   */
  getEntries(): ProgressEntry[] {
    return [...this.progressLog];
  }

  /**
   * Get formatted progress log as string array (for backward compatibility)
   */
  getFormattedLog(): string[] {
    return this.progressLog.map(entry => entry.formattedMessage);
  }

  /**
   * Get entries filtered by log level
   */
  getEntriesByLevel(level: LogLevel): ProgressEntry[] {
    return this.progressLog.filter(entry => entry.level === level);
  }

  /**
   * Get the total elapsed time since logger creation
   */
  getTotalElapsedTime(): number {
    return (Date.now() - this.startTime) / 1000;
  }

  /**
   * Check if there are any error entries
   */
  hasErrors(): boolean {
    return this.progressLog.some(entry => entry.level === 'ERROR');
  }

  /**
   * Check if there are any warning entries
   */
  hasWarnings(): boolean {
    return this.progressLog.some(entry => entry.level === 'WARNING');
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalEntries: number;
    errors: number;
    warnings: number;
    successes: number;
    info: number;
    totalTime: number;
  } {
    const entries = this.progressLog;
    return {
      totalEntries: entries.length,
      errors: entries.filter(e => e.level === 'ERROR').length,
      warnings: entries.filter(e => e.level === 'WARNING').length,
      successes: entries.filter(e => e.level === 'SUCCESS').length,
      info: entries.filter(e => e.level === 'INFO').length,
      totalTime: this.getTotalElapsedTime(),
    };
  }

  /**
   * Clear all progress entries
   */
  clear(): void {
    this.progressLog = [];
    this.startTime = Date.now();
  }

  /**
   * Add a completion message with total time
   */
  addCompletion(operationName: string, success: boolean = true): void {
    const totalTime = this.getTotalElapsedTime().toFixed(1);
    const level = success ? 'SUCCESS' : 'ERROR';
    const emoji = success ? '🎉' : '💥';
    const status = success ? 'completed successfully' : 'failed';

    this.addProgress(`${emoji} ${operationName} ${status} in ${totalTime}s`, level);
  }

  /**
   * Add standard validation messages
   */
  addValidationStart(): void {
    this.addProgress('📋 Parameters validated successfully');
  }

  addValidationError(error: string): void {
    this.addProgress(`❌ Parameter validation failed: ${error}`, 'ERROR');
  }

  /**
   * Add standard operation start message
   */
  addOperationStart(operationName: string): void {
    this.addProgress(`🚀 Starting ${operationName}`);
  }

  /**
   * Add resource verification messages
   */
  addResourceVerification(resourceType: string, name: string): void {
    this.addProgress(`🔍 Verifying ${resourceType}/${name} exists...`);
  }

  addResourceVerified(resourceType: string, name: string): void {
    this.addProgress(`✅ Resource verified: ${resourceType}/${name}`, 'SUCCESS');
  }

  addResourceNotFound(resourceType: string, name: string, error?: string): void {
    const message = error
      ? `❌ Resource ${resourceType}/${name} verification failed: ${error}`
      : `❌ Resource ${resourceType}/${name} not found`;
    this.addProgress(message, 'ERROR');
  }
}

/**
 * Create a new progress logger instance
 */
export function createProgressLogger(): ProgressLogger {
  return new ProgressLogger();
}

/**
 * Legacy function for backward compatibility
 * Creates a simple addProgress function that works with existing code
 */
export function createLegacyProgressLogger(): {
  addProgress: (message: string, level?: LogLevel) => void;
  getProgressLog: () => string[];
  getLogger: () => ProgressLogger;
} {
  const logger = new ProgressLogger();

  return {
    addProgress: (message: string, level: LogLevel = 'INFO') => {
      logger.addProgress(message, level);
    },
    getProgressLog: () => logger.getFormattedLog(),
    getLogger: () => logger,
  };
}

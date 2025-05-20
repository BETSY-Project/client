/**
 * Log type enum
 */
export enum LogType {
  INFO = 'info',
  ERROR = 'error',
  SUCCESS = 'success',
  WARNING = 'warning'
}

/**
 * Log entry interface
 */
export interface LogEntry {
  id: string;
  timestamp: number;
  type: LogType;
  message: string;
  details?: unknown;
}

/**
 * Log storage interface
 * Abstract storage layer to allow for different storage implementations
 */
export interface LogStorage {
  /**
   * Store a log entry
   */
  store(entry: Omit<LogEntry, 'id'>): Promise<LogEntry>;
  
  /**
   * Retrieve all log entries
   */
  getAll(): Promise<LogEntry[]>;
  
  /**
   * Retrieve logs by type
   */
  getByType(type: LogType): Promise<LogEntry[]>;
  
  /**
   * Clear all logs
   */
  clear(): Promise<void>;
  
  /**
   * Get logs count
   */
  count(): Promise<number>;
}
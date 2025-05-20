import { LogEntry, LogStorage, LogType } from './types';
import { IndexedDBLogStorage } from './indexed-db-storage';

// Custom event for log updates
export interface LogUpdateEvent {
  type: 'add' | 'clear';
  entry?: LogEntry;
}

// Type for log update listeners
type LogUpdateListener = (event: LogUpdateEvent) => void;

/**
 * Logger service
 * Provides methods for logging messages and accessing logs
 */
class Logger {
  private storage: LogStorage;
  private static instance: Logger;
  private listeners: LogUpdateListener[] = [];

  private constructor(storage: LogStorage) {
    this.storage = storage;
  }
  
  /**
   * Subscribe to log updates
   * @param listener - Callback function to be called when logs are updated
   * @returns Unsubscribe function
   */
  public subscribe(listener: LogUpdateListener): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Notify all listeners of a log update
   */
  private notifyListeners(event: LogUpdateEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  /**
   * Get logger instance (singleton)
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      let storage: LogStorage;
      
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        // Create a no-op storage for server-side
        storage = {
          store: async (entry) => ({ ...entry, id: 'server-' + Date.now() }),
          getAll: async () => [],
          getByType: async () => [],
          clear: async () => {},
          count: async () => 0
        };
      } else {
        // We use IndexedDB storage in the browser
        storage = new IndexedDBLogStorage();
      }
      
      Logger.instance = new Logger(storage);
    }
    return Logger.instance;
  }

  /**
   * Set custom storage implementation
   */
  public setStorage(storage: LogStorage): void {
    this.storage = storage;
  }

  /**
   * Log an info message
   */
  public async info(message: string, details?: unknown): Promise<LogEntry> {
    return this.log(LogType.INFO, message, details);
  }

  /**
   * Log an error message
   */
  public async error(message: string, details?: unknown): Promise<LogEntry> {
    return this.log(LogType.ERROR, message, details);
  }

  /**
   * Log a success message
   */
  public async success(message: string, details?: unknown): Promise<LogEntry> {
    return this.log(LogType.SUCCESS, message, details);
  }
  
  /**
   * Log a warning message
   */
  public async warn(message: string, details?: unknown): Promise<LogEntry> {
    return this.log(LogType.WARNING, message, details);
  }

  /**
   * General log method
   */
  private async log(type: LogType, message: string, details?: unknown): Promise<LogEntry> {
    try {
      const logEntry: Omit<LogEntry, 'id'> = {
        timestamp: Date.now(),
        type,
        message,
        details: details ? this.sanitizeDetails(details) : undefined
      };
      
      // Store the log in persistent storage
      const storedEntry = await this.storage.store(logEntry);
      
      // Notify all listeners about the new log
      this.notifyListeners({
        type: 'add',
        entry: storedEntry
      });
      
      return storedEntry;
    } catch (error) {
      // If we can't store the log, log to console as fallback
      console.error('Failed to store log entry:', error);
      console.log(`[${type}] ${message}`, details);
      
      // Create a temporary log entry
      const tempEntry = {
        id: 'temp-' + Date.now(),
        timestamp: Date.now(),
        type,
        message,
        details: this.sanitizeDetails(details)
      };
      
      // Notify listeners even for temporary entries
      this.notifyListeners({
        type: 'add',
        entry: tempEntry
      });
      
      return tempEntry;
    }
  }

  /**
   * Sanitize details to ensure they can be stored in IndexedDB
   * This handles circular references and functions
   */
  private sanitizeDetails(details: unknown): unknown {
    try {
      // Use JSON.stringify/parse to remove circular references and non-serializable values
      return JSON.parse(JSON.stringify(details));
    } catch (error) {
      // If serialization fails, return a simplified representation
      if (details instanceof Error) {
        return {
          name: details.name,
          message: details.message,
          stack: details.stack
        };
      }
      
      return String(details);
    }
  }

  /**
   * Get all logs
   */
  public async getAllLogs(): Promise<LogEntry[]> {
    try {
      return await this.storage.getAll();
    } catch (error) {
      console.error('Failed to retrieve logs:', error);
      return [];
    }
  }

  /**
   * Get logs by type
   */
  public async getLogsByType(type: LogType): Promise<LogEntry[]> {
    try {
      return await this.storage.getByType(type);
    } catch (error) {
      console.error(`Failed to retrieve ${type} logs:`, error);
      return [];
    }
  }

  /**
   * Clear all logs
   */
  public async clearLogs(): Promise<void> {
    try {
      await this.storage.clear();
      
      // Notify all listeners that logs have been cleared
      this.notifyListeners({ type: 'clear' });
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  /**
   * Get logs count
   */
  public async getLogsCount(): Promise<number> {
    try {
      return await this.storage.count();
    } catch (error) {
      console.error('Failed to count logs:', error);
      return 0;
    }
  }
}

// Export a singleton instance
export const logger = Logger.getInstance();

// Re-export types
export { LogType, LogEntry };
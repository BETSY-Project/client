import { LogEntry, LogStorage, LogType } from './types';

// Database configuration
const DB_NAME = 'betsy-logs';
const STORE_NAME = 'logs';
const DB_VERSION = 1;

/**
 * IndexedDB implementation of LogStorage
 */
export class IndexedDBLogStorage implements LogStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    // Initialize the database
    this.initDatabase();
  }

  /**
   * Initialize the IndexedDB database
   */
  private initDatabase(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        // Check if we're in a browser environment
        if (typeof window === 'undefined') {
          // We're on the server, return a rejected promise
          reject(new Error('IndexedDB is not available in server environment'));
          return;
        }
        
        // Check if IndexedDB is available
        if (!window.indexedDB) {
          reject(new Error('IndexedDB is not available in this browser'));
          return;
        }

        // Open the database
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        // Handle database upgrade (first time or version change)
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Create object store with auto-incrementing id if it doesn't exist
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { 
              keyPath: 'id',
              autoIncrement: false
            });
            
            // Create indexes for faster queries
            store.createIndex('type', 'type', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };

        // Handle success
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          resolve(db);
        };

        // Handle error
        request.onerror = (event) => {
          reject(new Error(`Failed to open database: ${(event.target as IDBOpenDBRequest).error?.message}`));
        };
      });
    }

    return this.dbPromise;
  }

  /**
   * Store a log entry in IndexedDB
   */
  async store(entry: Omit<LogEntry, 'id'>): Promise<LogEntry> {
    const db = await this.initDatabase();
    
    // Create a complete log entry with a unique ID
    const logEntry: LogEntry = {
      ...entry,
      id: crypto.randomUUID()
    };

    return new Promise((resolve, reject) => {
      // Start a transaction
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Add the log entry
      const request = store.add(logEntry);
      
      // Handle success
      request.onsuccess = () => {
        resolve(logEntry);
      };
      
      // Handle error
      request.onerror = (event) => {
        reject(new Error(`Failed to store log entry: ${(event.target as IDBRequest).error?.message}`));
      };
    });
  }

  /**
   * Retrieve all log entries from IndexedDB
   */
  async getAll(): Promise<LogEntry[]> {
    const db = await this.initDatabase();
    
    return new Promise((resolve, reject) => {
      // Start a transaction
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      // Get all log entries
      const request = store.index('timestamp').openCursor(null, 'prev'); // Sort by timestamp descending
      const logEntries: LogEntry[] = [];
      
      // Handle cursor
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          logEntries.push(cursor.value as LogEntry);
          cursor.continue();
        } else {
          // End of cursor, return results
          resolve(logEntries);
        }
      };
      
      // Handle error
      request.onerror = (event) => {
        reject(new Error(`Failed to retrieve log entries: ${(event.target as IDBRequest).error?.message}`));
      };
    });
  }

  /**
   * Retrieve logs by type from IndexedDB
   */
  async getByType(type: LogType): Promise<LogEntry[]> {
    const db = await this.initDatabase();
    
    return new Promise((resolve, reject) => {
      // Start a transaction
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      // Get log entries by type
      const index = store.index('type');
      const request = index.getAll(type);
      
      // Handle success
      request.onsuccess = (event) => {
        const result = (event.target as IDBRequest).result as LogEntry[];
        // Sort by timestamp descending
        result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(result);
      };
      
      // Handle error
      request.onerror = (event) => {
        reject(new Error(`Failed to retrieve log entries by type: ${(event.target as IDBRequest).error?.message}`));
      };
    });
  }

  /**
   * Clear all logs from IndexedDB
   */
  async clear(): Promise<void> {
    const db = await this.initDatabase();
    
    return new Promise((resolve, reject) => {
      // Start a transaction
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Clear the store
      const request = store.clear();
      
      // Handle success
      request.onsuccess = () => {
        resolve();
      };
      
      // Handle error
      request.onerror = (event) => {
        reject(new Error(`Failed to clear log entries: ${(event.target as IDBRequest).error?.message}`));
      };
    });
  }

  /**
   * Get logs count from IndexedDB
   */
  async count(): Promise<number> {
    const db = await this.initDatabase();
    
    return new Promise((resolve, reject) => {
      // Start a transaction
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      // Count entries
      const request = store.count();
      
      // Handle success
      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result as number);
      };
      
      // Handle error
      request.onerror = (event) => {
        reject(new Error(`Failed to count log entries: ${(event.target as IDBRequest).error?.message}`));
      };
    });
  }
}
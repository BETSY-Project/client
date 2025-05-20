"use client";

import { useCallback, useEffect, useState } from 'react';
import { LogEntry, LogType, LogUpdateEvent, logger } from '@/lib/logging/logger';

/**
 * React hook for using the logger service
 * Provides methods for logging and accessing logs with React integration
 */
export function useLogger() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to log updates and load initial logs
  useEffect(() => {
    // Initial load of logs
    const loadLogs = async () => {
      setLoading(true);
      try {
        const allLogs = await logger.getAllLogs();
        setLogs(allLogs);
      } catch (error) {
        console.error("Failed to load logs:", error);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
    
    // Subscribe to log updates
    const unsubscribe = logger.subscribe((event: LogUpdateEvent) => {
      if (event.type === 'add' && event.entry) {
        // Add new log to the state (at the beginning since we display in reverse later)
        setLogs(prevLogs => [event.entry!, ...prevLogs]);
      } else if (event.type === 'clear') {
        // Clear all logs from state
        setLogs([]);
      }
    });
    
    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  // Log info message (state will be updated via subscription)
  const logInfo = useCallback(async (message: string, details?: unknown): Promise<LogEntry> => {
    return await logger.info(message, details);
  }, []);

  // Log error message (state will be updated via subscription)
  const logError = useCallback(async (message: string, details?: unknown): Promise<LogEntry> => {
    return await logger.error(message, details);
  }, []);

  // Log success message (state will be updated via subscription)
  const logSuccess = useCallback(async (message: string, details?: unknown): Promise<LogEntry> => {
    return await logger.success(message, details);
  }, []);

  // Get logs by type
  const getLogsByType = useCallback(async (type: LogType): Promise<LogEntry[]> => {
    return await logger.getLogsByType(type);
  }, []);

  // Clear all logs (state will be updated via subscription)
  const clearLogs = useCallback(async (): Promise<void> => {
    await logger.clearLogs();
  }, []);

  // Get logs count
  const getLogsCount = useCallback(async (): Promise<number> => {
    return await logger.getLogsCount();
  }, []);

  return {
    logs,
    loading,
    logInfo,
    logError,
    logSuccess,
    getLogsByType,
    clearLogs,
    getLogsCount,
    LogType
  };
}
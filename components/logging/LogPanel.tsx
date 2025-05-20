"use client";

import { useEffect, useRef, useState } from "react";
import { useLogger } from "@/hooks/useLogger";
import { LogEntry, LogType } from "@/lib/logging/logger";
import { Button } from "@/components/ui/button";
import { Filter, Trash2, X, Bug, Copy, Check, Info, AlertCircle, AlertTriangle } from "lucide-react";

/**
 * Log item component for displaying a single log entry
 */
const LogItem = ({ log }: { log: LogEntry }) => {
  // Format timestamp to readable date string
  const formattedTime = new Date(log.timestamp).toLocaleTimeString();
  const formattedDate = new Date(log.timestamp).toLocaleDateString();
  
  // Determine background color based on log type
  let bgColorClass = "";
  let textColorClass = "";
  let borderColorClass = "";
  
  switch(log.type) {
    case LogType.INFO:
      bgColorClass = "bg-blue-50";
      textColorClass = "text-blue-800";
      borderColorClass = "border-blue-200";
      break;
    case LogType.ERROR:
      bgColorClass = "bg-red-50";
      textColorClass = "text-red-800";
      borderColorClass = "border-red-200";
      break;
    case LogType.SUCCESS:
      bgColorClass = "bg-green-50";
      textColorClass = "text-green-800";
      borderColorClass = "border-green-200";
      break;
    case LogType.WARNING:
      bgColorClass = "bg-amber-50";
      textColorClass = "text-amber-800";
      borderColorClass = "border-amber-200";
      break;
    default:
      bgColorClass = "bg-gray-50";
      textColorClass = "text-gray-800";
      borderColorClass = "border-gray-200";
  }
  
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <div className={`rounded-md p-3 mb-2 ${bgColorClass} ${textColorClass} border ${borderColorClass}`}>
      <div className="flex justify-between items-start">
        <div className="font-medium">{log.message}</div>
        <div className="text-xs whitespace-nowrap ml-2">{formattedTime}</div>
      </div>
      <div className="text-xs mt-1 text-gray-600">{formattedDate}</div>
      
      {log.details && (
        <div className="mt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs h-6 px-2"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? "Hide Details" : "Show Details"}
          </Button>
          
          {showDetails && (
            <div className="mt-2 p-2 bg-white/50 rounded text-xs overflow-auto max-h-40 font-mono">
              <pre>{typeof log.details === 'object' 
                ? JSON.stringify(log.details, null, 2) 
                : String(log.details)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * FilterBar component for filtering logs by type
 */
const FilterBar = ({ 
  activeType, 
  setActiveType,
  onClear
}: { 
  activeType: LogType | null;
  setActiveType: (type: LogType | null) => void;
  onClear: () => void;
}) => {
  return (
    <div className="flex gap-2 my-3 p-2 bg-gray-50 rounded-md">
      <Button
        variant={activeType === null ? "default" : "outline"}
        size="sm"
        onClick={() => setActiveType(null)}
        className="text-xs"
        title="All logs"
      >
        <Filter className="h-4 w-4" />
      </Button>
      <Button 
        variant={activeType === LogType.INFO ? "default" : "outline"}
        size="sm"
        onClick={() => setActiveType(LogType.INFO)}
        className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 hover:text-blue-900 border-blue-200"
        title="Info logs"
      >
        <Info className="h-4 w-4" />
      </Button>
      <Button 
        variant={activeType === LogType.ERROR ? "default" : "outline"}
        size="sm"
        onClick={() => setActiveType(LogType.ERROR)}
        className="text-xs bg-red-100 text-red-800 hover:bg-red-200 hover:text-red-900 border-red-200"
        title="Error logs"
      >
        <AlertCircle className="h-4 w-4" />
      </Button>
      <Button 
        variant={activeType === LogType.SUCCESS ? "default" : "outline"}
        size="sm"
        onClick={() => setActiveType(LogType.SUCCESS)}
        className="text-xs bg-green-100 text-green-800 hover:bg-green-200 hover:text-green-900 border-green-200"
        title="Success logs"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button 
        variant={activeType === LogType.WARNING ? "default" : "outline"}
        size="sm"
        onClick={() => setActiveType(LogType.WARNING)}
        className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200 hover:text-amber-900 border-amber-200"
        title="Warning logs"
      >
        <AlertTriangle className="h-4 w-4" />
      </Button>
      <div className="grow"></div>
      <Button
        variant="outline"
        size="sm"
        onClick={onClear}
        className="text-xs text-red-600 hover:text-red-700"
      >
        <Trash2 className="h-3 w-3 mr-1" />
        Clear
      </Button>
    </div>
  );
};

/**
 * Main LogPanel component
 */
export function LogPanel() {
  const [isClient, setIsClient] = useState(false);
  const { logs, loading, clearLogs, getLogsByType, LogType } = useLogger();
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [activeType, setActiveType] = useState<LogType | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [logsCount, setLogsCount] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  
  // Check if we're in the browser
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Update logs count whenever logs change
  useEffect(() => {
    setLogsCount(logs.length);
  }, [logs]);
  
  // Filter logs when active type or logs change
  useEffect(() => {
    const filterLogs = async () => {
      if (activeType === null) {
        // Newest logs are already at the beginning due to our hook's implementation
        setFilteredLogs([...logs]);
      } else {
        const typeFilteredLogs = await getLogsByType(activeType);
        // Need to sort type-filtered logs as they come from storage
        // We want newest first since our hook implementation already does this
        const sortedLogs = [...typeFilteredLogs].sort((a, b) => b.timestamp - a.timestamp);
        setFilteredLogs(sortedLogs);
      }
    };
    
    filterLogs();
  }, [activeType, logs, getLogsByType]);
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [filteredLogs]);
  
  // Handle clearing logs
  const handleClearLogs = async () => {
    await clearLogs();
    setFilteredLogs([]);
  };
  
  // Calculate main content padding based on panel state
  const mainContentClass = isOpen ? "pr-[400px]" : "";
  
  // Only render UI in browser
  if (!isClient) {
    return null;
  }

  return (
    <>
      {/* Main content padding container */}
      <div className={`fixed inset-0 pointer-events-none ${mainContentClass} transition-all duration-300 z-10`}></div>
      
      {/* Log panel toggle button */}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 rounded-full h-12 w-12 flex items-center justify-center bg-white shadow-md z-20"
      >
        <Bug className="h-5 w-5" />
        {logsCount > 0 && (
          <span className="absolute top-0 right-0 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {logsCount > 99 ? '99+' : logsCount}
          </span>
        )}
      </Button>
      
      {/* Log panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-lg transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } transition-transform duration-300 z-10 flex flex-col`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <Bug className="h-5 w-5 mr-2" /> 
            <h2 className="font-medium">Application Logs</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Format and copy the last 100 logs (in chronological order)
                const lastLogs = [...logs].slice(0, 100).reverse();
                const formattedLogs = lastLogs.map(log => {
                  const time = new Date(log.timestamp).toISOString();
                  const details = log.details ? `: ${JSON.stringify(log.details)}` : '';
                  return `[${time}] [${LogType[log.type]}] ${log.message}${details}`;
                }).join('\n');
                navigator.clipboard.writeText(formattedLogs);
                
                // Show success state temporarily
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 1500);
              }}
              title="Copy last 100 logs"
              className="h-8 w-8 ml-2"
            >
              {copySuccess ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Panel content */}
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <FilterBar 
            activeType={activeType} 
            setActiveType={setActiveType} 
            onClear={handleClearLogs}
          />
          
          <div 
            ref={logsContainerRef}
            className="flex-1 overflow-y-auto"
          >
            {loading ? (
              <div className="flex justify-center items-center h-40 text-gray-400">
                Loading logs...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex justify-center items-center h-40 text-gray-400">
                No logs found
              </div>
            ) : (
              // Display logs in reverse order to show most recent at the bottom
              [...filteredLogs].reverse().map(log => (
                <LogItem key={log.id} log={log} />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
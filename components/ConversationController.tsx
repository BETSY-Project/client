"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLogger } from "@/hooks/useLogger";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { useState, useEffect } from "react";
import { startAgentSession, stopAgentSession } from "@/lib/services/agent-api";
import { getLiveKitToken } from "@/lib/services/livekit-api";

export function ConversationController() {
  const { logInfo, logError, logSuccess } = useLogger();

  const [instructions, setInstructions] = useState("");
  
  const [isRoomConnected, setIsRoomConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isManualDisconnect, setIsManualDisconnect] = useState(false);
  
  const [token, setToken] = useState<string>("");
  const [serverUrl, setServerUrl] = useState<string>("");
  const [activeRoomName, setActiveRoomName] = useState<string>("");
  
  useEffect(() => {
    const checkAudioCapabilities = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          logError("Browser doesn't support media devices API");
          return;
        }
        
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const microphones = devices.filter(d => d.kind === 'audioinput');
          const hasMicrophone = microphones.length > 0;
          
          if (hasMicrophone) {
            logSuccess("Microphone detected", {
              deviceCount: microphones.length,
              devices: microphones.map(mic => ({
                label: mic.label || 'Unnamed microphone',
                id: mic.deviceId
              }))
            });
            
            const hasExplicitPermission = microphones.some(mic => mic.label);
            if (hasExplicitPermission) {
              logInfo("Microphone permission granted");
            } else {
              logInfo("Microphone detected but permission not explicitly granted");
            }
          } else {
            logError("No microphone detected");
          }
        } catch (permissionError) {
          logError("Error accessing media devices", { error: permissionError });
        }
      } catch (error) {
        logError("Error checking audio capabilities", { error });
      }
    };
    
    const checkAgentApiAvailability = async () => {
      try {
        const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
        if (!serverUrl) {
          logError("Server API URL not configured", {
            missingEnvVar: 'NEXT_PUBLIC_SERVER_URL'
          });
          return;
        }
        
        logInfo("Checking server API availability", { url: serverUrl });
        
        try {
          const response = await fetch(`${serverUrl}/health`);
          
          if (response.ok) {
            const data = await response.json();
            logSuccess("Agent API is available", { 
              status: data.status,
              timestamp: data.timestamp 
            });
          } else {
            logError("Agent API health check failed", { 
              status: response.status,
              statusText: response.statusText
            });
          }
        } catch (fetchError) {
          logError("Failed to reach server API", {
            error: fetchError,
            url: serverUrl
          });
        }
      } catch (error) {
        logError("Error checking server API", { error });
      }
    };
    
    checkAudioCapabilities();
    checkAgentApiAvailability();
  }, [logError, logSuccess, logInfo]);

  const handleStart = async () => {
    if (isRoomConnected || isConnecting) {
      logInfo("ConversationController: Already connected or connecting, ignoring start request.");
      return;
    }
    if (!instructions.trim()) {
      logError("ConversationController: No instructions provided, cannot start conversation");
      alert("Please enter system prompt instructions before starting.");
      return;
    }

    setIsConnecting(true); // Set connecting flag
    logInfo("ConversationController: Attempting to start conversation.", {
      instructionsLength: instructions.length,
    });
    
    try {
      logInfo(`ConversationController: Requesting LiveKit token from backend.`);
      const { token: newToken, livekitUrl: newServerUrl, roomName: newRoomName, identity: newIdentity } = await getLiveKitToken();
      
      if (!newToken || !newServerUrl || !newRoomName || !newIdentity) {
        logError("ConversationController: Failed to get valid token, URL, room name, or identity from backend.");
        throw new Error("Failed to get valid token, URL, room name, or identity from backend");
      }
      
      logInfo("ConversationController: Received token, URL, room name, and identity from backend.", { roomName: newRoomName, identity: newIdentity });
      setToken(newToken);
      setServerUrl(newServerUrl);
      setActiveRoomName(newRoomName);

      logInfo("ConversationController: Starting agent session via API with instructions and room name.", { roomName: newRoomName });
      // Pass the roomName obtained from the backend to startAgentSession
      startAgentSession(instructions, newRoomName)
        .then(() => {
          logSuccess(`ConversationController: Agent session started successfully (async) for room ${newRoomName}.`);
        })
        .catch((agentError) => {
          logError(`ConversationController: Failed to start agent session (async) for room ${newRoomName}.`, { error: agentError });
        });

    } catch (error) {
      logError("ConversationController: Failed to start conversation", { error });
      setToken("");
      setServerUrl("");
      setActiveRoomName("");
      setIsRoomConnected(false);
    } finally {
      setIsConnecting(false); // Reset connecting flag
    }
  };

  const handleStop = async () => {
    logInfo("ConversationController: Stop conversation button clicked.", { currentIsRoomConnected: isRoomConnected });
    
    if (!isRoomConnected && !token) {
        logInfo("ConversationController: Not connected, ignoring stop request.");
        return;
    }

    setIsManualDisconnect(true);

    try {
      logInfo("ConversationController: Attempting to stop agent session via API.");
      await stopAgentSession();
      logSuccess("ConversationController: Agent session stopped successfully.");
    } catch (error) {
      logError("ConversationController: Failed to stop agent session.", { error });
    } finally {
      logInfo("ConversationController: Clearing connection state and setting isRoomConnected to false.");
      setToken("");
      setServerUrl("");
      // Not clearing activeRoomName here, so it's still available for the onDisconnected log
      setIsRoomConnected(false);

      setTimeout(() => {
        setIsManualDisconnect(false);
      }, 500);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-[100dvh] w-[100vw] p-4">
      <div className="flex flex-col w-full max-w-lg gap-6">
        <Textarea 
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Enter system prompt instructions..."
          className="min-h-32 max-h-80 resize-y"
          style={{ resize: "vertical" }}
        />
        <div className="flex justify-center">
          <Button
            onClick={isRoomConnected ? handleStop : handleStart}
            variant={isRoomConnected ? "destructive" : "default"}
            disabled={isConnecting} // Disable button while connecting
          >
            {isConnecting ? "Connecting..." : (isRoomConnected ? "Stop" : "Start")}
          </Button>
        </div>
        
        {token && serverUrl && (
          <>
            <div className="mt-4 p-4 bg-green-50 rounded-md border border-green-200 flex flex-col items-center justify-center gap-1">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <span className="text-sm text-green-700">Connected to voice assistant</span>
              </div>
              {activeRoomName && (
                <div className="text-xs text-green-600 mt-1">
                  Room: {activeRoomName}
                </div>
              )}
            </div>
            
            <LiveKitRoom
              serverUrl={serverUrl}
              token={token}
              audio={true}
              video={false}
              onConnected={() => {
                logSuccess("LiveKitRoom Component: Connected", { roomName: activeRoomName });
                setIsRoomConnected(true);
                setIsConnecting(false);
                setIsManualDisconnect(false);
              }}
              onDisconnected={(reason) => {
                logError("LiveKitRoom Component: Disconnected", {
                  reason: reason?.toString(),
                  roomName: activeRoomName,
                  wasManualDisconnect: isManualDisconnect
                });
                setIsRoomConnected(false);
                setIsConnecting(false);
                if (!isManualDisconnect) {
                  setToken("");
                  setServerUrl("");
                }
              }}
              onError={(error) => {
                logError("LiveKitRoom Component: Error", {
                  error,
                  roomName: activeRoomName,
                });
                setIsRoomConnected(false);
                setIsConnecting(false);
                setToken("");
                setServerUrl("");
              }}
            >
              <RoomAudioRenderer />
              
            </LiveKitRoom>
          </>
        )}
      </div>
    </div>
  );
}
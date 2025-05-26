"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { logger } from "@/lib/logging/logger";
import { RoomAudioRenderer, RoomContext } from "@livekit/components-react";
import { useState, useEffect, useCallback } from "react";
import { startAgentSession, stopAgentSession } from "@/lib/services/agent-api";
import { getLiveKitToken } from "@/lib/services/livekit-api";
import { MicrophoneVisualizer } from "./MicrophoneVisualizer";
import {
  Track,
  TrackPublication,
  DisconnectReason,
  LocalParticipant,
  MediaDeviceFailure,
  Room,
  RoomEvent,
} from "livekit-client";

export function ConversationController() {
  const { info: logInfo, error: logError, success: logSuccess, debug: logDebug } = logger;

  const [instructions, setInstructions] = useState("");
  
  const [room, setRoom] = useState<Room | null>(null);
  const [isRoomConnected, setIsRoomConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isManualDisconnect, setIsManualDisconnect] = useState(false);
  
  const [token, setToken] = useState<string>("");
  const [serverUrl, setServerUrl] = useState<string>("");
  const [activeRoomName, setActiveRoomName] = useState<string>("");
  const [isMicTrackPublished, setIsMicTrackPublished] = useState(false);

  const onConnectedHandler = useCallback(() => {
    logSuccess("Room: Connected.", { roomName: activeRoomName });
    setIsRoomConnected(true);
    setIsConnecting(false);
  }, [activeRoomName, logSuccess]);

  const onDisconnectedHandler = useCallback((reason?: DisconnectReason) => {
    logError("Room: Disconnected.", { reason: reason?.toString(), roomName: activeRoomName, manual: isManualDisconnect });
    const wasManuallyDisconnected = isManualDisconnect;
    
    setIsRoomConnected(false);
    setIsConnecting(false);
    setRoom(null);
    setIsMicTrackPublished(false); // Reset mic track state
    
    if (wasManuallyDisconnected || token) {
        logInfo("Room: Clearing token, serverUrl, and activeRoomName post-disconnect.", { manual: wasManuallyDisconnected, currentToken: token ? 'exists' : 'empty' });
        setToken("");
        setServerUrl("");
        setActiveRoomName("");
    }
    setIsManualDisconnect(false);
  }, [activeRoomName, logError, logInfo, isManualDisconnect, token, setIsMicTrackPublished]);

  const onMediaDeviceFailureHandler = useCallback((error: Error) => {
    const failure = MediaDeviceFailure.getFailure(error);
    if (failure) {
      logError("Room: Media device failure.", { failure: MediaDeviceFailure[failure], originalError: error.message });
      alert(`Media device failure: ${MediaDeviceFailure[failure]}. Please check your microphone/camera and browser permissions.`);
    } else {
      logError("Room: Unknown media device error.", { error: error.message });
      alert(`An unknown media device error occurred: ${error.message}. Please check your microphone/camera and browser permissions.`);
    }
  }, [logError]);

  const onLocalTrackPublishedHandler = useCallback((publication: TrackPublication, participant: LocalParticipant) => {
    logInfo(`Room: Local track published: ${publication.source}`, { trackSid: publication.trackSid, identity: participant.identity });
    if (publication.source === Track.Source.Microphone && publication.track) {
      logSuccess("Room: Local microphone track is now published.", { trackSid: publication.trackSid, muted: publication.track.isMuted, participantMicEnabled: participant.isMicrophoneEnabled });
      setIsMicTrackPublished(true);
    }
  }, [logInfo, logSuccess, setIsMicTrackPublished]);

  const onLocalTrackUnpublishedHandler = useCallback((publication: TrackPublication, participant: LocalParticipant) => {
    logInfo(`Room: Local track unpublished: ${publication.source}`, { trackSid: publication.trackSid, participantId: participant.identity });
    if (publication.source === Track.Source.Microphone) {
      logInfo("Room: Local microphone track unpublished.");
      setIsMicTrackPublished(false);
    }
  }, [logInfo, setIsMicTrackPublished]);

  // Effect to manage room event listeners
  useEffect(() => {
    if (!room) {
      return;
    }

    // Attach event listeners
    room
      .on(RoomEvent.Connected, onConnectedHandler)
      .on(RoomEvent.Disconnected, onDisconnectedHandler)
      .on(RoomEvent.MediaDevicesError, onMediaDeviceFailureHandler)
      .on(RoomEvent.LocalTrackPublished, onLocalTrackPublishedHandler)
      .on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublishedHandler);

    // Cleanup function
    return () => {
      room
        .off(RoomEvent.Connected, onConnectedHandler)
        .off(RoomEvent.Disconnected, onDisconnectedHandler)
        .off(RoomEvent.MediaDevicesError, onMediaDeviceFailureHandler)
        .off(RoomEvent.LocalTrackPublished, onLocalTrackPublishedHandler)
        .off(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublishedHandler);
    };
  }, [room, onConnectedHandler, onDisconnectedHandler, onMediaDeviceFailureHandler, onLocalTrackPublishedHandler, onLocalTrackUnpublishedHandler]);

  // Effect for initial checks (audio capabilities, API availability)
  useEffect(() => {
    logInfo("ConversationController: Initializing.");
    const checkAudioCapabilities = async () => {
      logDebug("ConversationController: Checking audio capabilities.");
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          logError("ConversationController: Browser doesn't support media devices API. Cannot proceed with audio.");
          alert("Your browser does not support the necessary audio features. Please use a modern browser.");
          return;
        }
        
        try {
          logDebug("ConversationController: Enumerating media devices.");
          const devices = await navigator.mediaDevices.enumerateDevices();
          const microphones = devices.filter(d => d.kind === 'audioinput');
          const hasMicrophone = microphones.length > 0;
          
          if (hasMicrophone) {
            logSuccess("ConversationController: Microphone detected.", {
              deviceCount: microphones.length,
              devices: microphones.map(mic => ({
                label: mic.label || 'Unnamed microphone',
                id: mic.deviceId,
                groupId: mic.groupId,
              }))
            });
            
            const hasExplicitPermission = microphones.some(mic => mic.label && mic.label !== "");
            if (hasExplicitPermission) {
              logInfo("ConversationController: Microphone permission appears to be granted (device has label).");
            } else {
              logInfo("ConversationController: Microphone detected, but permission might not be explicitly granted yet (no device label). Attempting to get user media to trigger permission prompt if needed.");
              try {
                // Attempt to get user media to ensure permissions are active and labels are populated
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                logSuccess("ConversationController: Successfully accessed microphone stream for permission check.");
                stream.getTracks().forEach(track => track.stop()); // Stop the tracks immediately after permission check
                // Re-enumerate to get labels if they weren't available before
                const updatedDevices = await navigator.mediaDevices.enumerateDevices();
                const updatedMicrophones = updatedDevices.filter(d => d.kind === 'audioinput');
                 logInfo("ConversationController: Updated microphone list after getUserMedia.", {
                    deviceCount: updatedMicrophones.length,
                    devices: updatedMicrophones.map(mic => ({
                        label: mic.label || 'Unnamed microphone',
                        id: mic.deviceId,
                        groupId: mic.groupId,
                    }))
                });

              } catch (getUserMediaError) {
                logError("ConversationController: Error trying to get user media for permission check.", { error: getUserMediaError });
                alert("Could not access the microphone. Please ensure permission is granted in your browser settings.");
              }
            }
          } else {
            logError("ConversationController: No microphone detected. Please connect a microphone.");
            alert("No microphone detected. Please connect a microphone and refresh the page.");
          }
        } catch (permissionError) {
          logError("ConversationController: Error accessing media devices.", { error: permissionError });
          alert("There was an error accessing your audio devices. Please check your browser settings.");
        }
      } catch (error) {
        logError("ConversationController: General error in checkAudioCapabilities.", { error });
      }
    };
    
    const checkAgentApiAvailability = async () => {
      logDebug("ConversationController: Checking Agent API availability.");
      try {
        const apiUrl = process.env.NEXT_PUBLIC_SERVER_URL;
        if (!apiUrl) {
          logError("ConversationController: Server API URL (NEXT_PUBLIC_SERVER_URL) is not configured in environment variables.", {
            missingEnvVar: 'NEXT_PUBLIC_SERVER_URL'
          });
          alert("Application configuration error: Server URL is missing.");
          return;
        }
        
        logInfo("ConversationController: Pinging Agent API health endpoint.", { url: apiUrl });
        
        try {
          const response = await fetch(`${apiUrl}/health`);
          
          if (response.ok) {
            const data = await response.json();
            logSuccess("ConversationController: Agent API is available and healthy.", {
              status: data.status,
              timestamp: data.timestamp,
              url: apiUrl
            });
          } else {
            logError("ConversationController: Agent API health check failed.", {
              status: response.status,
              statusText: response.statusText,
              url: apiUrl,
              responseBody: await response.text().catch(() => "Could not read response body")
            });
            alert(`The agent server at ${apiUrl} is not responding correctly (Status: ${response.status}). Please check if the server is running.`);
          }
        } catch (fetchError) {
          logError("ConversationController: Failed to reach Agent API. The server might be down or a network issue occurred.", {
            error: fetchError,
            url: apiUrl
          });
          alert(`Could not connect to the agent server at ${apiUrl}. Please ensure it's running and accessible.`);
        }
      } catch (error) {
        logError("ConversationController: General error in checkAgentApiAvailability.", { error });
      }
    };
    
    checkAudioCapabilities();
    checkAgentApiAvailability();
  }, [logError, logInfo, logSuccess, logDebug]); // Added logDebug

  const handleStart = async () => {
    logInfo("ConversationController: handleStart called.");
    if (isRoomConnected || isConnecting) {
      logInfo("ConversationController: Start request ignored (already connected/connecting).");
      return;
    }
    if (!instructions.trim()) {
      logError("ConversationController: No instructions provided.");
      alert("Please enter system prompt instructions.");
      return;
    }

    setIsConnecting(true);
    logInfo("ConversationController: Starting conversation process...", { instructionsLength: instructions.length });
    
    let newRoomInstance: Room | null = null;
    try {
      logInfo("ConversationController: Requesting LiveKit token.");
      const { token: newTokenData, livekitUrl: newServerUrlData, roomName: newRoomNameData } = await getLiveKitToken();
      
      if (!newTokenData || !newServerUrlData || !newRoomNameData) {
        logError("ConversationController: Failed to get valid LiveKit connection details from backend.");
        alert("Failed to retrieve connection details from the server. Please try again.");
        throw new Error("Invalid LiveKit connection details received from backend");
      }
      
      logSuccess("ConversationController: LiveKit connection details received.", { roomName: newRoomNameData });
      setToken(newTokenData);
      setServerUrl(newServerUrlData);
      setActiveRoomName(newRoomNameData);

      newRoomInstance = new Room();
      setRoom(newRoomInstance); // Set room early so useEffect for listeners can pick it up

      logInfo("ConversationController: Connecting to LiveKit room.", { roomName: newRoomNameData });
      await newRoomInstance.connect(newServerUrlData, newTokenData);
      // onConnectedHandler will set isRoomConnected and isConnecting

      logSuccess("ConversationController: Successfully connected to LiveKit room instance, attempting to enable microphone.", { roomName: newRoomNameData });
      await newRoomInstance.localParticipant.setMicrophoneEnabled(true);
      logSuccess("ConversationController: Microphone enabled for local participant.", { roomName: newRoomNameData });

      logInfo("ConversationController: Starting agent session via API.", { roomName: newRoomNameData });
      await startAgentSession(instructions, newRoomNameData);
      logSuccess(`ConversationController: Agent session initiated for room ${newRoomNameData}.`);

    } catch (error) {
      const e = error as Error;
      logError("ConversationController: Error during start conversation sequence.", { errorMessage: e.message, errorDetails: e });
      alert(`Error starting conversation: ${e.message}. Check console for details.`);
      
      if (newRoomInstance && newRoomInstance.state !== 'disconnected') {
        await newRoomInstance.disconnect();
      }
      // onDisconnectedHandler should handle resetting states, including room to null
      // but if room was never set or connect failed early, ensure states are reset.
      if (!room || room?.state === 'disconnected') { // if room is already null or disconnected by handler
        setToken("");
        setServerUrl("");
        setActiveRoomName("");
        setIsRoomConnected(false);
      }
      setIsConnecting(false);
      setRoom(null);
      setIsMicTrackPublished(false); // Reset on error
    }
  };

  const handleStop = async () => {
    logInfo("ConversationController: Attempting to stop conversation.", { currentIsRoomConnected: isRoomConnected, roomExists: !!room, isConnecting });
  
    if (!isRoomConnected && !room && !isConnecting) {
        logInfo("ConversationController: Stop request ignored (not connected, no room instance, and not connecting).");
        return;
    }
  
    setIsManualDisconnect(true);
  
    try {
      logInfo("ConversationController: Stopping agent session via API.", { roomName: activeRoomName });
      await stopAgentSession();
      logSuccess("ConversationController: Agent session stop request sent successfully.");
    } catch (error) {
      const e = error as Error;
      logError("ConversationController: Failed to stop agent session via API.", { errorMessage: e.message, errorDetails: e });
    } finally {
      if (room) {
        logInfo("ConversationController: Disconnecting LiveKit room instance.");
        await room.disconnect(); // This will trigger onDisconnectedHandler
      } else {
        // If room is null but we were trying to stop (e.g., during a failed connection attempt),
        // call onDisconnectedHandler to ensure cleanup.
        onDisconnectedHandler();
      }
    }
  };

  // In handleStart, after successful startAgentSession:
  // ...
  // logSuccess(`ConversationController: Agent session initiated for room ${newRoomName}.`);
  // setConnectLiveKit(true); // This is now set directly in handleStart's success path
  // ...

  // In handleStart, error handling for getLiveKitToken:
  // ...
  // setIsRoomConnected(false);
  // setConnectLiveKit(false); // Added
  // setIsConnecting(false); // Ensure this is set
  // ...
  
  // In handleStart, error handling for startAgentSession:
  // ...
  // setIsRoomConnected(false);
  // setConnectLiveKit(false); // Added
  // setIsConnecting(false); // Ensure this is set
  // ...


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
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : (isRoomConnected ? "Stop" : "Start")}
          </Button>
        </div>
        
        {room && isRoomConnected ? (
          <RoomContext.Provider value={room}>
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
            <RoomAudioRenderer />
            {isMicTrackPublished && <MicrophoneVisualizer />}
          </RoomContext.Provider>
        ) : token && serverUrl && isConnecting ? (
            <div className="mt-4 p-4 bg-yellow-50 rounded-md border border-yellow-200 flex flex-col items-center justify-center gap-1">
                <span className="text-sm text-yellow-700">Connecting to room: {activeRoomName}...</span>
            </div>
        ) : null}
      </div>
    </div>
  );
}
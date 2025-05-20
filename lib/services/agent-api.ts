"use client";

import { logger } from "@/lib/logging/logger";

// URL of the agent API server
// In production, get this from environment variables
const AGENT_API_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:8000";

/**
 * Starts a new agent session with the provided instructions and room name
 * @param instructions System prompt instructions for the language teacher
 * @param roomName LiveKit room name to join
 * @returns Response from the agent API
 */
export async function startAgentSession(instructions: string, roomName: string) {
  try {
    const response = await fetch(`${AGENT_API_URL}/api/start-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instructions,
        room_name: roomName,
      }),
    });
    
    if (!response.ok) {
      let errorText = "Failed to start agent session";
      try {
        const errorData = await response.json();
        errorText = errorData.detail || errorText;
      } catch (_) {
        // Ignore JSON parsing error
      }
      
      logger.error(`Agent API error: ${errorText}`, { status: response.status });
      throw new Error(errorText);
    }
    
    const data = await response.json();
    
    // Check if the response contains valid data before logging success
    if (data.success && data.session_id && data.room_name) {
      logger.success("Agent session started successfully", { 
        sessionId: data.session_id, 
        roomName: data.room_name 
      });
    } else if (data.success) {
      // Log but flag incomplete data
      logger.warn("Agent session started with incomplete data", {
        sessionId: data.session_id || 'missing',
        roomName: data.room_name || 'missing'
      });
    }
    
    return data;
  } catch (error) {
    logger.error("Error starting agent session", { error });
    throw error;
  }
}

/**
 * Stops the current agent session
 * @returns Response from the agent API
 */
export async function stopAgentSession() {
  logger.info("Stopping agent session");
  
  try {
    const response = await fetch(`${AGENT_API_URL}/api/stop-session`, {
      method: "POST",
    });
    
    if (!response.ok) {
      let errorText = "Failed to stop agent session";
      try {
        const errorData = await response.json();
        errorText = errorData.detail || errorText;
      } catch (_) {
        // Ignore JSON parsing error
      }
      
      logger.error(`Agent API error: ${errorText}`, { status: response.status });
      throw new Error(errorText);
    }
    
    const data = await response.json();
    logger.success("Agent session stopped successfully");
    return data;
  } catch (error) {
    logger.error("Error stopping agent session", { error });
    throw error;
  }
}

/**
 * Checks the status of the agent API server
 * @returns Status of the agent API server
 */
export async function checkAgentStatus() {
  logger.info("Checking agent status");
  
  try {
    const response = await fetch(`${AGENT_API_URL}/api/status`, {
      method: "GET",
    });
    
    if (!response.ok) {
      logger.error("Failed to check agent status", { status: response.status });
      throw new Error("Failed to check agent status");
    }
    
    const data = await response.json();
    logger.info("Agent status checked", data);
    return data;
  } catch (error) {
    logger.error("Error checking agent status", { error });
    throw error;
  }
}
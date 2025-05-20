import { logger } from "@/lib/logging/logger";

// Get the region from environment variables or use a default
const LIVEKIT_REGION = process.env.NEXT_PUBLIC_LIVEKIT_REGION || "eu-west-2"; // London, UK as default

/**
 * Fetches a LiveKit token from the server
 * @param identity - User identity for the token
 * @param room - Optional room name
 * @returns Token and server URL
 */
export async function getLiveKitToken(identity: string, room: string) {
  logger.info(`Requesting LiveKit token for identity: ${identity}, room: ${room}, region: ${LIVEKIT_REGION}`);
  
  try {
    // Add room and region parameters
    const response = await fetch(`/api/livekit-token?identity=${identity}&room=${room}&region=${LIVEKIT_REGION}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error || 'Failed to get LiveKit token';
      logger.error(`LiveKit token request failed: ${errorMessage}`, { status: response.status, statusText: response.statusText });
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    if (!data.token || !data.url) {
      logger.error('Invalid response from token API', { data });
      throw new Error('Invalid response from token API');
    }
    
    // Safety conversion - ensure token is a string
    const token = String(data.token); 
    const url = String(data.url);
    
    logger.success(`Successfully obtained LiveKit token`, { tokenLength: token.length, url, region: LIVEKIT_REGION });
    return { token, url };
  } catch (error) {
    logger.error('Error while fetching LiveKit token', { error });
    throw error;
  }
}
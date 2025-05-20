/**
 * Room name utilities for LiveKit
 */

/**
 * Generates a unique room name using the provided prefix and a random ID
 * @param prefix - The room name prefix
 * @param idLength - Length of the random ID to append (default: 12)
 * @returns A unique room name in the format "prefix-randomId"
 */
export function generateRoomName(prefix: string = process.env.NEXT_PUBLIC_LIVEKIT_ROOM_NAME || 'betsy-classroom', idLength: number = 12): string {
  // Check what env variable we're using for room prefix
  const envPrefix = process.env.NEXT_PUBLIC_LIVEKIT_ROOM_NAME;
  
  // Generate a random string with the specified length
  const randomId = generateRandomString(idLength);
  
  // Clean the prefix to ensure it's URL-safe
  const cleanPrefix = cleanRoomPrefix(prefix);
  
  // Combine prefix and random ID
  const roomName = `${cleanPrefix}-${randomId}`;
  
  return roomName;
}

/**
 * Cleans a room prefix to ensure it's URL-safe
 * @param prefix - The room name prefix to clean
 * @returns A URL-safe room prefix
 */
function cleanRoomPrefix(prefix: string): string {
  // Remove any non-alphanumeric characters except hyphens and underscores
  // Replace spaces with hyphens
  return prefix
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]/g, '')
    // Ensure it doesn't start or end with a hyphen
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates a random alphanumeric string
 * @param length - The length of the string to generate
 * @returns A random alphanumeric string
 */
function generateRandomString(length: number): string {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  // Create a Uint32Array to get cryptographically strong random values
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  
  // Use the random values to select characters
  for (let i = 0; i < length; i++) {
    const randomIndex = randomValues[i] % characters.length;
    result += characters.charAt(randomIndex);
  }
  
  return result;
}
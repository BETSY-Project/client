import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

// Node.js runtime for access to Buffer
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // Extract parameters
    const identity = req.nextUrl.searchParams.get('identity');
    if (!identity) {
      return NextResponse.json({ error: 'Missing identity parameter' }, { status: 400 });
    }
    
    const room = req.nextUrl.searchParams.get('room') ?? 'betsy-classroom';
    
    // Extract region parameter (optional, used for LiveKit Cloud)
    const region = req.nextUrl.searchParams.get('region');
    
    // Validate environment variables
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const host = process.env.LIVEKIT_HOST;
    
    if (!apiKey || !apiSecret || !host) {
      return NextResponse.json({ error: 'Missing LiveKit credentials' }, { status: 500 });
    }
    
    // Generate JWT token
    try {
      // Create access token
      const accessToken = new AccessToken(apiKey, apiSecret, { identity });
      
      // Add room grant
      const grant = {
        room,
        roomJoin: true, 
        canPublish: true, 
        canPublishData: true,
        canSubscribe: true
      };
      
      // Add region if provided
      if (region) {
        // @ts-ignore - The region property exists but might not be in the type definitions
        grant.region = region;
      }
      
      accessToken.addGrant(grant);
      
      // Generate JWT and handle async/Promise if needed
      let jwt = accessToken.toJwt();
      if (jwt instanceof Promise) {
        jwt = await jwt;
      }
      
      // Handle Buffer if needed
      if (Buffer.isBuffer(jwt)) {
        jwt = jwt.toString('utf-8');
      }
      
      // Return token as string and host URL
      return NextResponse.json({ 
        token: String(jwt), 
        url: host,
        region: region || undefined
      });
    } catch (err) {
      console.error('Error generating token:', err);
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
    }
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { isZoomConfigured } from '@/lib/zoom';

export async function GET() {
  // With Server-to-Server OAuth, Zoom is "connected" if env vars are configured
  const configured = isZoomConfigured();

  return NextResponse.json({ 
    connected: configured,
    mode: 'server-to-server',
  });
}

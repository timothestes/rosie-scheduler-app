import { NextRequest, NextResponse } from 'next/server';

// GET /api/auth/zoom/callback - Legacy OAuth callback (no longer used with Server-to-Server OAuth)
export async function GET(request: NextRequest) {
  // With Server-to-Server OAuth, we don't need user authorization anymore
  // Just redirect to admin with a message
  return NextResponse.redirect(new URL('/admin?zoom_info=server_to_server', request.url));
}

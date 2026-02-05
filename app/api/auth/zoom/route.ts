import { NextRequest, NextResponse } from 'next/server';
import { isZoomConfigured } from '@/lib/zoom';

// GET /api/auth/zoom - Legacy OAuth route (no longer used with Server-to-Server OAuth)
export async function GET(request: NextRequest) {
  // With Server-to-Server OAuth, no user authorization is needed
  // Just check if it's configured and redirect back
  const configured = isZoomConfigured();
  
  if (configured) {
    return NextResponse.redirect(new URL('/admin?zoom_info=already_configured', request.url));
  } else {
    return NextResponse.redirect(new URL('/admin?zoom_error=not_configured', request.url));
  }
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware for Authentication-Based Routing
 * 
 * Purpose: Server-side route protection using a presence cookie.
 * - Redirects unauthenticated users to /login
 * - Redirects authenticated users from /login to /home
 * - Handles root / redirect based on auth state
 * 
 * Security Note: The 'auth' cookie is ONLY for navigation/UX.
 * Real authentication is enforced by:
 * 1. JWT token in localStorage (client-side)
 * 2. Backend [Authorize] attributes (server-side)
 */

// Apply a minimal set of security headers to all responses handled via middleware
function withSecurityHeaders(res: NextResponse) {
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Lock down powerful features by default (tune if needed)
  res.headers.set(
    'Permissions-Policy',
    [
      'geolocation=()',
      'microphone=()',
      'camera=()',
      'payment=()'
    ].join(', ')
  );
  return res;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check for redirect loop detection
  const redirectCount = parseInt(request.cookies.get('redirect_count')?.value || '0', 10);
  if (redirectCount > 3) {
    // Too many redirects, clear auth and go to login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const response = withSecurityHeaders(NextResponse.redirect(url));
    response.cookies.set('auth', '', { maxAge: 0, path: '/' });
    response.cookies.set('redirect_count', '0', { maxAge: 60, path: '/' });
    return response;
  }
  
  // Check for auth signals
  // Prefer secure, HttpOnly refresh token if it's on the same site/domain (prod)
  // Fallback to client-managed 'auth' presence cookie (dev/split domains)
  const refreshCookie = request.cookies.get('refreshToken');
  const authCookie = request.cookies.get('auth');
  const isAuthenticated = Boolean(refreshCookie?.value) || authCookie?.value === '1';
  
  // Public routes that don't need auth checks
  const publicPaths = [
    '/_next',
    '/api',
    '/favicon.ico',
    '/static',
    '/images',
    '/fonts',
  ];
  
  // Skip middleware for public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return withSecurityHeaders(NextResponse.next());
  }
  
  // Protected route patterns
  const protectedPaths = ['/home', '/messages', '/management', '/queues'];
  const isProtectedRoute = protectedPaths.some(path => pathname.startsWith(path));
  
  // Route: /login
  if (pathname === '/login') {
    if (isAuthenticated) {
      // Already logged in, redirect to home
      const url = request.nextUrl.clone();
      url.pathname = '/home';
      const response = withSecurityHeaders(NextResponse.redirect(url));
      response.cookies.set('redirect_count', String(redirectCount + 1), { maxAge: 60, path: '/' });
      return response;
    }
    // Not authenticated, allow access to login page
    const response = withSecurityHeaders(NextResponse.next());
    response.cookies.set('redirect_count', '0', { maxAge: 60, path: '/' }); // Reset counter on login page
    return response;
  }
  
  // Route: / (root)
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    if (isAuthenticated) {
      // Redirect authenticated users to home
      url.pathname = '/home';
    } else {
      // Redirect unauthenticated users to login
      url.pathname = '/login';
    }
    const response = withSecurityHeaders(NextResponse.redirect(url));
    response.cookies.set('redirect_count', String(redirectCount + 1), { maxAge: 60, path: '/' });
    return response;
  }
  
  // Protected routes
  if (isProtectedRoute) {
    if (!isAuthenticated) {
      // Not authenticated, redirect to login
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      const response = withSecurityHeaders(NextResponse.redirect(url));
      response.cookies.set('redirect_count', String(redirectCount + 1), { maxAge: 60, path: '/' });
      return response;
    }
    // Authenticated, allow access - reset redirect counter
    const response = withSecurityHeaders(NextResponse.next());
    response.cookies.set('redirect_count', '0', { maxAge: 60, path: '/' });
    return response;
  }
  
  // For any other route, allow access
  return withSecurityHeaders(NextResponse.next());
}

/**
 * Matcher configuration
 * Apply middleware to all routes except:
 * - Static files (_next/static)
 * - Image optimization (_next/image)
 * - Favicon
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

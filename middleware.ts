import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildSignInUrl } from '@/lib/auth/redirects';

const protectedRoutes = ['/dashboard', '/analytics'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  // Fast-path: avoid network calls in middleware (Edge runtime)
  // Determine if a Supabase auth cookie exists; if not, redirect protected routes.
  if (isProtectedRoute) {
    const hasSupabaseAuth = request.cookies.getAll().some(c =>
      c.name.startsWith('sb-') && /-auth-token(\.\d+)?$/.test(c.name)
    );

    if (!hasSupabaseAuth) {
      const signInUrl = buildSignInUrl({ next: pathname });
      return NextResponse.redirect(new URL(signInUrl, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|auth|sign-in|sign-up).*)']
};

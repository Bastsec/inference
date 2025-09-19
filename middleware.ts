import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { buildSignInUrl } from '@/lib/auth/redirects';

const protectedRoutes = ['/dashboard', '/analytics'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // Create Supabase client for middleware
  const response = NextResponse.next();
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Check if user is authenticated via Supabase
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (isProtectedRoute && (!user || error)) {
      if (error) {
        console.error('Middleware auth error:', error);
      }
      // Build sign-in URL with current path as redirect
      const signInUrl = buildSignInUrl({ next: pathname });
      return NextResponse.redirect(new URL(signInUrl, request.url));
    }
  } catch (authError) {
    console.error('Middleware Supabase error:', authError);
    if (isProtectedRoute) {
      const signInUrl = buildSignInUrl({ next: pathname });
      return NextResponse.redirect(new URL(signInUrl, request.url));
    }
  }

  // Note: payment verification fallback removed — unified function handles callback + crediting

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|auth|sign-in|sign-up).*)'],
  runtime: 'nodejs'
};

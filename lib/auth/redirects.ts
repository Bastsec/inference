/**
 * Centralized redirect logic for authentication flows
 */

export type RedirectSource = 'pricing' | 'dashboard' | 'analytics' | 'checkout';

export interface RedirectOptions {
  source?: RedirectSource;
  next?: string;
  priceId?: string;
  inviteId?: string;
}

/**
 * Determines the appropriate redirect destination after successful authentication
 */
export function getPostAuthRedirect(options: RedirectOptions): string {
  const { source, next, priceId } = options;

  // Handle checkout flow
  if (next === 'checkout' && priceId) {
    return '/pricing'; // Let the pricing page handle the checkout flow
  }

  // Handle source-based redirects
  if (source === 'pricing') {
    return '/pricing';
  }

  // Handle explicit next parameter
  if (next && next !== '/analytics') {
    return next;
  }

  // Default redirects based on authentication type
  if (next === '/analytics') {
    return '/analytics';
  }

  // Default redirect to dashboard
  return '/dashboard';
}

/**
 * Builds sign-in URL with proper redirect parameters
 */
export function buildSignInUrl(options: RedirectOptions): string {
  const params = new URLSearchParams();
  
  if (options.source) params.set('source', options.source);
  if (options.next) params.set('redirect', options.next);
  if (options.priceId) params.set('priceId', options.priceId);
  if (options.inviteId) params.set('inviteId', options.inviteId);

  const queryString = params.toString();
  return `/sign-in${queryString ? `?${queryString}` : ''}`;
}

/**
 * Builds sign-up URL with proper redirect parameters
 */
export function buildSignUpUrl(options: RedirectOptions): string {
  const params = new URLSearchParams();
  
  if (options.source) params.set('source', options.source);
  if (options.next) params.set('redirect', options.next);
  if (options.priceId) params.set('priceId', options.priceId);
  if (options.inviteId) params.set('inviteId', options.inviteId);

  const queryString = params.toString();
  return `/sign-up${queryString ? `?${queryString}` : ''}`;
}

/**
 * Extracts redirect options from URL search parameters
 */
export function extractRedirectOptions(searchParams: URLSearchParams): RedirectOptions {
  return {
    source: searchParams.get('source') as RedirectSource || undefined,
    next: searchParams.get('redirect') || searchParams.get('next') || undefined,
    priceId: searchParams.get('priceId') || undefined,
    inviteId: searchParams.get('inviteId') || undefined,
  };
}

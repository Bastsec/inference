'use client';

import { Button } from '@/components/ui/button';
import { signInWithOAuth } from '@/app/(login)/actions';

interface AuthTestProps {
  source?: string;
  next?: string;
}

/**
 * Test component to verify OAuth flow with proper redirects
 * This can be used on any page to test authentication flow
 */
export function AuthTest({ source, next }: AuthTestProps) {
  const handleGoogleSignIn = () => {
    signInWithOAuth('google', source, next);
  };

  const handleGitHubSignIn = () => {
    signInWithOAuth('github', source, next);
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <h3 className="text-lg font-semibold mb-3">OAuth Test Component</h3>
      <p className="text-sm text-gray-600 mb-4">
        Source: {source || 'none'} | Next: {next || 'default'}
      </p>
      <div className="flex gap-2">
        <Button onClick={handleGoogleSignIn} variant="outline" size="sm">
          Test Google OAuth
        </Button>
        <Button onClick={handleGitHubSignIn} variant="outline" size="sm">
          Test GitHub OAuth
        </Button>
      </div>
    </div>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/nextServer';
import { db } from '@/lib/db/drizzle';
import { users, teams, teamMembers, profiles, type NewUser, type NewTeam, type NewTeamMember } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { signToken } from '@/lib/auth/session';
import { getPostAuthRedirect, extractRedirectOptions } from '@/lib/auth/redirects';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  
  // Extract redirect options from URL parameters
  const redirectOptions = extractRedirectOptions(searchParams);

  if (code) {
    const supabase = await getServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const { user } = data;
      // GitHub may not return email unless the 'user:email' scope is granted; derive safely
      const metaEmail = (user as any)?.user_metadata?.email as string | undefined;
      const identityEmail = Array.isArray((user as any)?.identities)
        ? ((user as any).identities.find((i: any) => i?.identity_data?.email)?.identity_data?.email as string | undefined)
        : undefined;
      const safeEmail = user.email || metaEmail || identityEmail || `${user.id}@users.noreply.github.com`;
      
      // Check if user already exists in our local database
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, safeEmail))
        .limit(1);

      let dbUser = existingUser[0];

      if (existingUser.length === 0) {
        // Create new user in local database
        const newUser: NewUser = {
          email: safeEmail,
          passwordHash: '', // OAuth users don't have passwords
          role: 'owner'
        };

        const [createdUser] = await db.insert(users).values(newUser).returning();

        if (createdUser) {
          dbUser = createdUser;
          
          // Create a new team for the user
          const newTeam: NewTeam = {
            name: `${safeEmail}'s Team`
          };

          const [createdTeam] = await db.insert(teams).values(newTeam).returning();

          if (createdTeam) {
            // Add user to team
            const newTeamMember: NewTeamMember = {
              userId: createdUser.id,
              teamId: createdTeam.id,
              role: 'owner'
            };

            await db.insert(teamMembers).values(newTeamMember);
          }
        }
      }

      // Create session cookie for the middleware
      if (dbUser) {
        const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const sessionData = {
          user: { id: dbUser.id },
          expires: expiresInOneDay.toISOString(),
        };
        const encryptedSession = await signToken(sessionData);

        // Determine redirect destination using centralized logic
        const redirectTo = getPostAuthRedirect(redirectOptions);

        const response = NextResponse.redirect(`${origin}${redirectTo}`);
        
        // Set the session cookie
        response.cookies.set('session', encryptedSession, {
          expires: expiresInOneDay,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        });

        return response;
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}

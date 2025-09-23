import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/nextServer';
import { db } from '@/lib/db/drizzle';
import { users, teams, teamMembers, profiles, type NewUser, type NewTeam, type NewTeamMember } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getPostAuthRedirect, extractRedirectOptions } from '@/lib/auth/redirects';
import { liteLLMClient } from '@/lib/litellm/client';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Derive origin from proxy headers first, then fallback to request URL
  const xfProto = request.headers.get('x-forwarded-proto');
  const xfHost = request.headers.get('x-forwarded-host');
  const host = xfHost || request.headers.get('host');
  const origin = host ? `${xfProto || 'https'}://${host}` : new URL(request.url).origin;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${error}`);
  }
  
  // Extract redirect options from URL parameters
  const redirectOptions = extractRedirectOptions(searchParams);

  if (code) {
    const supabase = await getServerSupabase();
    const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (!authError && data.user) {
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

          // Automatically create API key for new OAuth users
          try {
            console.log('Creating API key for OAuth user:', user.id);

            const supabaseAdmin = createClient(
              process.env.SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            // Create profile if it doesn't exist
            const { data: existingProfile } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('id', user.id)
              .single();

            console.log('Existing profile check:', existingProfile);

            if (!existingProfile) {
              console.log('Creating profile for user:', user.id);
              await supabaseAdmin
                .from('profiles')
                .insert({
                  id: user.id,
                  email: safeEmail
                });
            }

            // Check if user already has a virtual key
            const { data: existingKey } = await supabaseAdmin
              .from('virtual_keys')
              .select('id, litellm_key_id')
              .eq('user_id', user.id)
              .single();

            console.log('Existing virtual key check:', existingKey);

            if (!existingKey) {
              console.log('Creating new LiteLLM key for user:', user.id);

              try {
                // Create actual LiteLLM key
                const liteLLMKey = await liteLLMClient.generateKey({
                  user_id: user.id,
                  key_alias: `User ${user.id.slice(0, 8)}`,
                  max_budget: 2.0, // $2.00 budget
                  budget_duration: '30d',
                  rpm_limit: 100,
                  tpm_limit: 100000
                  // Remove static model restrictions - allow all models including gpt-5, model-router, gpt-5-chat
                });

                console.log('LiteLLM key created:', liteLLMKey);

                // Store in our virtual_keys table
                await supabaseAdmin
                  .from('virtual_keys')
                  .insert({
                    user_id: user.id,
                    key: liteLLMKey.key, // Use the actual LiteLLM key as our virtual key
                    credit_balance: 200, // $2.00 in cents
                    is_active: true,
                    litellm_key_id: liteLLMKey.key, // Store the LiteLLM key ID (same as key for now)
                    max_budget: 200, // $2.00 in cents
                    budget_duration: '30d',
                    rpm_limit: 100,
                    tpm_limit: 100000,
                    model_restrictions: null, // No model restrictions - allow all models including gpt-5, model-router, gpt-5-chat
                    sync_status: 'synced',
                    last_synced_at: new Date().toISOString()
                  });

                // Create LiteLLM customer
                await liteLLMClient.createCustomer({
                  user_id: user.id,
                  alias: user.email?.split('@')[0], // Use email prefix as alias
                  blocked: false,
                  max_budget: 2.0, // $2.00 budget
                  budget_duration: '30d',
                  spend: 0,
                });

                console.log('LiteLLM customer created for user:', user.id);
              } catch (liteLLMError) {
                console.error('Failed to create LiteLLM key:', liteLLMError);
                // Fallback: create virtual key without LiteLLM integration
                const fallbackKey = `basti_fallback_${user.id.slice(0, 8)}_${Date.now().toString().slice(-6)}`;
                await supabaseAdmin
                  .from('virtual_keys')
                  .insert({
                    user_id: user.id,
                    key: fallbackKey,
                    credit_balance: 200,
                    is_active: true,
                    max_budget: 200,
                    budget_duration: '30d',
                    rpm_limit: 100,
                    tpm_limit: 100000,
                    sync_status: 'pending'
                  });
                console.log('Created fallback OAuth virtual key:', fallbackKey);
              }
            } else {
              console.log('User already has a virtual key');
            }
          } catch (keyError) {
            console.error('Failed to create API key for OAuth user:', keyError);
            // Don't fail the entire auth flow if key creation fails
          }
        }
      }

      // Determine redirect destination using centralized logic
      const redirectTo = getPostAuthRedirect(redirectOptions);

      console.log('OAuth success - redirecting to:', redirectTo);
      console.log('User synced to database:', dbUser?.id);

      // Supabase handles the session, just redirect
      return NextResponse.redirect(`${origin}${redirectTo}`);
    } else {
      console.error('OAuth exchange failed:', authError);
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=oauth_exchange_failed`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}

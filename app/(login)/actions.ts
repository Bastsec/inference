'use server';

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  User,
  users,
  activityLogs,
  profiles,
  type NewUser,
  type NewActivityLog,
  ActivityType
} from '@/lib/db/schema';
import { comparePasswords, hashPassword } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db/queries';
import { getServerSupabase } from '@/lib/supabase/nextServer';
import {
  validatedAction,
  validatedActionWithUser
} from '@/lib/auth/middleware';
import { getPostAuthRedirect, extractRedirectOptions } from '@/lib/auth/redirects';

async function logActivity(
  userId: number,
  type: ActivityType,
  ipAddress?: string
) {
  const newActivity: NewActivityLog = {
    userId,
    action: type,
    ipAddress: ipAddress || '',
    timestamp: new Date()
  };

  await db.insert(activityLogs).values(newActivity);
}

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100)
});

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data;
  const redirectTo = formData.get('redirect') as string | null;

  const supabase = await getServerSupabase();
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error || !authData.user) {
    return {
      error: 'Invalid email or password. Please try again.',
      email
    };
  }

  // Find user in local database
  const foundUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (foundUser.length > 0) {
    await logActivity(foundUser[0].id, ActivityType.SIGN_IN);
  }

  if (redirectTo === 'checkout') {
    redirect('/pricing');
  }

  redirect(redirectTo || '/dashboard');
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100)
});

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password } = data;

  const supabase = await getServerSupabase();
  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error || !authData.user) {
    return {
      error: error?.message || 'Failed to create account. Please try again.',
      email,
      password
    };
  }

  // Create user in local database
  const passwordHash = await hashPassword(password);
  const newUser: NewUser = {
    email,
    passwordHash,
    role: 'owner'
  };

  const [createdUser] = await db.insert(users).values(newUser).returning();

  if (!createdUser) {
    return {
      error: 'Failed to create user account. Please try again.',
      email,
      password
    };
  }

  await logActivity(createdUser.id, ActivityType.SIGN_UP);

  const redirectTo = formData.get('redirect') as string | null;
  redirect(redirectTo || '/dashboard');
});

export async function signInWithOAuth(
  provider: 'google' | 'github',
  source?: string,
  next?: string
) {
  const supabase = await getServerSupabase();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  // Build redirect URL with parameters
  const params = new URLSearchParams();
  if (source) params.set('source', source);
  if (next) params.set('next', next);
  
  const redirectTo = `${origin}/auth/callback${params.toString() ? `?${params.toString()}` : ''}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo
    }
  });

  if (error) {
    console.error('OAuth error:', error);
    redirect('/sign-in?error=oauth_error');
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signOut() {
  const user = (await getUser()) as User;
  if (user) {
    await logActivity(user.id, ActivityType.SIGN_OUT);
  }
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect('/');
}

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(8).max(100),
    newPassword: z.string().min(8).max(100),
    confirmPassword: z.string().min(8).max(100)
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword']
  });

export const updatePassword = validatedActionWithUser(
  updatePasswordSchema,
  async (data, _, user) => {
    const { currentPassword, newPassword } = data;

    const isPasswordValid = await comparePasswords(
      currentPassword,
      user.passwordHash || ''
    );

    if (!isPasswordValid) {
      return { error: 'Current password is incorrect.' };
    }

    if (currentPassword === newPassword) {
      return {
        error: 'New password must be different from the current password.'
      };
    }

    const newPasswordHash = await hashPassword(newPassword);

    await Promise.all([
      db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, user.id)),
      logActivity(user.id, ActivityType.UPDATE_PASSWORD)
    ]);

    return { success: 'Password updated successfully.' };
  }
);

const deleteAccountSchema = z.object({
  password: z.string().min(8).max(100)
});

export const deleteAccount = validatedActionWithUser(
  deleteAccountSchema,
  async (data, _, user) => {
    const { password } = data;

    const isPasswordValid = await comparePasswords(
      password,
      user.passwordHash || ''
    );
    if (!isPasswordValid) {
      return { error: 'Incorrect password. Account deletion failed.' };
    }

    await logActivity(user.id, ActivityType.DELETE_ACCOUNT);

    // Soft delete the user
    await db
      .update(users)
      .set({
        deletedAt: new Date(),
        email: `${user.email}-deleted-${Date.now()}`
      })
      .where(eq(users.id, user.id));

    const supabase = await getServerSupabase();
    await supabase.auth.signOut();
    redirect('/sign-up');
  }
);

const updateAccountSchema = z.object({
  name: z.string().min(1).max(64),
  email: z.string().email().min(3).max(255)
});

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { name, email } = data;

    await Promise.all([
      db.update(users).set({ name, email }).where(eq(users.id, user.id)),
      logActivity(user.id, ActivityType.UPDATE_ACCOUNT)
    ]);

    return { name, success: 'Account updated successfully.' };
  }
);
import { desc, and, eq, isNull } from 'drizzle-orm';
import { db } from './drizzle';
import { activityLogs, users, profiles } from './schema';
import { getReadOnlyServerSupabase } from '@/lib/supabase/nextServer';

export async function getUser() {
  try {
    const supabase = await getReadOnlyServerSupabase();
    const { data: auth, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Supabase auth error:', error);
      return null;
    }
    
    const email = auth.user?.email;
    if (!email) return null;

    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    return rows[0] ?? null;
  } catch (error) {
    console.error('Error in getUser():', error);
    return null;
  }
}

export async function getProfile() {
  try {
    const supabase = await getReadOnlyServerSupabase();
    const { data: auth, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Supabase auth error:', error);
      return null;
    }
    
    if (!auth.user?.id) return null;

    // Return the profile with UUID id that matches Supabase auth user id
    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, auth.user.id))
      .limit(1);

    return rows[0] ?? null;
  } catch (error) {
    console.error('Error in getProfile():', error);
    return null;
  }
}




export async function getActivityLogs() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}


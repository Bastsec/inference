-- Add UUID reference columns to team_members and activity_logs
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS user_uuid uuid;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS user_uuid uuid;

-- Backfill user_uuid from users.email -> profiles.email mapping
UPDATE public.team_members tm
SET user_uuid = p.id
FROM public.users u
JOIN public.profiles p ON p.email = u.email
WHERE tm.user_id = u.id AND tm.user_uuid IS NULL;

UPDATE public.activity_logs al
SET user_uuid = p.id
FROM public.users u
JOIN public.profiles p ON p.email = u.email
WHERE al.user_id = u.id AND al.user_uuid IS NULL;

-- Add foreign keys if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_members_user_uuid_fkey'
      AND conrelid = 'public.team_members'::regclass
  ) THEN
    ALTER TABLE public.team_members
      ADD CONSTRAINT team_members_user_uuid_fkey
      FOREIGN KEY (user_uuid) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'activity_logs_user_uuid_fkey'
      AND conrelid = 'public.activity_logs'::regclass
  ) THEN
    ALTER TABLE public.activity_logs
      ADD CONSTRAINT activity_logs_user_uuid_fkey
      FOREIGN KEY (user_uuid) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_team_members_user_uuid ON public.team_members(user_uuid);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_uuid ON public.activity_logs(user_uuid);

-- ─────────────────────────────────────────────────────────────────────────────
-- BrandMe — Supabase Schema: Views & Row Level Security Policies
-- Run these in the Supabase SQL Editor or via supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Helper: get current user's profile id ───────────────────────────────────
-- Used in RLS policies that need the profile ID (not user ID)

CREATE OR REPLACE FUNCTION auth_profile_id()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;


-- ─── Helper: RSVP counts per event ───────────────────────────────────────────
-- SECURITY DEFINER so it bypasses RLS on event_rsvps.
-- Without this, the security_invoker view below would count 0 INTERESTED/REQUESTED
-- rows for non-hosts because the read policies only expose GOING rows.

CREATE OR REPLACE FUNCTION rsvp_counts_for_event(p_event_id bigint)
RETURNS TABLE (interested_count int, going_count int, requested_count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(CASE WHEN status = 'INTERESTED' THEN 1 END)::int,
    COUNT(CASE WHEN status = 'GOING'      THEN 1 END)::int,
    COUNT(CASE WHEN status = 'REQUESTED'  THEN 1 END)::int
  FROM event_rsvps
  WHERE event_id = p_event_id;
$$;

-- ─── View: events_with_host ───────────────────────────────────────────────────
-- Joins events with host profile, RSVP counts, and niches.
-- Used by useEvents() and useEventById() hooks.

CREATE OR REPLACE VIEW events_with_host
WITH (security_invoker = true)
AS
SELECT
  e.*,
  row_to_json(p) AS host,
  rc.interested_count,
  rc.going_count,
  COALESCE(
    (SELECT json_agg(row_to_json(n))
     FROM niches n
     JOIN event_niches en ON en.niche_id = n.id
     WHERE en.event_id = e.id),
    '[]'::json
  )              AS niches,
  rc.requested_count
FROM events e
JOIN profiles p ON p.id = e.host_id
LEFT JOIN LATERAL rsvp_counts_for_event(e.id) rc ON true;


-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES
-- Enable RLS on each table first, then add policies.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── profiles ─────────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles
CREATE POLICY "profiles: public read"
  ON profiles FOR SELECT
  USING (true);

-- Only the owner can update their profile
CREATE POLICY "profiles: owner update"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Only the owner can delete their profile
CREATE POLICY "profiles: owner delete"
  ON profiles FOR DELETE
  USING (user_id = auth.uid());

-- Authenticated users can insert their own profile (during onboarding)
CREATE POLICY "profiles: owner insert"
  ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());


-- ─── niches ───────────────────────────────────────────────────────────────────

ALTER TABLE niches ENABLE ROW LEVEL SECURITY;

-- Read-only for everyone
CREATE POLICY "niches: public read"
  ON niches FOR SELECT
  USING (true);


-- ─── profile_niches ───────────────────────────────────────────────────────────

ALTER TABLE profile_niches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_niches: public read"
  ON profile_niches FOR SELECT
  USING (true);

CREATE POLICY "profile_niches: owner write"
  ON profile_niches FOR ALL
  USING (profile_id = auth_profile_id())
  WITH CHECK (profile_id = auth_profile_id());


-- ─── external_links ───────────────────────────────────────────────────────────

ALTER TABLE external_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "external_links: public read"
  ON external_links FOR SELECT
  USING (true);

CREATE POLICY "external_links: owner write"
  ON external_links FOR ALL
  USING (profile_id = auth_profile_id())
  WITH CHECK (profile_id = auth_profile_id());


-- ─── events ───────────────────────────────────────────────────────────────────

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Anyone can read published events
CREATE POLICY "events: public read published"
  ON events FOR SELECT
  USING (status = 'PUBLISHED');

-- The host can read all their own events (including DRAFT/CANCELLED)
CREATE POLICY "events: host read own"
  ON events FOR SELECT
  USING (host_id = auth_profile_id());

-- Only the host can insert events
CREATE POLICY "events: host insert"
  ON events FOR INSERT
  WITH CHECK (host_id = auth_profile_id());

-- Only the host can update their events
CREATE POLICY "events: host update"
  ON events FOR UPDATE
  USING (host_id = auth_profile_id())
  WITH CHECK (host_id = auth_profile_id());

-- Only the host can delete their events
CREATE POLICY "events: host delete"
  ON events FOR DELETE
  USING (host_id = auth_profile_id());



-- ─── event_rsvps ─────────────────────────────────────────────────────────────

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

-- Users can read their own RSVPs
CREATE POLICY "event_rsvps: read own"
  ON event_rsvps FOR SELECT
  USING (profile_id = auth_profile_id());

-- Event hosts can read RSVPs for their events (to see attendee requests)
CREATE POLICY "event_rsvps: host read"
  ON event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_rsvps.event_id
        AND e.host_id = auth_profile_id()
    )
  );

-- Any authenticated user can read GOING RSVPs for public events (interested is host-only)
CREATE POLICY "event_rsvps: public event read"
  ON event_rsvps FOR SELECT
  USING (
    event_rsvps.status = 'GOING'
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_rsvps.event_id
        AND e.privacy = 'PUBLIC'
    )
  );

-- Helper: check if the current user is GOING to a given event.
-- Must be SECURITY DEFINER to bypass RLS and avoid recursive policy evaluation
-- (the events_with_host view joins event_rsvps under security_invoker = true).
CREATE OR REPLACE FUNCTION user_is_going_to_event(p_event_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_rsvps
    WHERE event_id = p_event_id
      AND profile_id = auth_profile_id()
      AND status = 'GOING'
  );
$$;

-- Users who are GOING on an exclusive event can read GOING RSVPs for that event (interested is host-only)
CREATE POLICY "event_rsvps: exclusive going read"
  ON event_rsvps FOR SELECT
  USING (
    event_rsvps.status = 'GOING'
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_rsvps.event_id
        AND e.privacy = 'EXCLUSIVE'
    )
    AND user_is_going_to_event(event_rsvps.event_id)
  );

-- Users can insert their own RSVPs
CREATE POLICY "event_rsvps: insert own"
  ON event_rsvps FOR INSERT
  WITH CHECK (profile_id = auth_profile_id());

-- Users can update their own RSVPs; hosts can update RSVPs for their events (approve/decline)
CREATE POLICY "event_rsvps: update own or host"
  ON event_rsvps FOR UPDATE
  USING (
    profile_id = auth_profile_id()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_rsvps.event_id
        AND e.host_id = auth_profile_id()
    )
  );

-- Users can delete their own RSVPs; hosts can delete RSVPs for their events (decline)
CREATE POLICY "event_rsvps: delete own or host"
  ON event_rsvps FOR DELETE
  USING (
    profile_id = auth_profile_id()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_rsvps.event_id
        AND e.host_id = auth_profile_id()
    )
  );


-- ─── event_niches ─────────────────────────────────────────────────────────────

ALTER TABLE event_niches ENABLE ROW LEVEL SECURITY;

-- Anyone can read event niches (drives niche filtering on feed and map)
CREATE POLICY "event_niches: public read"
  ON event_niches FOR SELECT
  USING (true);

-- Only the event host can insert/delete event niches
CREATE POLICY "event_niches: host write"
  ON event_niches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_niches.event_id
        AND e.host_id = auth_profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_niches.event_id
        AND e.host_id = auth_profile_id()
    )
  );


-- ─── follows ──────────────────────────────────────────────────────────────────

-- Prevent self-follows at the DB level
ALTER TABLE follows ADD CONSTRAINT follows_no_self_follow
  CHECK (follower_id <> following_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Anyone can see who follows whom
CREATE POLICY "follows: public read"
  ON follows FOR SELECT
  USING (true);

-- Only the follower can create/delete a follow
CREATE POLICY "follows: insert own"
  ON follows FOR INSERT
  WITH CHECK (follower_id = auth_profile_id());

CREATE POLICY "follows: delete own"
  ON follows FOR DELETE
  USING (follower_id = auth_profile_id());


-- ─── follows: maintain denormalized follower/following counts ─────────────────
-- SECURITY DEFINER lets this function bypass RLS so it can update both sides
-- of a follow relationship (follower's profile AND followee's profile) even
-- though the authenticated user only owns one of them.
--
-- Run once in Supabase SQL Editor. Before running, reconcile any stale counts:
--   UPDATE profiles p
--   SET
--     follower_count  = (SELECT COUNT(*) FROM follows f WHERE f.following_id = p.id),
--     following_count = (SELECT COUNT(*) FROM follows f WHERE f.follower_id  = p.id);

CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count  = follower_count  + 1 WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count  = GREATEST(follower_count  - 1, 0) WHERE id = OLD.following_id;
    UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_follow_counts ON follows;

CREATE TRIGGER trg_follow_counts
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();


-- ─── portfolio_images ─────────────────────────────────────────────────────────

ALTER TABLE portfolio_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view portfolio images
CREATE POLICY "portfolio_images: public read"
  ON portfolio_images FOR SELECT
  USING (true);

-- Only the owner can insert/update/delete their portfolio images
CREATE POLICY "portfolio_images: owner write"
  ON portfolio_images FOR ALL
  USING (profile_id = auth_profile_id())
  WITH CHECK (profile_id = auth_profile_id());


-- ─── Stage 8: Push Notifications (superseded by Stage 9b — see below) ───────
-- push_token was originally added to profiles. It has since been moved to the
-- profile_settings table for security (push tokens are private device identifiers
-- and should not be readable by other users via the public profiles SELECT policy).
-- Do NOT add push_token or notifications_enabled to the profiles table.


-- ─── Stage 9: Notifications System ──────────────────────────────────────────
-- Run each block in order in the Supabase SQL Editor.

-- 1. Add created_at to event_rsvps
-- ALTER TABLE event_rsvps
--   ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 2. Add notifications_enabled flag to profiles
-- ALTER TABLE profiles
--   ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT true;

-- 3. Create notifications table
-- CREATE TABLE notifications (
--   id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   recipient_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
--   type         TEXT NOT NULL CHECK (type IN (
--                  'new_follower',
--                  'new_rsvp_going',
--                  'new_rsvp_requested',
--                  'rsvp_approved',
--                  'rsvp_declined'
--                )),
--   actor_id     BIGINT REFERENCES profiles(id) ON DELETE CASCADE,
--   event_id     BIGINT REFERENCES events(id) ON DELETE CASCADE,
--   read_at      TIMESTAMPTZ,
--   created_at   TIMESTAMPTZ DEFAULT now() NOT NULL
-- );
-- CREATE INDEX notifications_recipient_idx ON notifications (recipient_id, created_at DESC);

-- 4. RLS on notifications
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "notifications: read own"
--   ON notifications FOR SELECT
--   USING (recipient_id = auth_profile_id());
--
-- CREATE POLICY "notifications: update own"
--   ON notifications FOR UPDATE
--   USING (recipient_id = auth_profile_id())
--   WITH CHECK (recipient_id = auth_profile_id());
-- (No INSERT policy — inserts come only from SECURITY DEFINER triggers)

-- 5. Trigger: new follower notification
-- CREATE OR REPLACE FUNCTION create_follow_notification()
-- RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
-- BEGIN
--   INSERT INTO notifications (recipient_id, type, actor_id)
--   VALUES (NEW.following_id, 'new_follower', NEW.follower_id);
--   RETURN NULL;
-- END;
-- $$;
-- DROP TRIGGER IF EXISTS trg_follow_notification ON follows;
-- CREATE TRIGGER trg_follow_notification
--   AFTER INSERT ON follows
--   FOR EACH ROW EXECUTE FUNCTION create_follow_notification();

-- 6. Trigger: RSVP notifications (new GOING/REQUESTED → host; approved/declined → attendee)
-- CREATE OR REPLACE FUNCTION create_rsvp_notification()
-- RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
-- DECLARE
--   v_host_id BIGINT;
-- BEGIN
--   IF TG_OP = 'INSERT' THEN
--     SELECT host_id INTO v_host_id FROM events WHERE id = NEW.event_id;
--     IF v_host_id IS NULL OR v_host_id = NEW.profile_id THEN RETURN NULL; END IF;
--     IF NEW.status = 'GOING' THEN
--       INSERT INTO notifications (recipient_id, type, actor_id, event_id)
--       VALUES (v_host_id, 'new_rsvp_going', NEW.profile_id, NEW.event_id);
--     ELSIF NEW.status = 'REQUESTED' THEN
--       INSERT INTO notifications (recipient_id, type, actor_id, event_id)
--       VALUES (v_host_id, 'new_rsvp_requested', NEW.profile_id, NEW.event_id);
--     END IF;
--   ELSIF TG_OP = 'UPDATE' THEN
--     IF OLD.status = 'REQUESTED' AND NEW.status = 'GOING' THEN
--       SELECT host_id INTO v_host_id FROM events WHERE id = NEW.event_id;
--       INSERT INTO notifications (recipient_id, type, actor_id, event_id)
--       VALUES (NEW.profile_id, 'rsvp_approved', v_host_id, NEW.event_id);
--     END IF;
--   ELSIF TG_OP = 'DELETE' THEN
--     IF OLD.status = 'REQUESTED' AND auth_profile_id() != OLD.profile_id THEN
--       SELECT host_id INTO v_host_id FROM events WHERE id = OLD.event_id;
--       INSERT INTO notifications (recipient_id, type, actor_id, event_id)
--       VALUES (OLD.profile_id, 'rsvp_declined', v_host_id, OLD.event_id);
--     END IF;
--   END IF;
--   RETURN NULL;
-- END;
-- $$;
-- DROP TRIGGER IF EXISTS trg_rsvp_notification ON event_rsvps;
-- CREATE TRIGGER trg_rsvp_notification
--   AFTER INSERT OR UPDATE OR DELETE ON event_rsvps
--   FOR EACH ROW EXECUTE FUNCTION create_rsvp_notification();


-- ─── Stage 9b: profile_settings Table ───────────────────────────────────────
-- Moves push_token + notifications_enabled out of profiles (public-read) into a
-- private owner-only table. Run each statement in order in the SQL Editor.

-- 1. Create table
-- CREATE TABLE profile_settings (
--   profile_id            BIGINT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
--   push_token            TEXT,
--   notifications_enabled BOOLEAN NOT NULL DEFAULT true
-- );

-- 2. Migrate existing data (only needed if you previously added the columns to profiles)
-- INSERT INTO profile_settings (profile_id, push_token, notifications_enabled)
-- SELECT id, push_token, COALESCE(notifications_enabled, true)
-- FROM profiles
-- ON CONFLICT (profile_id) DO NOTHING;

-- 3. Enable RLS and add owner-only policies
-- ALTER TABLE profile_settings ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "profile_settings: read own"
--   ON profile_settings FOR SELECT
--   USING (profile_id = auth_profile_id());
--
-- CREATE POLICY "profile_settings: write own"
--   ON profile_settings FOR ALL
--   USING (profile_id = auth_profile_id())
--   WITH CHECK (profile_id = auth_profile_id());

-- 4. Drop the now-private columns from profiles (run AFTER verifying migration)
-- ALTER TABLE profiles DROP COLUMN IF EXISTS push_token;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS notifications_enabled;

-- 5. Seed a profile_settings row for new users on sign-up
--    (Add this to the existing handle_new_profile trigger function, or create a
--    separate trigger that inserts a default row into profile_settings whenever
--    a new profiles row is created.)
-- CREATE OR REPLACE FUNCTION create_profile_settings()
-- RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
-- BEGIN
--   INSERT INTO profile_settings (profile_id) VALUES (NEW.id)
--   ON CONFLICT (profile_id) DO NOTHING;
--   RETURN NULL;
-- END;
-- $$;
-- DROP TRIGGER IF EXISTS trg_create_profile_settings ON profiles;
-- CREATE TRIGGER trg_create_profile_settings
--   AFTER INSERT ON profiles
--   FOR EACH ROW EXECUTE FUNCTION create_profile_settings();


-- ─── Storage Bucket Policies ──────────────────────────────────────────────────
-- These policies are active in the Supabase dashboard.
-- Mirrored here for source tracking — run via SQL Editor or Storage → Policies.

-- ── avatars ── path: {auth.uid()}/profile.jpg
-- CREATE POLICY "avatars: owner write"
--   ON storage.objects FOR ALL TO authenticated
--   USING  (bucket_id = 'avatars' AND (SELECT auth.uid()::text) = (storage.foldername(name))[1])
--   WITH CHECK (bucket_id = 'avatars' AND (SELECT auth.uid()::text) = (storage.foldername(name))[1]);

-- ── banners ── path: {auth.uid()}/banner.jpg
-- CREATE POLICY "banners: owner write"
--   ON storage.objects FOR ALL TO authenticated
--   USING  (bucket_id = 'banners' AND (SELECT auth.uid()::text) = (storage.foldername(name))[1])
--   WITH CHECK (bucket_id = 'banners' AND (SELECT auth.uid()::text) = (storage.foldername(name))[1]);

-- ── event-covers ── path: {eventId}/cover.jpg
-- CREATE POLICY "event-covers: host write"
--   ON storage.objects FOR ALL TO authenticated
--   USING (bucket_id = 'event-covers' AND EXISTS (
--     SELECT 1 FROM events WHERE id::text = (storage.foldername(name))[1]
--       AND host_id = auth_profile_id()))
--   WITH CHECK (bucket_id = 'event-covers' AND EXISTS (
--     SELECT 1 FROM events WHERE id::text = (storage.foldername(name))[1]
--       AND host_id = auth_profile_id()));

-- ── post-media ── path: portfolio/{profileId}/{timestamp}.ext
-- NOTE: Original "authenticated users can upload" policy (no path restriction) was
-- replaced. The prior update/delete policies used auth.uid() vs bigint profileId
-- (never matched) and were replaced with this single owner-scoped policy.
-- CREATE POLICY "post-media: owner write"
--   ON storage.objects FOR ALL TO authenticated
--   USING (bucket_id = 'post-media'
--     AND (storage.foldername(name))[1] = 'portfolio'
--     AND EXISTS (SELECT 1 FROM profiles p
--       WHERE p.id::text = (storage.foldername(name))[2] AND p.user_id = auth.uid()))
--   WITH CHECK (bucket_id = 'post-media'
--     AND (storage.foldername(name))[1] = 'portfolio'
--     AND EXISTS (SELECT 1 FROM profiles p
--       WHERE p.id::text = (storage.foldername(name))[2] AND p.user_id = auth.uid()));


-- ─────────────────────────────────────────────────────────────────────────────
-- MODERATION TABLES
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── blocked_users ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blocked_users (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  blocker_id  BIGINT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id  BIGINT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocked_users: owner full access"
  ON blocked_users
  USING (blocker_id = auth_profile_id())
  WITH CHECK (blocker_id = auth_profile_id());

-- Allows a user to check if someone has blocked them (SELECT only, no write access)
CREATE POLICY "blocked_users: see if blocked by someone"
  ON blocked_users FOR SELECT
  USING (blocked_id = auth_profile_id());


-- ─── content_reports ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_reports (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reporter_id          BIGINT REFERENCES profiles(id) ON DELETE SET NULL,
  reported_profile_id  BIGINT REFERENCES profiles(id) ON DELETE CASCADE,
  reported_event_id    BIGINT REFERENCES events(id) ON DELETE CASCADE,
  reason               TEXT NOT NULL,
  status               TEXT DEFAULT 'pending'
                         CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK (reported_profile_id IS NOT NULL OR reported_event_id IS NOT NULL)
);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_reports: authenticated insert"
  ON content_reports FOR INSERT
  WITH CHECK (reporter_id = auth_profile_id());

CREATE POLICY "content_reports: view own reports"
  ON content_reports FOR SELECT
  USING (reporter_id = auth_profile_id());


-- ─── block_user_cleanup RPC ───────────────────────────────────────────────────
-- SECURITY DEFINER so it can delete follows/RSVPs in both directions,
-- bypassing per-row RLS policies that restrict deletes to the row owner.

CREATE OR REPLACE FUNCTION block_user_cleanup(p_blocker_id BIGINT, p_blocked_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove follow relationships in both directions
  DELETE FROM follows
  WHERE (follower_id = p_blocker_id AND following_id = p_blocked_id)
     OR (follower_id = p_blocked_id AND following_id = p_blocker_id);

  -- Remove RSVPs where either user attended the other's events
  DELETE FROM event_rsvps er
  USING events e
  WHERE er.event_id = e.id
    AND (
      (er.profile_id = p_blocker_id AND e.host_id = p_blocked_id)
      OR
      (er.profile_id = p_blocked_id AND e.host_id = p_blocker_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION block_user_cleanup(BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION block_user_cleanup(BIGINT, BIGINT) TO authenticated;

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


-- ─── View: events_with_host ───────────────────────────────────────────────────
-- Joins events with host profile, RSVP counts, and niches.
-- Used by useEvents() and useEventById() hooks.

CREATE OR REPLACE VIEW events_with_host
WITH (security_invoker = true)
AS
SELECT
  e.*,
  row_to_json(p)                         AS host,
  COUNT(DISTINCT r_i.profile_id)::int    AS interested_count,
  COUNT(DISTINCT r_g.profile_id)::int    AS going_count,
  COALESCE(
    (SELECT json_agg(row_to_json(n))
     FROM niches n
     JOIN event_niches en ON en.niche_id = n.id
     WHERE en.event_id = e.id),
    '[]'::json
  )                                      AS niches,
  COUNT(DISTINCT r_req.profile_id)::int  AS requested_count
FROM events e
JOIN profiles p ON p.id = e.host_id
LEFT JOIN event_rsvps r_i   ON r_i.event_id   = e.id AND r_i.status   = 'INTERESTED'
LEFT JOIN event_rsvps r_g   ON r_g.event_id   = e.id AND r_g.status   = 'GOING'
LEFT JOIN event_rsvps r_req ON r_req.event_id = e.id AND r_req.status = 'REQUESTED'
GROUP BY e.id, p.id;


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


-- ─── Stage 8: Push Notifications ────────────────────────────────────────────
-- Add push_token column to profiles for Expo push notification delivery.
-- Run in Supabase SQL Editor:

-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Users can update their own push token:
-- CREATE POLICY "profiles: update own push_token"
--   ON profiles FOR UPDATE
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);


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


-- ─── Storage Bucket Policies ──────────────────────────────────────────────────
-- Set these in the Supabase dashboard under Storage → Policies,
-- or via the SQL Editor using storage.objects policies.

-- avatars bucket: public read, authenticated upload to own folder
-- post-media bucket: public read, authenticated upload
-- event-covers bucket: public read, authenticated upload

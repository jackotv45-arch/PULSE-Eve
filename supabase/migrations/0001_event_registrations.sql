CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  tagline text,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  venue text NOT NULL,
  address text,
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  registrations_open boolean NOT NULL DEFAULT true,
  organizer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO anon, authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events are public" ON public.events FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  last_name text NOT NULL,
  first_name text NOT NULL,
  age integer NOT NULL CHECK (age BETWEEN 5 AND 120),
  email text NOT NULL,
  email_normalized text NOT NULL,
  phone text NOT NULL,
  phone_normalized text NOT NULL,
  profession text NOT NULL,
  organization text,
  qr_token text NOT NULL UNIQUE,
  reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  checked_in_at timestamptz,
  checked_in_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.registrations TO service_role;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX registrations_event_email_uniq ON public.registrations (event_id, email_normalized) WHERE status = 'confirmed';
CREATE UNIQUE INDEX registrations_event_phone_uniq ON public.registrations (event_id, phone_normalized) WHERE status = 'confirmed';
CREATE INDEX registrations_event_idx ON public.registrations (event_id);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.registration_attempts (
  id bigserial PRIMARY KEY,
  client_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.registration_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.registration_attempts_id_seq TO service_role;
ALTER TABLE public.registration_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX registration_attempts_key_idx ON public.registration_attempts (client_key, created_at);

-- Public event info with remaining places (no personal data)
CREATE OR REPLACE FUNCTION public.get_public_event(p_slug text)
RETURNS TABLE (
  id uuid, slug text, title text, tagline text, description text,
  starts_at timestamptz, ends_at timestamptz, venue text, address text,
  capacity integer, registrations_open boolean, organizer text, registered_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.slug, e.title, e.tagline, e.description, e.starts_at, e.ends_at, e.venue, e.address,
         e.capacity, e.registrations_open, e.organizer,
         (SELECT count(*)::int FROM public.registrations r WHERE r.event_id = e.id AND r.status = 'confirmed')
  FROM public.events e WHERE e.slug = p_slug
$$;
REVOKE ALL ON FUNCTION public.get_public_event(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event(text) TO anon, authenticated, service_role;

-- Atomic registration: rate limit, open/capacity check, duplicate check, insert, audit
CREATE OR REPLACE FUNCTION public.register_participant(
  p_event_slug text, p_last_name text, p_first_name text, p_age integer,
  p_email text, p_phone text, p_phone_normalized text, p_profession text,
  p_organization text, p_client_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_email text := lower(trim(p_email));
  v_count int;
  v_token text;
  v_ref text;
  v_id uuid;
BEGIN
  SELECT count(*) INTO v_count FROM public.registration_attempts
   WHERE client_key = p_client_key AND created_at > now() - interval '15 minutes';
  IF v_count >= 8 THEN
    RETURN jsonb_build_object('status', 'rate_limited');
  END IF;
  INSERT INTO public.registration_attempts (client_key) VALUES (p_client_key);

  SELECT * INTO v_event FROM public.events WHERE slug = p_event_slug FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF NOT v_event.registrations_open OR v_event.starts_at < now() THEN
    RETURN jsonb_build_object('status', 'closed');
  END IF;

  IF EXISTS (SELECT 1 FROM public.registrations WHERE event_id = v_event.id AND status = 'confirmed' AND email_normalized = v_email) THEN
    RETURN jsonb_build_object('status', 'duplicate', 'field', 'email');
  END IF;
  IF EXISTS (SELECT 1 FROM public.registrations WHERE event_id = v_event.id AND status = 'confirmed' AND phone_normalized = p_phone_normalized) THEN
    RETURN jsonb_build_object('status', 'duplicate', 'field', 'phone');
  END IF;

  IF v_event.capacity IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.registrations WHERE event_id = v_event.id AND status = 'confirmed';
    IF v_count >= v_event.capacity THEN
      RETURN jsonb_build_object('status', 'full');
    END IF;
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  LOOP
    v_ref := 'PLS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.registrations WHERE reference = v_ref);
  END LOOP;

  BEGIN
    INSERT INTO public.registrations (event_id, last_name, first_name, age, email, email_normalized,
      phone, phone_normalized, profession, organization, qr_token, reference)
    VALUES (v_event.id, trim(p_last_name), trim(p_first_name), p_age, trim(p_email), v_email,
      trim(p_phone), p_phone_normalized, trim(p_profession), nullif(trim(coalesce(p_organization, '')), ''), v_token, v_ref)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'duplicate', 'field', 'email');
  END;

  INSERT INTO public.audit_log (event_id, registration_id, action, details)
  VALUES (v_event.id, v_id, 'registration.created', jsonb_build_object('reference', v_ref));

  RETURN jsonb_build_object('status', 'ok', 'token', v_token, 'reference', v_ref);
END;
$$;
REVOKE ALL ON FUNCTION public.register_participant(text, text, text, integer, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_participant(text, text, text, integer, text, text, text, text, text, text) TO service_role;

-- Ticket lookup by secret token (no email/phone returned)
CREATE OR REPLACE FUNCTION public.get_ticket(p_token text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'first_name', r.first_name, 'last_name', r.last_name, 'reference', r.reference,
    'status', r.status, 'checked_in_at', r.checked_in_at, 'qr_token', r.qr_token,
    'event_title', e.title, 'event_starts_at', e.starts_at, 'event_ends_at', e.ends_at,
    'event_venue', e.venue, 'event_address', e.address)
  FROM public.registrations r JOIN public.events e ON e.id = r.event_id
  WHERE r.qr_token = p_token
$$;
REVOKE ALL ON FUNCTION public.get_ticket(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ticket(text) TO service_role;

INSERT INTO public.events (slug, title, tagline, description, starts_at, ends_at, venue, address, capacity, organizer)
VALUES ('pulse-fit-day', 'UENERGY FIT DAY',
  'Une matinée d’entraînement géante, ouverte à tous.',
  'Échauffement collectif, défis functional training, cours collectifs et bilans avec nos coachs. Gratuit, tous niveaux, attestation de participation remise aux présents.',
  '2026-12-12 08:00:00+01', '2026-12-12 13:00:00+01',
  'Salle UENERGY', 'Quartier Louis, Libreville, Gabon', 150, 'UENERGY Libreville');

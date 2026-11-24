-- UEnergy 2027: adapter les données du formulaire Google et sa capacité.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS participants_target_min integer
  CHECK (participants_target_min IS NULL OR participants_target_min > 0);

UPDATE public.events
SET capacity = 1000,
    participants_target_min = 600
WHERE is_featured;

CREATE OR REPLACE FUNCTION public.get_featured_event()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT to_jsonb(x) FROM (
    SELECT e.id, e.slug, e.title, e.tagline, e.description, e.starts_at, e.ends_at, e.venue, e.address,
           e.capacity, e.participants_target_min, e.registrations_open, e.organizer, e.hero_image, e.programme, e.faq,
           (SELECT count(*)::int FROM public.registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') AS registered_count
    FROM public.events e
    ORDER BY e.is_featured DESC, e.starts_at DESC
    LIMIT 1
  ) x
$$;
REVOKE ALL ON FUNCTION public.get_featured_event() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_featured_event() TO anon, authenticated, service_role;

ALTER TABLE public.registrations
  ADD COLUMN participant_name text,
  ADD COLUMN gender text,
  ADD COLUMN age_range text,
  ADD COLUMN receive_updates boolean NOT NULL DEFAULT false,
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name DROP NOT NULL,
  ALTER COLUMN age DROP NOT NULL;

UPDATE public.registrations
SET participant_name = COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), 'Participant'),
    age_range = CASE
      WHEN age BETWEEN 8 AND 18 THEN '8 - 18'
      WHEN age BETWEEN 19 AND 29 THEN '19 - 29'
      WHEN age BETWEEN 30 AND 40 THEN '30 - 40'
      WHEN age BETWEEN 41 AND 50 THEN '40 - 50'
      WHEN age > 50 THEN '+ de 50'
      ELSE NULL
    END;

ALTER TABLE public.registrations
  ALTER COLUMN participant_name SET NOT NULL,
  ADD CONSTRAINT registrations_gender_check CHECK (gender IS NULL OR gender IN ('Homme', 'Femme')),
  ADD CONSTRAINT registrations_age_range_check CHECK (age_range IS NULL OR age_range IN ('8 - 18', '19 - 29', '30 - 40', '40 - 50', '+ de 50'));

DROP FUNCTION IF EXISTS public.register_participant(text, text, text, integer, text, text, text, text, text, text);

CREATE FUNCTION public.register_participant(
  p_event_slug text,
  p_participant_name text,
  p_gender text,
  p_age_range text,
  p_email text,
  p_phone text,
  p_phone_normalized text,
  p_profession text,
  p_receive_updates boolean,
  p_client_key text
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
  IF nullif(trim(p_participant_name), '') IS NULL
     OR p_gender IS NULL OR p_gender NOT IN ('Homme', 'Femme')
     OR p_age_range IS NULL OR p_age_range NOT IN ('8 - 18', '19 - 29', '30 - 40', '40 - 50', '+ de 50')
     OR p_receive_updates IS NULL THEN
    RETURN jsonb_build_object('status', 'error');
  END IF;

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
    INSERT INTO public.registrations (
      event_id, participant_name, gender, age_range, email, email_normalized,
      phone, phone_normalized, profession, receive_updates, qr_token, reference
    )
    VALUES (
      v_event.id, trim(p_participant_name), p_gender, p_age_range, trim(p_email), v_email,
      trim(p_phone), p_phone_normalized, trim(p_profession), p_receive_updates, v_token, v_ref
    )
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'duplicate', 'field', 'email');
  END;

  INSERT INTO public.audit_log (event_id, registration_id, action, details)
  VALUES (v_event.id, v_id, 'registration.created', jsonb_build_object('reference', v_ref));

  RETURN jsonb_build_object('status', 'ok', 'token', v_token, 'reference', v_ref);
END;
$$;
REVOKE ALL ON FUNCTION public.register_participant(text, text, text, text, text, text, text, text, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_participant(text, text, text, text, text, text, text, text, boolean, text) TO service_role;

CREATE OR REPLACE FUNCTION public.check_in_participant(p_event_id uuid, p_token text, p_registration_id uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.registrations%ROWTYPE;
  v_name text;
BEGIN
  SELECT * INTO r FROM public.registrations
   WHERE event_id = p_event_id
     AND ((p_token IS NOT NULL AND qr_token = p_token) OR (p_registration_id IS NOT NULL AND id = p_registration_id))
   FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.audit_log (event_id, action, actor_id, details)
    VALUES (p_event_id, 'scan.rejected', p_actor, jsonb_build_object('reason', 'unknown'));
    RETURN jsonb_build_object('status', 'unknown');
  END IF;

  v_name := COALESCE(r.participant_name, concat_ws(' ', r.first_name, r.last_name));
  IF r.status <> 'confirmed' THEN
    INSERT INTO public.audit_log (event_id, registration_id, action, actor_id, details)
    VALUES (p_event_id, r.id, 'scan.rejected', p_actor, jsonb_build_object('reason', 'cancelled'));
    RETURN jsonb_build_object('status', 'cancelled', 'name', v_name);
  END IF;
  IF r.checked_in_at IS NOT NULL THEN
    INSERT INTO public.audit_log (event_id, registration_id, action, actor_id, details)
    VALUES (p_event_id, r.id, 'scan.rejected', p_actor, jsonb_build_object('reason', 'already'));
    RETURN jsonb_build_object('status', 'already', 'name', v_name, 'at', r.checked_in_at);
  END IF;

  UPDATE public.registrations SET checked_in_at = now(), checked_in_by = p_actor, updated_at = now() WHERE id = r.id;
  INSERT INTO public.audit_log (event_id, registration_id, action, actor_id, details)
  VALUES (p_event_id, r.id, 'scan.accepted', p_actor, jsonb_build_object('reference', r.reference));
  RETURN jsonb_build_object('status', 'ok', 'name', v_name, 'reference', r.reference);
END;
$$;
REVOKE ALL ON FUNCTION public.check_in_participant(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_participant(uuid, text, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_ticket(p_token text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'participant_name', COALESCE(r.participant_name, concat_ws(' ', r.first_name, r.last_name)),
    'first_name', r.first_name, 'last_name', r.last_name, 'reference', r.reference,
    'status', r.status, 'checked_in_at', r.checked_in_at, 'qr_token', r.qr_token,
    'event_title', e.title, 'event_starts_at', e.starts_at, 'event_ends_at', e.ends_at,
    'event_venue', e.venue, 'event_address', e.address)
  FROM public.registrations r JOIN public.events e ON e.id = r.event_id
  WHERE r.qr_token = p_token
$$;
REVOKE ALL ON FUNCTION public.get_ticket(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ticket(text) TO service_role;

UPDATE public.events e
SET faq = (
  SELECT jsonb_agg(
    CASE
      WHEN item->>'q' = 'Vais-je recevoir une attestation ?'
        THEN jsonb_set(item, '{a}', to_jsonb('Oui. Après l’événement, l’équipe enverra manuellement le PDF par e-mail aux participants dont la présence a été validée.'::text), true)
      ELSE item
    END ORDER BY ord
  )
  FROM jsonb_array_elements(e.faq) WITH ORDINALITY AS faq_item(item, ord)
)
WHERE jsonb_typeof(e.faq) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(e.faq) AS faq_item(item)
    WHERE faq_item.item->>'q' = 'Vais-je recevoir une attestation ?'
  );

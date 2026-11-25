-- Réinitialisation des inscriptions d’essai, appelée uniquement depuis le serveur admin.
CREATE OR REPLACE FUNCTION public.reset_event_registrations(p_event_id uuid, p_confirmation text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_registrations_open boolean;
  v_deleted_registrations integer;
  v_deleted_journal_entries integer;
BEGIN
  SELECT e.title, e.registrations_open
    INTO v_title, v_registrations_open
    FROM public.events AS e
   WHERE e.id = p_event_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Événement introuvable.';
  END IF;

  IF v_registrations_open THEN
    RAISE EXCEPTION 'Fermez les inscriptions dans « Événement & site » avant de réinitialiser les données.';
  END IF;

  IF btrim(p_confirmation) IS DISTINCT FROM btrim(v_title) THEN
    RAISE EXCEPTION 'Le nom de l’événement ne correspond pas.';
  END IF;

  DELETE FROM public.audit_log
   WHERE event_id = p_event_id
     AND (action LIKE 'registration.%' OR action LIKE 'checkin.%' OR action LIKE 'scan.%');
  GET DIAGNOSTICS v_deleted_journal_entries = ROW_COUNT;

  DELETE FROM public.registrations
   WHERE event_id = p_event_id;
  GET DIAGNOSTICS v_deleted_registrations = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_registrations', v_deleted_registrations,
    'deleted_journal_entries', v_deleted_journal_entries
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_event_registrations(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_event_registrations(uuid, text) TO service_role;

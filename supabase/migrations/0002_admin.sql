-- =========================================================================
-- 0002 — Espace administrateur : contenu du site piloté par l'admin,
-- comptes administrateurs / agents, contrôle des présences atomique.
-- =========================================================================

-- Contenu éditable de l'événement (affiché tel quel sur la page publique)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hero_image text,
  ADD COLUMN IF NOT EXISTS programme jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Un seul événement mis en avant à la fois
CREATE UNIQUE INDEX IF NOT EXISTS events_one_featured ON public.events ((true)) WHERE is_featured;

UPDATE public.events SET is_featured = true,
  programme = '[
    {"time":"08h00","tag":"ACCUEIL & ÉCHAUFFEMENT","title":"WARM-UP GÉANT","text":"Scan du QR, café, et tout le monde en mouvement.","img":"/images/club.jpg"},
    {"time":"09h30","tag":"ÉNERGIE & ENDURANCE","title":"FUNCTIONAL CHALLENGE","text":"Des ateliers en équipe, à votre niveau.","img":"/images/training.jpg"},
    {"time":"11h30","tag":"MOUVEMENT & CONSEILS","title":"COURS & BILANS COACH","text":"Cours collectif final et bilans personnalisés.","img":"/images/hero.jpg"}
  ]'::jsonb,
  faq = '[
    {"q":"L’inscription est-elle payante ?","a":"Non, la participation est entièrement gratuite. Les places sont limitées : seule l’inscription en ligne garantit votre entrée."},
    {"q":"Faut-il être membre de UENERGY ?","a":"Pas du tout. L’événement est ouvert à tous, membres ou non, débutants comme sportifs confirmés."},
    {"q":"Comment fonctionne mon QR code ?","a":"Après votre inscription, un QR code personnel et unique s’affiche. Téléchargez-le ou gardez la page de votre billet : il sera scanné une seule fois à l’entrée pour enregistrer votre présence."},
    {"q":"Vais-je recevoir une attestation ?","a":"Oui. Après l’événement, chaque participant dont la présence a été validée à l’entrée reçoit une attestation de participation en PDF par e-mail."},
    {"q":"Que dois-je apporter ?","a":"Une tenue de sport, des baskets, une bouteille d’eau, une serviette… et votre QR code sur votre téléphone ou imprimé."},
    {"q":"Puis-je inscrire quelqu’un d’autre ?","a":"Chaque participant s’inscrit avec sa propre adresse e-mail et son propre numéro : un QR code correspond à une seule personne."}
  ]'::jsonb
WHERE slug = 'pulse-fit-day';

-- Comptes du back-office (rôles séparés de auth.users)
CREATE TABLE IF NOT EXISTS public.staff (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'agent')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
-- aucune policy : lu uniquement côté serveur

-- Événement mis en avant + contenu, sans données personnelles
CREATE OR REPLACE FUNCTION public.get_featured_event()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT to_jsonb(x) FROM (
    SELECT e.id, e.slug, e.title, e.tagline, e.description, e.starts_at, e.ends_at, e.venue, e.address,
           e.capacity, e.registrations_open, e.organizer, e.hero_image, e.programme, e.faq,
           (SELECT count(*)::int FROM public.registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') AS registered_count
    FROM public.events e
    ORDER BY e.is_featured DESC, e.starts_at DESC
    LIMIT 1
  ) x
$$;
REVOKE ALL ON FUNCTION public.get_featured_event() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_featured_event() TO anon, authenticated, service_role;

-- Validation de présence atomique (un seul scan accepté, même en simultané)
CREATE OR REPLACE FUNCTION public.check_in_participant(p_event_id uuid, p_token text, p_registration_id uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.registrations%ROWTYPE;
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
  IF r.status <> 'confirmed' THEN
    INSERT INTO public.audit_log (event_id, registration_id, action, actor_id, details)
    VALUES (p_event_id, r.id, 'scan.rejected', p_actor, jsonb_build_object('reason', 'cancelled'));
    RETURN jsonb_build_object('status', 'cancelled', 'name', r.first_name || ' ' || r.last_name);
  END IF;
  IF r.checked_in_at IS NOT NULL THEN
    INSERT INTO public.audit_log (event_id, registration_id, action, actor_id, details)
    VALUES (p_event_id, r.id, 'scan.rejected', p_actor, jsonb_build_object('reason', 'already'));
    RETURN jsonb_build_object('status', 'already', 'name', r.first_name || ' ' || r.last_name, 'at', r.checked_in_at);
  END IF;
  UPDATE public.registrations SET checked_in_at = now(), checked_in_by = p_actor, updated_at = now() WHERE id = r.id;
  INSERT INTO public.audit_log (event_id, registration_id, action, actor_id, details)
  VALUES (p_event_id, r.id, 'scan.accepted', p_actor, jsonb_build_object('reference', r.reference));
  RETURN jsonb_build_object('status', 'ok', 'name', r.first_name || ' ' || r.last_name, 'reference', r.reference);
END;
$$;
REVOKE ALL ON FUNCTION public.check_in_participant(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_participant(uuid, text, uuid, uuid) TO service_role;

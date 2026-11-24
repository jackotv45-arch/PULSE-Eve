-- Remplacer la marque visible sans changer les identifiants internes (slug et QR).
UPDATE public.events e
SET title = replace(e.title, 'PULSE', 'UENERGY'),
    tagline = replace(e.tagline, 'PULSE', 'UENERGY'),
    description = replace(e.description, 'PULSE', 'UENERGY'),
    venue = replace(e.venue, 'PULSE', 'UENERGY'),
    address = replace(e.address, 'PULSE', 'UENERGY'),
    organizer = replace(e.organizer, 'PULSE', 'UENERGY'),
    faq = CASE
      WHEN jsonb_typeof(e.faq) = 'array' THEN coalesce((
        SELECT jsonb_agg(
          jsonb_set(
            jsonb_set(item, '{q}', to_jsonb(replace(coalesce(item->>'q', ''), 'PULSE', 'UENERGY')), true),
            '{a}', to_jsonb(replace(coalesce(item->>'a', ''), 'PULSE', 'UENERGY')), true
          ) ORDER BY ord
        )
        FROM jsonb_array_elements(e.faq) WITH ORDINALITY AS faq_item(item, ord)
      ), e.faq)
      ELSE e.faq
    END,
    updated_at = now()
WHERE e.title ILIKE '%PULSE%'
   OR e.tagline ILIKE '%PULSE%'
   OR e.description ILIKE '%PULSE%'
   OR e.venue ILIKE '%PULSE%'
   OR e.address ILIKE '%PULSE%'
   OR e.organizer ILIKE '%PULSE%'
   OR e.faq::text ILIKE '%PULSE%';

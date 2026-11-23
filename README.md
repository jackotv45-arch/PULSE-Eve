# PULSE — Page d'inscription aux événements

Site de la salle PULSE (Libreville) mis en mode « événement » : présentation de l'événement,
formulaire d'inscription sécurisé et billet avec QR code unique.

Stack : TanStack Start (React 19) + Vite, base de données Supabase (Postgres).

## 1. Base de données

1. Créez un projet sur https://supabase.com.
2. Ouvrez **SQL Editor** et exécutez le fichier `supabase/migrations/0001_event_registrations.sql`.
   Il crée les tables (événements, inscriptions, journal d'audit, anti-abus), les fonctions
   sécurisées et l'événement de démonstration « PULSE FIT DAY ».

## 2. Variables d'environnement

Copiez `.env.example` en `.env` et remplissez les valeurs (Supabase → Settings → API) :

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (clé publique / anon)
- `SUPABASE_SERVICE_ROLE_KEY` (clé secrète, utilisée uniquement côté serveur)

## 3. Lancer

    npm install      # ou bun install
    npm run dev      # http://localhost:3000
    npm test         # tests des règles du formulaire
    npm run build    # build de production dans .output/
    node .output/server/index.mjs   # lance le build (PORT=3000 par défaut)

Le build cible Node par défaut. Pour un autre hébergeur (Vercel, Netlify, Cloudflare…),
définissez `NITRO_PRESET` au moment du build (ex. `NITRO_PRESET=vercel npm run build`).

## Organisation

- `src/routes/index.tsx` : page événement (bandeau, programme, inscription, FAQ)
- `src/routes/billet.$token.tsx` : billet + QR code du participant
- `src/components/pulse/` : sections de la page
- `src/lib/registration.ts` : règles du formulaire (champs obligatoires, téléphone, anti-robots)
- `src/lib/event.functions.ts` : fonctions serveur (lecture de l'événement, inscription, billet)
- `src/styles.css` : design d'origine du site PULSE + styles de la page événement
- `public/images/` : photos de la salle

## Sécurité

- Les données personnelles ne sont jamais lisibles depuis le navigateur : tout passe par le serveur.
- Doublons (e-mail ou téléphone), capacité maximale et limitation des tentatives sont vérifiés
  dans la base, en une seule opération verrouillée.
- Le QR code contient uniquement un jeton secret (`PULSE-EVT:<jeton>`), aucune donnée personnelle.

## Changer d'événement

Modifiez la ligne de la table `events` (titre, date, lieu, capacité, `registrations_open`),
ou ajoutez-en une et changez `CURRENT_EVENT_SLUG` dans `src/lib/registration.ts`.

## Reste à faire

Voir `roadmap.md` : e-mail de confirmation, interface agent (scan), tableau de bord admin, attestations PDF.

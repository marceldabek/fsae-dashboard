
# FSAE EV Powertrain Dashboard (React + Tailwind + Firebase)


## PWA
Manifest + icons included. A simple service worker is registered for standalone display.


## New pages
- `/overview`: stats and top contributors
- `/people`: list of all people (searchable)
- `/person/:id`: a member’s personal dashboard (their projects)
- Admin can add/remove project owners in the project page; Person pages update accordingly (on refresh).


### Admin page
- `/admin`: create People, Projects (with owners), Tasks, and set a global Rulebook PDF URL stored at `settings/global.rulebook_url`.


### Personal dashboards
- `/person/:id`: shows member profile, their projects, each project’s tasks and derived completion %, plus quick links (SharePoint + Rulebook PDF).


### Ranked mode
- New route: `/ranked` shows five tier tables: Bronze, Silver, Gold, Platinum, Diamond with live scores.
- Tasks can optionally carry ranked_points of +10, +35, or +100. If not set, Complete defaults to +35, others +10.
- People can opt into the weekly/hourly pool and have a `rank` field. The default rank is Bronze if not set.
- Promotions and relegations are % based per tier. Defaults: promote more in lower tiers (funnel), promote fewer in higher tiers. Diamond doesn’t promote; Bronze doesn’t demote (by default).
- Admin → Ranked Settings provides manual override, percentages, and auto-apply toggle (hourly by default).

## Firebase config (fix auth/invalid-api-key)
This app expects Firebase Web app config via Vite env vars. If you see auth/invalid-api-key:

1) Copy .env.example to .env.local
2) Fill the VITE_FIREBASE_* values from your Firebase project settings (Project settings → Your apps → SDK setup and configuration)
3) Restart dev server

Required keys:
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID

## Local Firebase emulators

Start the emulators on pinned ports (functions:5002, firestore:8080, auth:9099, UI:4000):

```bash
firebase emulators:start --only functions,auth,firestore
```

### Service account for local Admin SDK

Create `functions/keys/serviceAccountKey.json` with your Firebase service account. This file must be gitignored (see `functions/.gitignore`).

Alternatively, you can reuse the existing JSON in `discord-firestore-sync/secrets/` for local-only development.

### Test Discord login endpoint (optional)

```bash
curl -I "http://127.0.0.1:5002/uconn-fsae-ev/us-central1/discordLogin"
```

Ensure your Discord application (in the Developer Portal) includes BOTH redirect URIs:
- Local: `http://127.0.0.1:5002/uconn-fsae-ev/us-central1/discordCallback`
- Prod:  `https://us-central1-uconn-fsae-ev.cloudfunctions.net/discordCallback`


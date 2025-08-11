
# FSAE EV Powertrain Dashboard (React + Tailwind + Firebase)

Public read, admin-only write. Deploys to GitHub Pages.

## Quick start
```bash
npm i
cp .env.example .env  # fill with your Firebase config
npm run dev
```

## Firebase Rules (publish after you get your UID)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read: if true; }
    match /{document=**} {
      allow create, update, delete: if request.auth != null && request.auth.uid == "YOUR_UID";
    }
  }
}
```

## Deploy to GitHub Pages
- Ensure `vite.config.ts` has `BASE_PATH` set to your repo name (e.g. `/fsae-dashboard/`).
- Commit & push, then run: `npm run deploy` (publishes `dist` to `gh-pages` branch).
- Site will be available at: `https://<username>.github.io/<repo>/`.

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


**GitHub Pages URL (after deploy):** https://marceldabek.github.io/fsae-dashboard/

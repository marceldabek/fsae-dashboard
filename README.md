
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


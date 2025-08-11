
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


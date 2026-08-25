# camp-log

This is a camping/trip logger web app.
It has the following features:
- Abilty to track activity statistics, such has kilometres hiked ect
- Save locations
- Keep track of your camps/trips

This app was initially developed for a Venturer Scout SIA, but will likely be extended on in the future to included some of these propesed features:
- Map to display all the locations camped
- Tags to keep track and search camps/locations
- Account System

# Latest demo deployment
The site is hosted for free on render, if its the first request to it in the first 15 minutes it might take up to a minute to start
[Site on free render plan](http://camp-log.onrender.com/)

# Running with Docker
A `Dockerfile` builds the frontend and runs the Express/Remult server. On every push to `master`, GitHub Actions builds the image and publishes it to `ghcr.io/aclem43/camp-log:latest` (see [.github/workflows/docker-publish.yml](.github/workflows/docker-publish.yml)).

To run it (e.g. on a TrueNAS box):

1. Copy [.env.example](.env.example) to `.env` and fill in real values (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`/`SECRET`, `OPENCAGE_API_KEY`, and Postgres credentials). Keep `DATABASE_URL` in sync with `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`.
2. Run `docker compose up -d` using [docker-compose.yml](docker-compose.yml). This starts the app on port 3000, a Postgres 16 instance with a persistent volume, and a [Watchtower](https://containrrr.dev/watchtower/) sidecar that polls GHCR every 5 minutes and auto-updates the app container when a new `latest` image is published (Postgres itself is pinned to the `16` tag and won't be auto-updated).

If the GHCR package is private, authenticate Docker on the host first: `docker login ghcr.io -u <github-username>` with a personal access token that has `read:packages` scope.

### TrueNAS SCALE Apps UI
If deploying via TrueNAS SCALE's Apps &rarr; Discover Apps &rarr; **Install via YAML** instead of the CLI, use [truenas-compose.yaml](truenas-compose.yaml). It's the same stack but with secrets inlined as `environment:` (the pasted-YAML flow has no `.env` file to read) and Postgres storage pointed at a real dataset path instead of a Docker-managed volume. Fill in every `CHANGE_ME` (secrets, pool name) before pasting it in.

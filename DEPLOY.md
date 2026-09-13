# Docker deployment for getmehired.today

This stack runs the Next.js app, Presage API, Nginx, and Certbot. Nginx exposes
only ports 80 and 443:

- `https://getmehired.today/` routes to the Next.js app.
- `https://getmehired.today/v1/*` routes to the Presage API.
- `wss://getmehired.today/v1/live` routes to the Presage WebSocket.
- `https://getmehired.today/presage-health` routes to the Presage health check.

## Before the first start

1. Point the `A` record for your domain at this server's public IPv4
   address. Add an `AAAA` record only if IPv6 really reaches this server.
   Set `DOMAIN` in `.env` (defaults to `getmehired.today`, `www.` alias included).
2. Allow inbound TCP ports 80 and 443 in the host and cloud firewalls.
3. Copy the environment template and fill in the keys. Compose loads
   `app/.env.local` into the app, presage-api, and certbot containers:

   ```sh
   cp app/.env.example app/.env.local
   ```

   Required in `app/.env.local`: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (baked at build time —
   must be set before `up --build`), `CLERK_SECRET_KEY`, `DATABASE_URL`,
   `R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET`,
   `GEMINI_API_KEY` (+ `GOOGLE_API_KEY` for workbench), `ELEVENLABS_API_KEY`,
   `DEEPGRAM_API_KEY`, `SMARTSPECTRA_API_KEY`.
   `CERTBOT_EMAIL` and `DOMAIN` are optional but recommended.

4. Apply Postgres migrations (TigerData/external DB — root compose ships no DB):

   ```sh
   for f in app/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
   ```

   This includes `0011_gmh_accounts_research.sql` for profiles/research.
5. Provision R2 CORS once from the app dir:

   ```sh
   pnpm --dir app setup:r2-cors
   ```

## Start

From the repository root:

```sh
docker compose up --build -d
```

Root compose is prod (nginx 80/443 only, no direct 8080). For presage-only
local dev with published 8080, use `presage-api/docker-compose.yml` instead:
`docker compose -f presage-api/docker-compose.yml up --build`.

Nginx initially uses a one-day self-signed fallback certificate. Certbot obtains
the trusted Let's Encrypt certificate through the port-80 webroot challenge,
and Nginx detects and loads it automatically. No second Compose command or
manual reload is needed. Certbot checks for renewal every 12 hours.

Follow certificate setup with:

```sh
docker compose logs -f certbot nginx
```

If DNS has not propagated yet, Certbot waits five minutes and retries. Once the
certificate is installed, verify it and both upstreams:

```sh
curl --fail https://getmehired.today/
curl --fail https://getmehired.today/presage-health
```

The Presage service does not implement end-user authentication. The `/v1/*`
routes are therefore public in this minimal setup and can consume SmartSpectra
credits. Put authentication or access controls in front of them before treating
this as a hardened production deployment.

# Docker deployment for getmehired.today

This stack runs the Next.js app, Presage API, Nginx, and Certbot. Nginx exposes
only ports 80 and 443:

- `https://getmehired.today/` routes to the Next.js app.
- `https://getmehired.today/v1/*` routes to the Presage API.
- `wss://getmehired.today/v1/live` routes to the Presage WebSocket.
- `https://getmehired.today/presage-health` routes to the Presage health check.

## Before the first start

1. Point the `A` record for `getmehired.today` at this server's public IPv4
   address. Add an `AAAA` record only if IPv6 really reaches this server.
2. Allow inbound TCP ports 80 and 443 in the host and cloud firewalls.
3. Copy the environment template and fill in the keys used by the app:

   ```sh
   cp .env.example .env
   ```

   `CERTBOT_EMAIL` is optional, but recommended for certificate expiry notices.

## Start

From the repository root:

```sh
docker compose up --build -d
```

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

# Presage edge deployment on `root@dev`

Status: execution-ready handoff plan, September 12, 2026

This document moves the Presage API from Vultr to the Ubuntu LXC guest reachable with passwordless SSH at `root@dev`. The public API will use a Cloudflare Tunnel. Tailscale remains the private administration path.

The recommended public endpoint is:

```text
https://presage.getmehired.today
wss://presage.getmehired.today/v1/live
```

The hostname is intentionally separate from `getmehired.today`. DNS cannot route only `/v1` to a different machine, and relaying the WebSocket through Vultr would keep the failing Vultr dependency and add a high-bandwidth, latency-sensitive network hop.

## Executive decision

Use Cloudflare Tunnel for public HTTPS/WSS and the existing Tailscale connection for SSH, deployment, and private diagnostics.

```text
Browser / camera client
        |
        | HTTPS or WSS, public DNS and Cloudflare TLS
        v
Cloudflare edge
        |
        | outbound tunnel initiated by cloudflared
        v
root@dev Ubuntu LXC
  cloudflared container ---> presage-api:8080
                                  |
                                  | outbound HTTPS
                                  v
                           Presage services

Operator ---> Tailscale ---> root@dev:22
```

This is cleaner than either Tailscale Funnel or a Tailscale relay through Vultr:

- Cloudflare Tunnel supports public custom hostnames and WebSockets without router port forwarding, dynamic DNS, or exposing the apartment's public IP.
- `root@dev` already has working Tailscale and can be managed privately even if DNS or the tunnel is unhealthy.
- A direct public tunnel avoids carrying raw camera frames through Vultr. A 1280x720 BGR frame is 2,764,800 bytes; at 30 FPS the payload alone is roughly 664 Mbps before protocol and TLS overhead.
- Ordinary Tailscale access would require every API client to join the tailnet. Funnel is less suitable for the existing custom domain and gives no advantage over Cloudflare, which already fronts `getmehired.today`.

Cloudflare documents full WebSocket support for Tunnel and proxied hostnames. It also notes that WAF inspection applies to the initial HTTP upgrade, not subsequent WebSocket frames, and that edge restarts can terminate connections. The client therefore needs normal reconnect/backoff behavior and must create a fresh Presage session after reconnecting. See [Cloudflare WebSockets](https://developers.cloudflare.com/network/websockets/), [Cloudflare Tunnel overview](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/), and the [Tunnel FAQ](https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/).

## Why the move is necessary

The deployed HTTPS and WSS layers on Vultr work. A client reaches `wss://getmehired.today/v1/live`, receives `hello`, `kIdle`, `kStarting`, and `session_started`, and sends frames. Processing then fails inside the native SmartSpectra SDK.

Server logs show Presage requests such as `POST /device/pair`, usage verification, metric authorization, and remote model delivery returning HTTP 403. This happened with both Vultr IPv4 addresses:

- `64.177.44.85`
- `155.138.236.93`

The secondary address was successfully used for container egress and produced the same result. The same image and API key work locally and reach `kRunning`, so the evidence points to Presage rejecting or mishandling the Vultr network/ASN path, not to SSL, WebSocket framing, or the rotated key.

The new target was inspected without modifying it:

- SSH alias: `root@dev`
- Hostname: `dev`
- OS: Ubuntu 24.04.5 LTS, x86_64
- Virtualization: LXC guest; this is not the Proxmox hypervisor
- Capacity: 8 CPUs, 16 GiB RAM, about 58 GB free disk
- Docker: 29.8.0; Compose: 5.5.1; no current containers or volumes
- Tailscale: active, including address `100.82.207.112`
- Apartment public IPv4 observed during inspection: `104.15.251.74`; it is not needed by the tunnel
- `cloudflared`: not installed on the host; it will run as a container
- Ports 80, 443, and 8080 are not publicly bound
- An unauthenticated probe to Presage's `/device/pair` returns a JSON HTTP 400 from the Presage application, rather than Vultr's HTML 403. This confirms the apartment egress path reaches Presage correctly.
- TCP connectivity from the guest to Cloudflare Tunnel endpoints on port 7844 and to Cloudflare APIs on 443 succeeds.

## Scope and success criteria

The immediate goal is a reliable public live WebSocket API. The deployment is complete when all of the following are true:

1. `https://presage.getmehired.today/health` returns HTTP 200 with a valid public certificate.
2. `https://presage.getmehired.today/v1/capabilities` returns the API capability response.
3. A real camera session over `wss://presage.getmehired.today/v1/live` progresses through `hello`, `kIdle`, `kStarting`, and `kRunning`.
4. The server accepts frames at the expected cadence, emits metric/validation events, and stops normally without `sdk_error`, close code 1011, or Presage authorization/pairing 403 errors.
5. Rebooting the LXC guest restores both containers and the public health endpoint without manual intervention.
6. No origin service port is exposed to the public Internet, and neither the Presage key nor the tunnel token is committed to Git or printed in logs.

This plan does not claim that the current large synchronous video-upload endpoint is suitable for Cloudflare. That is addressed separately below.

## Important repository facts

The implementation agent must inspect the current working tree before editing it. It already contains uncommitted Presage fixes and must not overwrite or revert them. At the time this plan was written, relevant modified or new paths included:

```text
docker-compose.yml
presage-api/Dockerfile
presage-api/docker-compose.yml
presage-api/docker-entrypoint.sh
presage-api/src/routes/live.ts
presage-api/examples/https_smoke_test.py
```

The API exposes:

```text
GET  /health
GET  /v1/capabilities
GET  /v1/live                 WebSocket upgrade
POST /v1/videos/analyze
```

The service uses a process-global native SDK and permits only one active processing session per container. A competing HTTP request receives 409; a competing WebSocket is closed with 1013. Running multiple API replicas is therefore not an automatic capacity or availability solution.

The keyring volume and stable container hostname added by the current changes are important. They give the native SDK a persistent device identity across container replacement. Do not deploy an older Dockerfile/entrypoint/Compose definition that omits those changes.

## Phase 1: Cloudflare control-plane setup

This phase needs access to the Cloudflare account that owns the `getmehired.today` zone. The implementation agent should ask the user for the tunnel token only when it is ready to deploy; the token must not be pasted into this document, source code, a command recorded in shell history, or chat logs.

1. In Cloudflare Zero Trust, create a remotely managed tunnel named `presage-dev`.
2. Add a public hostname:
   - Subdomain: `presage`
   - Domain: `getmehired.today`
   - Service type: HTTP
   - Service URL: `http://presage-api:8080`
3. Let Cloudflare create the proxied DNS record for the tunnel. Do not point the record at the apartment's public IPv4.
4. Confirm WebSockets are enabled for the zone under Network settings.
5. Obtain the tunnel token. Treat it as a high-value secret: anyone holding it can run a connector for this tunnel. Cloudflare documents token scope and rotation in [remotely managed tunnel permissions](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/remote-tunnel-permissions/).

The service name `presage-api` works because `cloudflared` will be a sidecar on the same Docker Compose network. If the dashboard refuses the service before the connector starts, save the hostname anyway and validate it once both containers are up.

Do not add Cloudflare Access in front of the endpoint during the first connectivity test. Access service tokens are inappropriate to embed in a browser WebSocket client. Authentication is a separate, required production-hardening phase described below.

## Phase 2: repository changes

Create a dedicated deployment bundle at `deploy/presage-edge/`; do not repurpose the root production Compose file, which also runs the application, nginx, and Certbot on Vultr.

The implementation should add:

```text
deploy/presage-edge/docker-compose.yml
deploy/presage-edge/.env.example
deploy/presage-edge/README.md
deploy/presage-edge/secrets/.gitkeep
```

Ensure `.gitignore` ignores the real deployment environment and secret files. The repository's root `.gitignore` already ignores `.env`, but add an explicit deployment secret pattern such as `deploy/**/secrets/*` with a negation for `.gitkeep`.

The new Compose definition should have these properties:

### `presage-api` service

- Build from `../../presage-api` so the tested local wrapper image is used.
- Use a stable `hostname: presage-api`.
- Set `init: true` and `restart: unless-stopped`.
- Load only the Presage service environment from a deployment-specific `.env`.
- Set `HOST=0.0.0.0` and `PORT=8080`.
- Use `expose: [8080]` so `cloudflared` can reach it without publishing it publicly.
- Optionally bind `127.0.0.1:8080:8080` for host-local diagnostics. Never bind `0.0.0.0:8080`.
- Mount a named volume such as `presage-keyring:/home/node/.local/share/keyrings`.
- Retain the existing `/health` healthcheck.

### `cloudflared` service

- Use the official `cloudflare/cloudflared` image pinned to a supported version or immutable digest chosen at implementation time. Do not silently use `latest` in the final deployment.
- Set `restart: unless-stopped`.
- Wait for `presage-api` to be healthy.
- Run the remotely managed tunnel with `tunnel --no-autoupdate run`.
- Prefer a Compose secret mounted as a file and Cloudflare's `--token-file` option so the token is not part of the container command or environment. Verify that option against the pinned image before deployment. If that image does not support it, use the documented token environment mechanism and record the reduced secrecy in the handoff.
- Do not publish any ports.
- Do not force QUIC. Automatic protocol selection permits TCP fallback when UDP/7844 is unavailable. The preflight already showed 7844 reachable. Cloudflare's current connectivity requirements are documented in [Tunnel connectivity prechecks](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/troubleshoot-tunnels/connectivity-prechecks/).

The implementation agent should first render and inspect the final configuration with:

```bash
docker compose --env-file .env config --quiet
```

It must verify that this command and any troubleshooting output do not print secret values.

### Environment and secrets

Only transfer variables needed by `presage-api/src/config.ts`; do not copy the root application's `.env` or unrelated Clerk, database, R2, or AI-provider credentials. Expected API settings include:

```text
SMARTSPECTRA_API_KEY
HOST=0.0.0.0
PORT=8080
SMARTSPECTRA_TELEMETRY_ENABLED
LOG_LEVEL
MAX_VIDEO_BYTES
VIDEO_ANALYSIS_TIMEOUT_MS
MAX_WS_FRAME_BYTES
```

Copy the current rotated Presage key from the local `presage-api/.env` into the remote deployment environment without displaying it. Set the remote file mode to 0600. Put the Cloudflare token in a separate 0600 secret file when `--token-file` is supported.

Do not copy the existing local or Vultr keyring volume. The apartment instance should provision a fresh persistent device identity on its first SDK session. Once created, preserve that volume through ordinary container rebuilds.

### Test script compatibility

`presage-api/examples/https_smoke_test.py` currently expects the root deployment's `/presage-health` nginx alias. The dedicated tunnel exposes the API directly at `/health`. Add a `--health-path` option, retain `/presage-health` as its backward-compatible default, and invoke it with `--health-path /health` for the new hostname. Update `presage-api/examples/README.md` with the new command.

The camera debugger already uses `/health` for its optional probe, so `--no-probe` should not be necessary on the new hostname.

## Phase 3: deployment over Tailscale SSH

Use `root@dev`; do not install this workload on the Proxmox hypervisor. The SSH alias already resolves over the user's private management setup.

1. Confirm the target and preserve evidence before modifying it:

   ```bash
   ssh root@dev 'hostname; systemd-detect-virt; docker version; docker compose version; docker ps -a'
   ```

2. Create a restricted deployment directory:

   ```bash
   ssh root@dev 'install -d -m 0750 /opt/get-me-hired'
   ```

3. Transfer the repository content needed to build the API plus `deploy/presage-edge`. `rsync -az` over SSH is preferred if present on both machines. Exclude `.git`, `.env`, `node_modules`, build output, and all unrelated secrets. Do not use `--delete` on the first deployment.
4. Transfer the API `.env` and tunnel-token file separately, then set each to mode 0600. Avoid commands that interpolate their contents onto the command line.
5. From `/opt/get-me-hired/deploy/presage-edge`, validate and build:

   ```bash
   docker compose --env-file .env config --quiet
   docker compose --env-file .env build presage-api
   docker compose --env-file .env up -d
   docker compose ps
   ```

6. Wait for the API healthcheck and tunnel connector to become healthy. Inspect bounded logs without dumping configuration:

   ```bash
   docker compose logs --tail=200 presage-api
   docker compose logs --tail=200 cloudflared
   curl --fail --silent --show-error http://127.0.0.1:8080/health
   ```

   If port 8080 was not bound to loopback, run the health request from the `cloudflared` container or use a one-shot container attached to the Compose network.

7. Confirm Cloudflare reports the tunnel as Healthy and has multiple connector connections. The connector makes outbound connections; no home-router NAT or firewall port-forward is required.

The first image build may be CPU- and network-intensive. Do not run `docker compose down -v` during retries: `-v` would delete the device keyring.

## Phase 4: end-to-end verification

Run these checks from the development workstation, not from inside `root@dev`, so they exercise public DNS, Cloudflare TLS, the tunnel, Docker networking, and the API together.

### HTTPS and certificate

After the smoke script supports `--health-path`, run:

```bash
cd presage-api
nix run path:. -- examples/https_smoke_test.py \
  --base-url https://presage.getmehired.today \
  --health-path /health
```

The script must verify hostname/certificate validation rather than using an insecure TLS option. Also check `/v1/capabilities` and confirm its response is from this API, not a Cloudflare error page.

### Real WebSocket camera session

Start with one baseline metric to minimize unrelated model requirements:

```bash
cd presage-api
env -u DRI_PRIME nix run path:. -- examples/camera_debug.py \
  --url wss://presage.getmehired.today/v1/live \
  --metrics 0 \
  --event-mode full \
  --duration 15
```

Then run the intended set:

```bash
env -u DRI_PRIME nix run path:. -- examples/camera_debug.py \
  --url wss://presage.getmehired.today/v1/live \
  --metrics 0,1,15 \
  --event-mode full \
  --duration 30
```

Expected evidence:

- Public TLS and WebSocket upgrade succeed.
- `hello` contains a session ID and SDK version.
- The processing state reaches `kRunning`, not `kError`.
- Frames continue for the requested duration and the server emits validation or metric events.
- The client ends normally instead of receiving close code 1011.
- Remote logs contain no `POST /device/pair` 403, usage-verification 403, metric-authorization 403, or model-delivery 403.

Record the observed FPS, upload throughput, time from connection to `kRunning`, and client-to-edge latency. Do not declare success from `/health` alone; `/health` does not initialize SmartSpectra.

### Restart test

Once the live session passes:

1. Recreate the API container without deleting volumes.
2. Repeat the baseline camera test and confirm the persistent keyring survives.
3. Reboot the `dev` LXC guest once.
4. Confirm Docker, both services, `/health`, and a fresh camera session recover automatically.
5. In the Proxmox UI, configure the LXC guest to start on host boot. This is a hypervisor setting and cannot be inferred from inside the guest.

## Phase 5: client cutover

Update clients to use the new hostname explicitly. Do not depend on an HTTP redirect for WebSocket migration; redirect behavior is inconsistent between clients and still incurs an unnecessary request to Vultr.

Recommended configuration:

```text
PRESAGE_HTTP_BASE_URL=https://presage.getmehired.today
PRESAGE_WS_URL=wss://presage.getmehired.today/v1/live
```

No current frontend reference to the Presage/WSS URL was found during this audit, so the implementation agent must locate the eventual integration point rather than assuming a file. Keep the old Vultr deployment intact until the new camera test passes, but do not send production sessions to it. After cutover, remove or disable the old public `/v1/live` route so failures are obvious and traffic cannot consume the singleton session unexpectedly.

If browser code calls REST endpoints on `presage.getmehired.today` from `https://getmehired.today`, it is cross-origin. Add `@fastify/cors` with an exact origin allowlist; do not use `*`. WebSocket handshakes also carry an `Origin` header, and the API should reject unexpected browser origins as part of hardening.

## Authentication and abuse protection

The wrapper currently has no end-user authentication. A public unauthenticated endpoint can consume paid Presage usage and can monopolize the single active SDK session. Cloudflare WAF and rate limits can protect the initial WebSocket handshake, but Cloudflare does not inspect frames after the 101 upgrade.

For the immediate supervised hackathon test:

- Keep the hostname undisclosed outside the team.
- Add a restrictive Cloudflare rate-limit/WAF rule for repeated connection attempts.
- Monitor active sessions and Presage usage.
- Treat this as temporary, not production security.

Before public release, implement application-layer authorization:

1. The authenticated Next.js application verifies the Clerk user and issues a short-lived, one-time Presage connection token.
2. The WebSocket client presents that token in a supported handshake field, preferably `Sec-WebSocket-Protocol`; a query parameter is acceptable only if server/proxy logs are proven to redact it.
3. `presage-api` validates issuer, audience, expiry, nonce, and user/session binding before acquiring the singleton SDK session.
4. HTTP upload endpoints require a bearer token with the appropriate scope.
5. Validate the browser `Origin` against the exact production origin.
6. Enforce per-user connection and session-duration limits in the application, not only at Cloudflare.

Do not embed a Cloudflare Access service token, Presage API key, or other long-lived secret in browser code.

## Large video uploads are a separate design problem

The live WebSocket path is compatible with Cloudflare Tunnel. The current synchronous `POST /v1/videos/analyze` contract is not reliably compatible with its configured 1 GiB maximum and six-hour analysis timeout.

Cloudflare's normal proxied upload limits are plan-dependent (commonly 100 MB on Free/Pro and 200 MB on Business), and proxied HTTP requests have finite read/write timeouts. See [Cloudflare 413 limits](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-413/) and [Cloudflare 524 timeouts](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/).

Use one of these explicit paths:

- MVP: support the public tunnel for live WSS, health, and capabilities only. Limit video uploads to the Cloudflare plan's verified ceiling and only claim synchronous analysis for durations proven in an end-to-end test.
- Recommended phase 2: upload video directly to R2/S3 with multipart/chunked upload, submit an object reference to the API, return HTTP 202 plus a job ID, and expose polling or event delivery for progress/results. This decouples upload and processing duration from one Cloudflare request.
- Private diagnostic use: reach a loopback-bound API over a Tailscale SSH forward. This is not a public product path.

Do not route large video requests through Vultr as a workaround; it adds latency, bandwidth cost, another failure domain, and the same problematic network dependency for Presage calls.

## Operations and reliability

- Enable Proxmox autostart for the `dev` LXC guest and choose a sensible boot order after networking.
- Keep `restart: unless-stopped` on both containers.
- Use an external monitor for `/health` and a lightweight synthetic WebSocket test that verifies at least the `hello` event. A complete camera processing test should run periodically or before demos because health alone cannot detect Presage pairing failures.
- Retain bounded Docker logs or configure rotation so verbose native SDK output cannot fill the 63 GB guest disk.
- Back up the LXC guest with Proxmox. Confirm that backups include the Docker named volume containing the keyring. Treat that volume as sensitive.
- Add a UPS and router uptime plan if this becomes more than a demo service. Tunnel ingress does not fix residential power or ISP outages.
- A second `cloudflared` connector can improve ingress-path availability, but it does not make the singleton native SDK highly available. A second API machine requires deliberate session routing, separate device identity, and confirmation that the Presage account permits it.
- Configure client ping/keepalive if the chosen WebSocket library does not already do so. On disconnect, use capped exponential backoff with jitter and recreate the entire SmartSpectra session.

## Rollback

Rollback must preserve the apartment keyring:

1. Stop sending clients to `presage.getmehired.today`.
2. Stop the Compose project with `docker compose down` only if necessary; never add `-v`.
3. Disable the public hostname or tunnel in Cloudflare.
4. Keep the keyring volume and deployment secrets for diagnosis.
5. Use the previous Vultr URL only after an end-to-end `kRunning` test proves Presage has stopped returning 403 for that egress. Its HTTP health check is not sufficient.

Because the old Vultr deployment currently fails during SDK processing, rollback should usually mean pausing the feature or using a verified local/Tailscale diagnostic path, not silently returning users to Vultr.

## Things the implementation agent must not do

- Do not run the API or `cloudflared` on the Proxmox hypervisor; use the `dev` LXC guest.
- Do not create a router port-forward or expose Docker port 8080 on the LAN/WAN.
- Do not relay raw WebSocket frames through Vultr or a Tailscale exit node.
- Do not change the apex `getmehired.today` route during the initial migration.
- Do not copy the Vultr/local keyring into the apartment deployment.
- Do not delete the named keyring volume during rebuilds or rollback.
- Do not commit, print, or paste the Presage key or Cloudflare tunnel token.
- Do not expose the unauthenticated endpoint as a finished production design.
- Do not advertise 1 GiB synchronous video analysis through Cloudflare without redesigning and testing it.
- Do not revert unrelated changes in the already-dirty working tree.

## Handoff checklist

The next agent should execute in this order:

- [ ] Inspect `git status`, the current Presage Docker changes, and API route/config code.
- [ ] Confirm `root@dev` still identifies as the expected Ubuntu LXC guest.
- [ ] Create the `presage-dev` remotely managed tunnel and `presage.getmehired.today` hostname.
- [ ] Add the dedicated Compose deployment, documentation, secret exclusions, and smoke-test health-path support locally.
- [ ] Run repository tests and build the API image locally.
- [ ] Transfer only required source/config to `/opt/get-me-hired` over Tailscale SSH.
- [ ] Install the Presage key and Cloudflare token as mode-0600 remote secrets.
- [ ] Build and start the two containers without publishing origin ports.
- [ ] Verify local container health and Cloudflare connector health.
- [ ] Run public HTTPS/certificate tests from the workstation.
- [ ] Run the real camera WebSocket test until it reaches `kRunning` and produces events.
- [ ] Recreate the API container and repeat the camera test to prove keyring persistence.
- [ ] Reboot the LXC guest and repeat public health plus live processing tests.
- [ ] Add origin/auth/rate-limit hardening before broad exposure.
- [ ] Cut clients over explicitly to the new WSS hostname.
- [ ] Disable the broken old public WSS route after the new path is proven.
- [ ] Record the final image digest, Cloudflare tunnel name/ID, deployment path, test output, recovery steps, and any deviations from this plan.

The only information that cannot be derived safely by the implementation agent is access to the Cloudflare zone/tunnel token. The default hostname decision is already made here: use `presage.getmehired.today` unless the user explicitly overrides it.

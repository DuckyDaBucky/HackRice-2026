# Presage edge deployment (`root@dev` + Cloudflare Tunnel)

Implements `docs/22-presage-proxmox-cloudflare-deployment.md`: the Presage API
runs in Docker on the `root@dev` Ubuntu LXC guest, with public ingress via a
Cloudflare Tunnel (`presage-dev`, hostname `presage.getmehired.today`).
Tailscale SSH stays the private admin path. There is no router port-forward
and no publicly bound origin port.

Public surface when complete:

```text
https://presage.getmehired.today/health
https://presage.getmehired.today/v1/capabilities
wss://presage.getmehired.today/v1/live
```

## Files

```text
deploy/presage-edge/docker-compose.yml  presage-api + cloudflared sidecar
deploy/presage-edge/.env.example        template; real `.env` lives on root@dev only
deploy/presage-edge/secrets/.gitkeep    placeholder; real token file is git-ignored
```

`secrets/cloudflared-token.env` holds the raw Cloudflare tunnel token (mode 0600,
git-ignored). It is loaded via `env_file` as the documented `TUNNEL_TOKEN` variable. The preferred `--token-file` flag is rejected by cloudflared 2026.7.3 and the image has no shell for a file-to-env wrapper, so the env mechanism is used and recorded here. Never run plain `docker compose config` (it prints the token); `config --quiet` is the only sanctioned render check.

## Prerequisites (Cloudflare dashboard)

1. Zero Trust -> Networks -> Tunnels: remotely managed tunnel `presage-dev`.
2. Public hostname: `presage.getmehired.today`, service type HTTP,
   URL `http://presage-api:8080`. Let Cloudflare create the proxied DNS record.
3. Zone Network settings: WebSockets enabled.
4. Copy the tunnel token; it is installed on `root@dev` during deployment.

## Deploy (from this workstation, over Tailscale SSH)

```bash
ssh root@dev 'hostname; systemd-detect-virt; docker version; docker compose version; docker ps -a'
ssh root@dev 'install -d -m 0750 /opt/get-me-hired'

# Transfer API source + this bundle (exclude secrets, VCS, deps, build output).
rsync -az --exclude .git --exclude .env --exclude node_modules --exclude dist \
  presage-api/ root@dev:/opt/get-me-hired/presage-api/
rsync -az --exclude secrets/ \
  deploy/presage-edge/ root@dev:/opt/get-me-hired/deploy/presage-edge/

# Install secrets without echoing values: stage via local files, then:
ssh root@dev 'install -m 0600 /dev/null /opt/get-me-hired/deploy/presage-edge/.env'
ssh root@dev 'install -m 0600 /dev/null /opt/get-me-hired/deploy/presage-edge/secrets/cloudflared-token.env'
# (copy the real contents over separately, e.g. scp to a temp name then
#  `install -m 0600` into place; verify size and mode with `stat`, never `cat`.
#  The token file must contain exactly one line: `TUNNEL_TOKEN=<token>`.)

cd /opt/get-me-hired/deploy/presage-edge   # on root@dev
docker compose --env-file .env config --quiet   # must not print secrets
docker compose --env-file .env build presage-api
docker compose --env-file .env up -d
docker compose ps
docker compose logs --tail=200 presage-api
docker compose logs --tail=200 cloudflared
curl --fail --silent --show-error http://127.0.0.1:8080/health
```

Fresh apartment keyring: do NOT copy any local/Vultr keyring volume. The first
SDK session provisions a new persistent device identity in `presage-keyring`.
Never run `docker compose down -v` here.

If the pinned `cloudflare/cloudflared` image rejects `--token-file`, fall back
to the documented token environment mechanism and record the deviation.

## Verify (from this workstation, not from `root@dev`)

```bash
cd presage-api
nix run path:. -- examples/https_smoke_test.py \
  --base-url https://presage.getmehired.today \
  --health-path /health

env -u DRI_PRIME nix run path:. -- examples/camera_debug.py \
  --url wss://presage.getmehired.today/v1/live \
  --metrics 0 --event-mode full --duration 15
```

Success = `hello` -> `kIdle` -> `kStarting` -> `kRunning`, frames flow, metric
events arrive, clean stop (no close 1011, no `/device/pair` 403). `/health`
alone is not success. Then: recreate the API container (no `-v`) and retest
keyring persistence; reboot the LXC guest and retest; set Proxmox autostart.

## Rollback (preserve the keyring)

1. Stop sending clients to `presage.getmehired.today`.
2. `docker compose down` only if needed; never `-v`.
3. Disable the tunnel hostname in Cloudflare; keep volume + secrets for diagnosis.
4. Vultr fallback only after an end-to-end `kRunning` test passes there.

## Deviations from the plan doc

- `.env` uses the real `presage-api/src/config.ts` names
  (`SMARTSPECTRA_ENABLE_TELEMETRY`, `SMARTSPECTRA_LOG_LEVEL`, `MAX_FRAME_BYTES`),
  not the doc's `SMARTSPECTRA_TELEMETRY_ENABLED` / `LOG_LEVEL` / `MAX_WS_FRAME_BYTES`.
- Loopback bind `127.0.0.1:8080:8080` is enabled (doc: optional) so the
  documented `curl http://127.0.0.1:8080/health` check works directly.
- `cloudflared` pinned to `2026.7.3`; confirm the tag/digest still resolves at
  deploy time and record the final digest.
- Token travels via `TUNNEL_TOKEN` env file, not `--token-file` (rejected by
  this image) and no shell exists in the image for a wrapper entrypoint.
  Revisit when the pinned image changes.

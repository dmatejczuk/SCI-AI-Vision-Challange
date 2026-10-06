# Deployment

## Choose a mode

| Mode | Compose file | Address | Published ports | Certificates |
| --- | --- | --- | --- | --- |
| Local (default) | `docker-compose.yml` | `http://localhost` | Loopback TCP 80 | None |
| LAN | `docker-compose.network.yml` | `https://APP_HOST` | TCP 80/443, UDP 443 | Caddy private CA by default |
| Public | `docker-compose.network.yml` | `https://APP_HOST` | TCP 80/443, UDP 443 | Public ACME CA |

The files are standalone alternatives, not overlays. Do not combine them with two `-f` flags.
They use the same service/image and project name. Switching modes recreates the application
container and disconnects current sessions. Keep the same project directory/name so certificate
volumes are reused. No application source changes are needed when changing hosts.

## Local startup

Install Docker Engine with Compose v2, or start Docker Desktop in Linux-container mode.
Use a local Docker context and ensure TCP port 80 is free. Internet access is needed for the first
build to fetch base images and npm dependencies. From the repository directory:

```sh
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app
```

Open **http://localhost** on that computer. No hosts entry, `.env`, certificate installation or
TLS exception is required. The default Caddy configuration serves HTTP explicitly and does not
redirect to a hostname or HTTPS. Compose publishes port 80 only on `127.0.0.1`.

Modern browsers consider HTTP localhost a potentially trustworthy origin, allowing camera access
with permission. Click **Rozpocznij** and grant camera access. OS privacy settings and browser or
enterprise policies still apply. A remote Docker context means localhost is not the deployment
host; use the network mode instead.

```sh
docker compose stop                  # Stop while retaining the container
docker compose start                 # Start the stopped container
docker compose up -d --build         # Rebuild after source updates
docker compose down                  # Remove the container and network
```

After `down`, run `up` again. No certificate or session-data migration is needed for local mode.

## LAN deployment with a private CA

Use a stable server LAN IP. Copy `.env.example` to `.env`, then edit these values:

```dotenv
APP_HOST=vision.example.test
APP_TLS_ISSUER=internal
```

`vision.example.test` and `192.168.10.20` below are examples; replace them with your chosen
hostname and actual server IP. `APP_HOST` must contain only one hostname, without scheme,
path or port. Environment variables in your shell override `.env` values.

Configure your LAN DNS to resolve that hostname to the server. Alternatively, add a hosts entry
on **each client** (administrator privileges required), for example:

```text
192.168.10.20 vision.example.test
```

Windows hosts file: `C:\Windows\System32\drivers\etc\hosts`; Linux/macOS: `/etc/hosts`.
This is optional for LAN clients when DNS is available, and never required for local mode.
Avoid `.local` names unless your network explicitly supports their mDNS behavior.
Allow inbound TCP 80/443 through the server firewall; UDP 443 enables optional HTTP/3.

```sh
docker compose -f docker-compose.network.yml config
docker compose -f docker-compose.network.yml up -d --build
docker compose -f docker-compose.network.yml ps
docker compose -f docker-compose.network.yml logs --tail=100 app
```

Caddy issues a private certificate and redirects HTTP requests for `APP_HOST` to HTTPS.
It stores its CA and certificates in the persistent `caddy_data` volume. Export only the public root:

```sh
docker compose -f docker-compose.network.yml cp app:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
```

Distribute this root through a trusted administrative channel and verify its fingerprint against
the server's copy. Never distribute private keys or the data volume. Install the root in the
trusted certificate store of every client. On Windows, an administrator can run:

```powershell
certutil -hashfile .\caddy-root.crt SHA256
certutil -addstore -f Root .\caddy-root.crt
```

For macOS/Linux use the OS trust-store procedure. Browser-specific stores or managed policies
may also require the root. Restart the browser and verify HTTPS has no warning. Do not bypass
certificate warnings or disable browser security. The container trusting its own CA does not
make remote clients trust it. Preserve `caddy_data`; do not use `down -v` during normal operation.

### Verify from another computer

Check that the system resolves the chosen hostname to the server (for example `ping` or a system
name resolver). A DNS-only lookup may not show hosts-file entries. After trusting the CA:

```sh
curl -I https://vision.example.test/
```

Alternatively, use `curl --cacert caddy-root.crt https://vision.example.test/` with a curl TLS
backend that supports that CA file. Open the same URL in the client's browser. Confirm no
certificate warning, `window.isSecureContext === true` in DevTools, and successful camera access
following **Rozpocznij**. Run a capture/train/test/game loop on each workstation.
A plain `http://192.168.10.20` address is not a secure camera context. `localhost` on a client
refers to that client, not the LAN server.

For a separate Node TLS verification without modifying the OS trust store (PowerShell):

```powershell
$env:APP_HOST = 'vision.example.test'
$env:SERVER_IP = '192.168.10.20'
$env:CA_FILE = "$PWD\caddy-root.crt"
node scripts/verify-https.mjs
```

The script validates both the certificate chain and hostname. `SERVER_IP` is optional when DNS
works; omit `CA_FILE` to use Node's default public CA trust. These script variables are not
required for normal browser use or local Docker startup.

## Public deployment

Use a real domain you control, for example `vision.your-domain.com`. Set `.env`:

```dotenv
APP_HOST=vision.your-domain.com
APP_TLS_ISSUER=acme
```

Point public DNS A records (and AAAA only if IPv6 is correctly routed) at the server. Forward
inbound TCP ports 80 and 443 to Caddy, allow them in firewalls, and allow outbound DNS/HTTPS for
certificate issuance/renewal. UDP 443 is optional for HTTP/3. No other service may occupy those
ports. Do not use an example/test domain for a real public certificate.

```sh
docker compose -f docker-compose.network.yml config
docker compose -f docker-compose.network.yml up -d --build
docker compose -f docker-compose.network.yml logs --tail=100 app
```

Caddy automatically obtains and renews public certificates using ACME. Unlike a private CA,
public certificates are already trusted by standard browser trust stores, so clients do not
install the Caddy root. Public issuance and renewal need Internet access; an isolated LAN should
use the private CA variant. Keep the data volume in either case. Public ACME issuance cannot be
verified using an unowned example domain. See [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).

## Operations and health

For network mode, include `-f docker-compose.network.yml` in **every** Compose command, including
`stop`, `start`, `down`, `ps`, `logs`, `exec`, `cp` and `up`. To return to local mode, run the default
`docker compose up -d --build`; it replaces the HTTPS service with loopback HTTP and retains the
named certificate volumes for later reuse.

```sh
docker compose ps
docker compose logs --tail=100 app
docker compose exec app wget -q -O - http://127.0.0.1:8080/health
```

The image checks this internal endpoint every 30 seconds (5-second timeout). It is bound to
container loopback and never published. `healthy` confirms Caddy responds internally, not client
DNS, certificate trust, camera hardware or model accuracy. Also check the public-facing URL:

```sh
curl -I http://localhost/
```

Expect HTTP 200 without `Location`, and `Content-Security-Policy`, `Permissions-Policy`,
`X-Content-Type-Options` and `Referrer-Policy`. The network URL should return HTTPS 200;
HTTP for its configured hostname should redirect to HTTPS. For detailed health history:

```sh
docker compose ps -q app
```

Copy the resulting container ID into `docker inspect --format '{{json .State.Health}}' CONTAINER_ID`.

## Troubleshooting

| Symptom | Check and action |
| --- | --- |
| Docker cannot connect | Start Docker Desktop, wait for its engine, select Linux containers and inspect `docker version` / `docker context show`. On Linux check the daemon and account permissions. |
| Port already allocated | Stop the conflicting web server/container or select the correct deployment host. Local mode needs TCP 80; network mode needs TCP 80/443 and publishes UDP 443. Inspect `docker ps`; on Windows use `Get-NetTCPConnection -LocalPort 80,443`. |
| Camera unavailable | Open the top-level app URL, click start and allow permission. Check OS/browser camera privacy settings, device connection and other apps using the camera. Test a supported recent Chrome/Edge browser. |
| Not a secure context | Use `http://localhost` on the Docker host or trusted HTTPS from clients. Inspect `window.isSecureContext`. Plain LAN HTTP is insufficient; never disable browser security. |
| Host not found | Check `APP_HOST`, DNS or client hosts entries, server IP, VPN and firewall. Local mode needs none of these name changes. |
| Untrusted certificate | For internal issuer, install the correct server CA on the client; check hostname, clock and browser trust store. For ACME inspect DNS, port reachability and issuance logs. Never dismiss the warning as a fix. |
| Container unhealthy | Inspect `.State.Health` as above and `docker compose logs --tail=100 app`; test the internal health endpoint. A starting status may take one health interval to change. |
| HTTPS after changing modes | Confirm the right Compose file and container ports. If a browser forces HTTPS on localhost, inspect its HTTPS-only/HSTS settings or test a clean profile; no insecure flags are needed. |
| Changed settings not applied | Run `up -d` again using the correct Compose file; `start` does not recreate a container with changed settings. |

## Offline preparation

Build while Internet is available, then export:

```sh
docker compose build
docker save ai-vision-challenge:1.0.0 -o ai-vision-challenge.tar
```

Transfer the archive and selected Compose file to the server; transfer `.env` only for network
mode. Caddy configurations are included in the image. After `docker load -i ai-vision-challenge.tar`,
run `docker compose up -d --no-build --pull never` for local mode, or
`docker compose -f docker-compose.network.yml up -d --no-build --pull never` for LAN mode.
For a new LAN server, distribute that server's CA. Assets and the model are bundled; clients
still require access to the server. Public certificate renewal is not an offline operation.

Camera secure-context requirements: [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

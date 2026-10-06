# Additional deployment guide: LAN and HTTPS

The [README](../README.md) covers starting and managing the container. This optional guide explains
network access, local hostnames, certificate trust and deployment without Internet access.
The hostname and addresses below are examples for a workshop network.

## Network access and certificates

Use a dedicated server with Docker Engine/Desktop and Docker Compose. Assign a static LAN address, for example `192.168.10.20`. The following address is an example: replace it with the school's actual address.

1. Configure local DNS: add an A record `ai-sci.local -> 192.168.10.20`. `.local` may be reserved for mDNS on some networks, so verify on every client; if necessary use hosts entries or a school-managed DNS name and update `APP_HOST`.
2. Alternatively, edit `C:\Windows\System32\drivers\etc\hosts` as administrator on each of the five Windows computers and add:

   ```text
   192.168.10.20 ai-sci.local
   ```

3. Permit inbound TCP ports 80/443 on the server's school/private network. UDP 443 is optional HTTP/3. Do not expose this workshop server to the public Internet.
4. Copy `.env.example` to `.env` if changing the hostname. Keep only the hostname in `APP_HOST`, without a scheme or path.
5. In the project directory, build and start:

   ```sh
   docker compose up -d --build
   docker compose ps
   docker compose logs app
   ```

   Once built, `docker compose up -d` starts the existing image. Caddy generates a private local CA and a certificate for `ai-sci.local` automatically (`tls internal`). No public certificate authority or Internet connection is needed. Persist the `caddy_data` volume: it holds this deployment's CA and keys. Do not use `docker compose down -v` during normal operations.

6. Export the public root certificate only:

   ```sh
   docker compose cp app:/data/caddy/pki/authorities/local/root.crt ./sci-root.crt
   ```

   Never copy `root.key` or the Caddy data volume to clients. Transfer `sci-root.crt` through your trusted administrative channel. Verify its fingerprint against the server's copy before installation:

   ```powershell
   certutil -hashfile .\sci-root.crt SHA256
   ```

7. On each of the five Windows computers, in an administrator terminal, trust the root:

   ```powershell
   certutil -addstore -f Root .\sci-root.crt
   ```

   The GUI equivalent is importing into **Local Computer → Trusted Root Certification Authorities**. Follow the school's policy for managed devices. Chrome/Edge use the Windows trust store; close and reopen the browser after import. On Linux use the distribution's CA trust mechanism; on macOS import the root in System Keychain and explicitly trust it. If the Caddy data volume is replaced, distribute and trust the new CA again.

8. Verify name resolution with `ping ai-sci.local` or `Resolve-DnsName ai-sci.local` (hosts entries may not appear in DNS-server-only tools). Open `https://ai-sci.local`. There must be no certificate warning. Do not work around certificate errors by dismissing the interstitial.
9. Verify TLS explicitly, replacing the example IP:

   ```sh
   curl --cacert sci-root.crt --resolve ai-sci.local:443:192.168.10.20 https://ai-sci.local/
   ```

10. Click **Rozpocznij**, allow the webcam, and confirm the live preview. If blocked, reset camera permission in the browser's site settings and check Windows camera privacy settings. The instructor panel can restart or select a camera.

Windows curl/Schannel may report an unknown revocation status for a private CA without a public CRL. Add `--ssl-revoke-best-effort` in that case; certificate chain and hostname verification remain enabled. Alternatively, export the public root to `certs/sci-root.crt` and run `node scripts/verify-https.mjs`. This uses explicit CA trust and hostname validation without changing the operating system trust store. Set `SERVER_IP` for a remote server and `APP_HOST` for a different domain.

For automated checks of a locally running production container, the Playwright configuration accepts `E2E_BASE_URL=https://ai-sci.local` and `E2E_TLS_SPKI` (the verified leaf key fingerprint returned by that script). It maps the test hostname to loopback and trusts only that key for the isolated test browser. This is a test setup, not a substitute for installing the CA on the five school computers.

### Air-gapped server preparation

Build the image on an Internet-connected machine before the event:

```sh
docker compose build
docker save ai-vision-challenge:1.0.0 -o ai-vision-challenge.tar
```

Transfer the image archive and `docker-compose.yml`/`.env` to the server. Run `docker load -i ai-vision-challenge.tar`, then `docker compose up -d --no-build --pull never`. Root CA generation happens on that server. Transfer and trust its root, not a different development server's root.

## Workstation preparation checklist

- [ ] Server has static LAN IP; image starts and reports healthy.
- [ ] Each client resolves `ai-sci.local` to that IP.
- [ ] Each client trusts the exported Caddy root and opens HTTPS without warnings.
- [ ] Each client has a working webcam and browser permission.
- [ ] Open the app on all five computers simultaneously.
- [ ] On every computer collect both classes, train, test live recognition and jump with OPEN → FIST.
- [ ] Hold FIST: no second jump. OPEN re-arms the next jump.
- [ ] Test SPACE independently of gesture predictions.
- [ ] Restart the camera and select another device where available.
- [ ] Confirm **Nowa grupa**, then run another session without restarting the server.
- [ ] Check that samples/scores on one client never appear on another.
- [ ] Disconnect WAN while preserving LAN; reload and run a complete session on each client.
- [ ] Create a desktop URL shortcut named **AI Vision Challenge** pointing to `https://ai-sci.local`.

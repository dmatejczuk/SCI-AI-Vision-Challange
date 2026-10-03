# Verification report — 2026-10-03

## Verified automatically

- TypeScript strict checking and ESLint pass.
- 15 unit tests pass: gesture transitions, held inputs, rearming, stability/threshold/reset checks, dataset limits/balancing, serialized inference cancellation, pending permission cancellation and repeated real classifier train/reset cycles.
- Three unit-tested training/reset cycles return TensorFlow tensor counts to baseline.
- Eight Chromium end-to-end scenarios have passed. They cover the full workshop, second-person flow, additive retraining, two complete model load/train/play/reset sessions, five concurrent isolated browser contexts, denied/pending camera permission, camera-loss recovery, CPU fallback, the independent instructor game and real Phaser gesture/SPACE integration.
- Browser resets with the actual packaged MobileNet return to zero retained tensors. No uncaught page errors occur in the full workshop test.
- The full workshop passes while all external-origin browser requests are blocked. No external requests are attempted.
- Desktop START, TEST and GAME screenshots were inspected at 1366×768; principal controls and game fit the viewport. START was additionally checked at 1920×1080 (no scrolling) and 390×844 (vertical scrolling, no horizontal overflow).
- Local MobileNet topology and all 55 shards pass SHA-256 integrity checks.
- Production Vite build succeeds and a Docker image builds successfully.
- Docker Compose starts Caddy successfully; container health check passes.
- `https://ai-sci.local` returns HTTP 200 through Caddy on loopback with TLS 1.3. A separate Node HTTPS client verifies both the certificate chain against the exported CA and the `ai-sci.local` hostname with `rejectUnauthorized: true`.
- Caddy sends the same-origin Content Security Policy, camera-only Permissions Policy and static assets.
- Dependency audit after updating Vitest reports zero known advisories.

## Final production-container result

The final `ai-vision-challenge:1.0.0` image passed its embedded `npm run check` (TypeScript, lint, 15 unit tests, model integrity and Vite build), was started with Docker Compose and reached healthy status. Its `/srv` contents were copied to the workspace `dist` directory.

Against that exact container at `https://ai-sci.local`, Playwright reported **7 passed, 1 intentionally skipped** in 2.6 minutes. Passing cases include the complete workshop with repeated resets and blocked external origins, five concurrent isolated clients, CPU-only training/prediction, camera denial, camera-loss recovery, diagnostic game restart/replay and cancellation of pending camera permission. The skipped isolated Phaser scene harness imports source modules through Vite, so it is development-only; it passed separately with the final Phaser distribution, confirming both gesture-triggered jumps and SPACE behavior.

TLS was checked independently with explicit CA trust and hostname validation before the production browser run. The browser used only the verified certificate's SPKI pin, without changing system trust settings. The development preview remains available at `http://localhost:5173`; the production container remains running on ports 80/443. School DNS and client CA installation are still required for normal access to `https://ai-sci.local`.

## Test limits / required on-site acceptance

Camera integration tests use Chromium's synthetic video device. Models, TensorFlow operations and Phaser are real. The five-client test uses five independent browser contexts on one machine, not five physical school workstations. It does not prove real-hand recognition accuracy or a 60 FPS target on the target hardware.

Physical webcams, permission policies, camera-in-use behavior, real device removal/reconnection, two people, lighting/hand-distance variation, natural gesture latency and the under-five-minute first-use target still require the on-site checklist in QA.md. The school DNS/hosts entries and root CA installation on those machines have not been changed from this development environment.

The HTTPS test uses an explicitly supplied trusted root. It does not modify Windows system trust or imply that a participant browser already trusts this development CA. Offline coverage blocks external browser origins while keeping the LAN-equivalent server available; physical WAN-disconnection acceptance remains an on-site check.

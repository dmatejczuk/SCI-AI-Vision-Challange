# Detailed laboratory verification — 2026-10-04

- TypeScript strict checking and ESLint pass. All 28 unit tests pass.
- Production Vite build passes with 1,322 transformed modules; all local model shards pass integrity
  verification. No additional runtime dependencies were introduced.
- The complete detailed/basic laboratory scenario also passes against the production build at
  http://localhost:4173 (36.8 seconds), including PCA, actual activation maps and game return.
- All 10 development-browser regression scenarios pass (3.5 minutes), including CPU fallback,
  camera recovery/cancellation, five isolated clients and real Phaser gesture/SPACE behavior.
- The detailed UI scenario passes with the real packaged model and classifier: source pixel and RGB
  inspection, channel matrix, histogram, normalization control, actual tensor shape and planes,
  full feature plot/heatmap/statistics, 61-point PCA for 60 training samples plus the current frame,
  16 intermediate activation maps, thresholds, eight stages, two-image comparison, second-person
  experiment, additive retraining, basic route, game return and group reset.
- The real-model memory harness passes repeated captures, PCA and activation extraction without
  increasing retained TensorFlow tensor counts. The live GestureController remains unchanged.
  Captured input floats and feature values match direct recomputation from the same frozen pixels.
  Reset during activation extraction clears both retained comparison frames and leaves zero tensors.
- Tests cover exact pixel/histogram values, crop/mirror mapping, floating-point tensor indexing,
  population statistics, PCA against analytically known data, class means over original samples,
  bounded chronological history, two-snapshot cleanup and serialized inference-loop restarts.
- Pixel inspection screenshots at 1366px and 390px were inspected. The mobile layout scrolls
  vertically without horizontal overflow. Plots use Canvas; PCA has at most 361 lightweight points.
- Physical cameras, real-hand recognition quality and pupil completion time remain on-site checks.
  Synthetic camera tests use real ML and Phaser; production code contains no mock predictions.
- Docker has not been redeployed for this extension; the prior container deployment is historical.

The reports below describe earlier versions, including the previous five-step module.

# Explanation module verification — 2026-10-04

- TypeScript and ESLint pass; 21 unit tests pass.
- Production Vite build and local model integrity verification pass (1,316 modules).
- The complete explanation/experiment/retraining/game/reset browser scenario also passes against
  the built production files at http://localhost:4173 (35.5 seconds).
- All 10 Chromium end-to-end tests pass against the development server, including the original
  workshop, CPU fallback, camera errors, multi-client isolation and real Phaser transition tests.
- The new UI scenario exercises a real frozen frame, all five steps, Back/Next without another
  analysis, two-frame comparison, second-person experiment, additive retraining, cross-revision
  score comparison, return to the trained game and a complete new-group reset.
- A separate real-model integration test repeats capture eight times. Snapshot scores equal direct
  classifier output for the captured embedding; confidence equals its maximum output. Navigation
  preserves the pixel buffer and snapshot identity. Tensor counts do not increase across captures,
  the original GestureController is unchanged, and reset during capture leaves zero tensors and no
  retained snapshot or comparison.
- Preprocessing tests verify the actual central crop, horizontal reversal and normalized pixel values.
  Unit tests also check a single camera draw/read per capture, feature aggregation for vectors of
  0/1/7/256/1024/2049 values and comparison retention across model revisions.
- Desktop and 390px-wide feature screens were visually inspected. The mobile flow has vertical
  scrolling without horizontal overflow.
- Interactive inspection in the in-app browser reached the camera permission wait. A full physical
  camera walkthrough could not be completed there. End-to-end tests use a synthetic camera, real
  MobileNet/classifier computation and real Phaser; no user-facing inference is mocked.
- The running Docker container described below is the earlier application build. This module is
  available on the development server; the container has not been redeployed as part of this change.

The earlier baseline verification follows for historical deployment context.

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

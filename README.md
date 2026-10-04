# AI Vision Challenge — SCI

A complete, Polish-language, two-person workshop application. Participants collect OPEN/FIST examples, train a local image classifier, control a Phaser runner, swap people, add examples and retrain. React/TypeScript owns the workshop; TensorFlow.js owns local ML; Phaser 3 owns the game. Caddy serves the production files over LAN HTTPS.

No camera images, embeddings, predictions or scores are sent to a server. There is no database, analytics, localStorage or model export. Each tab owns an independent, RAM-only session. Closing the tab or confirming **Nowa grupa** releases it. The pretrained extractor and all runtime assets are included in the project.

## Development

Requirements: Node.js 24, npm, a recent Chrome/Edge browser, a webcam and WebGL. The CPU fallback works but may respond more slowly.

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. Localhost is a secure-context exception for camera development. An HTTP LAN IP is not a production camera solution. Camera permission is requested only after **Rozpocznij**.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

`npm run check` runs type checking, lint, unit tests and the production build. End-to-end tests use a browser-generated test video stream, but the actual packaged MobileNet, TensorFlow training and Phaser code. They do not replace the camera/ML/game in the delivered app.

```sh
npx playwright install chromium
npm run test:e2e
```

On a restricted Windows workstation, store browsers in the workspace:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.browsers"
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

## Architecture and source map

See [architecture](docs/ARCHITECTURE.md) for the state machine and ownership rules.

- `src/services/SessionManager.ts`: explicit application stages, asynchronous cancellation and session reset.
- `src/features/camera`: camera lifecycle and device selection.
- `src/features/dataset`: bounded in-memory embedding collection, balanced training data.
- `src/features/training`: local MobileNet v1 0.25/224 feature extractor and softmax classifier.
- `src/features/prediction`: serialized inference loop and OPEN/FIST transition controller.
- `src/features/game`: Phaser runner and typed React/game bridge.
- `src/features/instructor`: diagnostics and settings.
- `src/i18n/pl.ts`: Polish UI copy. No translation framework is required to add another dictionary later.
- `src/config/settings.ts`: sample counts, thresholds, inference frequency and game constants.
- `src/styles.css`: design tokens and desktop-first layout.

The square, mirrored preview matches the square, mirrored image given to the extractor. Thirty samples per class take roughly three seconds on suitable hardware; slower computers take longer. A minimum of 20 samples per class is required, with a cap of 180 per class. Samples from both people are retained until group reset. Training balances the two classes by repeating samples of the smaller class, then shuffles batches. The 256-feature, two-output classifier trains for 24 short epochs. No validation accuracy is presented as proof of quality; participants test generalization on the second person.

The gesture controller requires two consecutive confident OPEN predictions to arm, then two confident FIST predictions to emit exactly one jump. Defaults are OPEN 0.82, FIST 0.80, 15 predictions/s. The game runs independently at display refresh rate. Holding FIST cannot repeatedly jump; SPACE is a separate emergency input. A jump is accepted only while the character is on the ground. Backgrounding the tab or losing the camera pauses the game and disarms gestures.

This is a binary image classifier, not a hand detector. A missing hand, clothing or background may still produce a confident class. Keep the hand large in the frame, vary position and background during capture, and discuss incorrect predictions as part of the exercise. Low confidence breaks a gesture streak. Thresholds are starting values, not a claim of measured gesture latency on school hardware.

## Packaged model and offline operation

`public/models/mobilenet` contains the original MobileNet JSON and weight shards (approximately 2 MB). `npm run verify:model` checks every file against committed SHA-256 checksums; production builds fail on missing/corrupt assets. Model provenance and licensing are in [MODEL.md](docs/MODEL.md).

`npm run download:model` is an explicit maintenance command requiring Internet. It replaces assets/checksums from the recorded TensorFlow URL; review changed checksums before distributing a release. It is never executed on application startup or during the workshop. The build uses the existing local model.

Internet is required once to obtain npm packages and Docker base images and build the deployment image. Thereafter the LAN server and clients can operate without WAN access. This means **LAN available, Internet disconnected**; clients still need access to the local server. There is intentionally no service worker hiding old builds.

## Production: LAN and HTTPS

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

## Five-workstation preparation checklist

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

## Instructor checklist before the first group

- [ ] Verify light, framing and camera height; keep the background reasonably uncluttered.
- [ ] Close other applications using the camera and unnecessary browser tabs.
- [ ] Complete one real-hand training/test/game loop on each station.
- [ ] Press **Ctrl + Shift + D** to inspect camera, samples, prediction latency/FPS, game FPS, backend and tensor memory. The small footer link opens the same panel.
- [ ] Check the default thresholds first. Adjust only if needed and retest a fast OPEN → FIST → OPEN gesture. Avoid unnecessarily slow inference rates.
- [ ] Confirm **Nowa grupa** on every station and leave START visible.
- [ ] Remind pairs to swap people after the first game and observe the difference before improving the data.

Suggested timing: introduction 30s; first person's data/training/test 2min; game 1min; swap/test 1min; second person's examples/retrain 2min; final game and discussion 1–2min. No facilitator needs to operate the wizard for participants.

## Verification and remaining on-site checks

See [QA.md](docs/QA.md) and [verification report](docs/VERIFICATION.md). Automated synthetic-camera tests prove software integration, not recognition accuracy for real children, physical camera compatibility, five-machine performance or lighting robustness. Those acceptance items require the actual school workstations and two people. Do not mark them passed on the strength of a headless browser test.

Useful upstream references: [TensorFlow.js transfer learning](https://www.tensorflow.org/js/tutorials/transfer/image_classification), [Caddy local HTTPS](https://caddyserver.com/docs/automatic-https#local-https), [Caddy internal TLS](https://caddyserver.com/docs/caddyfile/directives/tls).

## Interactive laboratory: “Jak AI to widzi?”

After training, TEST offers the laboratory alongside the direct game action. The basic route is
Image → Pixels → Features → Classification → Action; “Pokaż więcej” enables all eight stages,
including Preparation, Tensor and Decision. Back/Next and the pipeline map only read the same
frozen snapshot. The existing trained classifier is reused when returning to the game.

### Actual pipeline

1. `CameraService` requests an ideal 640×480 video stream; actual dimensions come from the device.
   One canvas draw captures an RGBA `ImageData`. TensorFlow reads its three RGB channels.
2. `prepareInput` centrally crops the largest square, performs bilinear resize to `config.imageSize`,
   mirrors horizontally and normalizes with `x / 127.5 - 1`. The current input is `[1,224,224,3]`.
3. Local MobileNet v1 0.25 runs through `conv_pw_13_relu`. Spatial averaging produces 256 features.
4. A Dense layer trained on this group's examples returns two softmax values, OPEN then FIST.
   Confidence is their maximum; the displayed class is argmax. These are not calibrated correctness
   probabilities. This classifier does not use nearest-neighbour distances or PCA for prediction.
5. `GestureController` separately applies configured thresholds and consecutive-frame stability.
   OPEN arms it; stable FIST after arming generates one JUMP, then resets it. The default thresholds
   are OPEN 0.82 and FIST 0.80, with two stable frames.

`InferencePipeline` is shared by live inference and snapshot capture. Sample collection shares the
same extractor and preprocessing. The exact normalized input floats are read back only for a
snapshot, alongside its prepared image. No TensorFlow tensor is retained by a snapshot.

### Inspection and visualization

- Pixels: click, move the pointer or use arrow keys on the source image. Inspect an 8×8 patch,
  individual RGB values, channel matrices, intensity bars and full-frame 256-bin RGB histograms.
- Preparation: actual crop coordinates and before/after images; the same normalization formula on
  the selected source pixel, plus an illustrative slider that does not alter the model input.
  Mapping shows the nearest output location and its exact tensor values. Bilinear interpolation
  mixes neighbouring samples; pixels outside the crop have no input counterpart.
- Tensor: actual shape and value count; selectable RGB planes show exact float values, not values
  reconstructed from rounded preview bytes.
- Features: every feature appears in the Canvas plot with range controls and numeric inspection.
  An alternative heatmap lays out the vector with blank unused cells. Grid location has no spatial
  meaning. Statistics include population standard deviation and `abs(value) < 1e-6` near-zero count.
- Dataset: class means use original stored samples, without training's balancing duplicates;
  compare them with the current vector and `abs(meanOpen - meanFist)`.
- PCA: computed on request using centered covariance-vector power iteration, two orthogonal
  components, three deterministic starts and 60 iterations per start. It is fitted only on original
  training examples, then projects the current frame with that same basis. Equal plot scales preserve
  2D geometry. Retained-variance estimates and projection limitations are displayed. PCA is explanatory,
  not the classifier's decision mechanism; the method is approximate for close eigenvalues.
- Inside the model: on request, inspect actual `conv_pw_1_relu` and `conv_pw_11_relu` outputs using
  the frozen input. Display eight channels per layer, selected by highest mean activation. Each map
  has its own min/max scale. These are internal representations, not named hand-part detectors.
- Classification and decision: real raw softmax outputs, confidence bars and captured thresholds;
  show the controller's before/after state, candidate streak and one-step transition result.
- Action: separate ML from ordinary application code. An isolated jump illustration appears only
  if the cloned controller really produces JUMP. It never sends an event to the Phaser game.

### Lifetime and performance

The live laboratory entry uses the existing inference scheduler with a **cloned** controller. A
90-entry ring buffer retains at most three seconds of numeric predictions, thresholds and actual
transition flags. LAB/TEST transitions are distinguished from events sent to GAME. Freeze stops
this loop and waits for its in-flight inference; navigation never predicts again. Restarting the
scheduler serializes behind any earlier in-flight work.

Histograms and input readback are snapshot-only. Feature statistics are calculated on snapshot
inspection, PCA and intermediate activations only on request. The two activation views reuse the
base model's weights; only the base model disposes those shared weights. Temporary tensors are
released in finally blocks, including cancellation/error paths.

“Porównaj z innym gestem” retains at most **two complete snapshots in browser RAM**. Compare their
source images, histograms, feature vectors and outputs. The labels are actual model predictions,
not assumed ground truth. Taking another pair clears the older snapshot. Leaving the laboratory
zeroes image/input/feature/map arrays and clears the canvases; only an optional score-only summary
survives additive retraining, labelled by model revision. “Nowa grupa” clears every snapshot,
comparison, numeric history, model revision and dataset. Nothing is persisted, exported or uploaded.

### Validation

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, and `npm run build`.
Numerical tests cover channel counts, exact normalization, crop/mirror mapping, tensor indexing,
statistics, PCA on known data, ring-buffer bounds and comparison cleanup. Browser integration uses
the real packaged model, classifier and Phaser with a synthetic camera. It checks all detailed
views, a basic walkthrough, repeated snapshots, on-demand activations/PCA, retraining, game return
and group reset. See `docs/VERIFICATION.md` for results and physical-camera acceptance limits.

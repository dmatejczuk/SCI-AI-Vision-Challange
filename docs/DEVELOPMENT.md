# Development and testing

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

## Source map and implementation notes

See [architecture](ARCHITECTURE.md) for the state machine and ownership rules.

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

`public/models/mobilenet` contains the original MobileNet JSON and weight shards (approximately 2 MB). `npm run verify:model` checks every file against committed SHA-256 checksums; production builds fail on missing/corrupt assets. Model provenance and licensing are in [MODEL.md](MODEL.md).

`npm run download:model` is an explicit maintenance command requiring Internet. It replaces assets/checksums from the recorded TensorFlow URL; review changed checksums before distributing a release. It is never executed on application startup or during the workshop. The build uses the existing local model.

Internet is required once to obtain npm packages and Docker base images and build the deployment image. Thereafter the LAN server and clients can operate without WAN access. This means **LAN available, Internet disconnected**; clients still need access to the local server. There is intentionally no service worker hiding old builds.

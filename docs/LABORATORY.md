# Interactive laboratory: “Jak AI to widzi?”

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

- Pixels: click, drag or use arrow keys on the source image. The exact selection rectangle matches
  the 4×4, 8×8, 16×16 or 32×32 patch. Zoom changes visual cell size only. Canvas supports RGB,
  individual channels, weighted brightness and actual normalized tensor samples with crop/mapping
  caveats. The selected-channel histogram uses the selected patch; full-frame histograms remain in
  a separate disclosure. These interactions never rerun inference.
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
and group reset. See [VERIFICATION.md](VERIFICATION.md) for results and physical-camera acceptance limits.

### Why this class? Interactive extension

The detailed classification stage explains the actual 256-feature → Dense → softmax pipeline.
A score gap below 0.20 is described explicitly as a classroom ambiguity heuristic; failure to reach
captured controller thresholds is distinguished from a confident output. No hand-part interpretation
is inferred from activations or a feature index. The final summary reports actual scores, thresholds
and the cloned controller's transition, and explicitly states that this inspection did not jump.

The main example map supports OPEN/FIST filters and pointer/keyboard point inspection. Sample IDs
are one-based within each class. Euclidean distances, mean per-class distances and the five nearest
examples are computed in the original full feature space, not the PCA projection. Cosine similarity
is a raw value, never a confidence percentage; zero-vector cosine is undefined. These metrics describe
representations and do not explain Dense as a nearest-neighbour classifier. No 2D decision boundary
is drawn because discarded dimensions also contribute to the actual classifier.

From Features, “PORÓWNAJ DWA OBRAZY” retains A and captures B. The comparison opens at Features and
shows A/B/absolute-difference modes, common-index tooltips, range zoom, Euclidean distance, cosine
and mean absolute RGB difference between prepared images (0–255). Pixel and feature metrics have
explicitly different scales. Educational text and a reduced-motion-aware numeric flow use actual
input/feature values and explain distributed meaning without promising gesture invariance.

“Które fragmenty obrazu mają znaczenie?” performs 16 or 64 actual sequential predictions, on demand.
Each trial starts from a fresh copy of the original source pixels, masks one central-crop region
with RGB(128,128,128), and measures baseline minus perturbed score for the **original winning class**.
Signed red/blue overlays scale to the largest absolute change in that experiment. This is sensitivity
to the specified perturbation, not an attention map or proof of semantic understanding. Cancellation
is checked around each inference; temporary buffers are zeroed in finally blocks. Only score/delta
arrays are retained, with the frozen snapshot, and cleared on exit/reset. The live game controller
is never called. The experiment exposes progress and cancellation; the normal workshop is unchanged.

The optional challenge restarts the live laboratory preview and freezes directly into detailed
classification. Adding that exact embedding requires an explicit human OPEN/FIST label and respects
the 180-per-class cap. It retrains the actual classifier; the normal test screen then allows another
check. Frozen photos are released, and only the explicitly labelled embedding enters the dataset.

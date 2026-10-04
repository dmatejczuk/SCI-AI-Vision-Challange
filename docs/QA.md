# Manual acceptance checklist

Record date, workstation ID, browser version, camera model, lighting and tester for each run. Unless specifically recorded in VERIFICATION.md, the checks below remain pending on-site.

## Five physical clients

- [ ] Run on all five stations concurrently and confirm independent counts/models/scores.
- [ ] Check HTTPS trust without exceptions on every station.
- [ ] Reload after disconnecting external Internet (keep LAN) and finish the full workshop.
- [ ] Compare game smoothness (target approximately 60 FPS) while ML inference runs.
- [ ] Record inference frequency/latency and training duration on the target Ryzen 5 workstation.

## Learning and gestures

- [ ] Train with person A; test A's OPEN and FIST.
- [ ] Test person B before adding data; discuss observed differences.
- [ ] Add B's examples without losing A's; retrain and compare.
- [ ] Test dim and bright light, near and far hands, varied positions and angles.
- [ ] Fast OPEN → FIST → OPEN produces one responsive jump.
- [ ] Slow OPEN → FIST produces one jump.
- [ ] Long FIST never produces repeated jumps.
- [ ] Initial FIST does not jump before OPEN arms.
- [ ] Brief hand disappearance does not stop the runner; observe possible background misclassification.
- [ ] SPACE jumps without an ML transition; holding SPACE does not auto-repeat.
- [ ] A missed jump/collision reaches RESULT without losing the dataset.
- [ ] A new round always starts disarmed.

## Recovery and resources

- [ ] Reject camera access, then restore permission and retry.
- [ ] No camera connected and camera already used elsewhere produce helpful messages.
- [ ] Unplug the active camera, reconnect and restart; select a second device.
- [ ] Change tabs during a game; return to a paused game, resume and re-arm.
- [ ] Reset during capture, training, inference, game and pending camera permission.
- [ ] Repeat train → play → reset at least ten times; compare instructor tensor counts after each reset.
- [ ] New group resets thresholds, score, model, data, camera and gesture state.
- [ ] Keyboard navigation works, dialog focus is contained, Escape closes dialogs, focus is visible.
- [ ] Desktop 1366×768 and 1920×1080 show the principal action and game without clipping.
- [ ] A new pair completes start → data → train → first gesture jump in under five minutes.

## Educational wrap-up

Ask: Which data did your model see? What changed for the second person? Did more varied examples help? Could the model be recognizing the background? Avoid interpreting displayed confidence as measured accuracy.

## Detailed laboratory acceptance

1. Train with real OPEN and FIST examples. Enter the laboratory and capture a frame. Confirm that
   the basic route visits Image, Pixels, Features, Classification and Action without requiring details.
2. Enable details. Move/click the image and use arrow keys. Verify RGB values and the 8×8 patch,
   including edge pixels. Switch COLOR/R/G/B and inspect histogram ranges and numeric readouts.
3. Select a pixel outside the crop, then visit Preparation: it must be identified as excluded.
   Select inside the crop and inspect the actual nearest tensor sample; explain bilinear mixing.
   Move the normalization slider and confirm that the frozen classification does not change.
4. Inspect Tensor shape, dynamic element count, all three RGB planes and exact float readouts.
5. Inspect the entire feature plot, zoom/reset, heatmap and statistics. Open class means, PCA and
   internal activations. Explain that grid locations do not map to fingers and PCA is not the classifier.
6. On Classification/Decision, compare softmax outputs, captured thresholds and controller state.
   Action must show JUMP only when the isolated controller preview actually returns a jump.
   Lab history uses a copy of the controller and must never move a running Phaser character.
7. Compare two real gestures. Images, histograms, features and outputs should all refer to their
   respective captured frames. Do not require the classifier to label them differently.
8. Add diverse examples/retrain, check the model-revision labels, and return to the game without an
   additional training pass. Confirm OPEN→FIST still generates one jump and holding FIST does not.
9. Repeat captures and internal-map requests. Reset while two frames are retained and while an
   activation request is in progress. Start a new group: no prior frame, summary, history or data remains.
10. Check keyboard/touch interaction, mobile vertical scrolling and physical webcam availability.
    Measure the basic route with actual participants; the 45–60-second target is not a benchmark result.

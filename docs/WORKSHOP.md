# Running a workshop

## Before the first group

- [ ] Verify light, framing and camera height; keep the background reasonably uncluttered.
- [ ] Close other applications using the camera and unnecessary browser tabs.
- [ ] Complete one real-hand training/test/game loop on each station.
- [ ] Press **Ctrl + Shift + D** to inspect camera, samples, prediction latency/FPS, game FPS, backend and tensor memory. The small footer link opens the same panel.
- [ ] Check the default thresholds first. Adjust only if needed and retest a fast OPEN → FIST → OPEN gesture. Avoid unnecessarily slow inference rates.
- [ ] Confirm **Nowa grupa** on every station and leave START visible.
- [ ] Remind pairs to swap people after the first game and observe the difference before improving the data.

Suggested timing: introduction 30s; first person's data/training/test 2min; game 1min; swap/test 1min; second person's examples/retrain 2min; final game and discussion 1–2min. No facilitator needs to operate the wizard for participants.

## Acceptance checks

See [QA.md](QA.md) and [VERIFICATION.md](VERIFICATION.md). Automated tests use a synthetic camera
with real ML and game code. Recognition quality, lighting and physical camera compatibility must
be checked with the actual participants and workstations.

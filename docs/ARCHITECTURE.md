# Architecture

The LAN server serves immutable application assets only. Each tab owns a SessionManager; no cookies, storage, uploads, telemetry, or server-side session exist. Images live only in the video element and transient preprocessing tensors. DatasetManager retains fixed-length numeric embeddings in RAM, with a per-class cap.

## Application states

START -> LOADING -> OPEN -> FIST -> READY -> TRAINING -> TRAINED -> TEST -> GAME -> RESULT.
RESULT -> PARTNER -> TEST. TEST/RESULT -> OPEN (append examples) -> FIST -> READY -> TRAINING. RESULT -> END. Instructor reset transitions any state to START after cancelling work. Error recovery preserves collected embeddings and returns to the relevant stage. A generation token and AbortController prevent old asynchronous work from publishing into a new session.

## ML pipeline

Use the pretrained TensorFlow MobileNet v1 width 0.25, 224px LayersModel, packaged under public/models. Cut at conv_pw_13_relu and global-average-pool to a 256-element embedding. Center-square crop and mirror the camera in the same way for training and inference; scale pixels to [-1,1]. Store embeddings, never images. A small dense softmax classifier is trained locally with balanced batches. Fit and inference yield between operations. Only one capture/prediction operation runs at once. Dispose transient tensors in finally blocks, replace old classifier only after successful training, release all models on reset.

## Gesture controller

WAITING_FOR_OPEN -> two confident OPEN samples -> ARMED -> two confident FIST samples -> one jump and WAITING_FOR_OPEN. Uncertain samples clear the candidate streak. No timer debounce; thresholds and inference rate are centrally configured. Visibility loss and camera loss disarm the controller. This binary classifier is not a hand detector: confidence is not proof of a hand or accuracy. Unknown/background inputs can be misclassified; this is discussed in the workshop.

## Game integration

React owns the lifetime of a Phaser instance. A typed GameController bridges jump, score, FPS, pause and game-over events. Phaser owns movement, gravity, collision, obstacles and rendering. Stable OPEN is needed again on every new round. SPACE also emits a jump without changing the gesture controller. Collisions consume a round, never the dataset. Obstacle intervals allow the full jump arc; the opening seconds are clear.

## Deployment

Multi-stage Node build -> Caddy static server. TLS uses Caddy's internal CA and a persistent data volume. Resolve ai-sci.local to a static LAN IP; install that instance's root certificate on every participant machine. All runtime requests remain same-origin. Internet is needed to prepare dependencies/images, not during the event. The model download is an explicit preparation command and checked-in assets are verified during builds.

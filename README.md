# AI Vision Challenge

Teach a model to recognize gestures, use it to control a game, and explore how it makes decisions.
AI Vision Challenge is an interactive workshop that takes participants from webcam examples
to their own image classifier – without writing code.

Participants collect open-hand and closed-fist examples, train a model, and put it to the test
in a gesture-controlled game. Switching the person in front of the camera reveals what the model
has learned and where it struggles. A wrong prediction becomes the next experiment: collect
better examples, retrain, and compare the results.

## Features

- **Guided workshop** – collect OPEN/FIST examples, train a classifier, and test predictions live.
- **Gesture-controlled game** – an open hand arms the next jump; closing the fist triggers it.
- **Interactive AI laboratory** – freeze a frame and inspect its pixels, extracted features, and actual model outputs.
- **Hands-on experiments** – compare two images, explore a map of training examples, and measure how masking image regions changes predictions.
- **Instructor tools** – diagnostics, settings, and a session reset for the next group.

The application interface is in Polish. Built with React, TypeScript, TensorFlow.js, and Phaser 3.

## Deploy with Docker

Requirements: a running Docker Engine or Docker Desktop in Linux-container mode, Docker Compose
v2, and a free TCP port 80. From the repository directory:

```sh
docker compose up -d --build
```

Open [http://localhost](http://localhost) on the Docker host, select **Rozpocznij**, and allow camera
access. No hosts-file edits, certificates, TLS warnings, `.env` file or environment variables are
needed. Browsers treat HTTP localhost as a secure context, so webcam access is available with
user permission. The port is bound to loopback; this default mode is for the host computer only.

The first build downloads dependencies/base images and runs project checks; it can take several minutes.

```sh
docker compose ps
docker compose logs -f app
docker compose stop
docker compose start
```

Run `docker compose up -d --build` again after updating the source. `docker compose down` removes
the container; the next `up` recreates it.

For other computers, use the separate HTTPS variant with `APP_HOST`. See the
[deployment guide](docs/DEPLOYMENT.md) for LAN/private CA, public domains, ports and troubleshooting.
An ordinary LAN IP over HTTP does not enable camera access.

## Run locally without Docker

For development or a quick local preview, install Node.js 24 and npm:

```sh
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173). See the [development guide](docs/DEVELOPMENT.md)
for build commands and testing instructions.

## Privacy and offline operation

Camera processing, training, and inference run in the browser. The application does not upload
images, training examples, or results to a server. Session data stays in the current tab's memory;
closing the tab or using the new-group reset clears it.

The pretrained model and application assets are bundled locally. Once the deployment is prepared,
the workshop can run without Internet access. Participant computers still need a connection
to the application server over the local network.

## Documentation

- [Additional network configuration, HTTPS, and offline deployment](docs/DEPLOYMENT.md)
- [Workshop preparation and facilitation](docs/WORKSHOP.md)
- [Interactive AI laboratory](docs/LABORATORY.md)
- [Development and testing](docs/DEVELOPMENT.md)
- [Application architecture](docs/ARCHITECTURE.md)
- [Pretrained model and licensing](docs/MODEL.md)
- [QA checklist](docs/QA.md) and [verification results](docs/VERIFICATION.md)

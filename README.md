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

You need Docker Engine or Docker Desktop with Docker Compose, and available ports 80 and 443.
Run the following commands from the project directory.

### Build and start

```sh
docker compose up -d --build
```

The first build installs dependencies, runs the project checks, and prepares the application image.
This can take several minutes. Downloading dependencies and base images requires Internet access.

### Check the service

```sh
docker compose ps
docker compose logs -f app
```

The container serves the application over HTTPS. Before first use, configure the deployment
address and certificate trust using the [additional network and HTTPS guide](docs/DEPLOYMENT.md).
This is required for webcam access from other computers.

Then open the deployment address in Chrome or Edge, select the start button, and allow camera
access. Each browser tab runs an independent workshop session.

### Update

After obtaining the latest source code, rebuild and restart the service:

```sh
docker compose up -d --build
```

### Stop and start again

```sh
docker compose stop
docker compose start
```

These commands preserve the container and its configuration.

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

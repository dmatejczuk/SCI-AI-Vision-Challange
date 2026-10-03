# Model provenance

- Model: TensorFlow.js MobileNet v1, width multiplier 0.25, 224 × 224 RGB input, ImageNet pretrained.
- Original JSON: https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json
- Publisher: TensorFlow / Google.
- Upstream model implementation: https://github.com/tensorflow/tfjs-models/tree/master/mobilenet
- Upstream license: Apache License 2.0 (included as `public/models/LICENSE`).
- Local payload: `public/models/mobilenet/model.json` and the referenced 55 weight shards; no runtime external URL.
- Integrity record: `public/models/mobilenet/checksums.json`.

The app uses the `conv_pw_13_relu` feature map, global average pooling, and a freshly initialized two-output dense classifier. The ImageNet label classifier is not used for gesture recognition. The distributed weights and topology are unchanged. Numeric embeddings (256 float32 values each) are the only participant data retained in RAM. Base model licensing does not imply endorsement of this application by TensorFlow or Google.

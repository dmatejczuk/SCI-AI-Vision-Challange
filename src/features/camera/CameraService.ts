export class CameraService {
  stream: MediaStream | null = null;
  private generation = 0;
  private deviceListener = () => {
    if (this.stream && !this.stream.getVideoTracks().some((track) => track.readyState === 'live'))
      this.onLost();
  };
  constructor(private onLost: () => void) {}
  get label() {
    return this.stream?.getVideoTracks()[0]?.label ?? '';
  }
  async start(video: HTMLVideoElement, deviceId?: string) {
    this.stop();
    const generation = this.generation;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw new Error('INSECURE_CONTEXT');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      throw new DOMException('Cancelled', 'AbortError');
    }
    this.stream = stream;
    stream.getVideoTracks().forEach((track) => {
      track.onended = this.onLost;
    });
    navigator.mediaDevices.addEventListener('devicechange', this.deviceListener);
    video.srcObject = stream;
    try {
      await video.play();
      if (!video.videoWidth)
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            video.removeEventListener('loadeddata', ready);
            reject(new Error('Camera frame timeout'));
          }, 10000);
          const ready = () => {
            clearTimeout(timeout);
            resolve();
          };
          video.addEventListener('loadeddata', ready, { once: true });
        });
    } catch (error) {
      if (generation === this.generation) this.stop();
      throw error;
    }
  }
  stop() {
    this.generation++;
    navigator.mediaDevices?.removeEventListener('devicechange', this.deviceListener);
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.stream = null;
  }
}

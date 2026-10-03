export class PredictionService {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private active: Promise<void> = Promise.resolve();
  start(work: () => Promise<void>, frequency: () => number, onError: (error: unknown) => void) {
    this.stop();
    const generation = this.generation;
    const tick = async () => {
      const started = performance.now();
      try {
        await work();
      } catch (error) {
        if (generation === this.generation) onError(error);
        return;
      }
      if (generation === this.generation)
        this.timer = setTimeout(
          () => {
            this.active = tick();
          },
          Math.max(0, 1000 / frequency() - (performance.now() - started)),
        );
    };
    this.active = tick();
  }
  stop() {
    this.generation++;
    clearTimeout(this.timer);
  }
  async idle() {
    await this.active;
  }
}

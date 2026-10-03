export class GameController {
  score = 0;
  fps = 0;
  paused = false;
  jump: () => void = () => {};
  setPaused: (paused: boolean) => void = () => {};
  onScore: (score: number) => void = () => {};
  onOver: (score: number) => void = () => {};
  reset() {
    this.score = 0;
    this.fps = 0;
    this.paused = false;
    this.jump = () => {};
    this.setPaused = () => {};
  }
}

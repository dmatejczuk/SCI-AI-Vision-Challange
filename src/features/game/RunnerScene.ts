import Phaser from 'phaser';
import { config } from '../../config/settings';
import { pl } from '../../i18n/pl';
import type { GameController } from './GameController';
export class RunnerScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private obstacles: {
    shape: Phaser.GameObjects.Container;
    width: number;
    height: number;
    passed: boolean;
  }[] = [];
  private velocity = 0;
  private elapsed = 0;
  private nextObstacle = config.game.firstObstacleMs;
  private ended = false;
  private running = true;
  private road!: Phaser.GameObjects.TileSprite;
  private body!: Phaser.GameObjects.Rectangle;
  constructor(private controller: GameController) {
    super('runner');
  }
  create() {
    const theme = getComputedStyle(document.documentElement);
    const color = (name: string) =>
      Phaser.Display.Color.HexStringToColor(theme.getPropertyValue(name).trim()).color;
    const ink = color('--color-primary'),
      accent = color('--color-accent'),
      muted = color('--color-muted'),
      danger = color('--color-danger');
    this.cameras.main.setBackgroundColor(theme.getPropertyValue('--color-game').trim());
    const grid = this.add.graphics().lineStyle(1, ink, 0.07);
    for (let x = 0; x < 960; x += 48) grid.lineBetween(x, 0, x, 480);
    for (let y = 4; y < 480; y += 48) grid.lineBetween(0, y, 960, y);
    this.add.text(32, 26, 'SCI / RUN', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: theme.getPropertyValue('--color-primary').trim(),
    });
    this.add
      .text(928, 28, pl.startSequence, {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        color: theme.getPropertyValue('--color-primary').trim(),
      })
      .setOrigin(1, 0);
    this.add.rectangle(480, config.game.ground + 2, 960, 4, ink);
    const roadTexture = this.make.graphics({ x: 0, y: 0 });
    roadTexture
      .fillStyle(muted, 0.4)
      .fillRect(0, 10, 18, 2)
      .fillRect(45, 27, 7, 2)
      .generateTexture('road', 96, 50);
    roadTexture.destroy();
    this.road = this.add.tileSprite(480, config.game.ground + 30, 960, 50, 'road');
    this.body = this.add.rectangle(0, -24, 38, 48, ink).setStrokeStyle(2, ink);
    const visor = this.add.rectangle(6, -30, 28, 13, accent);
    const eye = this.add.rectangle(12, -30, 4, 5, ink);
    const foot = this.add.rectangle(-8, -1, 14, 6, ink);
    this.player = this.add
      .container(156, config.game.ground, [this.body, visor, eye, foot])
      .setName('runner');
    this.registry.set('obstacleColor', danger);
    this.controller.jump = () => {
      if (this.running && !this.ended && this.player.y >= config.game.ground - 0.1)
        this.velocity = config.game.jumpVelocity;
    };
    this.controller.setPaused = (paused) => {
      this.running = !paused;
      this.controller.paused = paused;
    };
    const key = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    key.on('down', () => {
      if (key.repeats === 1) this.controller.jump();
    });
    this.events.once('shutdown', () => {
      key.removeAllListeners();
      this.controller.jump = () => {};
      this.controller.setPaused = () => {};
    });
  }
  update(_time: number, delta: number) {
    this.controller.fps = this.game.loop.actualFps;
    if (!this.running || this.ended) return;
    const dt = Math.min(delta, 40) / 1000;
    this.elapsed += dt * 1000;
    const speed = Math.min(config.game.maxSpeed, config.game.initialSpeed + this.elapsed / 1400);
    this.road.tilePositionX += speed * dt;
    this.velocity += config.game.gravity * dt;
    this.player.y = Math.min(config.game.ground, this.player.y + this.velocity * dt);
    if (this.player.y === config.game.ground) this.velocity = 0;
    this.body.scaleY = this.velocity === 0 ? 1 + Math.sin(this.elapsed / 75) * 0.025 : 1;
    if (this.elapsed >= this.nextObstacle) {
      const width = 34,
        height = 42;
      const block = this.add.rectangle(
        0,
        -height / 2,
        width,
        height,
        this.registry.get('obstacleColor'),
      );
      const label = this.add
        .text(0, -height - 17, this.obstacles.length % 2 ? '404' : 'BUG', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: getComputedStyle(document.documentElement)
            .getPropertyValue('--color-danger')
            .trim(),
        })
        .setOrigin(0.5);
      const shape = this.add.container(1000, config.game.ground, [block, label]);
      this.obstacles.push({ shape, width, height, passed: false });
      this.nextObstacle =
        this.elapsed + Math.max(1500, 2350 - this.elapsed / 90) + Math.random() * 500;
    }
    for (const obstacle of this.obstacles) {
      obstacle.shape.x -= speed * dt;
      const playerBounds = new Phaser.Geom.Rectangle(
        this.player.x - 14,
        this.player.y - 44,
        28,
        43,
      );
      const obstacleBounds = new Phaser.Geom.Rectangle(
        obstacle.shape.x - obstacle.width / 2 + 3,
        config.game.ground - obstacle.height + 3,
        obstacle.width - 6,
        obstacle.height - 3,
      );
      if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, obstacleBounds)) {
        this.ended = true;
        this.controller.onOver(this.controller.score);
        return;
      }
      if (!obstacle.passed && obstacle.shape.x < this.player.x - 35) {
        obstacle.passed = true;
        this.controller.score += 100;
        this.controller.onScore(this.controller.score);
      }
    }
    this.obstacles = this.obstacles.filter((obstacle) => {
      if (obstacle.shape.x < -60) {
        obstacle.shape.destroy();
        return false;
      }
      return true;
    });
  }
}

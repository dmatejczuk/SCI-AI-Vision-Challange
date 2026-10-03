import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { RunnerScene } from './RunnerScene';
import type { GameController } from './GameController';
import { config } from '../../config/settings';
import { pl } from '../../i18n/pl';
export function GameView({ controller }: { controller: GameController }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current!,
      width: config.game.width,
      height: config.game.height,
      scene: new RunnerScene(controller),
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true },
      audio: { noAudio: true },
      input: { keyboard: true },
    });
    return () => {
      game.destroy(true);
    };
  }, [controller]);
  return <div className="game-canvas" ref={host} role="img" aria-label={pl.gameTitle} />;
}

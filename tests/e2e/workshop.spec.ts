import { test, expect, type Page } from '@playwright/test';
async function collectAndTrain(page: Page) {
  await page.getByRole('button', { name: 'Zbierz OPEN' }).click();
  await expect(page.getByRole('button', { name: 'Dalej: pięść' })).toBeEnabled({ timeout: 45000 });
  await page.getByRole('button', { name: 'Dalej: pięść' }).click();
  await page.getByRole('button', { name: 'Zbierz FIST' }).click();
  await expect(page.getByRole('button', { name: 'Dalej: trening' })).toBeEnabled({
    timeout: 45000,
  });
  await page.getByRole('button', { name: 'Dalej: trening' }).click();
  await page.getByRole('button', { name: /Trenuj model|Trenuj ponownie/ }).click();
  await expect(page.getByRole('heading', { name: 'Model gotowy!' })).toBeVisible({
    timeout: 45000,
  });
}
async function reset(page: Page) {
  await page.keyboard.press('Control+Shift+D');
  await page.getByRole('button', { name: 'Nowa grupa', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Rozpocząć pracę z nową grupą?' });
  await confirmation.getByRole('button', { name: 'Nowa grupa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rozpocznij', exact: false })).toBeEnabled();
}
test('complete real ML workshop works with local assets and repeated group resets', async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  const allowedHost = new URL(process.env.E2E_BASE_URL || 'http://localhost:5173').hostname;
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== allowedHost) {
      external.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto('/');
  await page.screenshot({ path: 'test-results/start-desktop.png', fullPage: true });
  expect(
    await page.locator('video').evaluate((video) => (video as HTMLVideoElement).srcObject),
  ).toBeNull();
  const memory: number[] = [];
  for (let round = 0; round < 2; round++) {
    await page.getByRole('button', { name: 'Rozpocznij', exact: false }).click();
    await expect(page.getByRole('heading', { name: 'Pokaż otwartą dłoń' })).toBeVisible({
      timeout: 60000,
    });
    await collectAndTrain(page);
    await page.getByRole('button', { name: 'Sprawdź go' }).click();
    await expect(page.locator('.prediction-heading strong')).not.toHaveText('Niepewny wynik', {
      timeout: 15000,
    });
    await page.screenshot({ path: `test-results/test-model-${round}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Zagraj', exact: false }).click();
    await expect(page.locator('canvas')).toBeVisible();
    await page.keyboard.press('Space');
    await page.screenshot({ path: `test-results/game-${round}.png`, fullPage: true });
    await expect(page.getByRole('heading', { name: 'Koniec gry' })).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Teraz zamieńcie się!' }).click();
    await page.getByRole('button', { name: 'Sprawdź model' }).click();
    await expect(page.getByRole('heading', { name: 'Jak sobie radzi?' })).toBeVisible();
    if (round === 0) {
      await page.getByRole('button', { name: 'Dodaj więcej przykładów' }).click();
      await expect(page.locator('.sample-counts')).toContainText('30');
      await collectAndTrain(page);
      await page.getByRole('button', { name: 'Sprawdź go' }).click();
    }
    await reset(page);
    await page.keyboard.press('Control+Shift+D');
    const tensorValue = page
      .locator('dt')
      .filter({ hasText: 'Tensory w pamięci' })
      .locator('xpath=following-sibling::dd[1]');
    memory.push(Number(await tensorValue.textContent()));
    await page.getByRole('button', { name: 'Zamknij', exact: true }).click();
  }
  expect(memory[1]).toBe(memory[0]);
  expect(memory[0]).toBe(0);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test('five concurrent tabs maintain independent data', async ({ browser }) => {
  test.setTimeout(180000);
  const contexts = await Promise.all(Array.from({ length: 5 }, () => browser.newContext()));
  try {
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    await Promise.all(
      pages.map(async (page) => {
        await page.goto('/');
        await page.getByRole('button', { name: 'Rozpocznij', exact: false }).click();
        await expect(page.getByRole('heading', { name: 'Pokaż otwartą dłoń' })).toBeVisible({
          timeout: 90000,
        });
      }),
    );
    await pages[0].getByRole('button', { name: 'Zbierz OPEN' }).click();
    await expect(pages[0].getByRole('button', { name: 'Dalej: pięść' })).toBeEnabled({
      timeout: 60000,
    });
    for (const page of pages.slice(1))
      await expect(page.locator('.sample-counts b').first()).toHaveText('0');
    await reset(pages[0]);
    for (const page of pages.slice(1))
      await expect(page.getByRole('heading', { name: 'Pokaż otwartą dłoń' })).toBeVisible();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
test('CPU fallback trains and predicts when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    for (const prototype of [HTMLCanvasElement.prototype, OffscreenCanvas.prototype]) {
      const getContext = prototype.getContext;
      Object.defineProperty(prototype, 'getContext', {
        value: function (
          this: HTMLCanvasElement | OffscreenCanvas,
          type: string,
          ...args: unknown[]
        ) {
          if (type.includes('webgl')) return null;
          return Reflect.apply(getContext, this, [type, ...args]);
        },
      });
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Rozpocznij', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Pokaż otwartą dłoń' })).toBeVisible({
    timeout: 60000,
  });
  await collectAndTrain(page);
  await page.getByRole('button', { name: 'Sprawdź go' }).click();
  await expect(page.locator('.probability b').first()).not.toHaveText('0%');
  await page.keyboard.press('Control+Shift+D');
  await expect(
    page
      .locator('dt')
      .filter({ hasText: 'Silnik obliczeń' })
      .locator('xpath=following-sibling::dd[1]'),
  ).toHaveText('cpu');
  await page.getByRole('button', { name: 'Zamknij', exact: true }).click();
  await reset(page);
});
test('camera denial is recoverable and reset remains accessible', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Denied for test', 'NotAllowedError');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Rozpocznij', exact: false }).click();
  await expect(page.getByRole('alert')).toContainText('Dostęp do kamery jest zablokowany');
  await reset(page);
  await expect(page.getByRole('heading', { name: 'Twoja dłoń. Twój kontroler.' })).toBeVisible();
});
test('camera loss can be recovered without losing captured data', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Rozpocznij', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Pokaż otwartą dłoń' })).toBeVisible({
    timeout: 60000,
  });
  await page.getByRole('button', { name: 'Zbierz OPEN' }).click();
  await expect(page.getByRole('button', { name: 'Dalej: pięść' })).toBeEnabled({ timeout: 45000 });
  await page.locator('video').evaluate((video) => {
    const stream = (video as HTMLVideoElement).srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    track.stop();
    track.dispatchEvent(new Event('ended'));
  });
  await expect(page.getByRole('alert')).toContainText('Utracono połączenie z kamerą');
  await expect(page.locator('.live-label')).toHaveText('Brak');
  await page.getByRole('button', { name: 'Spróbuj ponownie' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.live-label')).toContainText('NA ŻYWO');
  await expect(page.locator('.sample-counts b').first()).toHaveText('30');
  await reset(page);
});
test('instructor can run and replay the real game without a camera or model', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+Shift+D');
  await page.getByRole('button', { name: 'Test gry bez kamery' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.keyboard.press('Control+Shift+D');
  await page.getByRole('button', { name: 'Test gry bez kamery' }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: 'Koniec gry' })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Zagraj ponownie' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await reset(page);
});
test('reset cancels a pending camera permission immediately', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Rozpocznij', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Przygotowujemy stanowisko…' })).toBeVisible();
  await reset(page);
});
test('Phaser responds to gesture transitions and SPACE without repeating held inputs', async ({
  page,
}) => {
  test.skip(
    !!process.env.E2E_BASE_URL,
    'This isolated scene harness uses Vite source modules; production game flow is tested separately.',
  );
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const scenePath = '/src/features/game/RunnerScene.ts',
      controllerPath = '/src/features/game/GameController.ts',
      gesturePath = '/src/features/prediction/GestureController.ts';
    const { RunnerScene } = await import(scenePath);
    const { GameController } = await import(controllerPath);
    const { GestureController } = await import(gesturePath);
    const phaserPath = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((name) => name.includes('/phaser.js?'))!;
    const { default: Phaser } = await import(phaserPath);
    const controller = new GameController();
    const gestures = new GestureController();
    const scene = new RunnerScene(controller);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;width:960px;height:480px';
    document.body.append(host);
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: host,
      width: 960,
      height: 480,
      scene,
      audio: { noAudio: true },
    });
    for (let index = 0; index < 300 && !scene.children?.getByName('runner'); index++)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const player = scene.children.getByName('runner');
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const observeAirborne = async () => {
      for (let index = 0; index < 20; index++) {
        await frame();
        if (player.y < 380) return true;
      }
      return false;
    };
    const land = async () => {
      for (let index = 0; index < 120; index++) {
        await frame();
        if (player.y >= 388) return;
      }
    };
    let jumps = 0;
    const feed = (open: number, fist: number) => {
      if (gestures.update(open, fist)) {
        jumps++;
        controller.jump();
      }
    };
    feed(0.95, 0.05);
    feed(0.95, 0.05);
    feed(0.05, 0.95);
    feed(0.05, 0.95);
    const gestureJump = await observeAirborne();
    await land();
    for (let index = 0; index < 6; index++) feed(0.05, 0.95);
    await frame();
    const heldStill = player.y === 388;
    feed(0.95, 0.05);
    feed(0.95, 0.05);
    feed(0.05, 0.95);
    feed(0.05, 0.95);
    const secondJump = await observeAirborne();
    await land();
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, bubbles: true }),
    );
    const spaceJump = await observeAirborne();
    window.dispatchEvent(
      new KeyboardEvent('keyup', { key: ' ', code: 'Space', keyCode: 32, bubbles: true }),
    );
    game.destroy(true);
    host.remove();
    return { gestureJump, secondJump, spaceJump, jumps, heldStill };
  });
  expect(result).toEqual({
    gestureJump: true,
    secondJump: true,
    spaceJump: true,
    jumps: 2,
    heldStill: true,
  });
});

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
  await expect(page.getByRole('heading', { name: 'Model gotowy' })).toBeVisible({
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
    await page.getByRole('button', { name: 'Test z drugą osobą' }).click();
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
  await expect(page.getByRole('heading', { name: 'Sterowanie gestami' })).toBeVisible();
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

test('frozen frame laboratory inspects real data, compares and returns to game', async ({
  page,
}) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Rozpocznij', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Pokaż otwartą dłoń' })).toBeVisible({
    timeout: 60000,
  });
  await collectAndTrain(page);
  await page.getByRole('button', { name: 'Sprawdź go' }).click();
  await page.getByRole('button', { name: 'JAK AI TO WIDZI?', exact: true }).click();
  await expect(page.locator('video')).toBeVisible();
  await page.getByRole('button', { name: 'ZATRZYMAJ KLATKĘ' }).click();
  await expect(page.getByRole('heading', { name: 'Obraz z kamery', exact: true })).toBeVisible();
  const original = await page
    .locator('.explanation-frame canvas')
    .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
  await page.getByRole('button', { name: 'POKAŻ WIĘCEJ', exact: true }).click();
  const stage = async (index: number) =>
    page
      .locator('.lab-pipeline button')
      .nth(index - 1)
      .click();
  await stage(2);
  const source = page.locator('.explanation-frame canvas');
  const box = (await source.boundingBox())!;
  await source.click({ position: { x: box.width / 4, y: box.height / 4 } });
  const rgb = await source.evaluate((canvas) => {
    const c = canvas as HTMLCanvasElement;
    return Array.from(
      c.getContext('2d')!.getImageData(Math.floor(c.width / 4), Math.floor(c.height / 4), 1, 1)
        .data,
    ).slice(0, 3);
  });
  await expect(page.locator('.pixel-readout')).toContainText(`RGB(${rgb.join(', ')})`);
  await source.click({ position: { x: 1, y: 20 } });
  await expect(page.locator('.patch-coordinates')).toContainText('x: 0–7');
  await source.press('ArrowRight');
  await expect(page.locator('.patch-coordinates')).toContainText('x: 1–8');
  await source.click({ position: { x: box.width / 4, y: box.height / 4 } });
  await page.getByRole('button', { name: 'R', exact: true }).click();
  await expect(page.locator('.patch-canvas')).toHaveAttribute('width', '256');
  await expect(page.locator('.patch-coordinates')).toContainText('8 × 8 px');
  await page.getByLabel('Rozmiar fragmentu', { exact: true }).selectOption('32');
  await expect(page.locator('.patch-coordinates')).toContainText('32 × 32 px');
  await expect(page.locator('.patch-canvas')).toHaveAttribute('width', '1024');
  await page.getByRole('button', { name: 'Powiększ piksele', exact: true }).click();
  await expect(page.locator('.patch-canvas')).toHaveAttribute('width', '1152');
  await expect(page.locator('.patch-coordinates')).toContainText('32 × 32 px');
  await page.getByRole('button', { name: 'PO NORMALIZACJI', exact: true }).click();
  await expect(page.locator('.tensor-readout')).toBeVisible();
  await page.getByRole('button', { name: 'JASNOŚĆ', exact: true }).click();
  await expect(page.locator('.pixel-layout')).toContainText('0,2126 R');
  await page.getByLabel('Rozmiar fragmentu', { exact: true }).selectOption('8');
  await page.locator('summary').filter({ hasText: 'ROZKŁAD KOLORÓW' }).click();
  await page.screenshot({ path: 'test-results/laboratory-pixels.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/laboratory-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await stage(3);
  await expect(page.locator('.prepared-pair canvas')).toHaveCount(2);
  await page.getByRole('slider', { name: 'Wartość kamery', exact: true }).press('End');
  await expect(page.locator('.normalization-inspector')).toContainText('1.00000');
  await stage(4);
  await expect(page.locator('.tensor-shape > code')).toHaveText('[1, 224, 224, 3]');
  await expect(page.locator('.tensor-planes canvas')).toHaveCount(3);
  await stage(5);
  await expect(page.locator('.lab-plot canvas').first()).toBeVisible();
  await page.getByRole('button', { name: 'MAPA CECH', exact: true }).click();
  await expect(page.locator('.lab-heatmap canvas')).toBeVisible();
  await page.locator('summary').filter({ hasText: 'WIĘCEJ DANYCH' }).click();
  await expect(page.locator('.stat-row')).toHaveCount(7);
  await page.locator('summary').filter({ hasText: 'MAPA NASZYCH PRZYKŁADÓW' }).click();
  await page.getByRole('button', { name: 'OBLICZ MAPĘ PCA' }).click();
  await expect(page.locator('.pca-plot circle')).toHaveCount(61);
  await page.locator('summary').filter({ hasText: 'WEWNĄTRZ MODELU' }).click();
  await page.getByRole('button', { name: 'OBLICZ MAPY AKTYWACJI' }).click();
  await expect(page.locator('.activation-grid canvas')).toHaveCount(16, { timeout: 30000 });
  await page.screenshot({ path: 'test-results/laboratory-features.png', fullPage: true });
  await stage(6);
  const scores = await page
    .locator('.explanation-visual progress')
    .evaluateAll((elements) => elements.map((element) => (element as HTMLProgressElement).value));
  expect(scores[0] + scores[1]).toBeCloseTo(1, 5);
  await expect(page.locator('.threshold-track i')).toHaveCount(2);
  await page.locator('summary').filter({ hasText: 'HISTORIA PREDYKCJI' }).click();
  await expect(page.locator('.why-panel')).toContainText('Dlaczego model wybrał');
  await page.getByRole('button', { name: 'Tylko OPEN', exact: true }).click();
  await expect(page.locator('.pca-plot circle')).toHaveCount(31);
  await page.locator('.pca-plot circle').first().focus();
  await page.locator('.pca-plot circle').first().press('Enter');
  await expect(page.locator('.pca-plot output')).toContainText('Odległość euklidesowa');
  await page.getByRole('button', { name: 'Wszystkie próbki', exact: true }).click();
  await page.locator('summary').filter({ hasText: 'Najbardziej podobne przykłady' }).click();
  await page
    .locator('summary')
    .filter({ hasText: 'Które fragmenty obrazu mają znaczenie?' })
    .click();
  await page.getByRole('button', { name: 'SPRAWDŹ WPŁYW FRAGMENTÓW', exact: true }).click();
  await expect(page.locator('.occlusion-map canvas')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.occlusion-experiment output')).toContainText('przed − po');
  await page.screenshot({ path: 'test-results/laboratory-why.png', fullPage: true });
  await stage(7);
  await expect(page.locator('.explanation-result')).toHaveText(
    scores[0] >= scores[1] ? 'OPEN' : 'FIST',
  );
  await stage(8);
  await expect(page.locator('.action-domains')).toContainText('Zwykły kod aplikacji');
  await stage(1);
  expect(
    await page
      .locator('.explanation-frame canvas')
      .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL()),
  ).toBe(original);
  await stage(8);
  await page.keyboard.press('Control+Shift+D');
  await expect(
    page
      .getByRole('dialog')
      .locator('dt')
      .filter({ hasText: 'Liczba analiz' })
      .locator('xpath=following-sibling::dd[1]'),
  ).toHaveText('1');
  await page.getByRole('button', { name: 'Zamknij', exact: true }).click();
  await page.getByRole('button', { name: 'PORÓWNAJ Z INNYM GESTEM' }).click();
  await expect(page.locator('video')).toBeVisible();
  await page.getByRole('button', { name: 'ZATRZYMAJ KLATKĘ' }).click();
  await expect(page.locator('.vector-comparison')).toBeVisible();
  await page.getByRole('button', { name: 'RÓŻNICA', exact: true }).click();
  await expect(page.locator('.vector-comparison .plot-tooltip')).toContainText('A:');
  await expect(page.locator('.vector-comparison .plot-tooltip')).toContainText('B:');
  await page.screenshot({ path: 'test-results/laboratory-vectors.png', fullPage: true });
  await stage(8);
  await expect(page.locator('.comparison-panels .explanation-frame canvas')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/laboratory-comparison.png', fullPage: true });
  await page.locator('.experiment summary').click();
  await page.getByRole('button', { name: 'SPRAWDŹ MODEL NA INNEJ OSOBIE', exact: true }).click();
  await expect(page.locator('.explanation-copy')).toContainText('Nie dodawaj jeszcze danych');
  await page.getByRole('button', { name: 'ZATRZYMAJ KLATKĘ' }).click();
  await stage(8);
  await page.locator('.experiment summary').click();
  await page.getByRole('button', { name: 'Dodaj różnorodne przykłady' }).click();
  await expect(page.locator('.sample-counts b').first()).toHaveText('30');
  await collectAndTrain(page);
  await page.getByRole('button', { name: 'Sprawdź go' }).click();
  await page.getByRole('button', { name: 'JAK AI TO WIDZI?', exact: true }).click();
  await page.getByRole('button', { name: 'ZATRZYMAJ KLATKĘ' }).click();
  const next = page.getByRole('button', { name: 'DALEJ →', exact: true });
  for (let i = 0; i < 4; i++) await next.click();
  await expect(page.locator('.comparison')).toContainText('Wersja modelu 1');
  await expect(page.locator('.comparison')).toContainText('Wersja modelu 2');
  await page.getByRole('button', { name: 'Zagraj', exact: false }).click();
  await expect(page.locator('.game-container canvas')).toBeVisible();
  await expect(page.locator('.explanation-frame canvas')).toHaveCount(0);
  await page.keyboard.press('Space');
  await reset(page);
  await page.keyboard.press('Control+Shift+D');
  await expect(
    page
      .locator('dt')
      .filter({ hasText: 'Tensory w pamięci' })
      .locator('xpath=following-sibling::dd[1]'),
  ).toHaveText('0');
  await expect(
    page
      .locator('dt')
      .filter({ hasText: 'Liczba analiz' })
      .locator('xpath=following-sibling::dd[1]'),
  ).toHaveText('0');
  expect(errors).toEqual([]);
});

test('snapshot pipeline matches the real classifier and repeated captures release tensors', async ({
  page,
}) => {
  test.skip(!!process.env.E2E_BASE_URL, 'Source-module integration harness runs against Vite.');
  test.setTimeout(180000);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/services/SessionManager.ts';
    const { SessionManager } = await import(path);
    const preprocessingPath = '/src/features/training/preprocessing.ts';
    const { prepareInput } = await import(preprocessingPath);
    const session = new SessionManager();
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = true;
    document.body.append(video);
    session.attachVideo(video);
    await session.start();
    const signal = new AbortController().signal;
    const embedding = await session.extractor.extract(video);
    for (let i = 0; i < 20; i++) {
      session.dataset.add('OPEN', embedding.slice());
      session.dataset.add(
        'FIST',
        embedding.map((value: number) => -value),
      );
    }
    await session.train();
    session.test();
    await session.openExplanation();
    session.predictor.stop();
    await session.predictor.idle();
    const baseline = session.diagnostics().memory.numTensors;
    let equal = true,
      stable = true,
      unchanged = true;
    const controllerBefore = JSON.stringify(session.gestures);
    for (let i = 0; i < 8; i++) {
      await session.freezeExplanation();
      const snapshot = session.getSnapshot().explanation.snapshot;
      if (i < 2) await session.inspectActivations();
      session.calculatePca();
      const prepared = prepareInput(snapshot.sourceFrame);
      const expectedInput = await prepared.input.data();
      equal &&=
        snapshot.inputValues.length === expectedInput.length &&
        snapshot.inputValues.every(
          (v: number, index: number) => Math.abs(v - expectedInput[index]) < 1e-6,
        );
      prepared.input.dispose();
      const expectedFeatures = await session.extractor.extract(snapshot.sourceFrame);
      equal &&= snapshot.featureVector.every(
        (v: number, index: number) => Math.abs(v - expectedFeatures[index]) < 1e-5,
      );
      const raw = await session.trainer.predict(snapshot.featureVector);
      equal &&=
        Math.abs(raw.open - snapshot.classScores.open) < 1e-6 &&
        Math.abs(raw.fist - snapshot.classScores.fist) < 1e-6;
      equal &&= snapshot.confidence === Math.max(raw.open, raw.fist);
      const pixels = snapshot.sourceFrame.data.slice();
      for (const step of [2, 3, 4, 5, 6, 7, 8, 4, 1]) session.explanationStep(step);
      stable &&=
        session.getSnapshot().explanation.snapshot.sourceFrame === snapshot.sourceFrame &&
        pixels.every((v: number, index: number) => v === snapshot.sourceFrame.data[index]);
      unchanged &&= session.diagnostics().memory.numTensors === baseline;
      session.anotherFrame();
      unchanged &&=
        snapshot.featureVector.every((v: number) => v === 0) &&
        snapshot.sourceFrame.data.every((v: number) => v === 0);
    }
    const analyses = session.getSnapshot().explanation.analysisCount;
    await session.freezeExplanation();
    const frozen = session.getSnapshot().explanation.snapshot;
    const originalPixels = frozen.sourceFrame.data.slice();
    await session.inspectOcclusion(4);
    const perturb = session.getSnapshot().explanation.snapshot.occlusion;
    const masked = new ImageData(
      originalPixels.slice(),
      frozen.sourceFrame.width,
      frozen.sourceFrame.height,
    );
    const crop = frozen.inputMetadata.crop;
    for (let y = crop.top; y < crop.top + Math.floor(crop.size / 4); y++)
      for (let x = crop.left; x < crop.left + Math.floor(crop.size / 4); x++) {
        const o = (y * masked.width + x) * 4;
        masked.data[o] = 128;
        masked.data[o + 1] = 128;
        masked.data[o + 2] = 128;
      }
    const direct = await session.pipeline.predict(masked, session.getSnapshot().settings);
    const score = direct.classScores[frozen.predictedClass === 'OPEN' ? 'open' : 'fist'];
    equal &&=
      Math.abs(perturb.scores[0] - score) < 1e-6 &&
      Math.abs(perturb.deltas[0] - (frozen.confidence - score)) < 1e-6;
    stable &&= frozen.sourceFrame.data.every((v: number, i: number) => v === originalPixels[i]);
    unchanged &&= session.diagnostics().memory.numTensors === baseline;
    const cancel = session.inspectOcclusion(8);
    session.cancelOcclusion();
    await cancel;
    unchanged &&= session.getSnapshot().explanation.snapshot.occlusion === perturb;
    const beforeCounts = session.dataset.counts;
    const frozenFeatures = frozen.featureVector.slice();
    await session.addFrozenExample('FIST');
    unchanged &&=
      session.dataset.counts.FIST === beforeCounts.FIST + 1 &&
      session.dataset.counts.OPEN === beforeCounts.OPEN;
    unchanged &&= session.dataset
      .examples()
      .filter((e: { label: string }) => e.label === 'FIST')
      .at(-1)
      .values.every((v: number, i: number) => v === frozenFeatures[i]);
    session.test();
    await session.openExplanation();
    session.predictor.stop();
    await session.predictor.idle();
    const controllerUnchanged = JSON.stringify(session.gestures) === controllerBefore;
    await session.freezeExplanation();
    const first = session.getSnapshot().explanation.snapshot;
    session.anotherFrame(false, true);
    await session.freezeExplanation();
    const second = session.getSnapshot().explanation.snapshot;
    const work = session.inspectOcclusion(8);
    await Promise.resolve();
    await session.resetSession();
    await work;
    unchanged &&= [first, second].every(
      (s) =>
        s.sourceFrame.data.every((v: number) => v === 0) &&
        s.inputValues.every((v: number) => v === 0) &&
        s.featureVector.every((v: number) => v === 0),
    );
    const afterReset = session.getSnapshot().explanation;
    const tensors = session.diagnostics().memory.numTensors;
    video.remove();
    void signal;
    return {
      equal,
      stable,
      unchanged,
      analyses,
      controllerUnchanged,
      tensors,
      clean:
        afterReset.snapshot === null &&
        afterReset.previous === null &&
        afterReset.comparison === null,
    };
  });
  expect(result).toEqual({
    equal: true,
    stable: true,
    unchanged: true,
    analyses: 8,
    controllerUnchanged: true,
    tensors: 0,
    clean: true,
  });
});

test('challenge asks for a human label and retrains with the frozen example', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Rozpocznij', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Pokaż otwartą dłoń' })).toBeVisible({
    timeout: 60000,
  });
  await collectAndTrain(page);
  await page.getByRole('button', { name: 'Sprawdź go' }).click();
  await page.getByRole('button', { name: 'JAK AI TO WIDZI?', exact: true }).click();
  await page.getByRole('button', { name: 'ZATRZYMAJ KLATKĘ' }).click();
  await page.getByRole('button', { name: 'POKAŻ WIĘCEJ', exact: true }).click();
  await page.locator('.lab-pipeline button').nth(5).click();
  await page.locator('summary').filter({ hasText: 'SPRÓBUJ OSZUKAĆ MODEL' }).click();
  await page.getByRole('button', { name: 'SPRÓBUJ OSZUKAĆ MODEL', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'SPRÓBUJ OSZUKAĆ MODEL', exact: true }),
  ).toBeVisible();
  await expect(page.locator('video')).toBeVisible();
  await page.getByRole('button', { name: 'ZATRZYMAJ KLATKĘ' }).click();
  await expect(page.locator('.why-panel')).toBeVisible();
  await expect(page.locator('.lab-pipeline button').nth(5)).toHaveAttribute('aria-current', 'step');
  await page
    .locator('summary')
    .filter({ hasText: 'Które fragmenty obrazu mają znaczenie?' })
    .click();
  await page.getByLabel('Siatka regionów', { exact: true }).selectOption('8');
  await page.getByRole('button', { name: 'SPRAWDŹ WPŁYW FRAGMENTÓW', exact: true }).click();
  await page.getByRole('button', { name: 'ANULUJ EKSPERYMENT', exact: true }).click();
  await expect(page.locator('.lab-pipeline button').nth(5)).toBeEnabled();
  await expect(page.locator('.occlusion-map')).toHaveCount(0);
  await page.locator('summary').filter({ hasText: 'DODAJ TEN PRZYKŁAD DO DANYCH' }).click();
  const retrain = page.getByRole('button', { name: 'DODAJ I WYTRENUJ PONOWNIE', exact: true });
  await expect(retrain).toBeDisabled();
  await page.getByRole('button', { name: 'FIST', exact: true }).click();
  await expect(retrain).toBeEnabled();
  await retrain.click();
  await expect(page.getByRole('heading', { name: 'Model gotowy' })).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: 'Sprawdź go' }).click();
  await page.getByRole('button', { name: 'JAK AI TO WIDZI?', exact: true }).click();
  await page.getByRole('button', { name: 'ZATRZYMAJ KLATKĘ' }).click();
  await page.getByRole('button', { name: 'POKAŻ WIĘCEJ', exact: true }).click();
  await page.locator('.lab-pipeline button').nth(5).click();
  await expect(page.locator('.explanation-visual')).toContainText('OPEN — 30 / FIST — 31');
  await expect(page.locator('.snapshot-badge')).toContainText('Wersja modelu 2');
  await reset(page);
  expect(errors).toEqual([]);
});

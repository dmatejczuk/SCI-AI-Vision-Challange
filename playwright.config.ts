import { defineConfig } from '@playwright/test';
const productionUrl = process.env.E2E_BASE_URL;
const browserArgs = [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  '--enable-webgl',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 120000,
  use: {
    baseURL: productionUrl || 'http://localhost:5173',
    viewport: { width: 1366, height: 768 },
    launchOptions: { args: browserArgs },
  },
  webServer: productionUrl
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
      },
  reporter: [['list'], ['html', { open: 'never' }]],
});

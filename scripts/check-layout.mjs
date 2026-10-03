import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  await page.goto('http://localhost:5173');
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    height: innerHeight,
    documentHeight: document.documentElement.scrollHeight,
  }));
  console.log(JSON.stringify(metrics));
  await page.screenshot({ path: `test-results/start-${viewport.width}.png`, fullPage: true });
  await page.close();
}
await browser.close();

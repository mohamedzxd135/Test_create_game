const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.click('.begin');
  await page.waitForSelector('.intro-card .begin', { timeout: 60000 });
  await page.click('.intro-card .begin');
  await page.waitForTimeout(800);
  const bars = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.bar').forEach(b => {
      const i = b.querySelector('i');
      out[b.className] = { w: i.style.width, px: i.getBoundingClientRect().width, bar: b.getBoundingClientRect().width, text: b.querySelector('span')?.textContent };
    });
    return out;
  });
  console.log(JSON.stringify(bars, null, 1));
  await browser.close();
})();

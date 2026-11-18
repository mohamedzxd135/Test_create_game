const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.click('.begin');
  await page.waitForSelector('.intro-card .begin', { timeout: 60000 });
  await page.click('.intro-card .begin');
  await page.waitForTimeout(800);
  const out = await page.evaluate(() => {
    const g = window.__elyndor;
    const near = g.world.colliders.filter(c => c.type === 'box' ? (108 > c.minX - 3 && 108 < c.maxX + 3 && 45 > c.minZ - 3 && 45 < c.maxZ + 3) : Math.hypot(108 - c.x, 45 - c.z) < c.r + 3);
    g.player.pos.set(108, 0, 60);
    const trace = [];
    g.keys['w'] = true;
    for (let i = 0; i < 20; i++) { g.simulate(1); trace.push(+g.player.pos.z.toFixed(1)); }
    g.keys['w'] = false;
    return { near, trace, speed: g.player.speed, blocked: g.blocked, alive: g.alive };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();

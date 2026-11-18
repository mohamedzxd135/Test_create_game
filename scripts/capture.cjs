const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'screenshots/select.jpg', type: 'jpeg', quality: 84 });

  await page.click('.begin');
  await page.waitForSelector('.intro-card .begin', { timeout: 60000 });
  await page.waitForTimeout(600);
  await page.click('.intro-card .begin');
  await page.waitForTimeout(800);

  const meta = await page.evaluate(() => {
    const g = window.__elyndor;
    return { low: g.lowQuality, gpu: g.gpuName, shadows: g.renderer.shadowMap.enabled, pixelRatio: g.renderer.getPixelRatio() };
  });
  console.log('QUALITY', JSON.stringify(meta));

  // bring the atmosphere fully to the capital and render a fresh frame
  const fresh = async (ms = 6, wait = 500) => {
    await page.evaluate((seconds) => {
      const g = window.__elyndor;
      g.simulate(seconds);
      g.renderer.render(g.scene, g.camera);
    }, ms);
    await page.waitForTimeout(wait);
  };

  await fresh(6);
  await page.screenshot({ path: 'screenshots/game.jpg', type: 'jpeg', quality: 84 });

  // cast the swordsman ultimate in the plaza
  await page.evaluate(() => {
    const g = window.__elyndor;
    g.player.mp = g.player.maxMp;
    g.useAbility('r');
    g.simulate(0.35);
    g.renderer.render(g.scene, g.camera);
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'screenshots/cast3.jpg', type: 'jpeg', quality: 84 });

  // a clean ability shot from behind
  await page.evaluate(() => {
    const g = window.__elyndor;
    g.player.mp = g.player.maxMp;
    g.useAbility('q');
    g.simulate(0.18);
    g.renderer.render(g.scene, g.camera);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/cast.jpg', type: 'jpeg', quality: 84 });

  // forest clearing near the Whispering Hollow
  await page.evaluate(() => {
    const g = window.__elyndor;
    g.player.pos.set(-640, 0, -700);
    g.camYaw = 2.5;
    g.camPitch = 0.22;
    g.camPos.set(0, 0, 0);
    g.simulate(4);
    g.renderer.render(g.scene, g.camera);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/forest.jpg', type: 'jpeg', quality: 84 });

  // map
  await page.keyboard.press('m');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/map.jpg', type: 'jpeg', quality: 84 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // dungeon
  const info = await page.evaluate(() => {
    const g = window.__elyndor;
    g.enterDungeon('hollow');
    g.simulate(5);
    g.renderer.render(g.scene, g.camera);
    const b = g.boss;
    return { before: g.enemies.filter(e => e.interior === 'hollow' && !e.dead).length, boss: b && { name: b.name, hp: b.hp, maxHp: b.maxHp, speed: b.speed, radius: b.radius }, fog: g.scene.fog.color.getHexString() };
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/dungeon.jpg', type: 'jpeg', quality: 84 });

  const cleared = await page.evaluate(() => {
    const g = window.__elyndor;
    if (g.boss) g.dealDamage(g.boss, 5000, { crit: true });
    g.simulate(1.2);
    g.renderer.render(g.scene, g.camera);
    return { cleared: [...g.cleared], quests: g.quests.map(q => [q.id, q.progress, q.done]), xp: g.xp, level: g.level, gold: g.gold };
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/dungeon-clear.jpg', type: 'jpeg', quality: 84 });
  console.log('INFO', JSON.stringify({ ...info, ...cleared }));
  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();

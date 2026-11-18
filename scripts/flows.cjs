const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.click('.class-card:nth-child(2)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/select-archer.jpg', type: 'jpeg', quality: 84 });
  await page.click('.begin');
  await page.waitForSelector('.intro-card .begin', { timeout: 60000 });
  await page.screenshot({ path: 'screenshots/intro.jpg', type: 'jpeg', quality: 84 });
  await page.click('.intro-card .begin');
  await page.waitForTimeout(900);

  // portal prompt + entry through the real API path
  const portal = await page.evaluate(() => {
    const g = window.__elyndor;
    const p = g.world.portals[0];
    g.player.pos.set(p.pos.x + 2, 0, p.pos.z + 4);
    g.simulate(0.3);
    const prompt = g.prompt;
    g.interact();
    return { name: p.dungeon.name, prompt: prompt && prompt.label, blocked: g.blocked };
  });
  await page.waitForTimeout(600);
  const portalModal = await page.locator('.modal.portal-modal, .modal').count();
  await page.screenshot({ path: 'screenshots/portal.jpg', type: 'jpeg', quality: 84 });
  if (await page.locator('.modal .begin').count()) await page.locator('.modal .begin').first().click();
  await page.waitForTimeout(900);
  const inside = await page.evaluate(() => ({ inside: window.__elyndor.insideDungeon, enemies: window.__elyndor.enemies.filter(e => e.interior && !e.dead).length, boss: window.__elyndor.boss?.name }));
  await page.evaluate(() => { const g = window.__elyndor; g.simulate(3); g.renderer.render(g.scene, g.camera); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/dungeon-enter.jpg', type: 'jpeg', quality: 84 });
  await page.evaluate(() => window.__elyndor.exitDungeon(true));
  await page.waitForTimeout(300);

  // level up via xp
  const lvl = await page.evaluate(() => {
    const g = window.__elyndor;
    const before = g.level;
    g.gainXp(2000);
    g.simulate(0.3);
    return { before, after: g.level, xpNext: g.xpNext, hp: g.player.maxHp };
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'screenshots/levelup.jpg', type: 'jpeg', quality: 84 });

  // complete a quest by killing 6 goblins in the beginner forest
  const quest = await page.evaluate(() => {
    const g = window.__elyndor;
    g.player.pos.set(-600, 0, -600);
    for (let i = 0; i < 6; i++) {
      const e = g.spawnEnemy('goblin', new (g.player.pos.constructor)(-600 + i * 1.5, 0, -604), { zone: g.world.spawnZones.beginner, depth: 0.1 });
      e.hp = 1;
      g.player.facing = Math.atan2(e.mesh.position.x - g.player.pos.x, e.mesh.position.z - g.player.pos.z);
      g.basicAttack();
      g.simulate(0.3);
    }
    const q = g.quests.find(q => q.id === 'q1');
    return { progress: q.progress, done: q.done, gold: g.gold, level: g.level };
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'screenshots/quest-complete.jpg', type: 'jpeg', quality: 84 });

  // open shop through dialogue UI
  const shop = await page.evaluate(() => {
    const g = window.__elyndor;
    const npc = g.world.npcs.find(n => n.data.kind === 'shop');
    g.player.pos.set(npc.data.x + 1, 0, npc.data.z + 2);
    g.interact();
    return npc.data.name;
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'screenshots/shop.jpg', type: 'jpeg', quality: 84 });
  console.log('FLOWS', JSON.stringify({ portal, portalModal, inside, lvl, quest, shop }));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})();

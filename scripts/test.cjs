const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.click('.class-card:nth-child(1)');
  await page.click('.begin');
  await page.waitForSelector('.intro-card .begin', { timeout: 60000 });
  await page.click('.intro-card .begin');
  await page.waitForTimeout(800);

  // collision: walk north from an offset lane toward the palace
  const col = await page.evaluate(() => {
    const g = window.__elyndor;
    g.player.pos.set(108, 0, 60);
    g.camYaw = 0;
    g.keys['w'] = true;
    g.simulate(20);
    g.keys['w'] = false;
    return { pos: g.player.pos.toArray().map(v => +v.toFixed(1)) };
  });
  console.log('COLLISION', JSON.stringify(col));

  // kill a goblin near the player and check quest + loot + xp
  const kill = await page.evaluate(() => {
    const g = window.__elyndor;
    g.player.pos.set(0, 0, 60); g.player.invuln = 0;
    const e = g.spawnEnemy('goblin', new (g.player.pos.constructor)(2, 0, 60), { zone: g.world.spawnZones.beginner, depth: 0.2 });
    e.hp = 5;
    const q0 = g.quests.find(q => q.id === 'q1').progress;
    const xp0 = g.xp;
    g.basicAttack();
    g.simulate(0.6);
    return { dead: e.dead, q0, q1: g.quests.find(q => q.id === 'q1').progress, xp0, xp1: g.xp };
  });
  console.log('KILL', JSON.stringify(kill));

  // shop modal opens through the real interaction path
  const shop = await page.evaluate(() => {
    const g = window.__elyndor;
    const npc = g.world.npcs.find(n => n.data.kind === 'shop');
    g.player.pos.set(npc.data.x, 0, npc.data.z + 2);
    g.interact();
    return { npc: npc.data.name, gold: g.gold };
  });
  await page.waitForTimeout(700);
  const shopModal = await page.locator('.modal.shop-modal').count();
  const buy = page.locator('.shop-item button').first();
  let bought = null;
  if (await buy.count()) {
    await buy.click();
    await page.waitForTimeout(300);
    bought = await page.evaluate(() => ({ gold: window.__elyndor.gold, potions: window.__elyndor.potions }));
  }
  const closeBtn = page.locator('.shop-card .modal-close, .shop-card .close, .shop-card button').last();
  if (await closeBtn.count()) await closeBtn.click().catch(() => {});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const unblocked = await page.evaluate(() => window.__elyndor.blocked);
  console.log('SHOP', JSON.stringify({ ...shop, shopModal, bought, unblocked }));

  // death flow with invuln cleared
  const death = await page.evaluate(() => {
    const g = window.__elyndor;
    g.player.invuln = 0;
    g.player.hp = 1;
    g.hurtPlayer(999);
    return { alive: g.alive, bool: g.blocked };
  });
  await page.waitForTimeout(700);
  const deathBtns = await page.locator('.overlay.death button').allInnerTexts();
  console.log('DEATH', JSON.stringify(death), deathBtns);
  if (deathBtns.length) {
    await page.locator('.overlay.death button').first().click();
    await page.waitForTimeout(500);
  }
  const afterDeath = await page.evaluate(() => ({ alive: window.__elyndor.alive, hp: window.__elyndor.player.hp, blocked: window.__elyndor.blocked, pos: window.__elyndor.player.pos.toArray().map(v => +v.toFixed(0)) }));
  console.log('RESPAWN', JSON.stringify(afterDeath));

  // fast travel updates zone after a frame
  const travel = await page.evaluate(() => {
    const g = window.__elyndor;
    const v = g.world.pois.find(p => p.kind === 'village');
    g.travelTo(v);
    g.simulate(0.2);
    return { pos: g.player.pos.toArray().map(v2 => +v2.toFixed(1)), zone: g.getZone().name, hud: g.currentZone?.name };
  });
  console.log('TRAVEL', JSON.stringify(travel));

  console.log('ERRORS', errors);
  await browser.close();
})();

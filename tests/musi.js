// Spaßmodus: Sammlung, Würfelbausatz und eine ganze Runde utala musi.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');

const FILE = lib.FILE;
const SHOTS = lib.SHOTS;

const errors = [];
const check = (condition, message) => { if (!condition) { errors.push(message); console.log('  ✗ ' + message); } };

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push('Konsole: ' + m.text()); });

  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.lesson');

  await page.locator('.tabs button[data-tab="musi"]').click();
  await page.waitForSelector('.musilines');
  const lines = await page.locator('.musiline').count();
  const groups = await page.locator('.musilines').count();
  console.log(`Sammlung: ${lines} Zeilen in ${groups} Gruppen`);
  check(lines >= 30, `nur ${lines} Zeilen`);
  check(groups === 4, `${groups} Gruppen statt 4`);

  // Jede Zeile braucht Bedeutung und wörtliche Lesart
  const empty = await page.evaluate(() => Array.from(document.querySelectorAll('.musiline'))
    .filter((row) => !row.querySelector('.meaning').textContent.trim()
      || !row.querySelector('.hint').textContent.trim()).length);
  check(empty === 0, `${empty} Zeile(n) ohne Bedeutung oder wörtliche Lesart`);

  // Nachschlagen muss auch hier gehen (am Rechner über den Zeiger)
  await page.locator('.musiline .gloss-word').first().hover();
  const looked = await page.waitForSelector('.bubble', { timeout: 3000 }).then(() => true, () => false);
  check(looked, 'kein Nachschlagen in der Sammlung');
  if (looked) console.log('Nachschlagen: ' + (await page.locator('.bubble').textContent()).replace(/\s+/g, ' ').trim());
  await page.screenshot({ path: `${SHOTS}/16-musi.png`, fullPage: true });

  // Würfelbausatz: zwanzig Würfe, jeder muss durch den Parser kommen
  const seen = new Set();
  for (let i = 0; i < 20; i += 1) {
    const made = await page.evaluate(() => ({
      tp: document.querySelector('.forged .glossline').textContent.replace(/\s+/g, ' ').trim(),
      say: document.querySelector('.forged .meaning').textContent.trim(),
    }));
    check(Boolean(made.tp && made.say), `Wurf ${i}: leer`);
    const bad = await page.evaluate((s) => TokiPona.parse(s).violations.map((v) => v.rule), made.tp);
    check(!bad.length, `Wurf „${made.tp}“ → ${bad.join(', ')}`);
    seen.add(made.tp);
    await page.locator('.forged ~ .row .ghost, .card .ghost').last().click();
    await page.waitForTimeout(20);
  }
  console.log(`Würfel: ${seen.size} verschiedene Sätze in 20 Würfen, z. B. „${[...seen][0]}“`);
  check(seen.size >= 10, `zu wenig Abwechslung: ${seen.size} verschiedene`);

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check(!overflow, 'Seite scrollt waagerecht');

  // Eine ganze Runde spielen
  await page.locator('.card .primary').first().click();
  await page.waitForSelector('.exbar');
  let steps = 0;
  while (steps < 40 && !(await page.locator('.done').count())) {
    steps += 1;
    if (errors.length) break;
    if (await page.locator('.pickline .tile').count()) {
      await page.locator('.pickline .tile').first().click();
    } else if (await page.locator('.slot').count()) {
      const tiles = await page.locator('.bank .tile:not(.used)').count();
      for (let i = 0; i < Math.min(2, tiles); i += 1) {
        await page.locator('.bank .tile:not(.used)').first().click();
      }
    } else if (await page.locator('.choice').count()) {
      await page.locator('.choice').first().click();
    }
    const go = page.locator('.actions .primary');
    if (await go.count() && !(await go.isDisabled())) await go.click();
    await page.waitForTimeout(40);
    const sheet = page.locator('.sheet');
    if (await sheet.count()) { await sheet.locator('.primary').click(); await page.waitForTimeout(40); }
  }
  check(Boolean(await page.locator('.done').count()), `Runde nach ${steps} Schritten nicht fertig`);
  if (await page.locator('.done').count()) {
    console.log(`Runde fertig nach ${steps} Schritten — ${(await page.locator('.tally').textContent()).replace(/\s+/g, ' ').trim()}`);
    await page.screenshot({ path: `${SHOTS}/17-musi-abschluss.png`, fullPage: true });
    await page.locator('.done .primary').click();
    await page.waitForSelector('.musilines');   // zurück in den Spaßmodus, nicht in den Pfad
  }

  // Der Kursfortschritt darf davon unberührt bleiben
  const done = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('o-toki-fortschritt-v1'));
    return { lessons: Object.keys(stored.done || {}), cards: Object.keys(stored.srs || {}) };
  });
  console.log(`Kursstand danach: ${done.lessons.length} Lektion(en) erledigt, `
    + `${done.cards.filter((k) => k.startsWith('s:musi')).length} musi-Karten in der Wiederholung`);
  check(done.lessons.length === 0, `Spaßmodus hakt Lektionen ab: ${done.lessons.join(', ')}`);
  check(done.cards.some((k) => k.startsWith('s:musi')), 'musi-Karten landen nicht in der Wiederholung');

  // Fällige musi-Karten müssen sich wiederholen lassen
  await page.evaluate(() => {
    const key = 'o-toki-fortschritt-v1';
    const stored = JSON.parse(localStorage.getItem(key));
    Object.keys(stored.srs).forEach((k) => { stored.srs[k].due = Date.now() - 1000; });
    localStorage.setItem(key, JSON.stringify(stored));
  });
  await page.reload();
  await page.waitForSelector('.lesson');
  const review = page.locator('.lesson.review');
  check(Boolean(await review.count()), 'keine Wiederholungskarte trotz fälliger musi-Karten');
  if (await review.count()) {
    await review.click();
    await page.waitForSelector('.exbar');
    console.log('Wiederholung mit musi-Karten startet');
  }

  // Englisch
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.lesson');
  await page.evaluate(() => document.querySelectorAll('.card .ghost')
    .forEach((b) => { if (/deutsch|english/i.test(b.textContent)) b.click(); }));
  await page.waitForTimeout(80);
  await page.locator('.tabs button[data-tab="musi"]').click();
  await page.waitForSelector('.musilines');
  const english = await page.locator('.musiline .meaning').first().textContent();
  const heading = await page.locator('.card h2').first().textContent();
  console.log(`Englisch: „${heading.trim()}“ · „${english.trim()}“`);
  check(/you|your|i am|my/i.test(english), `keine englische Bedeutung: ${english}`);
  const forged = await page.locator('.forged .meaning').textContent();
  check(/you|your/i.test(forged), `Würfel bleibt deutsch: ${forged}`);
  await page.screenshot({ path: `${SHOTS}/18-musi-en.png`, fullPage: true });

  await browser.close();
  if (errors.length) {
    console.log('\n✗ ' + errors.length + ' Problem(e):');
    errors.forEach((e) => console.log('  ' + e));
    process.exit(1);
  }
  console.log('\n✓ Spaßmodus in Ordnung');
})();

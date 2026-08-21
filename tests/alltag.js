// Alltagssätze und Überspringen.
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

  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.lesson');

  // ---------- Sammlung im o-toki-Reiter
  await page.locator('.tabs button[data-tab="toki"]').click();
  await page.waitForSelector('.musilines');
  const groups = await page.locator('.musilines').count();
  const lines = await page.locator('.musiline').count();
  console.log(`Alltagssätze: ${lines} in ${groups} Gruppen`);
  check(groups === 8, `${groups} Gruppen statt acht`);
  check(lines === 61, `${lines} Sätze statt 61`);
  const empty = await page.evaluate(() => Array.from(document.querySelectorAll('.musiline'))
    .filter((row) => !row.querySelector('.meaning').textContent.trim()
      || !row.querySelector('.hint').textContent.trim()).length);
  check(empty === 0, `${empty} Zeilen ohne Bedeutung oder wörtliche Lesart`);

  // Jeder Satz muss durch den Parser
  const bad = await page.evaluate(() => Array.from(document.querySelectorAll('.musiline .glossline'))
    .map((node) => node.textContent.replace(/\s+/g, ' ').trim())
    .filter((line) => TokiPona.splitUtterances(line)
      .flatMap((u) => TokiPona.parse(u).violations).length));
  check(bad.length === 0, `nicht parsende Sätze: ${bad.join(' | ')}`);
  await page.screenshot({ path: `${SHOTS}/31-alltag.png`, fullPage: true });

  // ---------- Übungsrunde daraus
  await page.locator('.card', { hasText: 'toki lon' }).locator('.primary').click();
  await page.waitForSelector('.exbar');
  let steps = 0;
  let sawSkip = false;
  while (steps < 30 && !(await page.locator('.done').count())) {
    steps += 1;
    if (errors.length) break;
    // Die erste Aufgabe wird übersprungen — das darf nichts kaputt machen.
    if (!sawSkip) {
      const before = await page.evaluate(() => document.querySelector('.track i').style.width);
      await page.locator('.exbar .skip').click();
      await page.waitForTimeout(60);
      const toast = await page.locator('.toast').count();
      const after = await page.evaluate(() => document.querySelector('.track i')
        ? document.querySelector('.track i').style.width : 'fertig');
      console.log(`übersprungen: ${before} → ${after}, Hinweis: ${toast ? 'ja' : 'nein'}`);
      check(toast > 0, 'kein Hinweis beim Überspringen');
      check(before !== after, 'Überspringen bringt die Aufgabe nicht weiter');
      sawSkip = true;
      continue;
    }
    if (await page.locator('.slot').count()) {
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
    console.log(`Runde fertig — ${(await page.locator('.tally').textContent()).replace(/\s+/g, ' ').trim()}`);
    await page.locator('.done .primary').click();
    // Zurück in den Reiter, aus dem die Runde kam
    await page.waitForSelector('.musilines');
    check(Boolean(await page.locator('.card', { hasText: 'toki lon' }).count()),
      'nach der Runde landet man nicht wieder bei den Alltagssätzen');
  }

  const cards = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('o-toki-fortschritt-v1'));
    return Object.keys(stored.srs || {});
  });
  console.log(`Karten danach: ${cards.length}, davon Alltag: ${cards.filter((k) => k.startsWith('s:p')).length}`);
  check(cards.some((key) => key.startsWith('s:p')), 'keine Alltagskarten in der Wiederholung');

  // Genau hinsehen: eine einzelne fällige Karte überspringen darf ihren
  // Stand nicht verschlechtern, sondern sie nur bald wieder fällig stellen.
  await page.evaluate(() => localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    done: { 1: true }, lang: 'de', sound: false,
    srs: { 's:p01': { reps: 4, interval: 604800000, ease: 2.7, due: Date.now() - 1000 } },
  })));
  await page.reload();
  await page.waitForSelector('.lesson.due');
  await page.locator('.lesson.due').click();
  await page.waitForSelector('.exbar');
  await page.locator('.exbar .skip').click();
  await page.waitForTimeout(80);
  const card = await page.evaluate(() => JSON.parse(localStorage.getItem('o-toki-fortschritt-v1')).srs['s:p01']);
  const minutes = Math.round((card.due - Date.now()) / 60000);
  console.log(`übersprungene Karte: ease ${card.ease}, reps ${card.reps}, wieder in ${minutes} min`);
  check(card.ease === 2.7, `Überspringen senkt die Leichtigkeit: ${card.ease}`);
  check(card.reps === 4, `Überspringen setzt die Wiederholungen zurück: ${card.reps}`);
  check(minutes >= 8 && minutes <= 12, `Karte kommt nicht bald wieder: ${minutes} min`);

  // ---------- Überspringen bei der Zeichenaufgabe
  await page.evaluate(() => localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    done: { 1: true }, lang: 'de', sound: false, sitelen: true,
    srs: { 't:mi': { reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 } },
  })));
  await page.reload();
  await page.waitForSelector('.lesson.due');
  await page.locator('.lesson.due').click();
  await page.waitForSelector('.trace');
  await page.locator('.exbar .skip').click();
  await page.waitForTimeout(80);
  check(Boolean(await page.locator('.done').count()), 'Überspringen beendet die Runde nicht');
  console.log('Zeichenaufgabe ließ sich überspringen');

  // ---------- Beispielsätze in der Wortliste
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.word');
  const examples = await page.locator('.word .example').count();
  const words = await page.locator('.word').count();
  console.log(`Beispielsätze: ${examples}/${words}`);
  check(examples === words, 'nicht jedes Wort hat einen Beispielsatz');

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Alltagssätze und Überspringen in Ordnung');
})();

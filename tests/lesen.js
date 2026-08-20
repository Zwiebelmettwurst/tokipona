// Lesen am Stück: Liste, Text mit aufdeckbaren Übersetzungen, Fragen danach.
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

  // Frisch: nur der erste Text darf offen sein
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.lipulist');
  const fresh = await page.evaluate(() => Array.from(document.querySelectorAll('.lipurow'))
    .map((row) => row.dataset.state));
  console.log(`Leseliste frisch: ${fresh.join(', ')}`);
  check(fresh.length === 10, `${fresh.length} Texte statt zehn`);
  // Ohne Fortschritt ist noch keiner offen — jede Zeile sagt, ab wann.
  check(fresh.every((s) => s === 'locked'), 'ein Text ist ohne Fortschritt schon offen');
  const locked = await page.locator('.lipurow[data-state="locked"] .body span').first().textContent();
  check(/ab Lektion \d/.test(locked), `kein Hinweis, ab wann: ${locked}`);

  // Mit Fortschritt: die ersten drei Texte offen
  await page.evaluate(() => localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    done: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true, 9: true },
    lang: 'de', sound: false,
  })));
  await page.reload();
  await page.waitForSelector('.lipulist');
  const open = await page.evaluate(() => Array.from(document.querySelectorAll('.lipurow'))
    .map((row) => row.dataset.state));
  console.log(`nach neun Lektionen: ${open.join(', ')}`);
  check(open.filter((s) => s === 'open').length === 9,
    `${open.filter((s) => s === 'open').length} offen statt neun`);

  // Der Zähler in der Kopfzeile
  const counter = (await page.locator('.card', { hasText: 'lipu' }).locator('.hint').first().textContent()).trim();
  console.log(`Zähler: ${counter.split('.').pop().trim()}`);
  check(/0 von 10 gelesen/.test(counter), `kein Zähler: ${counter}`);

  // Text öffnen
  await page.locator('.lipurow[data-state="open"]').first().click();
  await page.waitForSelector('.lipulines');
  const title = (await page.locator('.lipu-title').textContent()).trim();
  const lines = await page.locator('.lipuline').count();
  console.log(`Text „${title}“ mit ${lines} Zeilen`);
  check(lines >= 5, `nur ${lines} Zeilen`);

  // Übersetzungen sind zuerst verdeckt und lassen sich aufdecken
  const hidden = await page.locator('.lipuline .meaning:visible').count();
  check(hidden === 0, `${hidden} Übersetzungen sofort sichtbar`);
  await page.locator('.lipuline .reveal').first().click();
  await page.waitForTimeout(40);
  const shown = (await page.locator('.lipuline .meaning:visible').allTextContents()).join(' ').trim();
  console.log(`aufgedeckt: „${shown}“`);
  check(shown.length > 0, 'Tippen deckt die Übersetzung nicht auf');
  // Ein Tipp auf ein Wort schlägt nach, statt aufzudecken
  await page.locator('.lipuline').nth(1).locator('.gloss-word').first().hover();
  await page.waitForTimeout(60);
  check(Boolean(await page.locator('.bubble').count()), 'Nachschlagen im Text geht nicht');
  check((await page.locator('.lipuline .meaning:visible').count()) === 1,
    'das Nachschlagen deckt zusätzlich die Übersetzung auf');
  await page.screenshot({ path: `${SHOTS}/25-lesen.png`, fullPage: true });

  // Alles aufdecken und wieder zudecken
  await page.locator('.showall').click();
  await page.waitForTimeout(40);
  const all = await page.locator('.lipuline .meaning:visible').count();
  check(all === lines, `${all} von ${lines} Übersetzungen aufgedeckt`);
  await page.locator('.showall').click();
  await page.waitForTimeout(40);
  check((await page.locator('.lipuline .meaning:visible').count()) === 0,
    'zudecken lässt Übersetzungen stehen');
  await page.locator('.lipuline .reveal').first().click();

  // Jede Zeile muss durch den Parser kommen
  const bad = await page.evaluate(() => Array.from(document.querySelectorAll('.lipuline .glossline'))
    .map((node) => node.textContent.replace(/\s+/g, ' ').trim())
    .filter((line) => TokiPona.splitUtterances(line)
      .flatMap((u) => TokiPona.parse(u).violations).length));
  check(bad.length === 0, `nicht parsende Zeilen: ${bad.join(' | ')}`);

  // Fragen dazu
  await page.locator('.actions .primary').click();
  await page.waitForSelector('.choice');
  let rounds = 0;
  while (rounds < 12 && !(await page.locator('.done').count())) {
    rounds += 1;
    if (errors.length) break;
    await page.locator('.choice').first().click();
    await page.locator('.actions .primary').click();
    await page.waitForTimeout(40);
    const sheet = page.locator('.sheet');
    if (await sheet.count()) { await sheet.locator('.primary').click(); await page.waitForTimeout(40); }
  }
  check(Boolean(await page.locator('.done').count()), `Fragen nach ${rounds} Runden nicht fertig`);
  if (await page.locator('.done').count()) {
    console.log(`Fragen fertig: ${(await page.locator('.done h2').textContent()).trim()}`
      + ` — ${(await page.locator('.tally').textContent()).replace(/\s+/g, ' ').trim()}`);
    await page.locator('.done .primary').click();
    await page.waitForSelector('.lipulist');
  }

  // Zähler zählt weiter
  const after = (await page.locator('.card', { hasText: 'lipu' }).locator('.hint').first().textContent()).trim();
  check(/1 von 10 gelesen/.test(after), `Zähler zählt nicht mit: ${after}`);

  // Gelesen bleibt gelesen
  const marked = await page.evaluate(() => Array.from(document.querySelectorAll('.lipurow'))
    .filter((row) => row.dataset.state === 'done').length);
  check(marked === 1, `${marked} Texte als gelesen markiert statt einer`);
  await page.reload();
  await page.waitForSelector('.lipulist');
  check((await page.locator('.lipurow[data-state="done"]').count()) === 1,
    'gelesen überlebt das Neuladen nicht');

  // Englisch
  await page.evaluate(() => {
    const key = 'o-toki-fortschritt-v1';
    const stored = JSON.parse(localStorage.getItem(key));
    stored.lang = 'en';
    localStorage.setItem(key, JSON.stringify(stored));
  });
  await page.reload();
  await page.waitForSelector('.lipulist');
  const englishHint = (await page.locator('.card', { hasText: 'lipu' }).locator('.hint').first().textContent()).trim();
  console.log(`Englisch: ${englishHint}`);
  check(/Tap a line/i.test(englishHint), `Hinweis bleibt deutsch: ${englishHint}`);

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Lesen in Ordnung');
})();

// Diktat: hören und schreiben. Und die Sprachkarte.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const FILE = lib.FILE;
const SHOTS = lib.SHOTS;
const errors = [];
const check = (c, m) => { if (!c) { errors.push(m); console.log('  ✗ ' + m); } };

const FAKE = `
  window.__gesprochen = [];
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true,
    value: function (t) { this.text = t; } });
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => [{ name: 'Italiano', lang: 'it-IT' }], cancel: () => {},
    speak: (u) => { window.__gesprochen.push(u.text); if (u.onstart) u.onstart(); if (u.onend) setTimeout(u.onend, 5); },
    addEventListener: () => {} } });
`;

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });
  await page.addInitScript(FAKE);

  // ---------- Sprachkarte
  await page.goto(FILE);
  await page.evaluate(() => {
    const seen = { mi: true, sina: true, pona: true };
    localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
      done: { 1: true }, lang: 'de', sound: true, sitelen: true, seenWords: seen,
      srs: { 'w:mi': { reps: 4, interval: 8 * 86400000, ease: 2.5, due: Date.now() + 1e6 },
             'w:sina': { reps: 1, interval: 600000, ease: 2.5, due: Date.now() + 1e6 } } }));
  });
  await page.reload();
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.wordmap');
  const map = await page.evaluate(() => ({
    cells: document.querySelectorAll('.wordmap .cell').length,
    levels: [0, 1, 2, 3].map((l) => document.querySelectorAll(`.wordmap .cell[data-level="${l}"]`).length),
    tally: document.querySelector('.maptally').textContent.replace(/\s+/g, ' ').trim(),
    legend: document.querySelectorAll('.maplegend span').length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  console.log(`Karte: ${map.cells} Kästchen, Stufen ${map.levels.join('/')} · ${map.tally}`);
  check(map.cells === 137, `${map.cells} Kästchen statt 137`);
  check(map.levels[3] === 1, `${map.levels[3]} feste Wörter statt einem (mi)`);
  check(map.levels[2] === 1, `${map.levels[2]} geübte statt einem (sina)`);
  check(map.levels[1] === 1, `${map.levels[1]} gesehene statt einem (pona)`);
  check(/3 von 137/.test(map.tally), `Zähler: ${map.tally}`);
  check(map.legend === 4, `${map.legend} Legendeneinträge statt vier`);
  check(map.overflow === 0, 'die Karte sprengt die Breite');
  await page.locator('.wordmap .cell').nth(3).click();
  await page.waitForTimeout(60);
  check(Boolean(await page.locator('.bubble').count()), 'Kästchen schlägt nichts nach');

  // ---------- Diktat
  await page.goto(FILE);
  await page.evaluate(() => localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    done: { 1: true }, lang: 'de', sound: true,
    srs: { 's:lsp02_08': { reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 } } })));
  await page.reload();
  await page.locator('.lesson.review').click();
  await page.waitForSelector('.exbar');
  // Die Wiederholung liefert eine Bauaufgabe; das Diktat kommt aus der Lektion.
  await page.goto(FILE);
  await page.evaluate(() => localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    done: { 1: true }, lang: 'de', sound: true })));
  await page.reload();
  await page.waitForSelector('.lesson');
  await page.locator('.lesson[data-state="current"]').first().click();
  await page.waitForSelector('.exbar');
  let sawDictation = false;
  for (let step = 0; step < 30 && !(await page.locator('.done').count()); step += 1) {
    if (errors.length) break;
    if (await page.locator('.playbox').count() && await page.locator('.typed').count()) {
      sawDictation = true;
      await page.evaluate(() => { window.__gesprochen.length = 0; });
      await page.locator('.playbox .play').click();
      const heard = await page.evaluate(() => window.__gesprochen.slice());
      console.log(`Diktat: „${heard[0]}“`);
      check(heard.length === 1, 'der Knopf spielt nichts ab');
      // Erst falsch schreiben, dann richtig
      await page.locator('.typed').fill('mi pona');
      await page.locator('.actions .primary').click();
      await page.waitForSelector('.sheet');
      const wrong = (await page.locator('.sheet .verdict').textContent()).trim();
      console.log(`  falsch getippt → ${wrong}`);
      check(!(await page.locator('.sheet .verdict.good').count()), 'falsches Diktat gilt als richtig');
      check((await page.locator('.sheet .xraylabel').count()) >= 1, 'kein beschriftetes Röntgen');
      await page.screenshot({ path: `${SHOTS}/44-diktat.png` });
      await page.locator('.sheet .primary').click();
      await page.waitForTimeout(60);
      continue;
    }
    await page.locator('.exbar .skip').click();
    await page.waitForTimeout(50);
  }
  check(sawDictation, 'in der zweiten Lektion kam kein Diktat');

  // Ohne Ton kein Diktat
  const bare = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  bare.on('pageerror', (e) => { errors.push('ohne Ton: ' + e.message); console.log('  ✗ ' + e.message); });
  await bare.addInitScript(`
    Object.defineProperty(window, 'speechSynthesis', { get: () => undefined, configurable: true });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { get: () => undefined, configurable: true });
  `);
  await bare.goto(FILE);
  await bare.evaluate(() => localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({ done: { 1: true }, lang: 'de' })));
  await bare.reload();
  await bare.locator('.lesson[data-state="current"]').first().click();
  await bare.waitForSelector('.exbar');
  let seen = 0;
  for (let step = 0; step < 20 && !(await bare.locator('.done').count()); step += 1) {
    if (await bare.locator('.playbox').count()) seen += 1;
    await bare.locator('.exbar .skip').click();
    await bare.waitForTimeout(40);
  }
  check(seen === 0, 'Diktat trotz fehlender Sprachausgabe');

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Karte und Diktat in Ordnung');
})();

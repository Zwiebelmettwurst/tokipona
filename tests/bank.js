// Der Vorrat muss vor und nach dem Auflösen zeigen, was verbraucht ist —
// auch wenn ein Wort mehrfach vorkommt.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const SHOTS = lib.SHOTS;
const path = require('path');
const FILE = lib.FILE;

const state = (page) => page.evaluate(() => {
  const tiles = Array.from(document.querySelectorAll('.bank .tile'));
  return {
    placed: document.querySelectorAll('.slot .tile').length,
    used: tiles.filter((t) => t.classList.contains('used')).length,
    faded: tiles.filter((t) => parseFloat(getComputedStyle(t).opacity) < 0.4).length,
    words: tiles.map((t) => t.dataset.word),
  };
});

(async () => {
  const browser = await lib.launch(chromium);
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, colorScheme: 'light', locale: 'de-DE' });
  page.on('pageerror', (e) => errors.push('Seitenfehler: ' + e.message));
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.lesson');
  await page.locator('.lesson:not(.intro):not(.review)').first().click();
  await page.waitForSelector('.exbar');

  // bis zu einer Bau-Aufgabe
  for (let i = 0; i < 8 && !(await page.locator('.slot').count()); i += 1) {
    if (await page.locator('.choice').count()) await page.locator('.choice').first().click();
    else if (await page.locator('.pickline .tile').count()) await page.locator('.pickline .tile').first().click();
    const go = page.locator('.actions .primary');
    if (await go.count() && !(await go.isDisabled())) await go.click();
    await page.waitForTimeout(40);
    const sheet = page.locator('.sheet');
    if (await sheet.count()) { await sheet.locator('.primary').click(); await page.waitForTimeout(40); }
  }
  if (!(await page.locator('.slot').count())) { console.log('keine Bau-Aufgabe'); process.exit(1); }

  // Vier Kacheln legen und zwischendurch prüfen
  for (let i = 1; i <= 4; i += 1) {
    await page.locator('.bank .tile:not(.used)').first().click();
    const s = await state(page);
    if (s.used !== i) errors.push(`nach ${i} Kachel(n): ${s.used} als belegt markiert`);
    if (s.faded !== i) errors.push(`nach ${i} Kachel(n): ${s.faded} sichtbar abgeblendet`);
  }
  const before = await state(page);
  const duplicates = before.words.length - new Set(before.words).size;
  console.log(`Vorrat: ${before.words.length} Kacheln, ${duplicates} Doppelung(en), `
    + `${before.placed} gelegt, ${before.used} belegt`);

  // Auflösen — und genau hier ging der Zustand vorher verloren
  await page.locator('.actions .primary').click();
  await page.waitForSelector('.sheet');
  const after = await state(page);
  console.log(`nach dem Auflösen: ${after.placed} gelegt, ${after.used} belegt, ${after.faded} abgeblendet`);
  if (after.used !== before.used) errors.push(`Belegt-Zustand ändert sich beim Auflösen (${before.used} → ${after.used})`);
  if (after.faded !== after.used) errors.push(`nach dem Auflösen sehen ${after.used - after.faded} verbrauchte Kacheln verfügbar aus`);

  // Und sie dürfen nicht mehr reagieren
  const clickable = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.screen')).pointerEvents);
  if (clickable !== 'none') errors.push('Aufgabe bleibt nach dem Auflösen bedienbar');
  await page.screenshot({ path: `${SHOTS}/28-vorrat.png` });

  // Doppelte Wörter: 36 Kurssätze wiederholen eines. Lektion 2 freischalten
  // und so lange neu würfeln, bis ein Vorrat mit Doppelung auftaucht.
  await page.evaluate(() => {
    localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({ done: { 1: true }, lang: 'de' }));
  });
  let checked = false;
  for (let attempt = 0; attempt < 14 && !checked; attempt += 1) {
    await page.reload();
    await page.waitForSelector('.lesson');
    await page.locator('.lesson:not(.intro):not(.review)[data-state="current"]').first().click();
    await page.waitForSelector('.exbar');
    for (let step = 0; step < 8 && !checked; step += 1) {
      if (await page.locator('.slot').count()) {
        const words = await page.evaluate(() =>
          Array.from(document.querySelectorAll('.bank .tile')).map((t) => t.dataset.word));
        const twice = words.find((w, i) => words.indexOf(w) !== i);
        if (twice) {
          // Die hinterste Kachel dieses Wortes antippen: genau sie muss
          // belegt werden, nicht die vorderste mit demselben Wort.
          const copies = page.locator(`.bank .tile[data-word="${twice}"]`);
          const count = await copies.count();
          await copies.nth(count - 1).click();
          const marked = await page.evaluate((w) => Array.from(document.querySelectorAll('.bank .tile'))
            .filter((t) => t.dataset.word === w)
            .map((t) => t.classList.contains('used')), twice);
          console.log(`Doppelung „${twice}“ (${count}×): hinterste getippt → ${JSON.stringify(marked)}`);
          if (marked.filter(Boolean).length !== 1) {
            errors.push(`bei doppeltem „${twice}“ sind ${marked.filter(Boolean).length} Kacheln belegt statt 1`);
          }
          if (!marked[count - 1]) errors.push('getippt wurde hinten, belegt ist vorn');

          // Zurücknehmen muss dieselbe Kachel wieder freigeben
          await page.locator('.slot .tile').last().click();
          const freed = await page.evaluate((w) => Array.from(document.querySelectorAll('.bank .tile'))
            .filter((t) => t.dataset.word === w)
            .map((t) => t.classList.contains('used')), twice);
          if (freed.some(Boolean)) errors.push(`nach dem Zurücknehmen bleibt „${twice}“ belegt`);
          checked = true;
          break;
        }
      }
      if (await page.locator('.choice').count()) await page.locator('.choice').first().click();
      else if (await page.locator('.pickline .tile').count()) await page.locator('.pickline .tile').first().click();
      else if (await page.locator('.bank .tile').count()) await page.locator('.bank .tile').first().click();
      else if (await page.locator('.typed').count()) await page.locator('.typed').fill('mi pona');
      const go = page.locator('.actions .primary');
      if (await go.count() && !(await go.isDisabled())) await go.click();
      await page.waitForTimeout(40);
      const sheet = page.locator('.sheet');
      if (await sheet.count()) { await sheet.locator('.primary').click(); await page.waitForTimeout(40); }
    }
  }
  if (!checked) console.log('(kein Vorrat mit Doppelung angetroffen)');

  await browser.close();
  if (errors.length) { errors.forEach((e) => console.log('✗ ' + e)); process.exit(1); }
  console.log('\n✓ Vorrat zeigt durchgehend, was verbraucht ist');
})();

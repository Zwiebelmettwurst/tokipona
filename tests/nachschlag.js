// Nachschlagen beim Tippen und die Diagnose fehlender Teilchen.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const FILE = lib.FILE;
const SHOTS = lib.SHOTS;
const errors = [];
const check = (c, m) => { if (!c) { errors.push(m); console.log('  ✗ ' + m); } };

const open = (page, key) => page.evaluate((k) => {
  localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    done: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true }, lang: 'de', sound: false,
    srs: { [k]: { reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 } },
  }));
}, key);

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });

  // ---------- Nachschlagen in der Umschreib-Aufgabe
  await page.goto(FILE);
  await open(page, 'n:6');
  await page.reload();
  await page.waitForSelector('.lesson.due');
  await page.locator('.lesson.due').click();
  await page.waitForSelector('.typed');
  const concept = (await page.locator('.question').textContent()).trim();
  check(Boolean(await page.locator('.lookuptoggle').count()), 'kein Nachschlage-Knopf beim Umschreiben');
  check(await page.locator('.lookupbody').isHidden(), 'das Nachschlagen steht sofort offen');
  await page.locator('.lookuptoggle').click();
  await page.locator('.lookupsearch').fill('Haus');
  await page.waitForTimeout(60);
  const hits = await page.locator('.lookuphits .hit b').allTextContents();
  console.log(`„${concept}“ · Suche „Haus“ → ${hits.join(' ')}`);
  check(hits.includes('tomo'), `tomo nicht gefunden: ${hits.join(' ')}`);
  await page.locator('.lookuphits .hit', { hasText: 'tomo' }).first().click();
  await page.locator('.lookupsearch').fill('Blatt');
  await page.waitForTimeout(60);
  await page.locator('.lookuphits .hit', { hasText: 'lipu' }).first().click();
  const typed = await page.locator('.typed').inputValue();
  console.log('eingesetzt:', typed);
  check(typed === 'tomo lipu', `Wörter nicht eingesetzt: „${typed}“`);
  const live = (await page.locator('.live').textContent()).trim();
  check(/Ordnung/.test(live), `keine Rückmeldung nach dem Einsetzen: ${live}`);
  await page.screenshot({ path: `${SHOTS}/41-nachschlag.png` });
  await page.locator('.actions .primary').click();
  await page.waitForSelector('.sheet');
  check(Boolean(await page.locator('.sheet .verdict.good').count()), 'die eingesetzte Umschreibung gilt als falsch');

  // ---------- Auch beim freien Antworten
  await page.goto(FILE);
  await open(page, 'q:q03');
  await page.reload();
  await page.waitForSelector('.lesson.due');
  await page.locator('.lesson.due').click();
  await page.waitForSelector('.typed');
  check(Boolean(await page.locator('.lookuptoggle').count()), 'kein Nachschlagen bei der offenen Frage');

  // ---------- Fehlendes Teilchen wird benannt
  await page.goto(FILE);
  await page.evaluate(() => localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    done: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true }, lang: 'de', sound: false,
    srs: { 's:lsp06_06': { reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 } },
  })));
  await page.reload();
  await page.waitForSelector('.lesson.due');
  await page.locator('.lesson.due').click();
  await page.waitForSelector('.slot');
  for (const word of ['jan', 'mije', 'li', 'pana', 'moku', 'tawa', 'jan', 'lili']) {
    const tile = page.locator(`.bank .tile:not(.used)[data-word="${word}"]`).first();
    if (await tile.count()) await tile.click();
  }
  await page.locator('.actions .primary').click();
  await page.waitForSelector('.sheet');
  const reason = (await page.locator('.sheet .reason').first().textContent()).replace(/\s+/g, ' ').trim();
  console.log('ohne e →', reason);
  check(/Es fehlt e/.test(reason), `das fehlende e wird nicht benannt: ${reason}`);
  check(/kündigt das Objekt an/.test(reason), `keine Erklärung zu e: ${reason}`);

  // ---------- Der Unterschied ist im Röntgen markiert
  const marks = await page.evaluate(() => Array.from(document.querySelectorAll('.sheet .xraywrap'))
    .map((wrap) => ({
      label: wrap.querySelector('.xraylabel') && wrap.querySelector('.xraylabel').textContent.trim(),
      diff: Array.from(wrap.querySelectorAll('.span[data-diff="true"] b')).map((b) => b.textContent.trim()),
    })));
  console.log('markiert:', JSON.stringify(marks));
  check(marks.length === 2, `${marks.length} Röntgenblöcke`);
  check(marks[0].diff.length > 0 && marks[1].diff.length > 0,
    'der Unterschied ist nicht markiert');
  check(marks[1].diff.includes('moku'), `im Muster fehlt die Markierung: ${marks[1].diff}`);
  await page.screenshot({ path: `${SHOTS}/42-unterschied.png` });

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Nachschlagen und Unterschied sitzen');
})();

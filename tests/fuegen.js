// Fügeaufgabe: zwei Teile, ein Satz — und die Erklärung zu la oder pi.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const FILE = lib.FILE;
const SHOTS = lib.SHOTS;

const errors = [];
const check = (condition, message) => { if (!condition) { errors.push(message); console.log('  ✗ ' + message); } };

async function open(page, id) {
  await page.goto(FILE);
  await page.evaluate((key) => {
    localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
      done: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true, 9: true },
      lang: 'de', sound: false, goal: 40,
      srs: { [key]: { reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 } },
    }));
  }, 's:' + id);
  await page.reload();
  await page.waitForSelector('.lesson.due');
  await page.locator('.lesson.due').click();
  await page.waitForSelector('.slot');
}

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });

  // la
  await open(page, 'j01');
  const prompt = (await page.locator('.prompt').textContent()).trim();
  const question = (await page.locator('.question').textContent()).trim();
  const parts = await page.locator('.parts code').allTextContents();
  console.log(`„${prompt}“ · „${question}“ · Teile: ${parts.join(' + ')}`);
  check(/satz daraus/i.test(prompt), `falsche Aufschrift: ${prompt}`);
  check(parts.length === 2, `${parts.length} Teile statt zwei`);
  for (const word of ['tenpo', 'pini', 'la', 'mi', 'moku', 'e', 'kili']) {
    const tile = page.locator(`.bank .tile:not(.used)[data-word="${word}"]`).first();
    check(Boolean(await tile.count()), `Kachel „${word}“ fehlt`);
    if (await tile.count()) await tile.click();
  }
  await page.locator('.actions .primary').click();
  await page.waitForSelector('.sheet');
  const good = Boolean(await page.locator('.sheet .verdict.good').count());
  const reason = await page.locator('.sheet .reason').count()
    ? (await page.locator('.sheet .reason').first().textContent()).replace(/\s+/g, ' ').trim() : '';
  console.log(`gebaut → ${good ? 'richtig' : 'falsch'} · ${reason}`);
  check(good, 'der richtig gefügte Satz gilt als falsch');
  check(/Rahmen/.test(reason), `keine Erklärung zu la: ${reason}`);
  await page.screenshot({ path: `${SHOTS}/24-fuegen.png`, fullPage: true });

  // pi
  await open(page, 'j06');
  const piParts = await page.locator('.parts code').allTextContents();
  console.log(`pi-Aufgabe · Teile: ${piParts.join(' + ')}`);
  for (const word of ['jan', 'pi', 'toki', 'pona', 'li', 'toki']) {
    const tile = page.locator(`.bank .tile:not(.used)[data-word="${word}"]`).first();
    if (await tile.count()) await tile.click();
  }
  await page.locator('.actions .primary').click();
  await page.waitForSelector('.sheet');
  const piGood = Boolean(await page.locator('.sheet .verdict.good').count());
  const piReason = await page.locator('.sheet .reason').count()
    ? (await page.locator('.sheet .reason').first().textContent()).replace(/\s+/g, ' ').trim() : '';
  console.log(`gebaut → ${piGood ? 'richtig' : 'falsch'} · ${piReason}`);
  check(piGood, 'die pi-Fügung gilt als falsch');
  check(/gruppiert/.test(piReason), `keine Erklärung zu pi: ${piReason}`);

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Fügen in Ordnung');
})();

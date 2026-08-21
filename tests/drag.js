// Kacheln umsortieren: ziehen, Pfeiltasten, und der Tipp muss weiter entfernen.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const SHOTS = lib.SHOTS;
const path = require('path');
const FILE = lib.FILE;

const order = (page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('.slot .tile')).map((t) => t.dataset.word));

async function dragTo(page, fromIndex, toIndex) {
  const tiles = page.locator('.slot .tile');
  const from = await tiles.nth(fromIndex).boundingBox();
  const to = await tiles.nth(toIndex).boundingBox();
  // Ziel: knapp links der Zielmitte, damit davor eingefügt wird
  const targetX = toIndex < fromIndex ? to.x + to.width * 0.2 : to.x + to.width * 0.8;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(
      from.x + from.width / 2 + (targetX - from.x - from.width / 2) * (step / 8),
      to.y + to.height / 2,
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(80);
}

(async () => {
  const browser = await lib.launch(chromium);
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, colorScheme: 'dark', locale: 'de-DE' });
  page.on('pageerror', (e) => errors.push('Seitenfehler: ' + e.message));

  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.lesson');
  await page.locator('.lesson:not(.intro):not(.review)').first().click();
  await page.waitForSelector('.exbar');

  // Bis zu einer Bau-Aufgabe vorspulen
  for (let i = 0; i < 8 && !(await page.locator('.slot:not(.syllables)').count()); i += 1) {
    if (await page.locator('.slot.syllables').count()) {
      // Silbenaufgabe: überspringen, hier geht es ums Ziehen von Wörtern.
      await page.locator('.exbar .skip').click();
      await page.waitForTimeout(40);
      continue;
    }
    if (await page.locator('.choice').count()) await page.locator('.choice').first().click();
    else if (await page.locator('.pickline .tile').count()) await page.locator('.pickline .tile').first().click();
    const go = page.locator('.actions .primary');
    if (await go.count() && !(await go.isDisabled())) await go.click();
    await page.waitForTimeout(50);
    const sheet = page.locator('.sheet');
    if (await sheet.count()) { await sheet.locator('.primary').click(); await page.waitForTimeout(50); }
  }
  if (!(await page.locator('.slot:not(.syllables)').count())) { console.log('keine Bau-Aufgabe gefunden'); process.exit(1); }

  // Vier Kacheln legen
  for (let i = 0; i < 4; i += 1) await page.locator('.bank .tile:not(.used)').first().click();
  const start = await order(page);
  console.log('gelegt:      ', start.join(' '));
  if (start.length < 4) { console.log('zu wenige Kacheln'); process.exit(1); }

  // Letzte nach vorn ziehen
  await dragTo(page, 3, 0);
  const moved = await order(page);
  console.log('nach Ziehen: ', moved.join(' '));
  const expected = [start[3], ...start.slice(0, 3)];
  if (moved.join(' ') !== expected.join(' ')) {
    errors.push(`Ziehen ergab „${moved.join(' ')}“, erwartet „${expected.join(' ')}“`);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/19-ziehen.png` });
  const detail = await page.evaluate(() => Array.from(document.querySelectorAll('.slot .tile'))
    .map((t) => ({ word: t.dataset.word, inline: t.style.transform,
                   left: Math.round(t.getBoundingClientRect().left),
                   cls: t.className })));
  console.log('Zustand:', JSON.stringify(detail));
  const stray = detail.filter((t) => t.inline || t.left < 0).length;
  if (stray) errors.push(`${stray} Kachel(n) hängen nach dem Ziehen fest`);

  // Erste per Pfeiltaste nach rechts
  await page.locator('.slot .tile').first().focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(60);
  const shifted = await order(page);
  console.log('nach Pfeil:  ', shifted.join(' '));
  const wanted = [moved[1], moved[0], ...moved.slice(2)];
  if (shifted.join(' ') !== wanted.join(' ')) {
    errors.push(`Pfeiltaste ergab „${shifted.join(' ')}“, erwartet „${wanted.join(' ')}“`);
  }

  // Tipp ohne Bewegung entfernt weiterhin
  const before = (await order(page)).length;
  await page.locator('.slot .tile').nth(1).click();
  await page.waitForTimeout(60);
  const after = await order(page);
  console.log('nach Tipp:   ', after.join(' '));
  if (after.length !== before - 1) errors.push('Antippen entfernt nicht mehr');
  if (after.join(' ') !== [shifted[0], ...shifted.slice(2)].join(' ')) {
    errors.push('Antippen hat die falsche Kachel entfernt');
  }

  // Vorrat muss zur Auswahl passen
  const bankUsed = await page.evaluate(() =>
    document.querySelectorAll('.bank .tile.used').length);
  if (bankUsed !== after.length) {
    errors.push(`Vorrat zeigt ${bankUsed} belegt, gelegt sind ${after.length}`);
  }
  console.log(`Vorrat: ${bankUsed} belegt bei ${after.length} gelegten`);

  await browser.close();
  if (errors.length) { errors.forEach((e) => console.log('✗ ' + e)); process.exit(1); }
  console.log('\n✓ Ziehen, Pfeiltasten und Antippen greifen ineinander');
})();

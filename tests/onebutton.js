// Nach dem Antworten darf genau ein Hauptknopf sichtbar und bedienbar sein.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const SHOTS = lib.SHOTS;
const path = require('path');
const FILE = lib.FILE;

(async () => {
  const browser = await lib.launch(chromium);
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', locale: 'de-DE' });
  page.on('pageerror', (e) => errors.push('Seitenfehler: ' + e.message));
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.lesson');
  await page.locator('.lesson:not(.intro):not(.review)').first().click();
  await page.waitForSelector('.exbar');

  for (let round = 1; round <= 4; round += 1) {
    if (await page.locator('.done').count()) break;
    const before = await page.locator('.primary:visible').count();
    if (before !== 1) errors.push(`Runde ${round}: ${before} Hauptknöpfe vor dem Antworten`);

    if (await page.locator('.pickline .tile').count()) await page.locator('.pickline .tile').first().click();
    else if (await page.locator('.choice').count()) await page.locator('.choice').first().click();
    else if (await page.locator('.bank .tile').count()) await page.locator('.bank .tile').first().click();
    else if (await page.locator('.typed').count()) await page.locator('.typed').fill('mi pona');

    const check = page.locator('.actions .primary');
    if (await check.count() && !(await check.isDisabled())) await check.click();
    await page.waitForSelector('.sheet');

    const after = await page.locator('.primary:visible').count();
    const label = await page.locator('.primary:visible').first().textContent();
    console.log(`Runde ${round}: nach dem Antworten ${after} Hauptknopf („${label.trim()}“)`);
    if (after !== 1) errors.push(`Runde ${round}: ${after} Hauptknöpfe nach dem Antworten`);

    // Kacheln dürfen sich nicht mehr anfassen lassen
    const frozen = await page.evaluate(() => {
      const screen = document.querySelector('.screen');
      return screen ? getComputedStyle(screen).pointerEvents : 'kein Bildschirm';
    });
    if (frozen !== 'none') errors.push(`Runde ${round}: Aufgabe bleibt bedienbar (${frozen})`);

    if (round === 1) await page.screenshot({ path: `${SHOTS}/15-ein-knopf.png` });
    await page.locator('.sheet .primary').click();
    await page.waitForTimeout(60);
  }

  await browser.close();
  if (errors.length) { errors.forEach((e) => console.log('✗ ' + e)); process.exit(1); }
  console.log('\n✓ immer genau ein Hauptknopf');
})();

// Auf einem frischen Übungsbildschirm darf nichts hervorgehoben sein:
// weder Fokus noch Auswahl, egal wo vorher getippt wurde.
const { chromium, devices } = require('playwright');
const lib = require('./lib.js');
const SHOTS = lib.SHOTS;
const path = require('path');
const FILE = lib.FILE;

(async () => {
  const browser = await lib.launch(chromium);
  const errors = [];
  const context = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark', locale: 'de-DE', locale: 'de-DE' });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('Seitenfehler: ' + e.message));

  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.lesson');

  const probe = async (label) => {
    const state = await page.evaluate(() => ({
      active: document.activeElement ? document.activeElement.className || document.activeElement.tagName : 'keins',
      picked: Array.from(document.querySelectorAll('.choice')).filter((c) => c.dataset.picked === 'true').length,
      borders: Array.from(document.querySelectorAll('.choice, .tile')).map((c) => getComputedStyle(c).borderColor),
      disabled: (() => { const b = document.querySelector('.actions .primary'); return b ? b.disabled : null; })(),
    }));
    const distinct = new Set(state.borders.map((b) => b.replace(/\s/g, '')));
    console.log(`${label}: aktiv=${state.active}, ausgewählt=${state.picked}, `
      + `Rahmenfarben=${distinct.size}, Prüfen deaktiviert=${state.disabled}`);
    if (state.active !== 'keins' && state.active !== 'BODY') {
      errors.push(`${label}: Fokus liegt auf „${state.active}“`);
    }
    if (state.picked) errors.push(`${label}: ${state.picked} Antwort(en) als gewählt markiert`);
    if (distinct.size > 1) errors.push(`${label}: ${distinct.size} verschiedene Rahmenfarben ohne Auswahl`);
  };

  // Lektion antippen — der Tipp, der auf iOS den Hover hinterlässt
  await page.locator('.lesson:not(.intro):not(.review)').first().tap();
  await page.waitForSelector('.exbar');
  await probe('erste Aufgabe nach Lektionstipp');
  await page.screenshot({ path: `${SHOTS}/16-frisch.png` });

  // Durch mehrere Aufgaben tippen und jedes Mal den frischen Zustand prüfen
  for (let round = 1; round <= 4; round += 1) {
    if (await page.locator('.done').count()) break;
    if (await page.locator('.choice').count()) await page.locator('.choice').first().tap();
    else if (await page.locator('.bank .tile').count()) await page.locator('.bank .tile').first().tap();
    else if (await page.locator('.pickline .tile').count()) await page.locator('.pickline .tile').first().tap();
    else if (await page.locator('.typed').count()) await page.locator('.typed').fill('mi pona');
    const go = page.locator('.actions .primary');
    if (await go.count() && !(await go.isDisabled())) await go.tap();
    await page.waitForSelector('.sheet');
    await page.locator('.sheet .primary').tap();
    await page.waitForTimeout(80);
    if (!(await page.locator('.done').count())) await probe(`Aufgabe ${round + 1}`);
  }

  await browser.close();
  if (errors.length) { errors.forEach((e) => console.log('✗ ' + e)); process.exit(1); }
  console.log('\n✓ frische Aufgaben starten ohne Hervorhebung');
})();

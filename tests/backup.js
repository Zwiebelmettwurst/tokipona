// Fortschritt sichern, Gerät "leeren", aus dem Code wiederherstellen.
const { chromium, devices } = require('playwright');
const lib = require('./lib.js');
const SHOTS = lib.SHOTS;
const path = require('path');
const FILE = lib.FILE;

(async () => {
  const browser = await lib.launch(chromium);
  const errors = [];
  const context = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark', locale: 'de-DE', locale: 'de-DE' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('Seitenfehler: ' + e.message));

  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.lesson');

  // Eine Lektion spielen, damit es etwas zu sichern gibt
  await page.locator('.lesson:not(.intro):not(.review)').first().tap();
  await page.waitForSelector('.exbar');
  for (let i = 0; i < 30 && !(await page.locator(".done").count()); i += 1) {
    if (await page.locator('.choice').count()) await page.locator('.choice').first().tap();
    else if (await page.locator('.bank .tile').count()) await page.locator('.bank .tile').first().tap();
    else if (await page.locator('.pickline .tile').count()) await page.locator('.pickline .tile').first().tap();
    else if (await page.locator('.typed').count()) await page.locator('.typed').fill('mi pona');
    const go = page.locator('.actions .primary');
    if (await go.count() && !(await go.isDisabled())) await go.tap();
    await page.waitForTimeout(50);
    const sheet = page.locator('.sheet');
    if (await sheet.count()) { await sheet.locator('.primary').tap(); await page.waitForTimeout(50); }
  }
  if (errors.length) { errors.forEach((e) => console.log('✗ ' + e)); process.exit(1); }
  if (await page.locator('.done').count()) await page.locator('.done .primary').tap();
  else { console.log('Lektion nicht beendet'); process.exit(1); }
  await page.waitForSelector('.lesson');

  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('o-toki-fortschritt-v1')));
  console.log(`vorher: ${before.xp} XP, ${Object.keys(before.done).length} Lektion(en), `
    + `${Object.keys(before.srs).length} Karten`);

  // Sichern → Code kopieren
  await page.locator('[data-do="save"]').tap();
  const summary = (await page.locator('.card:has([data-do="save"]) .hint').first().textContent()).trim();
  console.log('Karte sagt:', summary.split('.')[0]);
  await page.screenshot({ path: `${SHOTS}/17-sichern.png`, fullPage: true });
  await page.locator('.drawer .ghost', { hasText: 'Zwischenablage' }).tap();
  await page.waitForTimeout(120);
  const code = await page.evaluate(() => navigator.clipboard.readText());
  console.log(`Code: ${(code.length / 1024).toFixed(1)} KB`);
  if (!code || code.length < 50) errors.push('Kein brauchbarer Code in der Zwischenablage');
  const confirmation = await page.locator('.drawer .hint.good').count();
  if (!confirmation) errors.push('Keine Rückmeldung nach dem Kopieren');

  // Gerät leeren — wie nach Safaris Sieben-Tage-Räumung
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.lesson');
  const wiped = await page.locator('.lesson[data-state="done"]').count();
  if (wiped) errors.push('Löschen hat nicht gewirkt');
  console.log(`nach dem Löschen: ${wiped} Lektion(en) erledigt`);

  // Wiederherstellen aus dem Code
  await page.locator('[data-do="load"]').tap();
  await page.locator('.paste').fill(code);
  await page.waitForTimeout(150);
  const preview = (await page.locator('.preview .hint').first().textContent()).replace(/\s+/g, ' ').trim();
  console.log('Vorschau:', preview.slice(0, 80));
  await page.screenshot({ path: `${SHOTS}/18-wiederherstellen.png`, fullPage: true });
  await page.locator('.preview .primary').tap();
  await page.waitForTimeout(150);

  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('o-toki-fortschritt-v1')));
  console.log(`nachher: ${after.xp} XP, ${Object.keys(after.done).length} Lektion(en), `
    + `${Object.keys(after.srs).length} Karten`);
  for (const field of ['xp', 'streak', 'dayXp']) {
    if (before[field] !== after[field]) errors.push(`${field}: ${before[field]} → ${after[field]}`);
  }
  if (Object.keys(before.srs).length !== Object.keys(after.srs).length) errors.push('Kartenzahl weicht ab');
  if (JSON.stringify(before.done) !== JSON.stringify(after.done)) errors.push('Lektionsstand weicht ab');
  if (!(await page.locator('.lesson[data-state="done"]').count())) errors.push('Pfad zeigt den Stand nicht');

  // Unsinn darf nicht durchgehen
  await page.locator('[data-do="load"]').tap();
  await page.locator('.paste').fill('völliger unsinn {');
  await page.waitForTimeout(120);
  if (!(await page.locator('.preview .hint.bad').count())) errors.push('Kaputter Text wird nicht abgewiesen');
  if (await page.locator('.preview .primary').count()) errors.push('Kaputter Text bietet trotzdem Übernahme an');
  await page.locator('.paste').fill('{"kein":"fortschritt"}');
  await page.waitForTimeout(120);
  if (!(await page.locator('.preview .hint.bad').count())) errors.push('Fremdes JSON wird nicht abgewiesen');
  console.log('Unsinn und fremdes JSON: abgewiesen');

  await browser.close();
  if (errors.length) { errors.forEach((e) => console.log('✗ ' + e)); process.exit(1); }
  console.log('\n✓ Sicherung und Wiederherstellung tragen');
})();

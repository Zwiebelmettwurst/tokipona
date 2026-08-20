// Wortnachschlag: antippen zeigt die Bedeutung, nochmal antippen schließt,
// woanders tippen schließt ebenfalls. Am Zeigegerät zusätzlich per Hover.
const { chromium, devices } = require('playwright');
const lib = require('./lib.js');
const SHOTS = lib.SHOTS;
const path = require('path');
const FILE = lib.FILE;

const toChoose = async (page) => {
  for (let i = 0; i < 10; i += 1) {
    if (await page.locator('.question.tp .gloss-word').count()) return true;
    if (await page.locator('.choice').count()) await page.locator('.choice').first().click();
    else if (await page.locator('.bank .tile').count()) await page.locator('.bank .tile').first().click();
    else if (await page.locator('.pickline .tile').count()) await page.locator('.pickline .tile').first().click();
    else if (await page.locator('.typed').count()) await page.locator('.typed').fill('mi pona');
    const go = page.locator('.actions .primary');
    if (await go.count() && !(await go.isDisabled())) await go.click();
    await page.waitForTimeout(40);
    const sheet = page.locator('.sheet');
    if (await sheet.count()) { await sheet.locator('.primary').click(); await page.waitForTimeout(40); }
  }
  return false;
};

(async () => {
  const browser = await lib.launch(chromium);
  const errors = [];

  // --- Telefon: antippen
  const phone = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark', locale: 'de-DE' });
  const page = await phone.newPage();
  page.on('pageerror', (e) => errors.push('Seitenfehler: ' + e.message));
  await page.goto(FILE);
  await page.evaluate(() => localStorage.setItem('o-toki-fortschritt-v1',
    JSON.stringify({ done: { 1: true }, lang: 'de' })));
  await page.reload();
  await page.waitForSelector('.lesson');
  await page.locator('.lesson[data-state="current"]').first().click();
  await page.waitForSelector('.exbar');

  if (!(await toChoose(page))) { console.log('keine Leseaufgabe gefunden'); process.exit(1); }

  const words = await page.locator('.question.tp .gloss-word').allTextContents();
  console.log('nachschlagbare Wörter:', words.join(' '));
  if (!words.length) errors.push('keine nachschlagbaren Wörter');

  // Antippen zeigt
  await page.locator('.question.tp .gloss-word').first().tap();
  await page.waitForTimeout(120);
  if (!(await page.locator('.bubble').count())) errors.push('Antippen zeigt keine Bedeutung');
  else {
    const text = (await page.locator('.bubble').textContent()).replace(/\s+/g, ' ').trim();
    console.log('Blase:', text);
    const inside = await page.evaluate(() => {
      const b = document.querySelector('.bubble').getBoundingClientRect();
      return b.left >= 0 && b.right <= window.innerWidth;
    });
    if (!inside) errors.push('Blase ragt aus dem Fenster');
  }
  await page.screenshot({ path: `${SHOTS}/29-nachschlag.png` });

  // Nochmal antippen schließt
  await page.locator('.question.tp .gloss-word').first().tap();
  await page.waitForTimeout(120);
  if (await page.locator('.bubble').count()) errors.push('zweites Antippen schließt nicht');

  // Anderes Wort, dann woanders tippen
  const count = await page.locator('.question.tp .gloss-word').count();
  await page.locator('.question.tp .gloss-word').nth(Math.min(2, count - 1)).tap();
  await page.waitForTimeout(120);
  if (!(await page.locator('.bubble').count())) errors.push('zweites Wort zeigt nichts');
  await page.locator('.prompt').tap();
  await page.waitForTimeout(120);
  if (await page.locator('.bubble').count()) errors.push('Tipp daneben schließt nicht');

  // Die Aufgabe muss weiter bedienbar bleiben
  await page.locator('.choice').first().tap();
  const armed = await page.locator('.actions .primary').isDisabled();
  if (armed) errors.push('Antwort lässt sich nach dem Nachschlagen nicht mehr wählen');
  await phone.close();

  // --- Zeigegerät: überfahren
  const desk = await browser.newContext({ viewport: { width: 900, height: 800 }, colorScheme: 'light', locale: 'de-DE' });
  const wide = await desk.newPage();
  await wide.goto(FILE);
  await wide.evaluate(() => localStorage.setItem('o-toki-fortschritt-v1',
    JSON.stringify({ done: { 1: true }, lang: 'de' })));
  await wide.reload();
  await wide.waitForSelector('.lesson');
  await wide.locator('.lesson[data-state="current"]').first().click();
  await wide.waitForSelector('.exbar');
  if (await toChoose(wide)) {
    await wide.locator('.question.tp .gloss-word').first().hover();
    await wide.waitForTimeout(150);
    const shown = await wide.locator('.bubble').count();
    console.log('Zeigegerät: Hover zeigt Bedeutung:', shown ? 'ja' : 'nein');
    if (!shown) errors.push('Hover zeigt nichts');
    await wide.mouse.move(10, 10);
    await wide.waitForTimeout(150);
    if (await wide.locator('.bubble').count()) errors.push('Blase bleibt nach dem Wegfahren stehen');
  }
  await browser.close();

  if (errors.length) { errors.forEach((e) => console.log('✗ ' + e)); process.exit(1); }
  console.log('\n✓ Wortnachschlag greift per Tipp und per Hover');
})();

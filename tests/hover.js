// Auf einem Tippgerät darf ohne Auswahl nichts wie ausgewählt aussehen —
// auch nicht, nachdem an derselben Stelle vorher etwas berührt wurde.
const { chromium, devices } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const FILE = lib.FILE;

(async () => {
  const browser = await lib.launch(chromium);
  const errors = [];

  for (const [label, options] of [
    ['iPhone 13', { ...devices['iPhone 13'], colorScheme: 'dark' }],
    ['Zeigergerät', { viewport: { width: 1200, height: 900 }, colorScheme: 'dark' }],
  ]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.goto(FILE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.lesson');

    const media = await page.evaluate(() => ({
      hover: matchMedia('(hover: hover)').matches,
      fine: matchMedia('(pointer: fine)').matches,
    }));
    console.log(`${label}: hover=${media.hover} pointer-fine=${media.fine}`);

    await page.locator('.lesson:not(.intro):not(.review)').first().click();
    await page.waitForSelector('.exbar');

    // Bis zu einer Auswahlaufgabe vorspulen
    for (let i = 0; i < 6 && !(await page.locator('.choice').count()); i += 1) {
      if (await page.locator('.bank .tile').count()) await page.locator('.bank .tile').first().click();
      else if (await page.locator('.pickline .tile').count()) await page.locator('.pickline .tile').first().click();
      const go = page.locator('.actions .primary');
      if (await go.count() && !(await go.isDisabled())) await go.click();
      await page.waitForTimeout(50);
      const sheet = page.locator('.sheet');
      if (await sheet.count()) { await sheet.locator('.primary').click(); await page.waitForTimeout(50); }
    }

    if (!(await page.locator('.choice').count())) { await context.close(); continue; }

    // Genau dort tippen, wo eben der Weiter-Knopf war: an dieser Stelle klebt
    // auf iOS der Hover-Zustand.
    const accent = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--accent').trim());
    const box = await page.locator('.choice').last().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(80);

    const highlighted = await page.evaluate(() => Array.from(document.querySelectorAll('.choice'))
      .map((c) => ({ picked: c.dataset.picked, border: getComputedStyle(c).borderColor })));
    const checkDisabled = await page.locator('.actions .primary').isDisabled();

    const looksPicked = highlighted.filter((c) => c.picked !== 'true'
      && c.border.replace(/\s/g, '') !== highlighted[0].border.replace(/\s/g, ''));

    console.log(`  Prüfen deaktiviert: ${checkDisabled}, hervorgehobene ohne Auswahl: ${looksPicked.length}`);
    if (label === 'iPhone 13' && looksPicked.length) {
      errors.push('iPhone: Antwort sieht ausgewählt aus, ohne es zu sein');
    }
    if (label === 'Zeigergerät' && !looksPicked.length) {
      errors.push('Zeigergerät: Hover-Rückmeldung fehlt');
    }
    await context.close();
  }

  await browser.close();
  if (errors.length) { errors.forEach((e) => console.log('✗ ' + e)); process.exit(1); }
  console.log('\n✓ Hover nur dort, wo es einen Zeiger gibt');
})();

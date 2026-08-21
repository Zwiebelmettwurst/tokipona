// Zeichentrakt: aus lässt den Kurs unberührt, an bringt Zeichenaufgaben.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const SHOTS = lib.SHOTS;
const path = require('path');
const FILE = lib.FILE;

(async () => {
  const browser = await lib.launch(chromium);
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, colorScheme: 'dark', locale: 'de-DE' });
  page.on('pageerror', (e) => errors.push('Seitenfehler: ' + e.message));
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.lesson');

  // Ist die Schrift wirklich geladen und ersetzt sie Wörter?
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    const probe = (family) => {
      const span = document.createElement('span');
      span.style.cssText = `position:absolute;visibility:hidden;font-size:40px;font-family:${family}`;
      span.textContent = 'soweli';
      document.body.append(span);
      const w = span.getBoundingClientRect().width;
      span.remove();
      return Math.round(w);
    };
    return { loaded: document.fonts.check('40px "linja pimeja"'),
             sp: probe("'linja pimeja'"), plain: probe('monospace') };
  });
  console.log(`Schrift geladen: ${font.loaded}, „soweli“ ${font.sp}px statt ${font.plain}px`);
  if (!font.loaded) errors.push('Schrift nicht geladen');
  if (font.sp > font.plain * 0.5) errors.push('Ligatur greift nicht');

  // Wörterbuch zeigt Zeichen
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.word');
  const glyphs = await page.locator('.word .glyph-inline').count();
  console.log(`Wörterbuch: ${glyphs} Zeichen`);
  if (glyphs < 130) errors.push(`nur ${glyphs} Zeichen im Wörterbuch`);
  await page.screenshot({ path: `${SHOTS}/21-nimi-sitelen.png` });

  // Aus: keine Zeichenaufgabe
  await page.locator('.tabs button[data-tab="pfad"]').click();
  await page.waitForSelector('.lesson');
  const label = await page.locator('.card:has(.glyph-row) .ghost').textContent();
  console.log('Schalter:', label.trim());
  await page.screenshot({ path: `${SHOTS}/22-schalter.png`, fullPage: true });

  const playLesson = async () => {
    const kinds = new Set();
    await page.locator('.lesson:not(.intro):not(.review)').first().click();
    await page.waitForSelector('.exbar');
    for (let i = 0; i < 30 && !(await page.locator('.done').count()); i += 1) {
      kinds.add(await page.evaluate(() => (
        document.querySelector('.trace') ? 'trace'
          : document.querySelector('.glyph') ? 'glyph'
          : document.querySelector('.pickline') ? 'fix'
            : document.querySelector('.slot') ? 'build'
              : document.querySelector('.typed') ? 'free'
                : document.querySelector('.choice') ? 'choice' : '?')));
      if (await page.locator('.trace').count()) {
        // Zeichenaufgabe: ein Strich quer über das Feld reicht zum Weiterkommen.
        const box = await page.locator('.trace').boundingBox();
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7);
        await page.mouse.up();
      } else if (await page.locator('.choice').count()) await page.locator('.choice').first().click();
      else if (await page.locator('.bank .tile').count()) await page.locator('.bank .tile').first().click();
      else if (await page.locator('.pickline .tile').count()) await page.locator('.pickline .tile').first().click();
      else if (await page.locator('.typed').count()) await page.locator('.typed').fill('mi pona');
      const go = page.locator('.actions .primary');
      if (await go.count() && !(await go.isDisabled())) await go.click();
      await page.waitForTimeout(40);
      const sheet = page.locator('.sheet');
      if (await sheet.count()) { await sheet.locator('.primary').click(); await page.waitForTimeout(40); }
    }
    if (await page.locator('.done').count()) await page.locator('.done .primary').click();
    await page.waitForSelector('.lesson');
    return kinds;
  };

  const withoutGlyphs = await playLesson();
  console.log('Aufgabenarten aus:', [...withoutGlyphs].join(' '));
  if (withoutGlyphs.has('glyph')) errors.push('Zeichenaufgabe trotz abgeschaltetem Trakt');
  if (withoutGlyphs.has('trace')) errors.push('Schreibaufgabe trotz abgeschaltetem Trakt');

  // An: Zeichenaufgabe muss kommen
  await page.locator('.card:has(.glyph-row) .ghost').click();
  await page.waitForTimeout(80);
  const nowLabel = await page.locator('.card:has(.glyph-row) .ghost').textContent();
  console.log('Schalter jetzt:', nowLabel.trim());
  const withGlyphs = await playLesson();
  console.log('Aufgabenarten an: ', [...withGlyphs].join(' '));
  if (!withGlyphs.has('glyph')) errors.push('keine Zeichenaufgabe trotz angeschaltetem Trakt');
  if (!withGlyphs.has('trace')) errors.push('keine Zeichenaufgabe zum Selbstschreiben');

  // Überlebt die Einstellung das Neuladen?
  await page.reload();
  await page.waitForSelector('.lesson');
  const persisted = await page.locator('.card:has(.glyph-row) .ghost').textContent();
  if (!persisted.includes('abschalten')) errors.push('Einstellung überlebt das Neuladen nicht');

  await browser.close();
  if (errors.length) { errors.forEach((e) => console.log('✗ ' + e)); process.exit(1); }
  console.log('\n✓ Zeichentrakt greift nur, wenn er an ist');
})();

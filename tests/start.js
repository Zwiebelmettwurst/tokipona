// Startseite: zweisprachig, Umschalter merkt sich die Wahl.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const FILE = 'file://' + lib.DOCS + '/index.html';
const SHOTS = lib.SHOTS;
const errors = [];
const check = (c, m) => { if (!c) { errors.push(m); console.log('  ✗ ' + m); } };

(async () => {
  const browser = await lib.launch(chromium);

  for (const [locale, expected] of [['de-DE', 'de'], ['en-US', 'en']]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale });
    page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });
    await page.goto(FILE);
    const state = await page.evaluate(() => ({
      lang: document.documentElement.getAttribute('data-lang'),
      htmlLang: document.documentElement.lang,
      title: document.title,
      visible: Array.from(document.querySelectorAll('h2'))
        .filter((h) => h.offsetParent !== null).map((h) => h.textContent.trim()),
      hidden: Array.from(document.querySelectorAll('h2'))
        .filter((h) => h.offsetParent === null).length,
    }));
    console.log(`${locale} → ${state.lang}: „${state.title}“ · ${state.visible.join(' | ')}`);
    check(state.lang === expected, `${locale} zeigt ${state.lang}`);
    check(state.htmlLang === expected, `html lang bleibt ${state.htmlLang}`);
    check(state.visible.length === 3 && state.hidden === 3,
      `${state.visible.length} sichtbare und ${state.hidden} verborgene Überschriften`);
    check(!/lernen|learn/.test(state.title) === false, `Titel ohne Sprache: ${state.title}`);

    // Umschalten und merken
    await page.locator('#lang').click();
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-lang'));
    check(after !== expected, 'Umschalten wechselt die Sprache nicht');
    await page.reload();
    const remembered = await page.evaluate(() => document.documentElement.getAttribute('data-lang'));
    check(remembered === after, `Wahl überlebt das Neuladen nicht (${remembered})`);
    await page.screenshot({ path: `${SHOTS}/33-start-${after}.png`, fullPage: true });
    await page.close();
  }

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Startseite spricht beide Sprachen');
})();

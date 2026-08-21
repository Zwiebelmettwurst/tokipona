// Der Hinweisstreifen muss in jeder Sprache und auf schmalen Geräten passen.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const FILE = lib.FILE;
const SHOTS = lib.SHOTS;
const errors = [];
const check = (c, m) => { if (!c) { errors.push(m); console.log('  ✗ ' + m); } };

(async () => {
  const browser = await lib.launch(chromium);
  for (const [width, lang] of [[320, 'de'], [320, 'en'], [390, 'en'], [430, 'de']]) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, locale: lang === 'de' ? 'de-DE' : 'en-US' });
    page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); });
    await page.goto(FILE);
    await page.evaluate((l) => localStorage.setItem('o-toki-fortschritt-v1',
      JSON.stringify({ done: { 1: true }, lang: l, sound: false })), lang);
    await page.reload();
    await page.waitForSelector('.lesson');
    // Streifen erzwingen: so, wie ihn der Service Worker auslöst
    await page.evaluate(() => {
      document.querySelector('.lesson:not(.intro):not(.review)').click();
      window.otokiUpdateReady(false);
    });
    await page.waitForSelector('.updatebar');
    const shape = await page.evaluate(() => {
      const bar = document.querySelector('.updatebar');
      const button = bar.querySelector('button');
      const text = bar.querySelector('span');
      const b = bar.getBoundingClientRect();
      const k = button.getBoundingClientRect();
      const s = text.getBoundingClientRect();
      return { bar: [Math.round(b.left), Math.round(b.right)], height: Math.round(b.height),
               button: [Math.round(k.left), Math.round(k.right)],
               textRight: Math.round(s.right), view: window.innerWidth,
               label: button.textContent.trim(), note: text.textContent.trim(),
               scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    console.log(`${width}px ${lang}: „${shape.note}“ + „${shape.label}“ · Streifen `
      + `${shape.bar[0]}–${shape.bar[1]} (Bild ${shape.view}), Höhe ${shape.height}`);
    check(shape.bar[1] <= shape.view, `${width}/${lang}: Streifen ragt aus dem Bild`);
    check(shape.button[1] <= shape.bar[1], `${width}/${lang}: Knopf ragt aus dem Streifen`);
    check(shape.textRight <= shape.button[0], `${width}/${lang}: Text und Knopf überlappen`);
    check(shape.height <= 80, `${width}/${lang}: Streifen ${shape.height}px hoch`);
    check(shape.scroll === 0, `${width}/${lang}: Seite scrollt waagerecht`);
    if (width === 320 && lang === 'en') {
      await page.screenshot({ path: `${SHOTS}/34-streifen-320-en.png` });
    }
    await page.close();
  }
  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Streifen passt überall');
})();

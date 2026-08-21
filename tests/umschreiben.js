// Selbst umschreiben: jede gültige Wortgruppe zählt, danach zeigt die App,
// was üblich ist.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const FILE = lib.FILE;
const SHOTS = lib.SHOTS;
const errors = [];
const check = (c, m) => { if (!c) { errors.push(m); console.log('  ✗ ' + m); } };

async function coin(page, index, text) {
  await page.goto(FILE);
  await page.evaluate((key) => localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    done: { 1: true, 2: true, 3: true }, lang: 'de', sound: false,
    srs: { [key]: { reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 } },
  })), 'n:' + index);
  await page.reload();
  await page.waitForSelector('.lesson.review');
  await page.locator('.lesson.review').click();
  await page.waitForSelector('.typed');
  const asked = (await page.locator('.question').textContent()).trim();
  await page.locator('.typed').fill(text);
  await page.waitForTimeout(60);
  const live = (await page.locator('.live').textContent()).trim();
  await page.locator('.actions .primary').click();
  await page.waitForSelector('.sheet');
  return {
    asked, live,
    good: Boolean(await page.locator('.sheet .verdict.good').count()),
    verdict: (await page.locator('.sheet .verdict').textContent()).replace(/\s+/g, ' ').trim(),
    reason: await page.locator('.sheet .reason').count()
      ? (await page.locator('.sheet .reason').first().textContent()).replace(/\s+/g, ' ').trim() : '',
    labels: await page.evaluate(() => Array.from(document.querySelectorAll('.sheet .xraylabel'))
      .map((n) => n.textContent.trim())),
  };
}

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });

  // Eigene, gültige Umschreibung — zählt, auch wenn sie nicht die übliche ist
  const own = await coin(page, 1, 'telo jaki wawa');
  console.log(`„${own.asked}“ · eigene Umschreibung → ${own.verdict}`);
  console.log(`   ${own.reason}`);
  check(own.good, 'eine gültige eigene Umschreibung wird abgelehnt');
  check(/Geht/.test(own.verdict), `Urteil: ${own.verdict}`);
  check(/geläufige Fassung/.test(own.reason), `kein Hinweis auf die übliche Fassung: ${own.reason}`);
  check(own.labels[0] === 'dein satz', `Röntgen nicht beschriftet: ${own.labels}`);
  await page.screenshot({ path: `${SHOTS}/38-umschreiben.png` });

  // Die übliche Fassung wird eigens gelobt
  const exact = await coin(page, 1, 'telo pimeja wawa');
  console.log(`übliche Fassung → ${exact.verdict}`);
  check(exact.good && /Genau die/.test(exact.verdict), `Urteil bei Volltreffer: ${exact.verdict}`);

  // Ein Wort allein reicht nicht
  const thin = await coin(page, 1, 'telo');
  console.log(`ein Wort → ${thin.verdict} · ${thin.reason}`);
  check(!thin.good, 'ein einzelnes Wort gilt als Umschreibung');
  check(/umschreibt noch nichts/.test(thin.reason), `Begründung: ${thin.reason}`);

  // Fremdwörter fliegen raus
  const foreign = await coin(page, 1, 'kafi wawa');
  console.log(`Fremdwort → ${foreign.verdict} · ${foreign.reason}`);
  check(!foreign.good, 'ein erfundenes Wort geht durch');
  check(/Kein toki-pona-Wort/.test(foreign.reason), `Begründung: ${foreign.reason}`);

  // Kaputte Wortgruppe
  const broken = await coin(page, 1, 'telo pi wawa');
  console.log(`kaputtes pi → ${broken.verdict} · ${broken.reason.slice(0, 60)}`);
  check(!broken.good, 'pi vor einem Wort geht durch');

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Umschreiben zählt, wenn es aufgeht');
})();

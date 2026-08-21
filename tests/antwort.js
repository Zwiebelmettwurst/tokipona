// Offene Fragen: eine eigene Antwort zählt, wenn Bau und geforderte
// Satzteile stimmen — und die Frage selbst zählt nicht als Antwort.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');

const FILE = lib.FILE;
const SHOTS = lib.SHOTS;

const errors = [];
const check = (condition, message) => { if (!condition) { errors.push(message); console.log('  ✗ ' + message); } };

// Genau eine fällige Karte: dann besteht die Wiederholung aus dieser Frage.
const seedQuestion = (page, id) => page.evaluate((key) => {
  localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    xp: 0, streak: 1, lastDay: null, dayXp: 0,
    done: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true, 9: true },
    mastery: {}, seenWords: {},
    srs: { [key]: { reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 } },
    sitelen: false, sound: false, lang: 'de',
  }));
}, 'q:' + id);

async function answer(page, id, text) {
  await page.goto(FILE);
  await seedQuestion(page, id);
  await page.reload();
  await page.waitForSelector('.lesson.due');
  await page.locator('.lesson.due').click();
  await page.waitForSelector('.typed');
  const question = (await page.locator('.question').textContent()).trim();
  const ask = (await page.locator('.ask').textContent()).trim();
  const hint = (await page.locator('.screen > .hint').first().textContent()).trim();
  await page.locator('.typed').fill(text);
  await page.waitForTimeout(60);
  const live = (await page.locator('.live').textContent()).trim();
  await page.locator('.actions .primary').click();
  await page.waitForSelector('.sheet');
  return {
    question, ask, hint, live,
    good: Boolean(await page.locator('.sheet .verdict.good').count()),
    verdict: (await page.locator('.sheet .verdict').textContent()).replace(/\s+/g, ' ').trim(),
    reason: await page.locator('.sheet .reason').count()
      ? (await page.locator('.sheet .reason').first().textContent()).replace(/\s+/g, ' ').trim() : '',
    xray: (await page.locator('.sheet .xray').allTextContents()).join(' ').replace(/\s+/g, ' ').trim(),
  };
}

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });

  // 1. Eine eigene, gültige Antwort mit dem geforderten Objekt
  const good = await answer(page, 'q03', 'mi moku e soweli lili.');
  console.log(`Frage: „${good.question}“ (${good.ask})`);
  console.log(`   Hinweis: ${good.hint}`);
  console.log(`   eigene Antwort → ${good.verdict}`);
  console.log(`   ${good.reason}`);
  console.log(`   Röntgen: ${good.xray}`);
  check(good.good, 'eine gültige eigene Antwort wird abgelehnt');
  check(/eigene/i.test(good.verdict), `Urteil passt nicht zur offenen Aufgabe: ${good.verdict}`);
  // Geröntgt wird die eigene Antwort, nicht das Beispiel.
  check(/soweli lili/.test(good.xray), `das Röntgen zeigt nicht die eigene Antwort: ${good.xray}`);
  check(good.live.length > 0, 'keine Rückmeldung beim Tippen');
  await page.screenshot({ path: `${SHOTS}/22-frage.png`, fullPage: true });

  // 2. Grammatisch sauber, aber ohne das geforderte Objekt
  const thin = await answer(page, 'q03', 'mi moku.');
  console.log(`ohne Objekt → ${thin.verdict} · ${thin.reason}`);
  check(!thin.good, 'Antwort ohne das geforderte Objekt gilt als richtig');
  check(/Objekt/.test(thin.reason), `kein Hinweis auf das fehlende Objekt: ${thin.reason}`);

  // 3. Kaputter Bau
  const broken = await answer(page, 'q03', 'mi li moku e kili.');
  console.log(`falscher Bau → ${broken.verdict} · ${broken.reason}`);
  check(!broken.good, 'ein Satz mit li nach mi gilt als richtig');
  check(broken.reason.length > 0, 'keine Erklärung zum Baufehler');

  // 4. Die Frage zurückgeben ist keine Antwort
  const echo = await answer(page, 'q03', 'sina moku e seme?');
  console.log(`Frage zurückgegeben → ${echo.verdict} · ${echo.reason}`);
  check(!echo.good, 'die Frage selbst gilt als Antwort');

  // 5. Vorfeld mit la wird verlangt
  const context = await answer(page, 'q12', 'mi pali e lipu.');
  console.log(`ohne Vorfeld → ${context.verdict} · ${context.reason}`);
  check(!context.good, 'Antwort ohne la-Vorfeld gilt als richtig');
  check(/la/.test(context.reason), `kein Hinweis auf das Vorfeld: ${context.reason}`);
  const withContext = await answer(page, 'q12', 'tenpo pini la mi pali e tomo.');
  check(withContext.good, 'Antwort mit Vorfeld und Objekt wird abgelehnt');
  console.log(`mit Vorfeld → ${withContext.verdict}`);

  // 6. Englisch
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
      done: { 1: true, 2: true, 3: true }, lang: 'en', sound: false,
      srs: { 'q:q03': { reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 } },
    }));
  });
  await page.reload();
  await page.waitForSelector('.lesson.due');
  await page.locator('.lesson.due').click();
  await page.waitForSelector('.typed');
  const englishHint = (await page.locator('.screen > .hint').first().textContent()).trim();
  const englishAsk = (await page.locator('.ask').textContent()).trim();
  console.log(`Englisch: „${englishAsk}“ · ${englishHint}`);
  check(/object/i.test(englishHint), `Hinweis bleibt deutsch: ${englishHint}`);

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Offene Fragen in Ordnung');
})();

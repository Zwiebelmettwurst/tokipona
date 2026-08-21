// „Dein Sohn ist stark.“ — jan lili mije sina oder jan mije lili sina?
// Beides ist derselbe Sohn. Die Aufgabe muss beides annehmen, einen
// Rollentausch aber weiterhin ablehnen.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');

const FILE = lib.FILE;
const SHOTS = lib.SHOTS;

const errors = [];
const check = (condition, message) => { if (!condition) { errors.push(message); console.log('  ✗ ' + message); } };

// Genau eine fällige Karte setzen — dann besteht die Wiederholung aus ihr.
const seed = (page, card) => page.evaluate((id) => {
  localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    xp: 0, streak: 1, lastDay: null, dayXp: 0, done: { 1: true }, mastery: {}, seenWords: {},
    srs: { [id]: { reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 } },
    sitelen: false, lang: 'de',
  }));
}, card);

async function attempt(page, words) {
  await page.goto(FILE);
  await seed(page, 's:lsp02_08');
  await page.reload();
  await page.waitForSelector('.lesson.review');
  await page.locator('.lesson.review').click();
  await page.waitForSelector('.slot');
  const prompt = (await page.locator('.question').textContent()).trim();
  for (const word of words) {
    const tile = page.locator(`.bank .tile:not(.used)[data-word="${word}"]`).first();
    if (!(await tile.count())) { errors.push(`Kachel „${word}“ fehlt im Vorrat`); return null; }
    await tile.click();
  }
  await page.locator('.actions .primary').click();
  await page.waitForSelector('.sheet');
  return {
    prompt,
    good: Boolean(await page.locator('.sheet .verdict.good').count()),
    verdict: (await page.locator('.sheet .verdict').textContent()).replace(/\s+/g, ' ').trim(),
    reason: await page.locator('.sheet .reason').count()
      ? (await page.locator('.sheet .reason').first().textContent()).replace(/\s+/g, ' ').trim() : '',
    solution: await page.locator('.sheet .solution').count()
      ? (await page.locator('.sheet .solution').first().textContent()).replace(/\s+/g, ' ').trim() : '',
  };
}

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });

  // 1. Musterlösung
  const exact = await attempt(page, ['jan', 'lili', 'mije', 'sina', 'li', 'wawa']);
  if (exact) {
    console.log(`„${exact.prompt}“ · Musterlösung → ${exact.verdict}`);
    check(exact.good, 'die Musterlösung selbst gilt nicht als richtig');
  }

  // 2. Umgestellte Beifügungen — die Frage aus dem Alltag
  const swapped = await attempt(page, ['jan', 'mije', 'lili', 'sina', 'li', 'wawa']);
  if (swapped) {
    console.log(`umgestellt → ${swapped.verdict}`);
    console.log(`   Hinweis: ${swapped.reason}`);
    console.log(`   gezeigt:  ${swapped.solution}`);
    check(swapped.good, 'jan mije lili sina wird abgelehnt');
    check(/umstellen|swap/i.test(swapped.verdict), `Urteil erklärt die Umstellung nicht: ${swapped.verdict}`);
    check(swapped.solution.includes('jan lili mije sina'), 'die übliche Reihenfolge wird nicht gezeigt');
    await page.screenshot({ path: `${SHOTS}/19-stellung.png` });
  }

  // 3. Rollentausch: dieselben Wörter, andere Aussage → bleibt falsch
  const roles = await attempt(page, ['wawa', 'li', 'jan', 'lili', 'mije', 'sina']);
  if (roles) {
    console.log(`Rollentausch → ${roles.verdict}`);
    console.log(`   Hinweis: ${roles.reason}`);
    check(!roles.good, 'wawa li jan lili mije sina gilt als richtig');
    check(/Stellung|order/i.test(roles.reason), `keine Erklärung zum Rollentausch: ${roles.reason}`);
  }

  await browser.close();
  if (errors.length) {
    console.log('\n✗ ' + errors.length + ' Problem(e)');
    process.exit(1);
  }
  console.log('\n✓ Umstellung zählt, Rollentausch nicht');
})();

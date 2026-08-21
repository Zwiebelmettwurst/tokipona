// Wortverbände, Stilvergleich und Silbenspiel.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const FILE = lib.FILE;
const SHOTS = lib.SHOTS;
const errors = [];
const check = (c, m) => { if (!c) { errors.push(m); console.log('  ✗ ' + m); } };

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ---------- Wortverband
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.word');
  await page.locator('.search').fill('tomo');
  await page.waitForTimeout(60);
  const row = page.locator('.word', { hasText: 'Haus' }).first();
  check((await page.locator('.net').count()) === 0, 'der Verband steht offen, bevor getippt wurde');
  await row.click();
  await page.waitForTimeout(60);
  const net = await page.evaluate(() => {
    const box = document.querySelector('.word[data-open="true"] .net');
    if (!box) return null;
    return {
      labels: Array.from(box.querySelectorAll('.netlabel')).map((n) => n.textContent.trim()),
      pairs: Array.from(box.querySelectorAll('code')).map((n) => n.textContent.replace(/\d+$/, '').trim()),
    };
  });
  console.log('tomo →', net && net.pairs.slice(0, 8).join(' | '));
  check(Boolean(net), 'kein Wortverband nach dem Antippen');
  check(net && net.pairs.length >= 4, `nur ${net && net.pairs.length} Verbindungen`);
  check(net && net.pairs.some((p) => p.startsWith('tomo ')), 'keine Verbindung als Kopfwort');
  check(net && net.pairs.some((p) => p.endsWith(' tomo')), 'keine Verbindung als Beifügung');
  // Jede angezeigte Verbindung muss auch als Wortgruppe durchgehen
  const bad = await page.evaluate(() => Array.from(
    document.querySelectorAll('.word[data-open="true"] .net code'))
    .map((n) => n.textContent.replace(/\d+$/, '').trim())
    .filter((pair) => TokiPona.parse(pair).violations.length));
  check(bad.length === 0, `unsaubere Verbindungen: ${bad.join(', ')}`);
  await page.screenshot({ path: `${SHOTS}/39-verband.png`, clip: { x: 0, y: 0, width: 390, height: 500 } });
  await row.click();
  await page.waitForTimeout(40);
  check((await page.locator('.word[data-open="true"]').count()) === 0, 'der Verband schließt nicht wieder');

  // ---------- Stilvergleich als Sammlung
  await page.locator('.tabs button[data-tab="toki"]').click();
  await page.waitForSelector('.musilines');
  const styles = await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.card'))
      .find((c) => /nasin ante/.test(c.textContent));
    return card ? {
      topics: Array.from(card.querySelectorAll('.styleline .netlabel')).map((n) => n.textContent.trim()),
      sentences: card.querySelectorAll('.glossline').length,
    } : null;
  });
  console.log(`Stilpaare: ${styles && styles.topics.length} Themen, ${styles && styles.sentences} Sätze`);
  check(styles && styles.topics.length === 8, 'nicht acht Stilthemen');
  check(styles && styles.sentences === 16, 'nicht sechzehn Sätze');

  // ---------- Stilaufgabe
  await page.evaluate(() => localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    done: { 1: true }, lang: 'de', sound: false,
    srs: { 'v:s01': { reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 } },
  })));
  await page.reload();
  await page.waitForSelector('.lesson.due');
  await page.locator('.lesson.due').click();
  await page.waitForSelector('.choice');
  const asked = (await page.locator('.question').textContent()).trim();
  const options = await page.locator('.choice').allTextContents();
  console.log(`Stilaufgabe: „${asked}“ · ${options.join(' / ')}`);
  check(/gefallen/.test(asked), `Frage: ${asked}`);
  await page.locator('.choice', { hasText: 'soweli li pona tawa mi.' }).click();
  await page.locator('.actions .primary').click();
  await page.waitForSelector('.sheet');
  const verdict = (await page.locator('.sheet .verdict').textContent()).trim();
  const reason = (await page.locator('.sheet .reason').first().textContent()).replace(/\s+/g, ' ').trim();
  console.log(`→ ${verdict} · ${reason.slice(0, 90)}`);
  check(/pona/.test(verdict), `Urteil: ${verdict}`);
  check(/olin/.test(reason), 'die andere Fassung wird nicht erklärt');

  // ---------- Silbenspiel
  await page.evaluate(() => localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    done: { 1: true }, lang: 'de', sound: false,
    srs: { 'y:soweli': { reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 } },
  })));
  await page.reload();
  await page.waitForSelector('.lesson.due');
  await page.locator('.lesson.due').click();
  await page.waitForSelector('.bank .tile');
  const chips = await page.locator('.bank .tile').allTextContents();
  console.log('Silben:', chips.join(' '));
  check(chips.length >= 4, `nur ${chips.length} Silben`);
  for (const part of ['so', 'we', 'li']) {
    check(chips.includes(part), `Silbe „${part}“ fehlt`);
  }
  for (const part of ['so', 'we', 'li']) {
    await page.locator(`.bank .tile:not(.used)`, { hasText: new RegExp(`^${part}$`) }).first().click();
  }
  await page.screenshot({ path: `${SHOTS}/40-silben.png`, clip: { x: 0, y: 0, width: 390, height: 480 } });
  await page.locator('.actions .primary').click();
  await page.waitForSelector('.sheet');
  const built = (await page.locator('.sheet .verdict').textContent()).trim();
  const note = (await page.locator('.sheet .reason').first().textContent()).replace(/\s+/g, ' ').trim();
  console.log(`gebaut → ${built} · ${note}`);
  check(/pona/.test(built), `richtig gebautes Wort gilt als falsch: ${built}`);
  check(/so · we · li/.test(note), `keine Silbenzerlegung in der Rückmeldung: ${note}`);

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Verband, Stil und Silben in Ordnung');
})();

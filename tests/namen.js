// Namen nachsprechen: was herauskommt, muss die Lautlehre bestehen.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const FILE = lib.FILE;
const SHOTS = lib.SHOTS;
const errors = [];
const check = (c, m) => { if (!c) { errors.push(m); console.log('  ✗ ' + m); } };

const NAMES = ['Klaus', 'Anna', 'Deutschland', 'Zwiebelmettwurst', 'Yvonne', 'Öztürk',
  'New York', 'Vladimir', 'Giuseppe', 'Þór', 'Wolfgang', 'Titus', 'Jill', 'x', '123'];

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.namecard');

  // Leeres Feld sagt es freundlich
  const empty = (await page.locator('.nameout').textContent()).trim();
  check(/Schreib/.test(empty), `leeres Feld: ${empty}`);

  for (const name of NAMES) {
    await page.locator('.nameinput').fill(name);
    await page.waitForTimeout(30);
    const out = (await page.locator('.nameout').textContent()).replace(/\s+/g, ' ').trim();
    if (/^[0-9x]+$/.test(name) && !/^jan /.test(out)) continue;   // Ziffern ergeben nichts
    const made = out.replace(/^jan\s+/, '').replace(/♪/g, '').trim();
    const bad = await page.evaluate((word) => word.split(' ')
      .map((part) => TokiPona.phonoCheck(part.toLowerCase()))
      .filter(Boolean), made);
    console.log(`${name.padEnd(18)} → ${out}`);
    check(bad.length === 0, `${name} → „${made}“ verstößt gegen die Lautlehre: ${JSON.stringify(bad)}`);
    check(/^jan /.test(out), `${name}: kein Kopfwort davor (${out})`);
    check(/^[A-ZÄÖÜ]/.test(made), `${name}: Name nicht groß geschrieben (${made})`);
  }

  // Die vier Kopfwörter stehen nebeneinander, nicht untereinander
  const rows = await page.evaluate(() => {
    const tops = Array.from(document.querySelectorAll('.heads .ghost'))
      .map((b) => Math.round(b.getBoundingClientRect().top));
    return { count: tops.length, lines: new Set(tops).size };
  });
  console.log(`Kopfwörter: ${rows.count} in ${rows.lines} Zeile(n)`);
  check(rows.count === 4, `${rows.count} Kopfwörter statt vier`);
  check(rows.lines === 1, `Kopfwörter brechen auf ${rows.lines} Zeilen um`);

  // Kopfwort wechseln
  await page.locator('.nameinput').fill('Berlin');
  await page.locator('.heads .ghost', { hasText: 'ma' }).click();
  await page.waitForTimeout(40);
  const place = (await page.locator('.nameout').textContent()).replace(/\s+/g, ' ').trim();
  console.log('mit Kopfwort ma:', place);
  check(/^ma /.test(place), `Kopfwort nicht gewechselt: ${place}`);
  await page.screenshot({ path: `${SHOTS}/37-namen.png`, clip: { x: 0, y: 0, width: 390, height: 420 } });

  // Wahl überlebt das Neuladen
  await page.reload();
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.namecard');
  const picked = await page.locator('.heads .ghost[data-picked="true"]').textContent();
  check(/ma/.test(picked), `Kopfwort nach Neuladen: ${picked}`);

  // Die Wörter des Nachschlags stehen dahinter weiter
  check((await page.locator('.word').count()) === 137, 'die Wortliste fehlt unter der Karte');

  // Englisch
  await page.evaluate(() => {
    const key = 'o-toki-fortschritt-v1';
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    stored.lang = 'en';
    localStorage.setItem(key, JSON.stringify(stored));
  });
  await page.reload();
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.namecard');
  const english = (await page.locator('.namecard h2').textContent()).trim();
  const heads = (await page.locator('.heads').textContent()).replace(/\s+/g, ' ').trim();
  console.log(`Englisch: „${english}“ · ${heads}`);
  check(/your name/i.test(english), `Überschrift bleibt deutsch: ${english}`);
  check(/person/.test(heads), `Kopfwörter bleiben deutsch: ${heads}`);

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Namen kommen sauber heraus');
})();

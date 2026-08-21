// Stufen und Tagesziel: die Zahl muss etwas bedeuten.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const FILE = lib.FILE;
const SHOTS = lib.SHOTS;
const errors = [];
const check = (c, m) => { if (!c) { errors.push(m); console.log('  ✗ ' + m); } };

const show = (page, xp, dayXp, goal) => page.evaluate(([x, d, g]) => {
  localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    xp: x, dayXp: d, goal: g, streak: 2, lastDay: new Date().toISOString().slice(0, 10),
    done: { 1: true }, lang: 'de', sound: false, days: {},
  }));
}, [xp, dayXp, goal]);

const read = (page) => page.evaluate(() => ({
  level: Number(document.querySelector('.ring b').textContent.trim()),
  fill: document.querySelector('.ring').style.getPropertyValue('--fill'),
  hint: document.querySelector('.level').getAttribute('title'),
  today: document.querySelector('.metric.gold').textContent.trim(),
  week: document.querySelector('.week') ? document.querySelector('.card .hint').textContent : '',
}));

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });
  await page.goto(FILE);

  // Die Kurve: Stufe n beginnt bei 25·n·(n−1)
  const expected = [[0, 1], [49, 1], [50, 2], [149, 2], [150, 3], [299, 3], [300, 4],
                    [500, 5], [750, 6], [800, 6], [1050, 7], [1800, 9], [2250, 10]];
  for (const [xp, want] of expected) {
    await show(page, xp, 0, 40);
    await page.reload();
    await page.waitForSelector('.ring');
    const seen = await read(page);
    if (seen.level !== want) check(false, `${xp} XP → Stufe ${seen.level} statt ${want}`);
  }
  console.log('Kurve: ' + expected.map(([xp, l]) => `${xp}→${l}`).join(' '));

  // Nach 800 XP — dem Stand von zwei Tagen Spielen — nicht mehr Stufe 9
  await show(page, 800, 215, 40);
  await page.reload();
  await page.waitForSelector('.ring');
  const heavy = await read(page);
  console.log(`800 XP: Stufe ${heavy.level}, Ring ${heavy.fill}, „${heavy.hint}“`);
  console.log(`Kopfzeile: „${heavy.today}“`);
  check(heavy.level === 6, `800 XP ergeben Stufe ${heavy.level}`);
  check(/Noch \d+ XP/.test(heavy.hint), `kein Hinweis zur nächsten Stufe: ${heavy.hint}`);
  check(parseInt(heavy.fill, 10) > 0 && parseInt(heavy.fill, 10) < 100,
    `Ringfüllung unplausibel: ${heavy.fill}`);
  // Tagesziel übererfüllt: kein „215/40“ mehr
  check(!/215\/40/.test(heavy.today), `Kopfzeile zeigt weiterhin ${heavy.today}`);
  check(/geschafft/.test(heavy.today), `kein Erfolgshinweis: ${heavy.today}`);
  await page.screenshot({ path: `${SHOTS}/36-stufe.png`, clip: { x: 0, y: 0, width: 390, height: 120 } });

  // Unter dem Ziel bleibt die alte Anzeige
  await show(page, 800, 30, 40);
  await page.reload();
  await page.waitForSelector('.ring');
  const under = await read(page);
  console.log(`unter Ziel: „${under.today}“`);
  check(/30\/40/.test(under.today), `Anzeige unter dem Ziel: ${under.today}`);

  // Vier Zielgrößen zur Auswahl
  const goals = await page.evaluate(() => Array.from(
    document.querySelectorAll('.card .row .ghost'))
    .map((b) => b.textContent.trim()).filter((t) => /XP$/.test(t)));
  console.log('Tagesziele:', goals.join(' '));
  check(goals.length === 4, `${goals.length} Zielgrößen statt vier`);

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Stufen und Ziel stimmen');
})();

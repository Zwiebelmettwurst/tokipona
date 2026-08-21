// Fällige Karten: gezählt wird, was sich auch bauen lässt. Eine Karte zu
// einer Aufgabe, die es nicht mehr gibt, blieb sonst für immer fällig — die
// Startseite versprach drei Karten und die Runde war sofort zu Ende.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const SHOTS = lib.SHOTS;
const FILE = lib.FILE;

const KEY = 'o-toki-fortschritt-v1';
const errors = [];
const check = (ok, message) => { if (!ok) { errors.push(message); console.log('  ✗ ' + message); } };

const faellig = () => ({ reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 });

const seed = async (page, srs, rest = {}) => {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
    [KEY, Object.assign({ lang: 'de', done: { 1: true } }, rest, { srs })]);
  await page.reload();
  await page.waitForSelector('.lesson');
  await page.waitForTimeout(350);      // die Schriftmessung läuft nach dem Laden
};

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });
  await page.goto(FILE);

  // 1. Nur tote Karten: die Karte darf gar nicht erst erscheinen.
  await seed(page, { 's:gibtsnicht1': faellig(), 's:gibtsnicht2': faellig(),
                     's:gibtsnicht3': faellig() });
  const tot = await page.locator('.lesson.due').count();
  console.log('nur tote Karten → Karte da:', tot ? 'ja' : 'nein');
  check(tot === 0, 'die Wiederholungskarte steht da, obwohl keine Karte zu bauen ist');

  // Und sie sind aus dem Speicher verschwunden, statt ewig fällig zu bleiben.
  const leer = await page.evaluate((key) => Object.keys(JSON.parse(localStorage.getItem(key)).srs), KEY);
  console.log('Speicher danach:', leer.length ? leer.join(' ') : '(leer)');
  check(leer.length === 0, `tote Karten bleiben liegen: ${leer.join(' ')}`);

  // 2. Gemischt: gezählt wird nur, was geht.
  const echt = {};
  for (const wort of ['pona', 'moku', 'lukin']) echt['w:' + wort] = faellig();
  await seed(page, Object.assign({ 's:gibtsnicht1': faellig(), 's:gibtsnicht2': faellig() }, echt));
  const text = (await page.locator('.lesson.due .body b').textContent()).trim();
  console.log('gemischt →', text);
  check(/^3 Karten/.test(text), `Startseite sagt „${text}“, bauen lassen sich drei`);

  await page.locator('.lesson.due').click();
  await page.waitForSelector('.exbar');
  const laenge = await page.evaluate(() =>
    Number(document.querySelector('.exbar .track i').style.width.replace('%', '')));
  console.log('Fortschritt der ersten Aufgabe:', laenge + '%');
  check(laenge === 0, 'die Runde startet nicht bei null');
  let schritte = 0;
  for (let i = 0; i < 12 && !(await page.locator('.done').count()); i += 1) {
    schritte += 1;
    await page.locator('.exbar .skip').click();
    await page.waitForTimeout(40);
  }
  console.log('Runde:', schritte, 'Aufgaben');
  check(schritte === 3, `${schritte} Aufgaben statt der versprochenen drei`);
  await page.locator('.done .primary').click();
  await page.waitForSelector('.lesson');

  // 3. Zeichenkarten hängen an der Schriftmessung und dürfen nicht
  //    weggeräumt werden, nur weil sie kurz nach dem Laden nicht zu bauen sind.
  await seed(page, { 't:soweli': faellig(), 'g:kili': faellig(), 'w:pona': faellig() });
  const uebrig = await page.evaluate((key) =>
    Object.keys(JSON.parse(localStorage.getItem(key)).srs).sort(), KEY);
  console.log('mit Zeichenkarten:', uebrig.join(' '));
  check(uebrig.includes('t:soweli') && uebrig.includes('g:kili'),
    `Zeichenkarten wurden weggeräumt: ${uebrig.join(' ')}`);

  // 4. Ein gesunder Stand bleibt unangetastet.
  const gesund = {};
  for (const wort of ['pona', 'moku', 'lukin', 'telo', 'jan']) gesund['w:' + wort] = faellig();
  await seed(page, gesund);
  const heil = await page.evaluate((key) =>
    Object.keys(JSON.parse(localStorage.getItem(key)).srs).length, KEY);
  check(heil === 5, `von fünf gesunden Karten sind ${heil} übrig`);
  const zahl = (await page.locator('.lesson.due .body b').textContent()).trim();
  console.log('gesunder Stand →', zahl);
  check(/^5 Karten/.test(zahl), `Startseite sagt „${zahl}“ statt fünf`);
  await page.screenshot({ path: `${SHOTS}/65-faellig.png` });

  await browser.close();
  if (errors.length) { console.log(`\n✗ ${errors.length} Problem(e)`); process.exit(1); }
  console.log('\n✓ fällige Karten versprechen nur, was sie halten');
})();

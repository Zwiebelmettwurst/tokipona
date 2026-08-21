// Lektion 0: der Satzbau vor dem Wortschatz. Regelkarten erklären, die
// Aufgaben dahinter prüfen genau diese Regel — und der Kurs bleibt für alle,
// die schon mittendrin sind, unverändert.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const SHOTS = lib.SHOTS;
const FILE = lib.FILE;

const KEY = 'o-toki-fortschritt-v1';
const errors = [];
const check = (ok, message) => { if (!ok) { errors.push(message); console.log('  ✗ ' + message); } };

const seed = async (page, stand) => {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [KEY, stand]);
  await page.reload();
  await page.waitForSelector('.lesson');
};

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, colorScheme: 'light', locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });
  await page.goto(FILE);

  // ------------------------------------------------ 1. Platz im Pfad
  await seed(page, { lang: 'de' });
  const pfad = await page.evaluate(() => Array.from(document.querySelectorAll('.path .lesson'))
    .slice(0, 3).map((n) => ({ titel: n.querySelector('b').textContent.trim(),
                               nummer: n.querySelector('.badge').textContent.trim(),
                               zustand: n.dataset.state })));
  console.log('Pfad:', pfad.map((l) => `${l.nummer} ${l.titel} (${l.zustand})`).join(' | '));
  check(pfad[0] && pfad[0].nummer === '0', `oben steht Lektion „${pfad[0] && pfad[0].nummer}“`);
  check(pfad[0] && pfad[0].zustand === 'current', 'Lektion 0 ist für Anfängerinnen nicht hervorgehoben');
  check(pfad[1] && pfad[1].zustand === 'open',
    `Lektion 1 ist „${pfad[1] && pfad[1].zustand}“ — sie darf nicht hinter Lektion 0 hängen`);
  await page.screenshot({ path: `${SHOTS}/61-pfad0.png` });

  // Wer schon mittendrin ist, wird nicht an den Anfang zurückgeschickt.
  await seed(page, { lang: 'de', xp: 300, done: { 1: true, 2: true } });
  const laufend = await page.evaluate(() => Array.from(document.querySelectorAll('.path .lesson'))
    .slice(0, 4).map((n) => n.dataset.state));
  console.log('mittendrin:', laufend.join(' '));
  check(laufend[0] === 'open', `Lektion 0 ist „${laufend[0]}“ statt schlicht offen`);
  check(laufend[3] === 'current', `hervorgehoben ist „${laufend[3]}“ statt Lektion 3`);
  const hallo = await page.locator('.hello p').textContent();
  check(!/Satz gebaut/.test(hallo), `Begrüßung schickt zurück zur Einführung: „${hallo}“`);

  // ------------------------------------------------ 2. Durchlauf
  await seed(page, { lang: 'de' });
  await page.locator('.path .lesson').first().click();
  await page.waitForSelector('.exbar');

  const arten = [];
  const regeln = [];
  let punkteVorRegel = null;
  let punkteNachRegel = null;
  for (let i = 0; i < 40 && !(await page.locator('.done').count()); i += 1) {
    const art = await page.evaluate(() => (document.querySelector('.rulebody') ? 'regel'
      : document.querySelector('.pickline') ? 'fehler'
      : document.querySelector('.slot') ? 'bauen'
      : document.querySelector('.choice') ? 'waehlen' : 'andere'));
    arten.push(art);

    if (art === 'regel') {
      const karte = await page.evaluate(() => ({
        beispiel: document.querySelector('.question').textContent.replace(/\s+/g, ' ').trim(),
        lesart: document.querySelector('.screen > .hint').textContent.trim(),
        roentgen: document.querySelectorAll('.rulebody .xraywrap .span').length,
        erklaerung: document.querySelector('.rulebody .reason').textContent.trim(),
        gegen: document.querySelector('.rulebad code')
          ? document.querySelector('.rulebad code').textContent.trim() : null,
        art: document.querySelector('.rulebad') ? document.querySelector('.rulebad').dataset.kind : null,
        marke: document.querySelector('.rulebad .mark')
          ? document.querySelector('.rulebad .mark').textContent.trim() : null,
        knoepfe: document.querySelectorAll('.actions .primary').length,
      }));
      regeln.push(karte);
      check(karte.roentgen >= 2, `Regel ohne Satzröntgen: ${karte.beispiel}`);
      check(karte.erklaerung.length > 40, `Regel ohne Erklärung: ${karte.beispiel}`);
      check(Boolean(karte.gegen), `Regel ohne Gegenbeispiel: ${karte.beispiel}`);
      check(['falsch', 'anders'].includes(karte.art), `Gegenbeispiel ohne Art: ${karte.art}`);
      check(karte.marke === (karte.art === 'falsch' ? '✕' : '≠'),
        `Gegenbeispiel „${karte.art}“ trägt die Marke „${karte.marke}“`);
      check(karte.knoepfe === 1, `${karte.knoepfe} Hauptknöpfe auf der Regelkarte`);
      if (regeln.length <= 2) {
        await page.screenshot({ path: `${SHOTS}/62-regel-${regeln.length}.png` });
      }
      // Lesen bringt keine Punkte — die kommen aus den Aufgaben danach.
      punkteVorRegel = await page.evaluate((key) =>
        (JSON.parse(localStorage.getItem(key)) || {}).xp || 0, KEY);
      await page.locator('.actions .primary').click();
      await page.waitForTimeout(50);
      punkteNachRegel = await page.evaluate((key) =>
        (JSON.parse(localStorage.getItem(key)) || {}).xp || 0, KEY);
      check(punkteNachRegel === punkteVorRegel,
        `eine gelesene Regel gab ${punkteNachRegel - punkteVorRegel} Punkte`);
      continue;
    }

    // Aufgaben lösen wir nicht, wir überspringen — geprüft wird der Ablauf.
    await page.locator('.exbar .skip').click();
    await page.waitForTimeout(40);
  }

  console.log('Ablauf:', arten.join(' '));
  console.log('Regeln:', regeln.map((r) => r.beispiel.replace(/\s*♪\s*$/, '')).join(' · '));
  check(regeln.length === 4, `${regeln.length} Regelkarten statt vier`);
  check(regeln.some((r) => r.art === 'falsch'), 'kein Gegenbeispiel der Art „falsch“');
  check(regeln.some((r) => r.art === 'anders'), 'kein Gegenbeispiel der Art „anders“');
  // Auf jede Regel folgen Aufgaben, keine zweite Regel unmittelbar danach.
  arten.forEach((art, index) => {
    if (art === 'regel' && arten[index + 1] === 'regel') {
      errors.push(`zwei Regeln hintereinander an Stelle ${index + 1}`);
    }
  });
  check(arten.filter((a) => a !== 'regel').length >= 8,
    `nur ${arten.filter((a) => a !== 'regel').length} Aufgaben zwischen den Regeln`);

  const abschluss = (await page.locator('.done h2').textContent()).trim();
  console.log('Abschluss:', abschluss);
  check(/Satz gebaut/.test(abschluss), `am Ende steht „${abschluss}“`);
  await page.screenshot({ path: `${SHOTS}/63-abschluss0.png` });
  await page.locator('.done .primary').click();
  await page.waitForSelector('.lesson');

  const danach = await page.evaluate(() => Array.from(document.querySelectorAll('.path .lesson'))
    .slice(0, 2).map((n) => n.dataset.state));
  console.log('Pfad danach:', danach.join(' '));
  check(danach[0] === 'done', `Lektion 0 bleibt „${danach[0]}“`);
  check(danach[1] === 'current', `Lektion 1 ist danach „${danach[1]}“`);
  const gemerkt = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).done['0'], KEY);
  check(gemerkt === true, 'Lektion 0 wird nicht als erledigt gemerkt');

  // Der Wiederholungsknopf startet wieder die Einführung, nicht Lektion 1.
  await page.locator('.path .lesson').first().click();
  await page.waitForSelector('.exbar');
  check(await page.locator('.rulebody').count() === 1,
    'die erledigte Lektion 0 startet nicht wieder mit einer Regel');
  await page.locator('.exbar button').first().click();
  await page.waitForSelector('.lesson');

  // ------------------------------------------------ 3. Englisch
  await seed(page, { lang: 'en' });
  const titel = await page.locator('.path .lesson b').first().textContent();
  console.log('Englisch:', titel.trim());
  check(/How a sentence/.test(titel), `englischer Titel fehlt: „${titel.trim()}“`);
  await page.locator('.path .lesson').first().click();
  await page.waitForSelector('.rulebody');
  const englisch = await page.evaluate(() => ({
    frage: document.querySelector('.prompt').textContent.trim(),
    erklaerung: document.querySelector('.rulebody .reason').textContent.trim(),
    gegen: document.querySelector('.rulebad .hint').textContent.trim(),
  }));
  console.log('  ', englisch.frage, '·', englisch.erklaerung.slice(0, 60) + '…');
  check(/sentence is built/.test(englisch.frage), `englische Aufschrift fehlt: „${englisch.frage}“`);
  check(!/[äöüß]/.test(englisch.erklaerung + englisch.gegen),
    'deutsche Wörter in der englischen Regelkarte');

  // Nichts ragt heraus.
  const breit = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!breit, 'die Regelkarte ragt seitlich heraus');

  await browser.close();
  if (errors.length) { console.log(`\n✗ ${errors.length} Problem(e)`); process.exit(1); }
  console.log('\n✓ Lektion 0 erklärt li und e, ohne den Kurs umzuhängen');
})();

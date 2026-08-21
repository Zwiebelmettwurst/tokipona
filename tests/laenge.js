// Die drei Neuen: Länge einer Runde, Schwachstellen, Tagebuch.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const SHOTS = lib.SHOTS;
const FILE = lib.FILE;

const KEY = 'o-toki-fortschritt-v1';

// Setzt einen Stand und lädt neu.
const seed = async (page, stand) => {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
    [KEY, stand]);
  await page.reload();
  await page.waitForSelector('.lesson');
};

// Zählt die Aufgaben einer Runde: bis zum Abschluss durchklicken.
const runde = async (page) => {
  await page.locator('.lesson[data-state="current"]').first().click();
  await page.waitForSelector('.exbar');
  const gesamt = await page.evaluate(() => document.querySelectorAll('.exbar').length);
  if (!gesamt) return 0;
  let schritte = 0;
  for (let i = 0; i < 40; i += 1) {
    if (await page.locator('.done').count()) break;
    schritte += 1;
    await page.locator('.exbar .skip').click();
    await page.waitForTimeout(30);
  }
  return schritte;
};

(async () => {
  const browser = await lib.launch(chromium);
  const errors = [];
  const check = (ok, message) => { if (!ok) { errors.push(message); console.log('  ✗ ' + message); } };
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', locale: 'de-DE' });
  page.on('pageerror', (e) => errors.push('Seitenfehler: ' + e.message));
  await page.goto(FILE);

  // ---------------------------------------------------------- 1. Rundenlänge
  await seed(page, { lang: 'de', size: 'kurz' });
  const kurz = await runde(page);
  console.log('kurze Runde:', kurz, 'Aufgaben');
  check(kurz > 0 && kurz <= 6, `kurze Runde hat ${kurz} Aufgaben, erlaubt sind bis 6`);

  await seed(page, { lang: 'de', size: 'lang' });
  const lang = await runde(page);
  console.log('lange Runde:', lang, 'Aufgaben');
  check(lang <= 20, `lange Runde hat ${lang} Aufgaben, erlaubt sind bis 20`);
  check(lang > kurz, `lange Runde (${lang}) ist nicht länger als die kurze (${kurz})`);

  // Die Wahl steht auf der Startseite und überlebt das Neuladen.
  await seed(page, { lang: 'de', size: 'mittel' });
  const knoepfe = page.locator('.card', { hasText: 'länge einer runde' }).locator('.ghost');
  check(await knoepfe.count() === 3, 'die Rundenlänge hat nicht drei Knöpfe');
  const gewaehlt = await page.locator('.card', { hasText: 'länge einer runde' })
    .locator('.ghost[data-picked="true"]').textContent();
  check(/Mittel/.test(gewaehlt), `vorgewählt steht „${gewaehlt}“, erwartet Mittel`);
  await knoepfe.first().click();
  await page.waitForTimeout(60);
  await page.reload();
  await page.waitForSelector('.lesson');
  const nachher = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).size, KEY);
  check(nachher === 'kurz', `nach dem Neuladen steht „${nachher}“ im Speicher, erwartet kurz`);

  // ------------------------------------------------------- 2. Schwachstellen
  // Ein Stand mit wackeligen Karten: keine Wiederholung geschafft, kleine Ease.
  const wackelig = {};
  for (const wort of ['toki', 'pona', 'mi', 'sina', 'moku', 'lape']) {
    wackelig['w:' + wort] = { reps: 0, interval: 600000, ease: 1.4, due: Date.now() + 8.64e7 };
  }
  await seed(page, { lang: 'de', size: 'mittel', done: { 1: true, 2: true },
                     srs: wackelig, mastery: { c_li: 0.1, c_modifikator: 0.2 } });
  const karte = page.locator('.lesson.weak');
  check(await karte.count() === 1, 'die Schwachstellenkarte fehlt');
  if (await karte.count()) {
    const text = (await karte.textContent()).replace(/\s+/g, ' ').trim();
    console.log('Schwachstellen:', text);
    check(/schwachstellen üben/i.test(text), 'die Karte trägt die falsche Aufschrift');
    // Sie steht direkt unter den fälligen Karten, nicht unter den Lektionen.
    const platz = await page.evaluate(() => {
      const alle = Array.from(document.querySelectorAll('.path .lesson, .screen > .lesson'));
      return alle.findIndex((node) => node.classList.contains('weak'));
    });
    check(platz === 0, `die Schwachstellenkarte steht an Position ${platz}, erwartet ganz oben`);

    await karte.click();
    await page.waitForSelector('.exbar');
    const laenge = await page.evaluate(() => document.querySelectorAll('.exbar').length);
    check(laenge === 1, 'die Schwachstellenrunde startet nicht');
    await page.screenshot({ path: `${SHOTS}/48-schwachstellen.png` });
    for (let i = 0; i < 30 && !(await page.locator('.done').count()); i += 1) {
      await page.locator('.exbar .skip').click();
      await page.waitForTimeout(30);
    }
    const schluss = (await page.locator('.done h2').textContent()).trim();
    console.log('Abschluss:', schluss);
    check(/schwachstellen/i.test(schluss), `am Ende steht „${schluss}“`);
    await page.locator('.done .primary').click();
    await page.waitForSelector('.lesson');
  }

  // Ohne wackelige Karten darf die Karte nicht dastehen.
  await seed(page, { lang: 'de' });
  check(await page.locator('.lesson.weak').count() === 0,
    'die Schwachstellenkarte steht auch ohne Schwachstellen da');

  // Übersprungene Karten sind keine Fehler: sie behalten die Anfangs-Leichtigkeit
  // 2,5 und dürfen die Schwachstellenrunde nicht auslösen.
  const uebersprungen = {};
  for (const wort of ['toki', 'pona', 'mi', 'sina', 'moku', 'lape']) {
    uebersprungen['w:' + wort] = { reps: 0, interval: 600000, ease: 2.5, due: Date.now() + 8.64e7 };
  }
  await seed(page, { lang: 'de', done: { 1: true }, srs: uebersprungen });
  check(await page.locator('.lesson.weak').count() === 0,
    'Überspringen allein macht schon eine Schwachstelle daraus');

  // Und sie zählt als Wiederholungskarte — Prüfungen, die den Kurs meinen,
  // schließen `.review` aus und dürfen nicht versehentlich hier landen.
  await seed(page, { lang: 'de', done: { 1: true, 2: true },
                     srs: wackelig, mastery: { c_li: 0.1 } });
  check(await page.locator('.lesson.weak:not(.review)').count() === 0,
    'die Schwachstellenkarte trägt kein .review');

  // ------------------------------------------------------------ 3. Tagebuch
  await seed(page, { lang: 'de', done: { 1: true, 2: true, 3: true } });
  const tagebuch = page.locator('.card', { hasText: 'o sitelen' });
  check(await tagebuch.count() > 0, 'die Tagebuchkarte fehlt');
  await tagebuch.locator('.ghost').click();
  await page.waitForSelector('.diarytext');
  const anstoss = await page.locator('.diarynudge .question').count();
  console.log('Anstoß da:', anstoss ? 'ja' : 'nein');
  check(anstoss === 1, 'der Anstoß des Tages fehlt');

  // Falscher Satzbau wird gemeldet, aber nicht bestraft.
  await page.locator('.diarytext').fill('mi moku e');
  await page.waitForTimeout(80);
  const schlecht = await page.locator('.diarywrite .live').textContent();
  console.log('Rückmeldung schlecht:', schlecht.trim());
  check(/0\/1/.test(schlecht), `bei kaputtem Satz steht „${schlecht.trim()}“`);
  check(await page.locator('.diarywrite .live.bad').count() === 1, 'der Stolperer wird nicht markiert');

  await page.locator('.diarytext').fill('tenpo suno ni la mi pona. mi moku e kili.');
  await page.waitForTimeout(80);
  const gut = await page.locator('.diarywrite .live').textContent();
  console.log('Rückmeldung gut:', gut.trim());
  check(/2\/2/.test(gut), `bei zwei guten Sätzen steht „${gut.trim()}“`);

  const xpVorher = await page.evaluate((key) => (JSON.parse(localStorage.getItem(key)) || {}).xp || 0, KEY);
  await page.locator('.diarywrite .primary').click();
  await page.waitForSelector('.diarytext');
  const stand = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
  const heute = new Date().toISOString().slice(0, 10);
  check(Boolean(stand.diary && stand.diary[heute]), 'der Eintrag landet nicht im Speicher');
  check(stand.xp === xpVorher + 15, `Punkte: ${xpVorher} → ${stand.xp}, erwartet +15`);
  await page.screenshot({ path: `${SHOTS}/49-tagebuch.png` });

  // Zweites Sichern desselben Tages gibt keine Punkte nochmal.
  await page.locator('.diarywrite .primary').click();
  await page.waitForSelector('.diarytext');
  const nochmal = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).xp, KEY);
  check(nochmal === stand.xp, `zweites Sichern gab nochmal Punkte: ${stand.xp} → ${nochmal}`);

  // Der Text steht nach dem Neuladen wieder im Feld.
  await page.reload();
  await page.waitForSelector('.lesson');
  await page.locator('.card', { hasText: 'o sitelen' }).locator('.ghost').click();
  await page.waitForSelector('.diarytext');
  const wieder = await page.locator('.diarytext').inputValue();
  check(/tenpo suno ni la mi pona/.test(wieder), `im Feld steht „${wieder}“`);

  // Ein älterer Eintrag lässt sich röntgen.
  const gestern = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await page.evaluate(([key, tag]) => {
    const stand = JSON.parse(localStorage.getItem(key));
    stand.diary[tag] = 'jan pona li kama.';
    localStorage.setItem(key, JSON.stringify(stand));
  }, [KEY, gestern]);
  await page.reload();
  await page.waitForSelector('.lesson');
  await page.locator('.card', { hasText: 'o sitelen' }).locator('.ghost').click();
  await page.waitForSelector('.diarytext');
  const alt = page.locator('.diaryentry');
  check(await alt.count() === 1, `ältere Einträge: ${await alt.count()}, erwartet 1`);
  await alt.locator('.ghost').click();
  await page.waitForTimeout(60);
  check(await alt.locator('.xraywrap').count() === 1, 'das Satzröntgen klappt nicht auf');
  await alt.locator('.ghost').click();
  await page.waitForTimeout(60);
  check(await alt.locator('.xraywrap').count() === 0, 'das Satzröntgen klappt nicht wieder zu');

  // Zurück muss zurückführen.
  await page.locator('.diarypast').evaluate((node) => node.scrollIntoView());
  await page.locator('.exbar button').first().click();
  await page.waitForSelector('.lesson');
  check(await page.locator('.diarytext').count() === 0, 'der Rückweg führt nicht zurück');

  // Nichts darf über den Rand ragen.
  const breit = await page.evaluate(() => document.documentElement.scrollWidth
    > window.innerWidth + 1);
  check(!breit, 'die Startseite ragt seitlich heraus');

  await browser.close();
  if (errors.length) { console.log(`\n✗ ${errors.length} Problem(e)`); process.exit(1); }
  console.log('\n✓ Rundenlänge, Schwachstellen und Tagebuch tragen');
})();

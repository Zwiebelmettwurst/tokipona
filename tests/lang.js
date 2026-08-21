// Beide Sprachfassungen: Umschalten, Inhalte, Meldungen, Dauerhaftigkeit.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const SHOTS = lib.SHOTS;
const path = require('path');
const FILE = lib.FILE;

(async () => {
  const browser = await lib.launch(chromium);
  const errors = [];

  for (const [locale, expectLang] of [['de-DE', 'de'], ['en-GB', 'en']]) {
    const context = await browser.newContext({
      viewport: { width: 420, height: 900 }, colorScheme: 'dark', locale,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`[${locale}] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${locale}] ${m.text()}`); });
    await page.goto(FILE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.lesson');

    const chosen = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('o-toki-fortschritt-v1') || '{}').lang);
    const firstLesson = (await page.locator(lib.KURS + ' .body b').first().textContent()).trim();
    console.log(`${locale}: Sprache ${chosen || '(noch nicht gespeichert)'}, erste Lektion „${firstLesson}“`);
    if (expectLang === 'de' && firstLesson !== 'Einfache Sätze') errors.push(`${locale}: falsche Lektionssprache`);
    if (expectLang === 'en' && firstLesson !== 'Simple sentences') errors.push(`${locale}: falsche Lektionssprache`);
    await context.close();
  }

  // Umschalten und eine Lektion in beiden Sprachen spielen
  const context = await browser.newContext({ viewport: { width: 420, height: 900 }, colorScheme: 'dark', locale: 'de-DE' });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('Seitenfehler: ' + e.message));
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.lesson');

  const play = async (label) => {
    const seen = [];
    await page.locator('.lesson:not(.intro):not(.review)').first().click();
    await page.waitForSelector('.exbar');
    for (let i = 0; i < 30 && !(await page.locator('.done').count()); i += 1) {
      seen.push((await page.locator('.prompt').first().textContent()).trim());
      if (await page.locator('.choice').count()) await page.locator('.choice').first().click();
      else if (await page.locator('.bank .tile').count()) await page.locator('.bank .tile').first().click();
      else if (await page.locator('.pickline .tile').count()) await page.locator('.pickline .tile').first().click();
      else if (await page.locator('.typed').count()) await page.locator('.typed').fill('mi li pona');
      const go = page.locator('.actions .primary');
      if (await go.count() && !(await go.isDisabled())) await go.click();
      await page.waitForTimeout(40);
      const sheet = page.locator('.sheet');
      if (await sheet.count()) {
        if (!seen.verdict) seen.verdict = (await sheet.locator('.verdict span').last().textContent()).trim();
        await sheet.locator('.primary').click();
        await page.waitForTimeout(40);
      }
    }
    const finished = await page.locator('.done').count();
    if (!finished) errors.push(`${label}: Lektion nicht beendet`);
    else {
      const tally = (await page.locator('.tally').textContent()).replace(/\s+/g, ' ').trim();
      console.log(`${label}: durchgespielt, Urteil „${seen.verdict}“, ${tally}`);
      await page.locator('.done .primary').click();
      await page.waitForSelector('.lesson');
    }
    return seen;
  };

  const de = await play('deutsch');
  console.log('  Anweisungen:', [...new Set(de)].join(' | '));
  await page.screenshot({ path: `${SHOTS}/23-deutsch.png`, fullPage: true });

  // Umschalten
  await page.locator('.card:has(h2) .ghost', { hasText: 'English' }).click();
  await page.waitForTimeout(100);
  const heading = (await page.locator('.hello p').textContent()).trim();
  const lesson = (await page.locator('.lesson:not(.intro):not(.review) .body b').first().textContent()).trim();
  console.log(`nach dem Umschalten: „${heading.slice(0, 40)}…“, Lektion „${lesson}“`);
  if (!/Continue|Twelve/.test(heading)) errors.push('Oberfläche nicht umgeschaltet');
  await page.screenshot({ path: `${SHOTS}/24-englisch.png`, fullPage: true });

  const en = await play('english');
  console.log('  prompts:   ', [...new Set(en)].join(' | '));
  if (de.some((d) => en.includes(d))) errors.push('Anweisungen sind in beiden Sprachen gleich');

  // Parsermeldung auf Englisch
  await page.locator('.tabs button[data-tab="toki"]').click();
  await page.waitForSelector('.xray');
  await page.locator('.typed').fill('mi li moku.');
  await page.waitForTimeout(120);
  const violation = (await page.locator('.violation').first().textContent()).replace(/\s+/g, ' ').trim();
  console.log('Parser (en):', violation.slice(0, 80));
  if (!/li/.test(violation) || /entfällt/.test(violation)) errors.push('Parsermeldung nicht übersetzt');

  // Wörterbuch auf Englisch
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.word');
  const gloss = (await page.locator('.word', { hasText: 'telo' }).first().textContent()).replace(/\s+/g, ' ').trim();
  console.log('Wörterbuch (en):', gloss.slice(0, 60));
  if (/Wasser/.test(gloss)) errors.push('Wörterbuch nicht übersetzt');

  // Seitensprache und Titel folgen der Wahl
  const meta = await page.evaluate(() => ({ lang: document.documentElement.lang, title: document.title }));
  console.log(`Seite (en): lang=${meta.lang}, Titel „${meta.title}“`);
  if (meta.lang !== 'en') errors.push(`html lang bleibt ${meta.lang}`);
  if (!/learn/.test(meta.title)) errors.push(`Titel nicht übersetzt: ${meta.title}`);

  // Die neuen Bereiche sprechen auch Englisch
  await page.locator('.tabs button[data-tab="toki"]').click();
  await page.waitForSelector('.musilines');
  const everyday = (await page.locator('.card', { hasText: 'toki lon' }).textContent()).replace(/\s+/g, ' ').trim();
  console.log('Alltag (en):', everyday.slice(0, 70));
  if (!/everyday|practise/i.test(everyday)) errors.push('Alltagssätze nicht übersetzt');
  const group = (await page.locator('.musilines').first().locator('.hint').first().textContent()).trim();
  if (/wörtlich/.test(group)) errors.push('wörtliche Lesart nicht übersetzt');

  await page.locator('.tabs button[data-tab="pfad"]').click();
  await page.waitForSelector('.lipulist');
  const reading = (await page.locator('.card', { hasText: 'lipu' }).first().textContent()).replace(/\s+/g, ' ').trim();
  console.log('Lesen (en):', reading.slice(0, 70));
  if (!/reading|Tap a line/i.test(reading)) errors.push('Leseliste nicht übersetzt');
  const goal = (await page.locator('.card', { hasText: 'daily goal' }).count());
  if (!goal) errors.push('Tageszielkarte nicht übersetzt');

  // Auch der Überspringen-Knopf und die Wortkacheln
  await page.locator('.lesson:not(.intro):not(.review)').first().click();
  await page.waitForSelector('.exbar');
  const skipLabel = (await page.locator('.exbar .skip').textContent()).trim();
  if (skipLabel !== 'skip') errors.push(`Überspringen nicht übersetzt: ${skipLabel}`);
  const closeLabel = await page.locator('.exbar button:first-of-type').getAttribute('aria-label');
  if (closeLabel !== 'cancel') errors.push(`Abbrechen nicht übersetzt: ${closeLabel}`);
  for (let i = 0; i < 12 && !(await page.locator('.slot:not(.syllables)').count()); i += 1) {
    if (await page.locator('.slot.syllables').count()) {
      // Silbenaufgabe: überspringen, hier geht es ums Ziehen von Wörtern.
      await page.locator('.exbar .skip').click();
      await page.waitForTimeout(40);
      continue;
    }
    if (await page.locator('.choice').count()) await page.locator('.choice').first().click();
    else if (await page.locator('.pickline .tile').count()) await page.locator('.pickline .tile').first().click();
    else if (await page.locator('.typed').count()) await page.locator('.typed').fill('mi pona');
    const go = page.locator('.actions .primary');
    if (await go.count() && !(await go.isDisabled())) await go.click();
    await page.waitForTimeout(40);
    const sheet = page.locator('.sheet');
    if (await sheet.count()) { await sheet.locator('.primary').click(); await page.waitForTimeout(40); }
  }
  if (await page.locator('.slot:not(.syllables)').count()) {
    await page.locator('.bank .tile').first().click();
    const tileLabel = await page.locator('.slot .tile').first().getAttribute('aria-label');
    console.log('Kachel (en):', tileLabel);
    if (!/tap to remove/.test(tileLabel)) errors.push(`Kachelhilfe nicht übersetzt: ${tileLabel}`);
  }
  await page.locator('.exbar button:first-of-type').click();
  await page.waitForSelector('.lesson');

  // Überlebt das Neuladen
  await page.reload();
  await page.waitForSelector('.lesson');
  const persisted = (await page.locator('.hello p').textContent()).trim();
  if (/Weiter bei|Zwölf/.test(persisted)) errors.push('Sprachwahl überlebt das Neuladen nicht');

  await browser.close();
  if (errors.length) { errors.forEach((e) => console.log('✗ ' + e)); process.exit(1); }
  console.log('\n✓ beide Sprachen tragen');
})();

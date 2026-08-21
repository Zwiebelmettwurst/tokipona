// Spielt den Prototyp im Browser durch: erst falsch antworten, die Musterlösung
// aus der Rückmeldung lernen, beim zweiten Anlauf richtig antworten.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');

const FILE = lib.FILE;
const SHOTS = lib.SHOTS;

(async () => {
  const browser = await lib.launch(chromium);
  const errors = [];

  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 420, height: 900 }, colorScheme: scheme, locale: 'de-DE' });
    page.on('pageerror', (e) => errors.push(`[${scheme}] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${scheme}] console: ${m.text()}`); });

    await page.goto(FILE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.lesson');

    console.log(`[${scheme}] Lektionen: ${await page.locator('.lesson').count()}`
      + `, gesperrt: ${await page.locator('.lesson[data-state="locked"]').count()}`);
    await page.screenshot({ path: `${SHOTS}/1-pfad-${scheme}.png`, fullPage: true });

    await page.locator('.lesson').first().click();
    await page.waitForSelector('.exbar');

    const known = new Map();          // Frage → Musterlösung
    const attempts = new Map();       // Frage → Anzahl Versuche
    const shots = { exercise: false, sheet: false, free: false, fix: false, review: false };
    let steps = 0;

    while (steps < 80 && !(await page.locator('.done').count())) {
      steps += 1;
      if (errors.length) break;
      const type = await page.evaluate(() => (
        document.querySelector('.pickline') ? 'fix'
          : document.querySelector('.playbox') ? 'listen'
            : document.querySelector('.slot.syllables') ? 'syllable'
              : document.querySelector('.slot') ? 'build'
              : document.querySelector('.typed') ? 'free'
                : document.querySelector('.choice') ? 'choice' : 'unknown'));
      const question = type === 'fix'
        ? (await page.locator('.pickline').textContent()).trim()
        : type === 'listen'
          ? 'hören:' + (await page.locator('.choices').textContent()).trim()
          : (await page.locator('.question').textContent()).trim();
      const solution = known.get(question);

      if (type === 'fix') {
        // Reihum jedes Wort antippen, bis das richtige dabei ist.
        const tries = attempts.get(question) || 0;
        attempts.set(question, tries + 1);
        const chips = await page.locator('.pickline .tile').count();
        await page.locator('.pickline .tile').nth(tries % chips).click();
        if (!shots.fix) {
          await page.screenshot({ path: `${SHOTS}/9-fehlersuche-${scheme}.png`, fullPage: true });
          shots.fix = true;
        }
      } else if (type === 'build') {
        if (solution) {
          for (const word of solution.replace(/[.!?]/g, '').split(/\s+/)) {
            await page.locator(`.bank .tile:not(.used)[data-word="${word}"]`).first().click();
          }
        } else {
          const tiles = await page.locator('.bank .tile:not(.used)').count();
          for (let i = 0; i < Math.min(3, tiles); i += 1) {
            await page.locator('.bank .tile:not(.used)').last().click();
          }
          if (!shots.exercise) {
            await page.screenshot({ path: `${SHOTS}/2-uebung-${scheme}.png`, fullPage: true });
            shots.exercise = true;
          }
        }
      } else if (type === 'free') {
        if (!solution) {
          await page.locator('.typed').fill('mi li moku');
          await page.waitForTimeout(80);
          console.log(`[${scheme}] Live: ${(await page.locator('.live').textContent()).trim()}`);
          if (!shots.free) {
            await page.screenshot({ path: `${SHOTS}/4-frei-${scheme}.png`, fullPage: true });
            shots.free = true;
          }
        } else {
          await page.locator('.typed').fill(solution);
          await page.waitForTimeout(80);
        }
      } else if (type === 'syllable') {
        // Silben der Reihe nach durchprobieren, bis das Wort steht.
        const tries = attempts.get(question) || 0;
        attempts.set(question, tries + 1);
        const count = await page.locator('.bank .tile').count();
        for (let i = 0; i < count; i += 1) {
          await page.locator('.bank .tile:not(.used)').first().click();
        }
      } else if (type === 'listen') {
        // Höraufgabe: durchprobieren, bis die richtige Antwort dabei ist.
        const tries = attempts.get(question) || 0;
        attempts.set(question, tries + 1);
        const count = await page.locator('.choice').count();
        await page.locator('.choice').nth(tries % count).click();
      } else if (type === 'choice') {
        const options = await page.locator('.choice').allTextContents();
        const wanted = solution && options.findIndex((o) => o.trim() === solution.trim());
        await page.locator('.choice').nth(wanted > 0 ? wanted : (options.length - 1)).click();
      }

      const check = page.locator('.actions .primary');
      if (await check.count() && !(await check.isDisabled())) await check.click();
      await page.waitForTimeout(60);

      const sheet = page.locator('.sheet');
      if (await sheet.count()) {
        const good = await sheet.locator('.verdict.good').count();
        if (!good) {
          const shown = await sheet.locator('.solution').count()
            ? (await sheet.locator('.solution').first().textContent()).trim()
            : null;
          if (shown) known.set(question, shown.includes('—') ? shown.split('—')[1].trim() : shown);
        }
        if (!shots.sheet && !good) {
          await page.screenshot({ path: `${SHOTS}/3-rueckmeldung-${scheme}.png`, fullPage: true });
          shots.sheet = true;
        }
        await sheet.locator('.primary').click();
        await page.waitForTimeout(60);
      }
    }

    if (await page.locator('.done').count()) {
      const tally = (await page.locator('.tally').textContent()).replace(/\s+/g, ' ').trim();
      console.log(`[${scheme}] Abschluss nach ${steps} Schritten — ${tally}`);
      await page.screenshot({ path: `${SHOTS}/5-abschluss-${scheme}.png`, fullPage: true });
      await page.locator('.done .primary').click();
      await page.waitForSelector('.lesson');
      console.log(`[${scheme}] danach: ${await page.locator('.lesson[data-state="done"]').count()} erledigt, `
        + `${await page.locator('.lesson[data-state="locked"]').count()} gesperrt, `
        + `XP-Anzeige „${(await page.locator('.metric.gold').textContent()).trim()}“`);
      await page.screenshot({ path: `${SHOTS}/6-fortschritt-${scheme}.png`, fullPage: true });
    } else {
      errors.push(`[${scheme}] Lektion nach ${steps} Schritten nicht abgeschlossen`);
      await page.screenshot({ path: `${SHOTS}/x-haenger-${scheme}.png`, fullPage: true });
      await page.close();
      continue;
    }

    // Zeitsprung: alle Karten fällig stellen und die Wiederholung durchspielen
    await page.evaluate(() => {
      const key = 'o-toki-fortschritt-v1';
      const stored = JSON.parse(localStorage.getItem(key));
      Object.keys(stored.srs).forEach((k) => { stored.srs[k].due = Date.now() - 1000; });
      localStorage.setItem(key, JSON.stringify(stored));
    });
    await page.reload();
    await page.waitForSelector('.lesson');
    const reviewCard = page.locator('.lesson.review');
    if (!(await reviewCard.count())) {
      errors.push(`[${scheme}] keine Wiederholungskarte trotz fälliger Karten`);
    } else {
      console.log(`[${scheme}] Wiederholung: ${(await reviewCard.textContent()).replace(/\s+/g, ' ').trim()}`);
      await page.screenshot({ path: `${SHOTS}/10-faellig-${scheme}.png`, fullPage: true });
      await reviewCard.click();
      await page.waitForSelector('.exbar');
      let rounds = 0;
      while (rounds < 60 && !(await page.locator('.done').count())) {
        rounds += 1;
        if (errors.length) break;
        const kind = await page.evaluate(() => (
          document.querySelector('.pickline') ? 'fix'
            : document.querySelector('.playbox') ? 'listen'
              : document.querySelector('.slot') ? 'build'
                : document.querySelector('.typed') ? 'typed'
                  : document.querySelector('.choice') ? 'choice' : 'unknown'));
        if (kind === 'build') {
          const tiles = await page.locator('.bank .tile:not(.used)').count();
          for (let i = 0; i < Math.min(2, tiles); i += 1) {
            await page.locator('.bank .tile:not(.used)').first().click();
          }
        } else if (kind === 'choice') {
          await page.locator('.choice').first().click();
        } else if (kind === 'fix') {
          await page.locator('.pickline .tile').first().click();
        } else if (kind === 'listen') {
          await page.locator('.choice').first().click();
        } else if (kind === 'typed') {
          // Offene Frage: eine gültige Antwort, die nicht auf jede Frage passt
          // — falsch geraten ist hier kein Fehler, die Karte kommt wieder.
          await page.locator('.typed').fill('tenpo ni la mi moku e kili.');
          await page.waitForTimeout(60);
        }
        const go = page.locator('.actions .primary');
        if (await go.count() && !(await go.isDisabled())) await go.click();
        await page.waitForTimeout(50);
        const sheet2 = page.locator('.sheet');
        if (await sheet2.count()) { await sheet2.locator('.primary').click(); await page.waitForTimeout(50); }
      }
      if (await page.locator('.done').count()) {
        console.log(`[${scheme}] Wiederholung abgeschlossen nach ${rounds} Schritten`);
        await page.locator('.done .primary').click();
        await page.waitForSelector('.lesson');
      } else {
        errors.push(`[${scheme}] Wiederholung nicht abgeschlossen`);
      }
    }

    await page.locator('.tabs button[data-tab="toki"]').click();
    await page.waitForSelector('.xray');
    await page.locator('.typed').fill('jan pi pona li lape.');
    await page.waitForTimeout(80);
    console.log(`[${scheme}] Sandkasten: `
      + (await page.locator('.violation').first().textContent()).replace(/\s+/g, ' ').trim().slice(0, 80));
    await page.screenshot({ path: `${SHOTS}/7-sandkasten-${scheme}.png`, fullPage: true });

    await page.locator('.tabs button[data-tab="nimi"]').click();
    await page.waitForSelector('.word');
    await page.locator('.search').fill('wasser');
    await page.waitForTimeout(80);
    console.log(`[${scheme}] Suche „wasser“: ${await page.locator('.word').count()} Treffer`);
    await page.screenshot({ path: `${SHOTS}/8-nimi-${scheme}.png`, fullPage: true });

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) errors.push(`[${scheme}] Seite scrollt waagerecht`);

    // Fortschritt muss einen Neustart überleben
    await page.reload();
    await page.waitForSelector('.lesson');
    const persisted = await page.locator('.lesson[data-state="done"]').count();
    if (!persisted) errors.push(`[${scheme}] Fortschritt geht beim Neuladen verloren`);
    else console.log(`[${scheme}] nach Neuladen: ${persisted} Lektion(en) weiterhin erledigt`);

    await page.close();
  }

  await browser.close();
  if (errors.length) {
    console.log('\n✗ ' + errors.length + ' Problem(e):');
    errors.forEach((e) => console.log('  ' + e));
    process.exit(1);
  }
  console.log('\n✓ Durchlauf ohne Fehler');
})();

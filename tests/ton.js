// Aussprache: Hörknöpfe, Höraufgabe, Stimmenwahl — und ein Gerät ganz ohne
// Sprachausgabe darf nicht stolpern.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');

const FILE = lib.FILE;
const SHOTS = lib.SHOTS;

const errors = [];
const check = (condition, message) => { if (!condition) { errors.push(message); console.log('  ✗ ' + message); } };

// Sprachausgabe nachstellen: merkt sich, was gesprochen werden sollte.
const FAKE = `
  window.__gesprochen = [];
  window.__abgespielt = [];
  window.HTMLMediaElement.prototype.play = function () { window.__abgespielt.push(this.src); return Promise.resolve(); };
  const stimmen = [
    { name: 'Deutsch', lang: 'de-DE' },
    { name: 'Italiano', lang: 'it-IT' },
    { name: 'Español', lang: 'es-ES' },
  ];
  // window.speechSynthesis ist ein Nur-Lese-Zugriff — daher defineProperty.
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: function (text) { this.text = text; },
  });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => stimmen,
      cancel: () => {},
      speak: (u) => {
        window.__gesprochen.push({ text: u.text, lang: u.lang, voice: u.voice && u.voice.name, rate: u.rate });
        // Wie eine echte Stimme: erst anfangen, dann aufhören.
        if (u.onstart) u.onstart();
        if (u.onend) setTimeout(() => u.onend(), 10);
      },
      addEventListener: () => {},
    },
  });
`;

const spoken = (page) => page.evaluate(() => window.__gesprochen.slice());

(async () => {
  const browser = await lib.launch(chromium);

  // ---------- Gerät mit Sprachausgabe
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });
  await page.addInitScript(FAKE);
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.lesson');

  // Einstellungskarte samt Hörprobe
  const soundCard = page.locator('.card', { hasText: 'aussprache' });
  check(Boolean(await soundCard.count()), 'keine Aussprache-Karte');
  await soundCard.locator('.say').click();
  let heard = await spoken(page);
  console.log(`Hörprobe: „${heard[0] && heard[0].text}“ mit Stimme ${heard[0] && heard[0].voice}`
    + ` (${heard[0] && heard[0].lang}), Tempo ${heard[0] && heard[0].rate}`);
  check(heard.length === 1, 'Hörprobe spricht nicht');
  check(heard[0] && heard[0].voice === 'Italiano',
    `italienische Stimme wird nicht bevorzugt: ${heard[0] && heard[0].voice}`);
  check(heard[0] && !/[.!?]/.test(heard[0].text),
    `Satzzeichen werden mitgesprochen: ${heard[0] && heard[0].text}`);
  await page.screenshot({ path: `${SHOTS}/20-aussprache.png`, fullPage: true });

  // Wörterliste: jeder Eintrag hat einen Hörknopf
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.word');
  const words = await page.locator('.word').count();
  const buttons = await page.locator('.word .say').count();
  console.log(`Wörterliste: ${buttons}/${words} Einträge mit Hörknopf`);
  check(buttons === words, 'nicht jeder Worteintrag lässt sich anhören');
  // Einzelne Wörter kommen als echte Aufnahme, nicht aus der Gerätestimme.
  await page.evaluate(() => { window.__gesprochen.length = 0; window.__abgespielt.length = 0; });
  await page.locator('.word .say').first().click();
  await page.waitForTimeout(60);
  const firstWord = (await page.locator('.word b').first().textContent()).trim();
  const spielte = await page.evaluate(() => window.__abgespielt.slice());
  heard = await spoken(page);
  console.log(`Wort „${firstWord}“ → ${spielte[0] ? spielte[0].split('/').pop() : '(Stimme)'}`);
  check(spielte.length === 1 && new RegExp(`/kalama/(kalaasi|jlakuse)/${firstWord}\\.mp3$`).test(spielte[0]),
    `falsche Aufnahme: ${JSON.stringify(spielte)} für ${firstWord}`);
  check(heard.length === 0, 'die Gerätestimme spricht zusätzlich');

  // Höraufgabe: kommt vor und lässt sich lösen
  await page.locator('.tabs button[data-tab="pfad"]').click();
  await page.waitForSelector('.lesson');
  await page.locator('.lesson:not(.intro):not(.review)').first().click();
  await page.waitForSelector('.exbar');
  let sawListen = false;
  let heardSolution = false;
  let steps = 0;
  while (steps < 40 && !(await page.locator('.done').count())) {
    steps += 1;
    if (errors.length) break;
    if (await page.locator('.playbox').count()) {
      sawListen = true;
      // Der Satz darf nicht zu sehen sein — sonst ist es keine Höraufgabe.
      const visible = await page.evaluate(() =>
        Boolean(document.querySelector('.screen .question')));
      check(!visible, 'die Höraufgabe zeigt den Satz im Klartext');
      await page.evaluate(() => { window.__gesprochen.length = 0; });
      await page.locator('.playbox .play').click();
      const played = await spoken(page);
      check(played.length === 1, 'der große Knopf spielt nichts ab');
      console.log(`Höraufgabe: „${played[0] && played[0].text}“`);
      await page.screenshot({ path: `${SHOTS}/21-hoeraufgabe.png` });
      await page.locator('.choice').first().click();
    } else if (await page.locator('.pickline .tile').count()) {
      await page.locator('.pickline .tile').first().click();
    } else if (await page.locator('.slot').count()) {
      const tiles = await page.locator('.bank .tile:not(.used)').count();
      for (let i = 0; i < Math.min(2, tiles); i += 1) {
        await page.locator('.bank .tile:not(.used)').first().click();
      }
    } else if (await page.locator('.choice').count()) {
      await page.locator('.choice').first().click();
    } else if (await page.locator('.typed').count()) {
      await page.locator('.typed').fill('mi pona');
    }
    const go = page.locator('.actions .primary');
    if (await go.count() && !(await go.isDisabled())) await go.click();
    await page.waitForTimeout(40);
    const sheet = page.locator('.sheet');
    if (await sheet.count()) {
      // Die Musterlösung im Rückmeldeblatt lässt sich anhören
      if (await sheet.locator('.say').count() && !heardSolution) {
        await page.evaluate(() => { window.__gesprochen.length = 0; window.__abgespielt.length = 0; });
        await sheet.locator('.say').first().click();
        await page.waitForTimeout(60);
        const said = await spoken(page);
        const files = await page.evaluate(() => window.__abgespielt.slice());
        // Ein einzelnes Wort kommt als Aufnahme, ein Satz aus der Stimme —
        // aber nie die deutsche Lesart daneben.
        const german = said.find((entry) => /[—,äöüßA-Z]/.test(entry.text));
        check(!german, `deutsche Lesart wird vorgelesen: ${german && german.text}`);
        check(said.length + files.length > 0, 'die Musterlösung gibt keinen Ton');
        if (said.length || files.length) {
          console.log('Musterlösung anhören: '
            + (files.length ? files[0].split('/').pop() : `„${said[0].text}“`));
          heardSolution = true;
        }
      }
      await sheet.locator('.primary').click();
      await page.waitForTimeout(40);
    }
  }
  check(sawListen, `in ${steps} Schritten kam keine Höraufgabe`);
  check(heardSolution, 'die Musterlösung ließ sich nie anhören');

  // Ganzen Text vorlesen
  await page.goto(FILE);
  await page.evaluate(() => localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    done: { 1: true, 2: true, 3: true }, lang: 'de', sound: true,
  })));
  await page.reload();
  await page.waitForSelector('.lipulist');
  await page.locator('.lipurow[data-state="open"]').first().click();
  await page.waitForSelector('.lipulines');
  const textLines = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.lipuline .glossline'))
      .map((node) => node.textContent.replace(/[.!?]/g, ' ').replace(/\s+/g, ' ').trim()));
  await page.evaluate(() => { window.__gesprochen.length = 0; });
  await page.locator('.sayall').click();
  await page.waitForTimeout(120);
  const readAloud = (await spoken(page)).map((entry) => entry.text);
  console.log(`Vorlesen: ${readAloud.length} Sätze, erster „${readAloud[0]}“`);
  check(readAloud.length === textLines.length,
    `${readAloud.length} statt ${textLines.length} Sätzen vorgelesen`);
  check(JSON.stringify(readAloud) === JSON.stringify(textLines),
    `Reihenfolge stimmt nicht:\n  ${readAloud.join(' | ')}\n  ${textLines.join(' | ')}`);
  const label = await page.locator('.sayall').textContent();
  check(/vorlesen/i.test(label), `Knopf bleibt auf „still“ stehen: ${label}`);

  // Abschalten muss alle Knöpfe verschwinden lassen
  await page.evaluate(() => { window.location.reload(); });
  await page.waitForSelector('.lesson');
  await page.locator('.card', { hasText: 'aussprache' }).locator('.ghost').click();
  await page.waitForTimeout(60);
  const left = await page.locator('.say').count();
  check(left === 0, `nach dem Abschalten sind noch ${left} Hörknöpfe da`);
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.word');
  check((await page.locator('.say').count()) === 0, 'Wörterliste behält Hörknöpfe trotz Abschalten');
  await page.close();

  // ---------- Gerät ohne Sprachausgabe
  const bare = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  bare.on('pageerror', (e) => { errors.push('ohne Ton — Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });
  await bare.addInitScript(`
    try { delete window.speechSynthesis; } catch (e) {}
    try { delete window.SpeechSynthesisUtterance; } catch (e) {}
    Object.defineProperty(window, 'speechSynthesis', { get: () => undefined, configurable: true });
  `);
  await bare.goto(FILE);
  await bare.waitForSelector('.lesson');
  check((await bare.locator('.say').count()) === 0, 'Hörknöpfe ohne Sprachausgabe');
  const note = await bare.locator('.card', { hasText: 'aussprache' }).textContent();
  check(/keine Sprachausgabe/i.test(note), `kein Hinweis auf fehlende Sprachausgabe: ${note.slice(0, 80)}`);
  await bare.locator('.lesson:not(.intro):not(.review)').first().click();
  await bare.waitForSelector('.exbar');
  check((await bare.locator('.playbox').count()) === 0, 'Höraufgabe ohne Sprachausgabe');
  console.log('Ohne Sprachausgabe: keine Knöpfe, keine Höraufgabe, kein Fehler');

  await browser.close();
  if (errors.length) {
    console.log('\n✗ ' + errors.length + ' Problem(e)');
    process.exit(1);
  }
  console.log('\n✓ Aussprache in Ordnung');
})();

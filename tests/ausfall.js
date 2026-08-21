// Was passiert, wenn der Ton nicht kommt? Der Hörknopf darf nie stumm
// danebenstehen: misslingt die Aufnahme, übernimmt die Gerätestimme, und
// geht auch die nicht, sagt die App es.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const SHOTS = lib.SHOTS;
const FILE = lib.FILE;

const errors = [];
const check = (ok, message) => { if (!ok) { errors.push(message); console.log('  ✗ ' + message); } };

// Sprachausgabe nachstellen. `modus` entscheidet, wie sich das Abspielen
// einer Datei verhält: heil, verweigert (das Versprechen scheitert) oder
// kaputt (die Datei meldet einen Fehler).
const fake = (modus) => `
  window.__gesprochen = [];
  window.__abgespielt = [];
  window.HTMLMediaElement.prototype.play = function () {
    window.__abgespielt.push(this.src);
    const modus = '${modus}';
    if (modus === 'verweigert') return Promise.reject(new Error('NotAllowedError'));
    if (modus === 'kaputt') {
      setTimeout(() => { if (this.onerror) this.onerror(new Event('error')); }, 5);
      return Promise.resolve();
    }
    setTimeout(() => { if (this.onended) this.onended(new Event('ended')); }, 5);
    return Promise.resolve();
  };
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: function (text) { this.text = text; },
  });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      speaking: false, pending: false,
      getVoices: () => [{ name: 'Italiano', lang: 'it-IT' }],
      cancel: () => {},
      speak: (u) => {
        if (window.__stumm) throw new Error('geht nicht');
        window.__gesprochen.push(u.text);
        if (u.onend) setTimeout(() => u.onend(), 10);
      },
      addEventListener: () => {},
    },
  });
`;

// Öffnet die Wörterliste und tippt den ersten Hörknopf an.
async function tippen(browser, modus, stand) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });
  await page.addInitScript(fake(modus));
  await page.goto(FILE);
  await page.evaluate((value) => localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify(value)),
    Object.assign({ lang: 'de' }, stand));
  await page.reload();
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.word .say');
  const knopf = page.locator('.word .say').first();
  await knopf.click();
  await page.waitForTimeout(200);
  const ergebnis = await page.evaluate(() => ({
    dateien: window.__abgespielt.slice(),
    stimme: window.__gesprochen.slice(),
  }));
  const busy = await knopf.getAttribute('data-busy');
  await page.close();
  return Object.assign(ergebnis, { busy });
}

(async () => {
  const browser = await lib.launch(chromium);

  // 1. Heiler Fall: die Datei spielt, die Gerätestimme hält still.
  const heil = await tippen(browser, 'heil');
  console.log('heil       →', heil.dateien.length, 'Datei(en),', heil.stimme.length, 'Mal Stimme');
  check(heil.dateien.length === 1, 'die Aufnahme wird nicht abgespielt');
  check(heil.stimme.length === 0, 'die Gerätestimme redet zusätzlich');
  check(heil.busy === 'false', `der Knopf bleibt nach dem Abspielen angefasst (${heil.busy})`);

  // 2. Das Abspielen wird verweigert — genau das passiert, wenn ein Gerät
  //    Ton nur nach einer Berührung erlaubt oder die Datei nicht mag.
  const verweigert = await tippen(browser, 'verweigert');
  console.log('verweigert →', verweigert.dateien.length, 'Datei(en),',
    verweigert.stimme.length, 'Mal Stimme:', JSON.stringify(verweigert.stimme));
  check(verweigert.dateien.length === 1, 'es wird gar nicht erst versucht');
  check(verweigert.stimme.length === 1, 'die Gerätestimme springt nicht ein');
  check(verweigert.busy === 'false', 'der Knopf hängt nach dem Fehlschlag fest');

  // 3. Die Datei fehlt oder lässt sich nicht lesen.
  const kaputt = await tippen(browser, 'kaputt');
  console.log('kaputt     →', kaputt.dateien.length, 'Datei(en),',
    kaputt.stimme.length, 'Mal Stimme:', JSON.stringify(kaputt.stimme));
  check(kaputt.stimme.length === 1, 'bei kaputter Datei springt die Gerätestimme nicht ein');
  check(kaputt.busy === 'false', 'der Knopf hängt nach der kaputten Datei fest');

  // 4. Gerätestimme gewählt: die Dateien werden gar nicht angefasst.
  const ilo = await tippen(browser, 'heil', { voice: 'ilo' });
  console.log('ilo        →', ilo.dateien.length, 'Datei(en),', ilo.stimme.length, 'Mal Stimme');
  check(ilo.dateien.length === 0, 'trotz Gerätestimme wird eine Datei abgespielt');
  check(ilo.stimme.length === 1, 'die Gerätestimme spricht nicht');

  // Die Wahl steht in der kalama-Karte und überlebt das Neuladen.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); });
  await page.addInitScript(fake('heil'));
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.voicepick');
  const chips = page.locator('.voicepick .ghost');
  const namen = (await chips.allTextContents()).map((s) => s.trim());
  console.log('Stimmen:', namen.join(' · '));
  check(namen.length === 4, `${namen.length} Stimmen statt vier`);
  check(namen.includes('Gerätestimme'), 'die Gerätestimme fehlt in der Auswahl');
  await chips.last().click();
  await page.waitForTimeout(80);
  await page.reload();
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.voicepick');
  const gemerkt = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('o-toki-fortschritt-v1')).voice);
  check(gemerkt === 'ilo', `nach dem Neuladen steht „${gemerkt}“ im Speicher`);

  // Der Hinweis auf den Stummschalter steht in der Aussprache-Karte.
  await page.locator('.tabs button[data-tab="pfad"]').click();
  await page.waitForSelector('.lesson');
  const hinweis = await page.locator('.card', { hasText: 'aussprache' }).textContent();
  check(/Stummschalter/.test(hinweis), 'kein Hinweis auf den Stummschalter');
  await page.evaluate(() => document.querySelector('.card .say').scrollIntoView());
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}/54-ton-ausweg.png` });

  // 5. Geht gar nichts, sagt die App es — statt still zu bleiben.
  await page.evaluate(() => { window.__stumm = true; });
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.word .say');
  await page.locator('.word .say').first().click();
  await page.waitForTimeout(200);
  const meldung = await page.locator('.toast').count()
    ? (await page.locator('.toast').textContent()).trim() : '';
  console.log('stumm      → Meldung:', meldung || '(keine)');
  check(/kein Ton/i.test(meldung), `keine Meldung, wenn nichts geht: „${meldung}“`);

  await browser.close();
  if (errors.length) { console.log(`\n✗ ${errors.length} Problem(e)`); process.exit(1); }
  console.log('\n✓ der Hörknopf bleibt nie stumm ohne Erklärung');
})();

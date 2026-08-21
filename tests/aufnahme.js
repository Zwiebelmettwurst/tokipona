// Eigene Aufnahmen: aufnehmen, behalten, statt der Gerätestimme abspielen.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const http = require('http');
const fs = require('fs');
const path = require('path');
const DOCS = lib.DOCS;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png',
                '.webmanifest': 'application/manifest+json' };
const errors = [];
const check = (c, m) => { if (!c) { errors.push(m); console.log('  ✗ ' + m); } };

const server = http.createServer((request, response) => {
  const name = decodeURIComponent(request.url.split('?')[0]);
  const file = path.join(DOCS, name === '/' ? 'index.html' : name);
  if (!file.startsWith(DOCS) || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});

(async () => {
  await new Promise((r) => server.listen(8096, r));
  const browser = await lib.launch(chromium, {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    locale: 'de-DE', permissions: ['microphone'] });
  const page = await context.newPage();
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });
  // Gerätestimme mitschreiben, damit sich beides unterscheiden lässt
  await page.addInitScript(`
    window.__gesprochen = [];
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true,
      value: function (t) { this.text = t; } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [{ name: 'it', lang: 'it-IT' }], cancel: () => {},
      speak: (u) => window.__gesprochen.push(u.text), addEventListener: () => {} } });
    window.__abgespielt = [];
    const realPlay = window.HTMLMediaElement.prototype.play;
    window.HTMLMediaElement.prototype.play = function () { window.__abgespielt.push(this.src); return Promise.resolve(); };
  `);

  await page.goto('http://localhost:8096/prototype.html');
  await page.waitForSelector('.lesson');
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.word');

  const before = await page.locator('.word .rec').count();
  console.log(`Aufnahmeknöpfe: ${before}`);
  check(before === 137, `${before} Knöpfe statt 137`);
  check(Boolean(await page.locator('.card', { hasText: 'eigene aufnahmen' }).count()), 'keine Aufnahmekarte');

  // Erstes Wort aufnehmen
  await page.locator('.search').fill('mi');
  await page.waitForTimeout(60);
  const row = page.locator('.word', { hasText: 'ich, wir' }).first();
  await row.locator('.rec').click();
  await page.waitForTimeout(250);
  const busy = await row.locator('.rec').getAttribute('data-busy');
  console.log('während der Aufnahme:', busy);
  check(busy === 'true', 'der Knopf zeigt die laufende Aufnahme nicht');
  await page.waitForTimeout(3200);
  const has = await row.locator('.rec').getAttribute('data-has');
  console.log('nach der Aufnahme:', has);
  check(has === 'true', 'die Aufnahme wurde nicht behalten');

  // ♪ spielt jetzt die eigene Aufnahme statt der Gerätestimme
  await page.evaluate(() => { window.__gesprochen.length = 0; window.__abgespielt.length = 0; });
  await row.locator('.say').click();
  await page.waitForTimeout(120);
  const played = await page.evaluate(() => ({ eigen: window.__abgespielt.length, stimme: window.__gesprochen.length }));
  console.log('Wiedergabe:', JSON.stringify(played));
  check(played.eigen === 1, 'die eigene Aufnahme wird nicht abgespielt');
  check(played.stimme === 0, 'die Gerätestimme spricht trotzdem');

  // Ein Wort ohne Aufnahme nimmt weiter die Gerätestimme
  await page.locator('.search').fill('soweli');
  await page.waitForTimeout(60);
  await page.evaluate(() => { window.__gesprochen.length = 0; window.__abgespielt.length = 0; });
  await page.locator('.word .say').first().click();
  await page.waitForTimeout(120);
  // Ohne eigene Aufnahme greift die mitgelieferte — nicht die Gerätestimme.
  const fallback = await page.evaluate(() => ({ quelle: window.__abgespielt.slice(), stimme: window.__gesprochen.length }));
  check(fallback.quelle.length === 1 && /\/kalama\/(kalaasi|jlakuse)\/soweli\.mp3$/.test(fallback.quelle[0]),
    `Rückfall führt nicht zur mitgelieferten Aufnahme: ${JSON.stringify(fallback)}`);
  check(fallback.stimme === 0, 'die Gerätestimme spricht trotzdem');

  // Überlebt das Neuladen
  await page.reload();
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.word');
  await page.waitForTimeout(400);
  const kept = await page.locator('.word .rec[data-has="true"]').count();
  console.log('nach dem Neuladen behalten:', kept);
  check(kept === 1, `${kept} Aufnahmen nach dem Neuladen`);
  const tally = (await page.locator('.card', { hasText: 'eigene aufnahmen' }).textContent()).replace(/\s+/g, ' ');
  check(/1 eigene Aufnahme/.test(tally), `Zähler: ${tally}`);

  // Löschen
  await page.locator('.card', { hasText: 'eigene aufnahmen' }).locator('.ghost').click();
  await page.waitForTimeout(300);
  check((await page.locator('.word .rec[data-has="true"]').count()) === 0, 'Löschen wirkt nicht');

  await browser.close();
  server.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ eigene Aufnahmen tragen');
})();

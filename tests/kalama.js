// Echte Aufnahmen: kommen sie, wo sie sollen — und weichen sie der eigenen Stimme?
const { chromium } = require('playwright');
const lib = require('./lib.js');
const http = require('http');
const fs = require('fs');
const path = require('path');
const DOCS = lib.DOCS;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png',
                '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
const errors = [];
const check = (c, m) => { if (!c) { errors.push(m); console.log('  ✗ ' + m); } };

const holt = [];
const server = http.createServer((request, response) => {
  const name = decodeURIComponent(request.url.split('?')[0]);
  const file = path.join(DOCS, name === '/' ? 'index.html' : name);
  if (name.includes('/kalama/')) holt.push(name);
  if (!file.startsWith(DOCS) || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});

(async () => {
  await new Promise((r) => server.listen(8095, r));
  const browser = await lib.launch(chromium, {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    locale: 'de-DE', permissions: ['microphone'] });
  const page = await context.newPage();
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });
  await page.addInitScript(`
    window.__gesprochen = []; window.__abgespielt = [];
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true,
      value: function (t) { this.text = t; } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [{ name: 'it', lang: 'it-IT' }], cancel: () => {},
      speak: (u) => window.__gesprochen.push(u.text), addEventListener: () => {} } });
    window.HTMLMediaElement.prototype.play = function () { window.__abgespielt.push(this.src); return Promise.resolve(); };
  `);

  await page.goto('http://localhost:8095/prototype.html');
  await page.waitForSelector('.lesson');
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.word');

  // Ein einzelnes Wort nimmt die echte Aufnahme, nicht die Gerätestimme
  await page.locator('.search').fill('soweli');
  await page.waitForTimeout(80);
  await page.evaluate(() => { window.__gesprochen.length = 0; window.__abgespielt.length = 0; });
  await page.locator('.word .say').first().click();
  await page.waitForTimeout(150);
  const played = await page.evaluate(() => ({ ton: window.__abgespielt.slice(), stimme: window.__gesprochen.slice() }));
  console.log('Wort „soweli“ →', JSON.stringify(played));
  check(played.ton.length === 1 && /kalama\/kalaasi\/soweli\.mp3$/.test(played.ton[0]),
    `keine echte Aufnahme: ${JSON.stringify(played)}`);
  check(played.stimme.length === 0, 'die Gerätestimme spricht trotzdem');

  // Ein ganzer Satz bleibt bei der Gerätestimme
  await page.locator('.tabs button[data-tab="musi"]').click();
  await page.waitForSelector('.musiline');
  await page.evaluate(() => { window.__gesprochen.length = 0; window.__abgespielt.length = 0; });
  await page.locator('.musiline .say').first().click();
  await page.waitForTimeout(150);
  const sentence = await page.evaluate(() => ({ ton: window.__abgespielt.length, stimme: window.__gesprochen.slice() }));
  console.log('Satz →', JSON.stringify(sentence));
  check(sentence.stimme.length === 1 && sentence.ton === 0, `Satz falsch abgespielt: ${JSON.stringify(sentence)}`);

  // Alle 137 Dateien sind erreichbar und klingen nach mp3
  const alle = await page.evaluate(async () => {
    const words = Object.keys(TokiPona.lexicon);
    const bad = [];
    let bytes = 0;
    for (const word of words) {
      const res = await fetch(`./kalama/kalaasi/${word}.mp3`);
      if (!res.ok) { bad.push(word + ':' + res.status); continue; }
      const buf = new Uint8Array(await res.arrayBuffer());
      bytes += buf.length;
      const kopf = String.fromCharCode(buf[0], buf[1], buf[2]);
      if (!(kopf === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0))) bad.push(word + ':kein mp3');
    }
    return { anzahl: words.length, fehlend: bad, kb: Math.round(bytes / 1024) };
  });
  console.log(`Dateien: ${alle.anzahl - alle.fehlend.length}/${alle.anzahl} in Ordnung, ${alle.kb} KB`);
  check(alle.fehlend.length === 0, `fehlend oder kaputt: ${alle.fehlend.slice(0, 5).join(', ')}`);

  // Zweite Stimme: umschalten wirkt sofort
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.voicepick');
  await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.card'))
      .find((c) => /kalama — gesprochene/.test(c.querySelector('h2').textContent));
    Array.from(card.querySelectorAll('.voicepick .ghost'))
      .find((b) => /Lakuse/.test(b.textContent)).click();
  });
  await page.waitForTimeout(120);
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.word');
  await page.locator('.search').fill('soweli');
  await page.waitForTimeout(80);
  await page.evaluate(() => { window.__abgespielt.length = 0; });
  await page.locator('.word .say').first().click();
  await page.waitForTimeout(120);
  const zweite = await page.evaluate(() => window.__abgespielt.slice());
  console.log('zweite Stimme →', zweite[0] && zweite[0].split('/').slice(-2).join('/'));
  check(zweite.length === 1 && /jlakuse\/soweli\.mp3$/.test(zweite[0]),
    `Stimmenwechsel greift nicht: ${JSON.stringify(zweite)}`);

  // Auch die zweite Stimme ist vollständig da
  const zweiteAlle = await page.evaluate(async () => {
    const words = Object.keys(TokiPona.lexicon);
    const bad = [];
    for (const word of words) {
      const res = await fetch(`./kalama/jlakuse/${word}.mp3`);
      if (!res.ok) bad.push(word);
    }
    return bad;
  });
  check(zweiteAlle.length === 0, `jan Lakuse fehlt: ${zweiteAlle.slice(0, 5).join(', ')}`);
  console.log(`jan Lakuse: 137/137 erreichbar`);

  // Wahl überlebt das Neuladen, dann zurück auf kala Asi
  await page.reload();
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.word');
  const gemerkt = await page.evaluate(() => JSON.parse(localStorage.getItem('o-toki-fortschritt-v1')).voice);
  check(gemerkt === 'jlakuse', `Stimme nach Neuladen: ${gemerkt}`);
  await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.card'))
      .find((c) => /kalama — gesprochene/.test(c.querySelector('h2').textContent));
    Array.from(card.querySelectorAll('.voicepick .ghost'))
      .find((b) => /kala Asi/.test(b.textContent)).click();
  });
  await page.waitForTimeout(100);

  // Die eigene Aufnahme schlägt die mitgelieferte
  await page.locator('.tabs button[data-tab="nimi"]').click();
  await page.waitForSelector('.word');
  await page.locator('.search').fill('soweli');
  await page.waitForTimeout(60);
  await page.locator('.word .rec').first().click();
  await page.waitForTimeout(3300);
  await page.evaluate(() => { window.__abgespielt.length = 0; });
  await page.locator('.word .say').first().click();
  await page.waitForTimeout(150);
  const own = await page.evaluate(() => window.__abgespielt.slice());
  console.log('nach eigener Aufnahme →', own[0] && own[0].slice(0, 24));
  check(own.length === 1 && own[0].startsWith('blob:'), `eigene Aufnahme greift nicht: ${own}`);

  // Herkunft steht in der App
  const credit = await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.card'))
      .find((c) => /kalama — gesprochene/.test(c.querySelector('h2') ? c.querySelector('h2').textContent : ''));
    return card ? card.textContent : '';
  });
  console.log('Karte:', credit.replace(/\s+/g, ' ').slice(0, 120));
  check(/kala Asi/.test(credit), 'die Sprecherin wird nicht genannt');
  check(/CC BY-SA/.test(credit), 'die Lizenz wird nicht genannt');

  await browser.close();
  server.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ echte Aufnahmen an Bord');
})();

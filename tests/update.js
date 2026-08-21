// Prüft, dass eine neue Fassung schnell ankommt: ohne laufende Übung sofort,
// mitten in einer Übung erst nach Antippen des Streifens.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SRC = lib.DOCS;
// Die Veröffentlichung wird in einer Wegwerf-Kopie nachgestellt, damit das
// Depot unberührt bleibt.
const WORK = path.join(os.tmpdir(), 'o-toki-served');
const SHOTS = lib.SHOTS;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png',
                '.webmanifest': 'application/manifest+json', '.css': 'text/css' };

fs.rmSync(WORK, { recursive: true, force: true });
fs.cpSync(SRC, WORK, { recursive: true });

const server = http.createServer((request, response) => {
  const name = decodeURIComponent(request.url.split('?')[0]);
  const file = path.join(WORK, name === '/' ? 'index.html' : name);
  if (!file.startsWith(WORK) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404); response.end('nicht gefunden'); return;
  }
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});

// Stellt eine neue Veröffentlichung nach: Seite und Service Worker ändern sich.
function publish(version) {
  for (const name of ['prototype.html', 'sw.js']) {
    const file = path.join(WORK, name);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8')
      .replace(/OTOKI_VERSION = '[^']*'/, `OTOKI_VERSION = '${version}'`)
      .replace(/const VERSION = '[^']*'/, `const VERSION = '${version}'`));
  }
}

const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

(async () => {
  await new Promise((resolve) => server.listen(8098, resolve));
  const browser = await lib.launch(chromium);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('Seitenfehler: ' + e.message));
  // Zählt Seitenaufrufe: eine neue Fassung darf genau einmal neu laden,
  // nicht in einer Schleife (das passiert, wenn der Hinweis am Lebenslauf
  // des Workers hängt statt an der Fassungsnummer).
  let loads = 0;
  page.on('framenavigated', (frame) => { if (!frame.parentFrame()) loads += 1; });

  await page.goto('http://localhost:8098/prototype.html');
  await page.waitForSelector('.lesson');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Zweiter Aufruf: jetzt bedient der Service Worker die Seite von Anfang an.
  await page.reload();
  await page.waitForSelector('.lesson');
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  check(controlled, 'Service Worker steuert die Seite nicht');

  loads = 0;
  const first = await page.evaluate(() => window.OTOKI_VERSION);
  console.log('Fassung beim Start:', first);
  check(Boolean(first), 'keine Fassungsnummer in der Seite');
  const shown = await page.locator('.version').textContent();
  console.log('Anzeige im Pfad:', shown.trim());
  check(shown.includes(first), 'Fassungsnummer wird nicht angezeigt');

  // 1. Neue Veröffentlichung, während niemand übt → soll von selbst kommen
  publish('neu-eins');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => window.OTOKI_VERSION === 'neu-eins', null, { timeout: 15000 })
    .catch(() => errors.push('neue Fassung kam ohne laufende Übung nicht an'));
  await page.waitForSelector('.lesson');
  console.log(`nach Veröffentlichung: ${await page.evaluate(() => window.OTOKI_VERSION)}`
    + ` (${loads} Seitenaufruf)`);
  await page.waitForTimeout(2500);
  check(loads === 1, `die Seite lädt sich im Kreis (${loads} Aufrufe für eine Fassung)`);

  // Der alte Cache muss weg sein, sonst wächst der Speicher endlos
  const caches = await page.evaluate(() => window.caches.keys());
  console.log('Cache-Namen:', caches.join(', '));
  check(caches.length === 1 && caches[0] === 'o-toki-neu-eins', 'alte Caches bleiben liegen');

  // 2. Neue Veröffentlichung mitten in einer Übung → nur ein Streifen
  await page.locator('.lesson:not(.intro):not(.review)').first().click();
  await page.waitForSelector('.exbar');
  const before = await page.locator('.question').textContent();
  publish('neu-zwei');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForSelector('.updatebar', { timeout: 15000 })
    .catch(() => errors.push('kein Hinweisstreifen während der Übung'));
  // Der Streifen muss in den Rahmen passen — Text links, Knopf rechts,
  // beides innerhalb des Kastens und innerhalb des Bildschirms.
  const shape = await page.evaluate(() => {
    const bar = document.querySelector('.updatebar');
    const button = bar.querySelector('button');
    const text = bar.querySelector('span');
    const b = bar.getBoundingClientRect();
    const k = button.getBoundingClientRect();
    const s = text.getBoundingClientRect();
    return {
      barLeft: Math.round(b.left), barRight: Math.round(b.right),
      buttonLeft: Math.round(k.left), buttonRight: Math.round(k.right),
      textRight: Math.round(s.right), barBottom: Math.round(b.bottom),
      view: window.innerWidth, height: Math.round(b.height),
      buttonLines: Math.round(k.height / parseFloat(getComputedStyle(button).lineHeight || 16)),
    };
  });
  console.log(`Streifen: ${shape.barLeft}–${shape.barRight} px (Bild ${shape.view}), `
    + `Knopf ${shape.buttonLeft}–${shape.buttonRight}, Höhe ${shape.height}`);
  check(shape.barRight <= shape.view, `Streifen ragt ${shape.barRight - shape.view}px aus dem Bild`);
  check(shape.buttonRight <= shape.barRight,
    `Knopf ragt ${shape.buttonRight - shape.barRight}px aus dem Streifen`);
  check(shape.buttonLeft >= shape.barLeft, 'Knopf ragt links aus dem Streifen');
  check(shape.textRight <= shape.buttonLeft, 'Text und Knopf überlappen');
  check(shape.height <= 80, `Streifen ist ${shape.height}px hoch — der Text bricht zu oft um`);

  const still = await page.evaluate(() => window.OTOKI_VERSION);
  check(still === 'neu-eins', `Übung wurde weggeladen (${still})`);
  const question = await page.locator('.question').count()
    ? await page.locator('.question').textContent() : '';
  check(question === before, 'Aufgabe hat sich unter der Hand geändert');
  await page.screenshot({ path: `${SHOTS}/15-neue-fassung.png` });

  // Antippen lädt dann wirklich neu
  await page.locator('.updatebar button').click();
  await page.waitForFunction(() => window.OTOKI_VERSION === 'neu-zwei', null, { timeout: 15000 })
    .catch(() => errors.push('Antippen lädt die neue Fassung nicht'));
  await page.waitForSelector('.lesson');
  console.log('nach Antippen:', await page.evaluate(() => window.OTOKI_VERSION));

  // 3. Offline muss weiterhin gehen
  await context.setOffline(true);
  await page.goto('http://localhost:8098/prototype.html');
  const offline = await page.locator('.lesson').count();
  console.log('Offline geladen:', offline ? 'ja' : 'nein');
  check(offline > 0, 'Offline-Start schlägt fehl');
  await context.setOffline(false);

  await browser.close();
  server.close();
  fs.rmSync(WORK, { recursive: true, force: true });

  if (errors.length) {
    console.log('\n✗ ' + errors.length + ' Problem(e):');
    errors.forEach((e) => console.log('  ' + e));
    process.exit(1);
  }
  console.log('\n✓ Aktualisierung greift sofort');
})();

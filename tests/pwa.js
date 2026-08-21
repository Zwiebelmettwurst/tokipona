// Prüft die gehostete Fassung: Manifest, Service Worker, Offline-Start, Symbole.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DOCS = lib.DOCS;
const SHOTS = lib.SHOTS;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png',
                '.webmanifest': 'application/manifest+json', '.css': 'text/css' };

const server = http.createServer((request, response) => {
  const name = decodeURIComponent(request.url.split('?')[0]);
  const file = path.join(DOCS, name === '/' ? 'index.html' : name);
  if (!file.startsWith(DOCS) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404); response.end('nicht gefunden'); return;
  }
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});

(async () => {
  await new Promise((resolve) => server.listen(8099, resolve));
  const browser = await lib.launch(chromium);
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('Seitenfehler: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('Konsole: ' + m.text()); });

  // Startseite
  await page.goto('http://localhost:8099/');
  console.log('Titel:', await page.title());
  // innerText statt textContent: die verborgene Sprachfassung zählt nicht mit.
  const links = await page.evaluate(() => Array.from(document.querySelectorAll('a.card'))
    .map((card) => card.innerText.split('\n')[0].trim()));
  console.log('Karten:', links.join(' | '));
  if (links.some((label) => !label)) errors.push('eine Startseitenkarte ohne Beschriftung');
  await page.screenshot({ path: `${SHOTS}/11-startseite.png`, fullPage: true });

  // Umlaute müssen ankommen, auch wenn der Server keine Kodierung mitschickt:
  // die Seite sagt selbst, dass sie UTF-8 ist.
  const encoding = await page.evaluate(async () => {
    const response = await fetch('./prototype.html');
    const text = await response.text();
    return {
      declared: /<meta charset="utf-8">/i.test(text),
      header: response.headers.get('content-type'),
    };
  });
  console.log(`Kodierung: im Dokument ${encoding.declared ? 'ja' : 'nein'}, `
    + `Kopfzeile „${encoding.header}“`);
  if (!encoding.declared) errors.push('die Seite erklärt ihre Kodierung nicht');

  // Manifest
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href;
    return (await fetch(href)).json();
  });
  console.log(`Manifest: „${manifest.short_name}“, ${manifest.display}, `
    + `${manifest.icons.length} Symbole, Start ${manifest.start_url}`);
  for (const icon of manifest.icons) {
    const status = await page.evaluate(async (src) => (await fetch(src)).status, icon.src);
    if (status !== 200) errors.push(`Symbol ${icon.src} liefert ${status}`);
  }
  const apple = await page.evaluate(async () =>
    (await fetch(document.querySelector('link[rel="apple-touch-icon"]').href)).status);
  if (apple !== 200) errors.push(`apple-touch-icon liefert ${apple}`);

  // App öffnen, Service Worker abwarten
  await page.locator('a.card.primary').click();
  await page.waitForSelector('.lesson');
  const registered = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return Boolean(registration.active || registration.installing || registration.waiting);
  });
  console.log('Service Worker aktiv:', registered);
  if (!registered) errors.push('Service Worker nicht registriert');

  // Eine Lektion anspielen, damit Fortschritt entsteht
  await page.locator('.lesson:not(.intro):not(.review)').first().click();
  await page.waitForSelector('.exbar');
  await page.locator('.choice, .tile').first().click();
  const check = page.locator('.actions .primary');
  if (await check.count() && !(await check.isDisabled())) await check.click();
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${SHOTS}/12-app-hosted.png` });

  // Netz kappen und neu laden — muss aus dem Cache kommen
  await context.setOffline(true);
  await page.goto('http://localhost:8099/prototype.html');
  const offlineOk = await page.locator('.lesson').count();
  console.log('Offline geladen:', offlineOk ? 'ja' : 'nein');
  if (!offlineOk) errors.push('Offline-Start schlägt fehl');
  await page.screenshot({ path: `${SHOTS}/13-offline.png` });
  await context.setOffline(false);

  // Standalone-Ansicht wie nach „Zum Home-Bildschirm“
  const standalone = await browser.newContext({
    viewport: { width: 390, height: 844 }, colorScheme: 'dark',
  });
  const home = await standalone.newPage();
  await home.goto('http://localhost:8099/prototype.html');
  await home.waitForSelector('.lesson');
  const overflow = await home.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) errors.push('waagerechter Überlauf auf 390 px');
  await home.screenshot({ path: `${SHOTS}/14-iphone-dunkel.png`, fullPage: true });

  await browser.close();
  server.close();

  if (errors.length) {
    console.log('\n✗ ' + errors.length + ' Problem(e):');
    errors.forEach((e) => console.log('  ' + e));
    process.exit(1);
  }
  console.log('\n✓ gehostete Fassung in Ordnung');
})();

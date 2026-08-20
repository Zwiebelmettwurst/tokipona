// Satzkarte: wird sie gebaut, und steht etwas drauf?
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const fs = require('fs');
const FILE = lib.FILE;
const SHOTS = lib.SHOTS;
const errors = [];
const check = (c, m) => { if (!c) { errors.push(m); console.log('  ✗ ' + m); } };

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });
  await page.goto(FILE);

  // Im Sandkasten steht der Knopf an jedem gültigen Satz
  await page.locator('.tabs button[data-tab="toki"]').click();
  await page.waitForSelector('.typed');
  await page.locator('.typed').fill('jan pona mi li pana e lipu tawa mi.');
  await page.waitForTimeout(150);
  check(Boolean(await page.locator('.cardbutton').count()), 'kein Kartenknopf am gültigen Satz');
  await page.locator('.typed').fill('mi li moku.');
  await page.waitForTimeout(150);
  check((await page.locator('.cardbutton').count()) === 0, 'Kartenknopf am fehlerhaften Satz');

  // Bild bauen und ansehen — ohne den Teilen-Dialog des Geräts
  await page.locator('.typed').fill('soweli lili li moku e kili suwi.');
  await page.waitForTimeout(150);
  const shot = await page.evaluate(async () => {
    const link = document.querySelector('a[download]');
    return null;
  });
  const png = await page.evaluate(async () => {
    // denselben Weg wie der Knopf gehen, aber das Bild zurückgeben
    const button = document.querySelector('.cardbutton');
    if (!button) return null;
    window.__geteilt = null;
    // Teilen unterbinden, damit der Rückfallweg greift
    navigator.canShare = () => false;
    const before = document.querySelectorAll('a[download]').length;
    button.click();
    await new Promise((r) => setTimeout(r, 600));
    const links = Array.from(document.querySelectorAll('a[download]'));
    return { neu: links.length >= before, name: links.length ? links[0].getAttribute('download') : null };
  });
  console.log('Datei:', JSON.stringify(png));

  // Die Leinwand selbst prüfen: Maße, Farbe, Inhalt
  const canvas = await page.evaluate(async () => {
    await document.fonts.ready;
    const app = document.querySelector('.cardbutton');
    const wrapper = window.__karte;
    return null;
  });

  // Über einen eigenen Aufruf an die Zeichenroutine kommen wir nicht heran —
  // also das Bild aus dem Blob des Knopfes holen.
  const dataUrl = await page.evaluate(async () => {
    const button = document.querySelector('.cardbutton');
    navigator.canShare = () => false;
    let captured = null;
    const realCreate = URL.createObjectURL;
    URL.createObjectURL = (blob) => { captured = blob; return realCreate(blob); };
    button.click();
    await new Promise((r) => setTimeout(r, 800));
    URL.createObjectURL = realCreate;
    if (!captured) return null;
    const buf = await captured.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return { size: bytes.length, type: captured.type, base64: btoa(binary).slice(0, 100000) };
  });
  check(Boolean(dataUrl), 'kein Bild erzeugt');
  if (dataUrl) {
    console.log(`Bild: ${dataUrl.type}, ${Math.round(dataUrl.size / 1024)} KB`);
    check(dataUrl.type === 'image/png', `falscher Typ: ${dataUrl.type}`);
    check(dataUrl.size > 5000, `Bild zu klein: ${dataUrl.size}`);
    fs.writeFileSync(`${SHOTS}/45-satzkarte.png`, Buffer.from(dataUrl.base64, 'base64'));
  }

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Satzkarte entsteht');
})();

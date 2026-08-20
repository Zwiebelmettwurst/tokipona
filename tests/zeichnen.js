// sitelen pona selbst schreiben: die Vorlage nachfahren zählt, Kritzeln nicht.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const FILE = lib.FILE;
const SHOTS = lib.SHOTS;

const errors = [];
const check = (condition, message) => { if (!condition) { errors.push(message); console.log('  ✗ ' + message); } };

// Fällige Zeichenkarte setzen — dann besteht die Wiederholung aus ihr.
const seed = (page, word) => page.evaluate((key) => {
  localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    done: { 1: true }, lang: 'de', sound: false, sitelen: true,
    srs: { [key]: { reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 } },
  }));
}, 't:' + word);

async function openTrace(page, word) {
  await page.goto(FILE);
  await seed(page, word);
  await page.reload();
  await page.waitForSelector('.lesson.review');
  await page.locator('.lesson.review').click();
  await page.waitForSelector('.trace');
  await page.waitForTimeout(200);            // Schrift laden lassen
}

// Punkte der Vorlage aus dem sichtbaren Feld lesen — was da blass steht,
// fahren wir nach.
const templatePoints = (page, step) => page.evaluate((raster) => {
  const canvas = document.querySelector('.trace');
  const box = canvas.getBoundingClientRect();
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  const points = [];
  for (let y = 0; y < canvas.height; y += raster) {
    for (let x = 0; x < canvas.width; x += raster) {
      if (data[(y * canvas.width + x) * 4 + 3] > 10) {
        points.push({
          x: box.left + (x / canvas.width) * box.width,
          y: box.top + (y / canvas.height) * box.height,
        });
      }
    }
  }
  return points;
}, step);

async function dot(page, point) {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 0.5, point.y + 0.5);
  await page.mouse.up();
}

async function verdict(page) {
  await page.locator('.actions .primary').click();
  await page.waitForSelector('.sheet');
  return {
    good: Boolean(await page.locator('.sheet .verdict.good').count()),
    reason: (await page.locator('.sheet .reason').first().textContent()).replace(/\s+/g, ' ').trim(),
  };
}

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });

  // 1. Leeres Feld: „Prüfen“ bleibt aus
  await openTrace(page, 'mi');
  check(await page.locator('.actions .primary').isDisabled(), 'Prüfen ist ohne Strich schon möglich');
  const points = await templatePoints(page, 6);
  console.log(`Vorlage „mi“: ${points.length} Punkte abgetastet`);
  check(points.length > 20, `zu wenig Vorlage gefunden: ${points.length}`);

  // 2. Nachgefahren: viele kurze Tupfer genau auf der Vorlage
  for (const point of points) await dot(page, point);
  await page.screenshot({ path: `${SHOTS}/26-zeichnen.png` });
  const traced = await verdict(page);
  console.log(`nachgefahren → ${traced.good ? 'richtig' : 'falsch'} · ${traced.reason}`);
  check(traced.good, `sauberes Nachfahren gilt als falsch: ${traced.reason}`);
  check(/\d+%/.test(traced.reason), 'keine Zahlen in der Rückmeldung');

  // 3. Kritzeln daneben: füllt das Feld, sitzt aber nicht auf der Linie
  await openTrace(page, 'mi');
  const box = await page.locator('.trace').boundingBox();
  await page.mouse.move(box.x + 6, box.y + 6);
  await page.mouse.down();
  for (let i = 0; i <= 20; i += 1) {
    await page.mouse.move(box.x + 6 + (i % 2) * (box.width - 12), box.y + 6 + (i / 20) * (box.height - 12));
  }
  await page.mouse.up();
  const scribble = await verdict(page);
  console.log(`gekritzelt → ${scribble.good ? 'richtig' : 'falsch'} · ${scribble.reason}`);
  check(!scribble.good, 'Kritzeln gilt als richtig');

  // 4. Nur ein kleiner Strich: zu wenig Vorlage getroffen
  await openTrace(page, 'mi');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 8, box.y + box.height / 2);
  await page.mouse.up();
  const tiny = await verdict(page);
  console.log(`ein Tupfer → ${tiny.good ? 'richtig' : 'falsch'} · ${tiny.reason}`);
  check(!tiny.good, 'ein einzelner Tupfer gilt als richtig');
  check(/fehlt/.test(tiny.reason), `keine passende Erklärung: ${tiny.reason}`);

  // 5. „nochmal“ leert das Feld
  await openTrace(page, 'mi');
  await dot(page, points[0]);
  check(!(await page.locator('.actions .primary').isDisabled()), 'Prüfen bleibt nach einem Strich aus');
  await page.locator('.row .ghost').click();
  check(await page.locator('.actions .primary').isDisabled(), '„nochmal“ leert das Feld nicht');

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Zeichnen in Ordnung');
})();

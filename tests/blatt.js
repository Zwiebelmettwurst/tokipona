// Das Rückmeldeblatt: Urteil, eigener Satz und Musterlösung sauber getrennt.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const FILE = lib.FILE;
const SHOTS = lib.SHOTS;
const errors = [];
const check = (c, m) => { if (!c) { errors.push(m); console.log('  ✗ ' + m); } };

async function build(page, id, words) {
  await page.goto(FILE);
  await page.evaluate((key) => {
    localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
      done: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true, 9: true },
      lang: 'de', sound: false,
      srs: { [key]: { reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 } },
    }));
  }, 's:' + id);
  await page.reload();
  await page.waitForSelector('.lesson.review');
  await page.locator('.lesson.review').click();
  await page.waitForSelector('.slot');
  for (const word of words) {
    const tile = page.locator(`.bank .tile:not(.used)[data-word="${word}"]`).first();
    if (await tile.count()) await tile.click();
  }
  await page.locator('.actions .primary').click();
  await page.waitForSelector('.sheet');
  return page.evaluate(() => ({
    verdict: document.querySelector('.sheet .verdict').textContent.replace(/\s+/g, ' ').trim(),
    good: Boolean(document.querySelector('.sheet .verdict.good')),
    labels: Array.from(document.querySelectorAll('.sheet .xraylabel')).map((n) => n.textContent.trim()),
    blocks: Array.from(document.querySelectorAll('.sheet .xraywrap')).map((wrap) => ({
      label: wrap.querySelector('.xraylabel') ? wrap.querySelector('.xraylabel').textContent.trim() : null,
      text: Array.from(wrap.querySelectorAll('.span b')).map((b) => b.textContent.trim()).join(' '),
    })),
    reason: document.querySelector('.sheet .reason')
      ? document.querySelector('.sheet .reason').textContent.replace(/\s+/g, ' ').trim() : '',
  }));
}

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });

  // Falsch gebaut: eigener Satz und Musterlösung müssen beide beschriftet sein
  const wrong = await build(page, 'lsp06_06', ['jan', 'mije', 'li', 'moku']);
  console.log(`falsch → „${wrong.verdict}“`);
  wrong.blocks.forEach((b) => console.log(`   [${b.label}] ${b.text}`));
  check(!wrong.good, 'ein unvollständiger Satz gilt als richtig');
  check(wrong.blocks.length === 2, `${wrong.blocks.length} Röntgenblöcke statt zwei`);
  check(wrong.blocks[0] && wrong.blocks[0].label === 'dein satz',
    `erster Block heißt „${wrong.blocks[0] && wrong.blocks[0].label}“`);
  check(wrong.blocks[1] && wrong.blocks[1].label === 'so ist sie gebaut',
    `zweiter Block heißt „${wrong.blocks[1] && wrong.blocks[1].label}“`);
  check(wrong.blocks[0] && wrong.blocks[0].text !== wrong.blocks[1].text,
    'beide Blöcke zeigen denselben Satz');
  check(/Fast|Nicht ganz/.test(wrong.verdict), `Urteil unverändert: ${wrong.verdict}`);
  check(!/Noch nicht/.test(wrong.verdict), 'Urteil sagt weiterhin „Noch nicht“');
  await page.screenshot({ path: `${SHOTS}/35-blatt.png` });

  // Richtig gebaut: nur der eigene Satz, keine Musterlösung
  const right = await build(page, 'lsp06_06',
    ['jan', 'mije', 'li', 'pana', 'e', 'moku', 'tawa', 'jan', 'lili']);
  console.log(`richtig → „${right.verdict}“`);
  right.blocks.forEach((b) => console.log(`   [${b.label}] ${b.text}`));
  check(right.good, 'die Musterlösung gilt als falsch');
  check(right.blocks.length === 1, `${right.blocks.length} Blöcke statt einem`);
  check(right.blocks[0].label === 'dein satz', `Block heißt „${right.blocks[0].label}“`);

  // Kaputter Bau: „Nicht ganz“ statt „Fast“
  const broken = await build(page, 'lsp06_06',
    ['jan', 'mije', 'pana', 'li', 'e', 'moku', 'tawa', 'jan', 'lili']);
  console.log(`kaputter Bau → „${broken.verdict}“ · ${broken.reason.slice(0, 60)}`);
  check(/Nicht ganz/.test(broken.verdict), `Urteil bei Baufehler: ${broken.verdict}`);

  // Die geflickte Kursaufgabe: Klammern sind weg, alle vier Fassungen zählen
  const fixed = await build(page, 'lsp11_08', ['tenpo', 'mun', 'nanpa', 'luka', 'li', 'pona']);
  console.log(`lsp11_08 → „${fixed.verdict}“`);
  check(fixed.good, 'die geflickte Aufgabe nimmt ihre eigene Musterlösung nicht an');

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ Rückmeldeblatt liest sich sauber');
})();

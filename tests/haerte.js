// Härtetest: bösartige Sicherungsdateien und getippter Text.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const FILE = lib.FILE;
const errors = [];
const check = (c, m) => { if (!c) { errors.push(m); console.log('  ✗ ' + m); } };

(async () => {
  const browser = await lib.launch(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.on('pageerror', (e) => { errors.push('Seitenfehler: ' + e.message); console.log('  ✗ ' + e.message); });

  // 1. Verbogener Zustand im Speicher darf die App nicht umwerfen
  await page.goto(FILE);
  await page.evaluate(() => localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
    xp: 'viel', dayXp: -5, streak: null, goal: 99999, lang: '<script>', sitelen: 'ja',
    done: { '<img src=x onerror=window.__x=1>': true },
    mastery: { '<b>böse</b>': 'sehr' },
    srs: { 'w:mi': { reps: 'viele', ease: null, due: 'gestern' } },
    days: { 'heute': 'viele' },
    __proto__: { geknackt: true },
  })));
  await page.reload();
  await page.waitForSelector('.lesson');
  const state = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('o-toki-fortschritt-v1'));
    return {
      xp: stored.xp, goal: stored.goal, lang: stored.lang, sitelen: stored.sitelen,
      done: Object.keys(stored.done || {}), mastery: Object.keys(stored.mastery || {}),
      geknackt: Boolean({}.geknackt),
      tags: document.querySelectorAll('.screen img, .screen b:not(.ring b)').length,
    };
  });
  console.log('nach verbogenem Zustand:', JSON.stringify(state).slice(0, 200));
  check(state.xp === 0, `xp bleibt „${state.xp}“`);
  check(state.goal === 40, `Ziel bleibt ${state.goal}`);
  check(state.lang === 'de' || state.lang === 'en', `Sprache bleibt „${state.lang}“`);
  check(state.sitelen === false, 'sitelen bleibt wahr');
  check(!state.geknackt, 'Prototyp verbogen');
  check(state.mastery.length === 0 || !/[<>]/.test(state.mastery.join('')),
    `Auszeichnung im Fortschritt: ${state.mastery}`);

  // 2. Getippter Text bleibt Text — in allen drei Tippaufgaben
  const cases = [
    ['q:q03', '<b>fett</b> li pona'],
    ['n:1', '<b>fett</b> telo'],
  ];
  for (const [key, payload] of cases) {
    await page.goto(FILE);
    await page.evaluate((k) => localStorage.setItem('o-toki-fortschritt-v1', JSON.stringify({
      done: { 1: true, 2: true, 3: true }, lang: 'de', sound: false,
      srs: { [k]: { reps: 1, interval: 600000, ease: 2.5, due: Date.now() - 1000 } },
    })), key);
    await page.reload();
    await page.locator('.lesson.review').click();
    await page.waitForSelector('.typed');
    await page.locator('.typed').fill(payload);
    await page.locator('.actions .primary').click();
    await page.waitForSelector('.sheet');
    const marks = await page.evaluate(() => ({
      html: document.querySelector('.sheet .reason').innerHTML,
      text: document.querySelector('.sheet .reason').textContent.trim().slice(0, 60),
    }));
    console.log(`${key}: ${marks.text}`);
    check(!/<(b|img|script|i)\b/i.test(marks.html),
      `${key}: getippte Auszeichnung schlägt durch — ${marks.html.slice(0, 80)}`);
  }

  // 3. Der Sandkasten ebenso
  await page.goto(FILE);
  await page.locator('.tabs button[data-tab="toki"]').click();
  await page.waitForSelector('.typed');
  await page.locator('.typed').fill('<b>fett</b> li pona');
  await page.waitForTimeout(150);
  const sandbox = await page.evaluate(() => document.querySelectorAll('.result b:not(.span b)').length);
  check(sandbox === 0, `Sandkasten zeigt ${sandbox} eingeschleuste Auszeichnungen`);

  await browser.close();
  if (errors.length) { console.log('\n✗ ' + errors.length + ' Problem(e)'); process.exit(1); }
  console.log('\n✓ nichts schlägt durch');
})();

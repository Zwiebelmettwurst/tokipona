// Prüft, ob Prüfknopf, Rückmeldungsblatt und Reiter im sichtbaren Bereich
// liegen — auch bei der verkleinerten Höhe, die Safari mit eingeblendeter
// Werkzeugleiste übrig lässt.
const { chromium } = require('playwright');
const lib = require('./lib.js');
const path = require('path');
const FILE = lib.FILE;

(async () => {
  const browser = await lib.launch(chromium);
  const errors = [];

  // 390x664: iPhone-Breite, Höhe abzüglich Safari-Leisten.
  // „Homescreen“ stellt zusätzlich die Sicherheitsbereiche der installierten
  // App nach — dort liegt der Inhalt unter Status- und Home-Leiste.
  for (const [label, size, insets] of [
    ['Safari mit Leisten', { width: 390, height: 664 }, null],
    ['Vollbild', { width: 390, height: 844 }, null],
    ['klein', { width: 320, height: 568 }, null],
    ['Homescreen', { width: 390, height: 844 }, { top: '59px', bottom: '34px' }],
  ]) {
    const page = await browser.newPage({ viewport: size, colorScheme: 'dark', locale: 'de-DE' });
    if (insets) {
      await page.addInitScript(([top, bottom]) => {
        addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.setProperty('--safe-top', top);
          document.documentElement.style.setProperty('--safe-bottom', bottom);
        });
      }, [insets.top, insets.bottom]);
    }
    await page.goto(FILE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.lesson');

    const tabs = await page.evaluate(() => {
      const r = document.querySelector('.tabs').getBoundingClientRect();
      const bar = document.querySelector('.topbar').getBoundingClientRect();
      const level = document.querySelector('.topbar .ring').getBoundingClientRect();
      const style = getComputedStyle(document.documentElement);
      return {
        bottom: Math.round(r.bottom), view: window.innerHeight,
        barTop: Math.round(bar.top), ringTop: Math.round(level.top),
        safeTop: parseInt(style.getPropertyValue('--safe-top'), 10) || 0,
        tabPad: Math.round(parseFloat(getComputedStyle(document.querySelector('.tabs button')).paddingBottom)),
        safeBottom: parseInt(style.getPropertyValue('--safe-bottom'), 10) || 0,
      };
    });
    if (tabs.bottom > tabs.view + 1) {
      errors.push(`[${label}] Reiter ragen ${tabs.bottom - tabs.view}px über den Rand`);
    }
    // Nichts Bedienbares darf unter der Systemleiste liegen.
    if (tabs.ringTop < tabs.safeTop) {
      errors.push(`[${label}] Kopfzeile beginnt bei ${tabs.ringTop}px, Systemleiste reicht bis ${tabs.safeTop}px`);
    }
    if (tabs.tabPad < tabs.safeBottom) {
      errors.push(`[${label}] Reiterleiste hält ${tabs.tabPad}px unten frei, nötig sind ${tabs.safeBottom}px`);
    }
    console.log(`${label}: Kopfzeile ab ${tabs.ringTop}px (Systemleiste ${tabs.safeTop}px), `
      + `Reiter halten ${tabs.tabPad}px frei (${tabs.safeBottom}px nötig)`);

    await page.locator('.lesson').first().click();
    await page.waitForSelector('.exbar');

    const bar = await page.evaluate(() => {
      const close = document.querySelector('.exbar button:first-of-type').getBoundingClientRect();
      const safe = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-top'), 10) || 0;
      return { top: Math.round(close.top), safe };
    });
    if (bar.top < bar.safe) {
      errors.push(`[${label}] Übungsleiste beginnt bei ${bar.top}px, Systemleiste reicht bis ${bar.safe}px`);
    }

    const button = await page.evaluate(() => {
      const r = document.querySelector('.actions .primary').getBoundingClientRect();
      return { bottom: Math.round(r.bottom), view: window.innerHeight };
    });
    const slack = button.view - button.bottom;
    console.log(`${label} (${size.width}x${size.height}): Knopfunterkante ${button.bottom}, `
      + `Sichtbereich ${button.view}, Luft ${slack}px`);
    if (slack < 0) errors.push(`[${label}] Prüfknopf ${-slack}px unter dem Rand`);

    await page.locator('.choice, .tile').first().click();
    const check = page.locator('.actions .primary');
    if (await check.count() && !(await check.isDisabled())) await check.click();
    await page.waitForSelector('.sheet');
    const sheet = await page.evaluate(() => {
      const r = document.querySelector('.sheet .primary').getBoundingClientRect();
      return { bottom: Math.round(r.bottom), view: window.innerHeight };
    });
    if (sheet.bottom > sheet.view + 1) {
      errors.push(`[${label}] Knopf im Rückmeldungsblatt ${sheet.bottom - sheet.view}px unter dem Rand`);
    }
    // Auch die anderen Reiter dürfen nicht waagerecht scrollen.
    await page.locator('.exbar button:first-of-type').click();
    await page.waitForSelector('.tabs');
    for (const tab of ['nimi', 'toki', 'pfad']) {
      await page.locator(`.tabs button[data-tab="${tab}"]`).click();
      await page.waitForTimeout(80);
      const wide = await page.evaluate(() => ({
        over: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        by: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      if (wide.over) errors.push(`[${label}] Reiter ${tab} scrollt ${wide.by}px waagerecht`);
      // Nicht scrollen reicht nicht: eine Spalte kann so schmal gequetscht
      // werden, dass ein Zeichen je Zeile übrigbleibt. Im Wörterbuch war
      // genau das der Fall — die Bedeutung stand in einer 19px-Spalte.
      // Geprüft wird das schmalste Wort der ganzen Liste.
      if (tab === 'nimi') {
        const eng = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll('.word'));
          if (!rows.length) return null;
          return rows.map((row) => {
            const gloss = row.querySelector('span:not(.glyph-inline)');
            return {
              wort: row.querySelector('b').textContent.trim(),
              anteil: gloss
                ? gloss.getBoundingClientRect().width / row.getBoundingClientRect().width : 0,
              breit: gloss ? Math.round(gloss.getBoundingClientRect().width) : 0,
            };
          }).sort((a, b) => a.anteil - b.anteil)[0];
        });
        if (!eng) errors.push(`[${label}] keine Wortzeile gefunden`);
        else if (eng.anteil < 0.6) {
          errors.push(`[${label}] Bedeutungsspalte bei „${eng.wort}“ nur ${eng.breit}px `
            + `(${Math.round(eng.anteil * 100)}% der Zeile)`);
        }
      }
    }

    await page.close();
  }

  await browser.close();
  if (errors.length) { errors.forEach((e) => console.log('✗ ' + e)); process.exit(1); }
  console.log('\n✓ alles im sichtbaren Bereich');
})();

// Gemeinsames Rüstzeug der Browserprüfungen.
//
// Die Prüfungen laufen sowohl hier als auch in der Werkbank: dort gibt es
// keinen festen Pfad zum Browser, hier schon. Beides deckt diese Datei ab.
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const FILE = 'file://' + path.join(DOCS, 'prototype.html');
const START = 'file://' + path.join(DOCS, 'index.html');
const SHOTS = path.join(__dirname, 'shots');

// Eine Kurslektion — nicht die Einführung (Lektion 0) und nicht die
// Sonderkarten oben (fällige Karten, Schwachstellen). Wer den Kurs meint,
// nimmt diesen Wähler.
const KURS = '.lesson:not(.intro):not(.review)';

// Playwright bringt in der Werkbank seinen eigenen Browser mit; hier liegt
// einer neben der Sitzung.
function browserPath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const pool = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!pool || !fs.existsSync(pool)) return undefined;
  const found = fs.readdirSync(pool)
    .filter((name) => name.startsWith('chromium'))
    .map((name) => path.join(pool, name, 'chrome-linux', 'chrome'))
    .concat([path.join(pool, 'chromium', 'chrome-linux', 'chrome'), path.join(pool, 'chromium')])
    .find((candidate) => fs.existsSync(candidate));
  return found;
}

async function launch(chromium, options = {}) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const executablePath = browserPath();
  return chromium.launch(Object.assign({}, executablePath ? { executablePath } : {}, options));
}

// Kleiner Prüfsammler: sammelt Abweichungen, statt beim ersten Fehler zu enden.
function collector() {
  const errors = [];
  const check = (condition, message) => {
    if (!condition) { errors.push(message); console.log('  ✗ ' + message); }
  };
  const done = (heiter) => {
    if (errors.length) {
      console.log('\n✗ ' + errors.length + ' Problem(e)');
      process.exit(1);
    }
    console.log('\n✓ ' + heiter);
  };
  return { errors, check, done };
}

module.exports = { ROOT, DOCS, FILE, START, SHOTS, KURS, launch, collector, browserPath };

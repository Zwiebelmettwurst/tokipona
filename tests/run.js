// Führt alle Browserprüfungen der Reihe nach aus.
//
//   node tests/run.js            alle
//   node tests/run.js drag lang  nur diese
//
// Jede Prüfung ist ein eigenes Programm und meldet sich über den Rückgabewert.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const wanted = process.argv.slice(2);
const suites = fs.readdirSync(HERE)
  .filter((name) => name.endsWith('.js') && !['lib.js', 'run.js'].includes(name))
  .filter((name) => !wanted.length || wanted.some((part) => name.includes(part)))
  .sort();

if (!suites.length) {
  console.log('Keine Prüfung gefunden.');
  process.exit(1);
}

const started = Date.now();
const failed = [];
for (const suite of suites) {
  const label = suite.replace('.js', '');
  process.stdout.write(`${label.padEnd(14)}`);
  const run = spawnSync(process.execPath, [path.join(HERE, suite)], {
    encoding: 'utf8', timeout: 300000,
  });
  if (run.status === 0) {
    const summary = (run.stdout || '').trim().split('\n').filter((line) => line.startsWith('✓')).pop();
    console.log('✓ ' + (summary ? summary.slice(2) : 'bestanden'));
  } else {
    failed.push(label);
    console.log('✗');
    console.log((run.stdout || '').split('\n').filter((line) => line.includes('✗')).map((l) => '   ' + l).join('\n'));
    if (run.stderr && run.stderr.trim()) {
      console.log('   ' + run.stderr.trim().split('\n').slice(0, 4).join('\n   '));
    }
  }
}

const seconds = Math.round((Date.now() - started) / 1000);
console.log(`\n${suites.length - failed.length}/${suites.length} bestanden in ${seconds}s`);
if (failed.length) {
  console.log('gescheitert: ' + failed.join(' '));
  process.exit(1);
}

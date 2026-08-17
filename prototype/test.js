// Prüft den JS-Parser des Prototyps gegen dieselben Korpora wie das Swift-Paket.
//   node prototype/test.js

const data = require('./data.js');
const TokiPona = require('./tokipona.js');

let failures = 0;
const check = (condition, message) => {
  if (!condition) { failures += 1; console.log('  ✗ ' + message); }
};

// 1. Golden-Korpus: muss fehlerfrei durchlaufen
for (const sentence of data.corpus.valid) {
  const result = TokiPona.parse(sentence);
  check(result.isValid,
    `SOLL FEHLERFREI  ${sentence} → ${result.violations.map((v) => v.rule).join(', ')}`);
}

// 2. Fehlersätze: müssen genau ihre Regel auslösen
for (const [sentence, rule] of data.corpus.invalid) {
  const rules = TokiPona.parse(sentence).violations.map((v) => v.rule);
  check(rules.includes(rule), `SOLL ${rule}  ${sentence} → ${rules.join(', ') || 'keine Meldung'}`);
}

// 3. Fremdes Material: die Sätze des Kurses lipu sona pona
let externalOk = 0;
for (const sentence of data.corpus.external) {
  const result = TokiPona.parse(sentence);
  if (result.isValid) externalOk += 1;
  else check(false, `KURS  ${sentence} → ${result.violations.map((v) => v.rule).join(', ')}`);
}

// 4. Alle importierten Musterlösungen müssen gültig sein
let items = 0;
for (const lesson of data.lessons) {
  for (const item of lesson.items) {
    for (const solution of [item.tp, ...item.also]) {
      items += 1;
      const violations = TokiPona.splitUtterances(solution)
        .flatMap((u) => TokiPona.parse(u).violations);
      check(!violations.length,
        `IMPORT ${item.id}  ${solution} → ${violations.map((v) => v.rule).join(', ')}`);
    }
  }
}

// 5. Satzröntgen
const spans = TokiPona.xray(TokiPona.parse('jan suli li pana e lipu tawa mi.').utterance);
check(JSON.stringify(spans.map((s) => s.role))
      === JSON.stringify(['Subjekt', 'Prädikat', 'Verb', 'Objekt', 'Präposition', 'Ergänzung']),
      'Satzröntgen: ' + spans.map((s) => `${s.text}=${s.role}`).join(' '));

console.log(`Golden:  ${data.corpus.valid.length} gültige, ${data.corpus.invalid.length} fehlerhafte`);
console.log(`Kurs:    ${externalOk}/${data.corpus.external.length} fehlerfrei`);
console.log(`Import:  ${items} Musterlösungen geprüft`);
console.log(failures ? `\n✗ ${failures} Abweichung(en)` : '\n✓ alle Prüfungen bestanden');
process.exit(failures ? 1 : 0);

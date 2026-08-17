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

// 4. Alle importierten Musterlösungen müssen gültig sein — in jeder Sprache
let items = 0;
for (const [lang, pack] of Object.entries(data.languages)) {
  for (const lesson of pack.lessons) {
    for (const item of lesson.items) {
      check(item.target && item.target.length, `IMPORT ${lang} ${item.id}: keine Übersetzung`);
      for (const solution of [item.tp, ...item.also]) {
        items += 1;
        const violations = TokiPona.splitUtterances(solution)
          .flatMap((u) => TokiPona.parse(u).violations);
        check(!violations.length,
          `IMPORT ${lang} ${item.id}  ${solution} → ${violations.map((v) => v.rule).join(', ')}`);
      }
    }
  }
}

// 5. Jedes Wort braucht in jeder Sprache eine Bedeutung
for (const [word, entry] of Object.entries(data.lexicon)) {
  for (const lang of Object.keys(data.languages)) {
    check(entry.glosses[lang] && entry.glosses[lang].length,
      `LEXIKON ${word}: keine Bedeutung für ${lang}`);
  }
}

// 6. Meldungen müssen in beiden Sprachen greifen
for (const [sentence] of data.corpus.invalid) {
  for (const lang of Object.keys(data.languages)) {
    for (const violation of TokiPona.parse(sentence).violations) {
      const text = TokiPona.describe(violation, lang);
      check(text && text !== violation.key,
        `MELDUNG ${lang}/${violation.key}: keine Übersetzung`);
    }
  }
}

// 7. Satzröntgen
const spans = TokiPona.xray(TokiPona.parse('jan suli li pana e lipu tawa mi.').utterance);
check(JSON.stringify(spans.map((s) => s.role))
      === JSON.stringify(['subject', 'predicateMarker', 'verb', 'object', 'preposition', 'complement']),
      'Satzröntgen: ' + spans.map((s) => `${s.text}=${s.role}`).join(' '));

// 8. Rollennamen: in jeder Sprache vorhanden, und wirklich übersetzt.
// Auf Englisch ist die Beschriftung mit dem Schlüssel identisch — das ist
// kein Fehler, deshalb prüft der Vergleich gegen die deutsche Fassung.
for (const span of spans) {
  for (const lang of Object.keys(data.languages)) {
    const label = TokiPona.roleLabel(span.role, lang);
    check(typeof label === 'string' && label.length > 0, `ROLLE ${lang}/${span.role}: leer`);
  }
}
check(TokiPona.roleLabel('subject', 'de') === 'Subjekt'
      && TokiPona.roleLabel('predicateMarker', 'de') === 'Prädikat',
      'deutsche Rollennamen fehlen');
check(TokiPona.roleLabel('predicateMarker', 'en') === 'predicate', 'englische Rollennamen fehlen');

console.log(`Golden:  ${data.corpus.valid.length} gültige, ${data.corpus.invalid.length} fehlerhafte`);
console.log(`Kurs:    ${externalOk}/${data.corpus.external.length} fehlerfrei`);
console.log(`Import:  ${items} Musterlösungen in ${Object.keys(data.languages).length} Sprachen geprüft`);
console.log(failures ? `\n✗ ${failures} Abweichung(en)` : '\n✓ alle Prüfungen bestanden');
process.exit(failures ? 1 : 0);

// Prüft den JS-Parser des Prototyps gegen dieselben Korpora wie das Swift-Paket.
//   node prototype/test.js

const data = require('./data.js');
const musi = require('./musi.js');
const open = require('./toki.js');
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

// 7. Spaßmodus: jede Zeile muss sauber sein und in beiden Sprachen stehen
const KINDS = Object.keys(musi.kinds);
const ids = new Set();
for (const line of musi.lines) {
  check(!ids.has(line.id), `MUSI ${line.id}: doppelte Kennung`);
  ids.add(line.id);
  check(KINDS.includes(line.kind), `MUSI ${line.id}: unbekannte Sorte ${line.kind}`);
  check(line.sting >= 1 && line.sting <= 3, `MUSI ${line.id}: Frechheit ausserhalb 1..3`);
  const violations = TokiPona.splitUtterances(line.tp).flatMap((u) => TokiPona.parse(u).violations);
  check(!violations.length,
    `MUSI ${line.id}  ${line.tp} → ${violations.map((v) => v.rule).join(', ')}`);
  for (const lang of Object.keys(data.languages)) {
    check(Array.isArray(line[lang]) && line[lang].length && line[lang][0].trim(),
      `MUSI ${line.id}: keine Bedeutung für ${lang}`);
    check(line.lit && line.lit[lang] && line.lit[lang].trim(),
      `MUSI ${line.id}: keine wörtliche Lesart für ${lang}`);
  }
  check(musi.intro.de && musi.intro.en, 'MUSI: Einleitung fehlt');
}

// 8. Bausätze: JEDE Kombination muss grammatisch sein — der Würfel darf
//    keinen kaputten Satz ausspucken können.
let combos = 0;
for (const pattern of musi.patterns) {
  for (const lang of Object.keys(data.languages)) {
    check(typeof pattern.say[lang] === 'function', `MUSI ${pattern.id}: keine Lesart für ${lang}`);
    check(pattern.name[lang], `MUSI ${pattern.id}: kein Name für ${lang}`);
  }
  const rows = pattern.slots.reduce(
    (acc, slot) => acc.flatMap((prefix) => slot.map((option) => [...prefix, option])), [[]]);
  for (const row of rows) {
    combos += 1;
    const sentence = pattern.frame
      .replace('{a}', row[0][0])
      .replace('{b}', row[1] ? row[1][0] : '');
    const violations = TokiPona.parse(sentence).violations;
    check(!violations.length,
      `MUSI ${pattern.id}  ${sentence} → ${violations.map((v) => v.rule).join(', ')}`);
    for (const option of row) {
      check(option.length === 3 && option[1] && option[2],
        `MUSI ${pattern.id}: Füllung „${option[0]}“ ohne beide Lesarten`);
      for (const token of TokiPona.tokenize(option[0])) {
        check(Boolean(TokiPona.lexicon[token.text]),
          `MUSI ${pattern.id}: „${token.text}“ steht nicht im Lexikon`);
      }
    }
  }
}

// 9. Offene Fragen: Frage, Beispielantworten und die geforderten Satzteile
const roleSet = (text) => {
  const parts = TokiPona.splitUtterances(text);
  const violations = parts.flatMap((part) => TokiPona.parse(part).violations);
  const roles = new Set(parts.flatMap((part) =>
    TokiPona.xray(TokiPona.parse(part).utterance).map((span) => span.role)));
  return { violations, roles };
};
const seenIds = new Set();
let answers = 0;
for (const prompt of open.prompts) {
  check(!seenIds.has(prompt.id), `FRAGE ${prompt.id}: doppelte Kennung`);
  seenIds.add(prompt.id);
  const asked = roleSet(prompt.tp);
  check(!asked.violations.length,
    `FRAGE ${prompt.id}  ${prompt.tp} → ${asked.violations.map((v) => v.rule).join(', ')}`);
  for (const lang of Object.keys(data.languages)) {
    check(Array.isArray(prompt[lang]) && prompt[lang].length && prompt[lang][0].trim(),
      `FRAGE ${prompt.id}: keine Übersetzung für ${lang}`);
  }
  for (const role of prompt.need) {
    check(Boolean(open.needs[role]), `FRAGE ${prompt.id}: unbekannte Anforderung ${role}`);
  }
  check(prompt.models.length >= 1, `FRAGE ${prompt.id}: keine Beispielantwort`);
  for (const model of prompt.models) {
    answers += 1;
    const given = roleSet(model);
    check(!given.violations.length,
      `ANTWORT ${prompt.id}  ${model} → ${given.violations.map((v) => v.rule).join(', ')}`);
    // Jede Beispielantwort muss die eigene Anforderung erfüllen — sonst
    // verlangt die Aufgabe etwas, das sie selbst nicht vormacht.
    for (const role of prompt.need) {
      check(given.roles.has(role), `ANTWORT ${prompt.id}  ${model}: ohne ${role}`);
    }
  }
}
for (const [role, labels] of Object.entries(open.needs)) {
  for (const lang of Object.keys(data.languages)) {
    check(labels[lang] && labels[lang].trim(), `ANFORDERUNG ${role}: keine Beschriftung für ${lang}`);
  }
}

// 10. Gleichwertige Wortstellung: Beifügungen dürfen tauschen, Rollen nicht
const ORDER_CASES = [
  ['jan mije lili sina li wawa.', 'jan lili mije sina li wawa.', true],
  ['mi jo e kili suwi loje.', 'mi jo e kili loje suwi.', true],
  ['soweli lili sina li suwi.', 'soweli sina lili li suwi.', true],
  ['jan li moku e soweli.', 'soweli li moku e jan.', false],       // Rollentausch
  ['jan lili ala li wawa.', 'jan ala lili li wawa.', false],       // Verneinung
  ['jan pona mute li lape.', 'jan mute pona li lape.', false],     // Menge
  ['tomo tawa mi li pona.', 'tomo mi tawa li pona.', false],       // feste Fügung
  ['jan pi toki pona li pona.', 'jan pi pona toki li pona.', false], // pi-Gruppe
  ['jan Sonja suli li pona.', 'jan suli Sonja li pona.', false],   // Name am Kopfwort
];
for (const [a, b, same] of ORDER_CASES) {
  check(TokiPona.sameMeaning(a, b) === same,
    `STELLUNG „${a}“ ${same ? 'sollte' : 'sollte nicht'} „${b}“ entsprechen`);
}
check(TokiPona.canonical('mi mije suli li lape.') === null
      || TokiPona.canonical('jan lili mije li wawa.') === 'jan lili mije li wawa',
      'STELLUNG: Vergleichsform sortiert nicht alphabetisch');
check(TokiPona.canonical('jan sina li') === null, 'STELLUNG: kaputter Satz hat keine Vergleichsform');

// 11. Satzröntgen
const spans = TokiPona.xray(TokiPona.parse('jan suli li pana e lipu tawa mi.').utterance);
check(JSON.stringify(spans.map((s) => s.role))
      === JSON.stringify(['subject', 'predicateMarker', 'verb', 'object', 'preposition', 'complement']),
      'Satzröntgen: ' + spans.map((s) => `${s.text}=${s.role}`).join(' '));

// 12. Rollennamen: in jeder Sprache vorhanden, und wirklich übersetzt.
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
console.log(`musi:    ${musi.lines.length} Zeilen, ${combos} gewürfelte Sätze geprüft`);
console.log(`offen:   ${open.prompts.length} Fragen, ${answers} Beispielantworten geprüft`);
console.log(failures ? `\n✗ ${failures} Abweichung(en)` : '\n✓ alle Prüfungen bestanden');
process.exit(failures ? 1 : 0);

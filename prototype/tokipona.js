// Zeilennaher Port von TokiPonaKit für den Prototyp.
// Maßgeblich bleibt das Swift-Paket; prototype/test.js prüft beide gegen
// dieselben Korpora.

const TokiPona = (function (data) {
  const LEX = data.lexicon;
  const VARIANTS = data.variants;

  const PREPOSITIONS = new Set(['lon', 'tan', 'tawa', 'kepeken', 'sama']);
  const PREVERBS = new Set(['wile', 'ken', 'kama', 'awen', 'sona', 'lukin']);
  const EXT_PREVERBS = new Set(['alasa', 'open', 'pini']);
  const STRUCTURAL = new Set(['li', 'e', 'la', 'pi', 'o', 'en', 'anu', 'a']);
  const BOUNDARY = new Set(['li', 'e', 'la', 'o', 'en', 'anu']);

  const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
  const CONSONANTS = new Set(['j', 'k', 'l', 'm', 'n', 'p', 's', 't', 'w']);
  const FORBIDDEN = new Set(['ji', 'ti', 'wo', 'wu']);
  const STRIPPED = new Set([...'.,;!?"\'„“»«()[]…·-–—']);

  const lookup = (text) => LEX[VARIANTS[text] || text] || null;

  // ---------------------------------------------------------------- Lautregeln

  function phonoCheck(text) {
    const lower = text.toLowerCase();
    if (!lower) return { kind: 'emptyString', detail: '' };
    for (const c of lower) {
      if (!VOWELS.has(c) && !CONSONANTS.has(c)) return { kind: 'foreignLetter', detail: c };
    }
    const chars = [...lower];
    let i = 0, first = true;
    while (i < chars.length) {
      let syllable = '';
      if (CONSONANTS.has(chars[i])) { syllable += chars[i]; i += 1; }
      else if (!first) return { kind: 'missingVowel', detail: '' };
      if (i >= chars.length || !VOWELS.has(chars[i])) {
        return { kind: syllable ? 'danglingConsonant' : 'missingVowel', detail: syllable };
      }
      syllable += chars[i];
      i += 1;
      if (FORBIDDEN.has(syllable)) return { kind: 'forbiddenSyllable', detail: syllable };
      if (i < chars.length && chars[i] === 'n') {
        const next = i + 1 < chars.length ? chars[i + 1] : null;
        if (next && VOWELS.has(next)) { /* eröffnet die nächste Silbe */ }
        else if (next && (next === 'n' || next === 'm')) {
          return { kind: 'forbiddenSyllable', detail: 'n' + next };
        } else { syllable += 'n'; i += 1; }
      }
      first = false;
    }
    return null;
  }

  // ---------------------------------------------------------------- Tokenizer

  function editDistance(a, b) {
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = [...Array(b.length + 1).keys()];
    for (let i = 1; i <= a.length; i += 1) {
      const cur = [i, ...Array(b.length).fill(0)];
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[b.length];
  }

  const SPELLINGS = [...Object.keys(LEX), ...Object.keys(VARIANTS)].sort();

  function suggest(text) {
    let best = null;
    for (const candidate of SPELLINGS) {
      if (Math.abs(candidate.length - text.length) > 1) continue;
      if (editDistance(text, candidate) === 1) {
        if (best !== null && best.length <= candidate.length) continue;
        best = candidate;
      }
    }
    return best;
  }

  function makeToken(original, index, offset, colon) {
    const token = {
      original, text: original.toLowerCase(), index, offset,
      followedByColon: colon, word: null, kind: null, suggestion: null, problem: null,
    };
    if (/^[A-ZÄÖÜ]/.test(original)) {
      const problem = phonoCheck(token.text);
      if (problem) { token.kind = 'malformedName'; token.problem = problem; }
      else token.kind = 'properName';
    } else if (lookup(token.text)) {
      token.kind = 'known';
      token.word = lookup(token.text);
    } else {
      token.kind = 'unknown';
      token.suggestion = suggest(token.text);
    }
    return token;
  }

  const isParticle = (t, p) => t.text === p && STRUCTURAL.has(p) && t.word !== null;
  const isBoundary = (t) => t.word !== null && BOUNDARY.has(t.text);
  const isProperName = (t) => t.kind === 'properName' || t.kind === 'malformedName';
  const canModify = (t) => (t.kind === 'known'
    ? (!t.word.roles.includes('particle') || t.word.roles.includes('content'))
    : true);
  const isPreposition = (t) => t.word !== null && PREPOSITIONS.has(t.text);
  const isPreverb = (t) => t.word !== null && (PREVERBS.has(t.text) || EXT_PREVERBS.has(t.text));

  function tokenize(input) {
    const tokens = [];
    let raw = '', start = 0;
    const flush = () => {
      if (!raw) return;
      let body = raw, colon = false;
      while (body.endsWith(':')) { colon = true; body = body.slice(0, -1); }
      body = [...body].filter((c) => !STRIPPED.has(c)).join('');
      raw = '';
      if (!body) return;
      tokens.push(makeToken(body, tokens.length, start, colon));
    };
    [...input].forEach((character, position) => {
      if (/\s/.test(character)) flush();
      else { if (!raw) start = position; raw += character; }
    });
    flush();
    return tokens;
  }

  function splitUtterances(input) {
    const out = [];
    let current = '';
    for (const c of input) {
      current += c;
      if ('.!?'.includes(c)) { if (current.trim()) out.push(current.trim()); current = ''; }
    }
    if (current.trim()) out.push(current.trim());
    return out;
  }

  // ---------------------------------------------------------------- Parser

  // Verstöße tragen Schlüssel und Werte, keinen fertigen Satz. Übersetzt wird
  // erst bei der Anzeige — sonst wäre die Sprache im Parser eingebrannt.
  const MESSAGES = {
    de: {
      emptyUtterance: () => 'Der Satz ist leer.',
      emptyContext: () => 'Vor „la“ fehlt der Kontext.',
      contextWithoutClause: () => 'Nach „la“ fehlt der Hauptsatz.',
      unknownWord: (p) => `„${p.word}“ steht nicht im Wortschatz.`,
      unknownWordSuggest: (p) => `„${p.word}“ steht nicht im Wortschatz. Meintest du „${p.suggestion}“?`,
      unknownWordKu: (p) => `„${p.word}“ gehört zu den nimi ku suli, nicht zu pu.`,
      properNameNotTokiponized: (p, table) => `„${p.word}“ ist kein toki-pona-Name: `
        + table[PHONO_KEY[p.kind]](p),
      missingSubject: () => 'Vor „li“ fehlt das Satzsubjekt.',
      liAfterMiSina: (p) => `Nach „${p.word}“ als alleinigem Subjekt entfällt „li“.`,
      missingLi: () => 'Vor dem Prädikat fehlt „li“.',
      vocativeWithoutContent: () => '„o“ braucht eine Anrede davor oder einen Befehl danach.',
      repeatedParticle: (p) => `„${p.word}“ steht doppelt.`,
      missingPredicate: (p) => (p.word ? `Nach „${p.word}“ fehlt das Prädikat.` : 'Dem Satz fehlt das Prädikat.'),
      objectWithoutNoun: () => 'Nach „e“ fehlt das Objekt.',
      unexpectedToken: (p) => `„${p.word}“ passt an dieser Stelle nicht in den Satzbau.`,
      particleInPhrasePosition: (p) => `„${p.word}“ ist ein Partikel und kann keine Phrase anführen.`,
      properNameAsHead: () => 'Namen stehen als Beifügung hinter einem Wort wie jan, ma oder toki.',
      piWithoutContent: () => 'Nach „pi“ fehlt die Wortgruppe.',
      piWithSingleWord: () => '„pi“ gruppiert nur mehrwortige Beifügungen um; vor einem einzelnen Wort entfällt es.',
      phonoEmptyString: () => 'Leere Zeichenkette.',
      phonoForeignLetter: (p) => `„${p.detail}“ gehört nicht zu den 14 Buchstaben von toki pona.`,
      phonoForbiddenSyllable: (p) => `Die Silbe „${p.detail}“ ist in toki pona nicht erlaubt.`,
      phonoMissingVowel: () => 'Jede Silbe braucht einen Vokal.',
      phonoDanglingConsonant: () => 'Nach dem letzten Vokal ist nur „n“ erlaubt.',
    },
    en: {
      emptyUtterance: () => 'The sentence is empty.',
      emptyContext: () => 'There is no context before “la”.',
      contextWithoutClause: () => 'There is no main clause after “la”.',
      unknownWord: (p) => `“${p.word}” is not in the vocabulary.`,
      unknownWordSuggest: (p) => `“${p.word}” is not in the vocabulary. Did you mean “${p.suggestion}”?`,
      unknownWordKu: (p) => `“${p.word}” is one of the nimi ku suli, not from pu.`,
      properNameNotTokiponized: (p, table) => `“${p.word}” is not a toki pona name: `
        + table[PHONO_KEY[p.kind]](p),
      missingSubject: () => 'There is no subject before “li”.',
      liAfterMiSina: (p) => `After “${p.word}” alone as the subject, “li” is dropped.`,
      missingLi: () => '“li” is missing before the predicate.',
      vocativeWithoutContent: () => '“o” needs someone addressed before it or a command after it.',
      repeatedParticle: (p) => `“${p.word}” appears twice.`,
      missingPredicate: (p) => (p.word ? `There is no predicate after “${p.word}”.` : 'The sentence has no predicate.'),
      objectWithoutNoun: () => 'There is no object after “e”.',
      unexpectedToken: (p) => `“${p.word}” does not fit the sentence structure here.`,
      particleInPhrasePosition: (p) => `“${p.word}” is a particle and cannot head a phrase.`,
      properNameAsHead: () => 'Names follow a head word such as jan, ma or toki.',
      piWithoutContent: () => 'There is no word group after “pi”.',
      piWithSingleWord: () => '“pi” only regroups modifiers of two or more words; before a single word it is dropped.',
      phonoEmptyString: () => 'Empty string.',
      phonoForeignLetter: (p) => `“${p.detail}” is not one of the 14 letters of toki pona.`,
      phonoForbiddenSyllable: (p) => `The syllable “${p.detail}” is not allowed in toki pona.`,
      phonoMissingVowel: () => 'Every syllable needs a vowel.',
      phonoDanglingConsonant: () => 'Only “n” may follow the last vowel.',
    },
  };

  const PHONO_KEY = {
    emptyString: 'phonoEmptyString', foreignLetter: 'phonoForeignLetter',
    forbiddenSyllable: 'phonoForbiddenSyllable', missingVowel: 'phonoMissingVowel',
    danglingConsonant: 'phonoDanglingConsonant',
  };

  const ROLES = {
    de: { context: 'Kontext', particle: 'Partikel', vocative: 'Anrede', subject: 'Subjekt',
          predicateMarker: 'Prädikat', directive: 'Befehl', preverb: 'Präverb', verb: 'Verb',
          complement: 'Ergänzung', object: 'Objekt', preposition: 'Präposition' },
    en: { context: 'context', particle: 'particle', vocative: 'address', subject: 'subject',
          predicateMarker: 'predicate', directive: 'command', preverb: 'preverb', verb: 'verb',
          complement: 'complement', object: 'object', preposition: 'preposition' },
  };

  const roleLabel = (role, lang) => (ROLES[lang] || ROLES.de)[role] || role;

  function describe(violation, lang) {
    const table = MESSAGES[lang] || MESSAGES.de;
    const make = table[violation.key] || MESSAGES.de[violation.key];
    return make ? make(violation.params || {}, table) : violation.key;
  }

  const CONCEPT_OF_RULE = {
    liAfterMiSina: 'c_mi_sina',
    missingLi: 'c_li', missingSubject: 'c_li', missingPredicate: 'c_li', repeatedParticle: 'c_li',
    objectWithoutNoun: 'c_e_objekt',
    piWithSingleWord: 'c_pi', piWithoutContent: 'c_pi',
    vocativeWithoutContent: 'c_o',
    emptyContext: 'c_la', contextWithoutClause: 'c_la',
    properNameNotTokiponized: 'c_namen', properNameAsHead: 'c_namen',
  };

  class Engine {
    constructor(tokens) {
      this.tokens = tokens;
      this.pos = 0;
      this.limit = tokens.length;
      this.violations = [];
      this.suppress = false;
    }

    report(rule, tokens, key, params = {}, correction = null) {
      if (this.suppress && (rule === 'unknownWord' || rule === 'properNameNotTokiponized')) return;
      this.violations.push({
        rule, key, params, correction,
        concept: CONCEPT_OF_RULE[rule] || null,
        tokenIndices: tokens.map((t) => t.index),
      });
    }

    run() {
      if (!this.tokens.length) { this.report('emptyUtterance', [], 'emptyUtterance'); return null; }
      this.reportLexicalIssues();

      let start = 0, end = this.tokens.length;
      const finals = [];
      let question = this.tokens.some((t) => t.text === 'seme' && t.word);

      if (end - start > 1 && this.tokens[start].text === 'taso' && this.tokens[start].word) start += 1;

      let changed = true;
      while (changed) {
        changed = false;
        if (end - start >= 3
            && this.tokens[end - 2].text === 'anu' && this.tokens[end - 2].word
            && this.tokens[end - 1].text === 'seme' && this.tokens[end - 1].word) {
          question = true;
          finals.unshift(this.tokens[end - 2], this.tokens[end - 1]);
          end -= 2; changed = true;
        }
        while (end - start > 1 && this.tokens[end - 1].word
               && (this.tokens[end - 1].text === 'a' || this.tokens[end - 1].text === 'kin')) {
          finals.unshift(this.tokens[end - 1]);
          end -= 1; changed = true;
        }
      }

      const interjection = { contexts: [], clause: { kind: 'interjection', subjects: [], predicates: [] },
                             finalParticles: finals, isQuestion: question };
      if (start >= end) return interjection;
      if (end - start === 1) {
        const word = this.tokens[start].word;
        if (word && word.roles.includes('interjection')) return interjection;
      }

      const contexts = [];
      let segment = start;
      for (;;) {
        const la = this.indexOfTopLevel('la', segment, end);
        if (la === null) break;
        if (la === segment) {
          this.report('emptyContext', [this.tokens[la]], 'emptyContext');
        } else {
          const clause = this.parseClause(segment, la);
          if (clause) {
            if (clause.kind === 'fragment' && clause.subjects.length === 1) {
              contexts.push({ kind: 'phrase', phrase: clause.subjects[0] });
            } else contexts.push({ kind: 'clause', clause });
          }
        }
        segment = la + 1;
      }

      if (segment >= end) {
        this.report('contextWithoutClause', [this.tokens[end - 1]], 'contextWithoutClause');
        return { contexts, clause: null, finalParticles: finals, isQuestion: question };
      }

      const clause = this.parseClause(segment, end);
      if (clause && clause.predicates.some((p) => p.isPolarQuestion)) question = true;
      return { contexts, clause, finalParticles: finals, isQuestion: question };
    }

    reportLexicalIssues() {
      for (const token of this.tokens) {
        if (token.kind === 'unknown') {
          this.report('unknownWord', [token],
            token.suggestion ? 'unknownWordSuggest' : 'unknownWord',
            { word: token.original, suggestion: token.suggestion },
            token.suggestion);
        } else if (token.kind === 'malformedName') {
          this.report('properNameNotTokiponized', [token], 'properNameNotTokiponized',
            { word: token.original, kind: token.problem.kind, detail: token.problem.detail });
        }
      }
    }

    parseClause(from, to) {
      if (from >= to) return null;

      const oIndex = this.indexOfTopLevel('o', from, to);
      if (oIndex !== null) return this.parseDirective(from, oIndex, to);

      const liIndex = this.indexOfTopLevel('li', from, to);

      if (liIndex === from) {
        this.report('missingSubject', [this.tokens[liIndex]], 'missingSubject');
      }
      if (liIndex === from + 1 && this.isBarePronoun(this.tokens[from])) {
        this.report('liAfterMiSina', [this.tokens[liIndex]], 'liAfterMiSina',
          { word: this.tokens[from].text },
          this.tokens[from].text + ' ' + this.tokens.slice(from + 2, to).map((t) => t.text).join(' '));
      }

      let subjects = [], predicates = [];

      if (liIndex !== null) {
        if (liIndex > from) {
          this.pos = from; this.limit = liIndex;
          subjects = this.parseSubjectChain();
          this.reportLeftovers(liIndex);
        }
        this.pos = liIndex; this.limit = to;
        predicates = this.parsePredicateChain();
      } else if (this.isBarePronoun(this.tokens[from])) {
        this.pos = from; this.limit = Math.min(from + 1, to);
        const subject = this.parseNounPhrase();
        if (subject) subjects = [subject];
        this.pos = from + 1; this.limit = to;
        if (this.pos < to) {
          predicates = [this.parsePredicate(null)];
          predicates = predicates.concat(this.parsePredicateChain());
        }
      } else {
        this.pos = from; this.limit = to;
        subjects = this.parseSubjectChain();
        if (this.pos < to) {
          if (isParticle(this.tokens[this.pos], 'e')) {
            this.report('missingLi', [this.tokens[this.pos]], 'missingLi', {},
              this.correctionWithLi(from, to));
            this.pos = to;
            return { kind: 'declarative', subjects, predicates: [] };
          }
          this.reportLeftovers(to);
        }
        return { kind: 'fragment', subjects, predicates: [] };
      }

      return { kind: 'declarative', subjects, predicates };
    }

    parseDirective(from, oIndex, to) {
      let subjects = [];
      if (oIndex > from) {
        this.pos = from; this.limit = oIndex;
        subjects = this.parseSubjectChain();
        this.reportLeftovers(oIndex);
      }
      const marker = this.tokens[oIndex];
      this.pos = oIndex + 1; this.limit = to;
      let predicates = [];
      if (this.pos < to) {
        predicates.push(this.parsePredicate(marker));
        predicates = predicates.concat(this.parsePredicateChain());
      }
      if (!subjects.length && !predicates.length) {
        this.report('vocativeWithoutContent', [marker], 'vocativeWithoutContent');
      }
      return { kind: predicates.length ? 'imperative' : 'vocative', subjects, predicates };
    }

    parseSubjectChain() {
      const phrases = [];
      const first = this.parseNounPhrase(true);
      if (!first) return phrases;
      phrases.push(first);
      while (this.pos < this.limit
             && (isParticle(this.tokens[this.pos], 'en') || isParticle(this.tokens[this.pos], 'anu'))) {
        this.pos += 1;
        const next = this.parseNounPhrase(true);
        if (!next) break;
        phrases.push(next);
      }
      return phrases;
    }

    chainsPredicate(token) {
      return isParticle(token, 'li') || isParticle(token, 'anu');
    }

    parsePredicateChain() {
      const predicates = [];
      while (this.pos < this.limit && this.chainsPredicate(this.tokens[this.pos])) {
        const marker = this.tokens[this.pos];
        this.pos += 1;
        if (this.pos < this.limit && isParticle(this.tokens[this.pos], 'li')) {
          this.report('repeatedParticle', [this.tokens[this.pos]], 'repeatedParticle', { word: 'li' });
          continue;
        }
        predicates.push(this.parsePredicate(marker));
      }
      return predicates;
    }

    parsePredicate(marker) {
      const preverbs = [];
      let negated = false, polar = false;

      while (this.pos < this.limit && isPreverb(this.tokens[this.pos])) {
        const preverb = this.tokens[this.pos];
        if (this.pos + 1 >= this.limit) break;
        const next = this.tokens[this.pos + 1];
        if (isBoundary(next)) break;
        if (next.text === 'ala' && next.word) {
          if (this.pos + 2 < this.limit && this.tokens[this.pos + 2].text === preverb.text) {
            if (this.pos + 3 >= this.limit || isBoundary(this.tokens[this.pos + 3])) break;
            polar = true;
            preverbs.push({ token: preverb, isNegated: false });
            this.pos += 3;
            continue;
          }
          if (this.pos + 2 < this.limit && !isBoundary(this.tokens[this.pos + 2])) {
            preverbs.push({ token: preverb, isNegated: true });
            negated = true;
            this.pos += 2;
            continue;
          }
          break;
        }
        preverbs.push({ token: preverb, isNegated: false });
        this.pos += 1;
      }

      let core = { kind: 'missing' };
      if (this.pos < this.limit && isPreposition(this.tokens[this.pos])) {
        core = { kind: 'prepositional', phrase: this.parsePrepositionalPhrase() };
      } else if (this.pos < this.limit && !isBoundary(this.tokens[this.pos])) {
        const phrase = this.parseNounPhrase();
        if (phrase) core = { kind: 'phrase', phrase };
      } else {
        this.report('missingPredicate', marker ? [marker] : [], 'missingPredicate',
          { word: marker ? marker.text : null });
      }

      if (core.kind === 'phrase') {
        const mods = core.phrase.modifiers;
        mods.forEach((modifier, offset) => {
          if (modifier.kind !== 'simple' || modifier.token.text !== 'ala' || !modifier.token.word) return;
          const following = mods[offset + 1];
          if (following && following.kind === 'simple'
              && following.token.text === core.phrase.head.text) polar = true;
          else negated = true;
        });
      }

      const objects = [], prepositions = [];
      while (this.pos < this.limit) {
        const token = this.tokens[this.pos];
        if (isParticle(token, 'e')) {
          this.pos += 1;
          if (this.pos < this.limit && isParticle(this.tokens[this.pos], 'e')) {
            this.report('repeatedParticle', [this.tokens[this.pos]], 'repeatedParticle', { word: 'e' });
            continue;
          }
          const object = this.parseNounPhrase();
          if (object) {
            objects.push(object);
            while (this.pos < this.limit && isParticle(this.tokens[this.pos], 'en')) {
              this.pos += 1;
              const further = this.parseNounPhrase();
              if (!further) break;
              objects.push(further);
            }
          } else {
            this.report('objectWithoutNoun', [token], 'objectWithoutNoun');
          }
        } else if (isPreposition(token)) {
          const phrase = this.parsePrepositionalPhrase();
          if (phrase.object === null) {
            if (objects.length) objects[objects.length - 1].modifiers.push({ kind: 'simple', token });
            else if (core.kind === 'phrase') core.phrase.modifiers.push({ kind: 'simple', token });
            else prepositions.push(phrase);
          } else prepositions.push(phrase);
        } else break;
      }

      if (this.pos < this.limit && !this.chainsPredicate(this.tokens[this.pos])) {
        this.report('unexpectedToken', [this.tokens[this.pos]], 'unexpectedToken',
          { word: this.tokens[this.pos].original });
        while (this.pos < this.limit && !this.chainsPredicate(this.tokens[this.pos])) this.pos += 1;
      }

      return { marker, preverbs, core, objects, prepositions, isNegated: negated, isPolarQuestion: polar };
    }

    parsePrepositionalPhrase() {
      const preposition = this.tokens[this.pos];
      this.pos += 1;
      let object = null;
      if (this.pos < this.limit && !isBoundary(this.tokens[this.pos])
          && !isParticle(this.tokens[this.pos], 'pi')) {
        object = this.parseNounPhrase();
      }
      return { preposition, object };
    }

    parseNounPhrase(allowPrepositionAsModifier = false) {
      if (this.pos >= this.limit) return null;
      const head = this.tokens[this.pos];

      if (isBoundary(head) || isParticle(head, 'pi')) {
        this.report('particleInPhrasePosition', [head], 'particleInPhrasePosition', { word: head.text });
        return null;
      }
      if (isProperName(head)) {
        this.report('properNameAsHead', [head], 'properNameAsHead', {}, `jan ${head.original}`);
      }

      this.pos += 1;
      const modifiers = [];
      let embedded = null;

      if (head.followedByColon) {
        embedded = this.parseEmbedded();
        return { head, modifiers, embedded };
      }

      while (this.pos < this.limit) {
        const token = this.tokens[this.pos];

        if (isParticle(token, 'pi')) {
          this.pos += 1;
          const group = [];
          while (this.pos < this.limit && !isBoundary(this.tokens[this.pos])
                 && !isParticle(this.tokens[this.pos], 'pi') && canModify(this.tokens[this.pos])) {
            group.push(this.tokens[this.pos]);
            this.pos += 1;
          }
          if (!group.length) {
            this.report('piWithoutContent', [token], 'piWithoutContent');
          } else if (group.length === 1) {
            this.report('piWithSingleWord', [token, group[0]], 'piWithSingleWord', {},
              `${head.text} ${group[0].text}`);
            modifiers.push({ kind: 'simple', token: group[0] });
          } else {
            modifiers.push({ kind: 'group', tokens: group });
          }
          continue;
        }

        if (isBoundary(token)) break;
        if (isPreposition(token) && !allowPrepositionAsModifier) break;
        if (!canModify(token)) break;

        modifiers.push({ kind: 'simple', token });
        this.pos += 1;

        if (token.followedByColon) { embedded = this.parseEmbedded(); break; }
      }

      return { head, modifiers, embedded };
    }

    parseEmbedded() {
      if (this.pos >= this.limit) return null;
      const slice = this.tokens.slice(this.pos, this.limit);
      this.pos = this.limit;
      const engine = new Engine(slice);
      engine.suppress = true;
      const utterance = engine.run();
      if (!utterance) return null;
      this.violations = this.violations.concat(engine.violations);
      return utterance;
    }

    indexOfTopLevel(particle, from, to) {
      for (let index = from; index < to; index += 1) {
        if (isParticle(this.tokens[index], particle)) return index;
        if (this.tokens[index].followedByColon) return null;
      }
      return null;
    }

    isBarePronoun(token) {
      return token.word !== null && token.word.roles.includes('pronoun')
        && (token.text === 'mi' || token.text === 'sina');
    }

    reportLeftovers(bound) {
      if (this.pos >= bound) return;
      this.report('unexpectedToken', [this.tokens[this.pos]], 'unexpectedToken',
        { word: this.tokens[this.pos].original });
      this.pos = bound;
    }

    correctionWithLi(from, to) {
      const objectIndex = this.indexOfTopLevel('e', from, to);
      if (objectIndex === null) return null;
      const insertion = Math.max(from + 1, objectIndex - 1);
      const words = this.tokens.slice(from, to).map((t) => t.text);
      words.splice(insertion - from, 0, 'li');
      return words.join(' ');
    }
  }

  function parse(input) {
    const tokens = tokenize(input);
    const engine = new Engine(tokens);
    const utterance = engine.run();
    return { tokens, utterance, violations: engine.violations, isValid: !engine.violations.length };
  }

  // ---------------------------------------------------------------- Satzröntgen

  const phraseTokens = (phrase) => {
    const out = [phrase.head];
    for (const modifier of phrase.modifiers) {
      if (modifier.kind === 'group') out.push(...modifier.tokens);
      else out.push(modifier.token);
    }
    return out;
  };
  const phraseText = (phrase) => phraseTokens(phrase).map((t) => t.text).join(' ');

  // ------------------------------------------------------------- Silben

  // Jedes Wort zerfällt in Silben der Form (K)V(n). Ein n gehört zur Silbe,
  // wenn danach kein Vokal kommt: lin-ja, mon-su-ta, aber a-ni? gibt es nicht.
  function syllables(word) {
    const letters = String(word || '').toLowerCase();
    const out = [];
    let index = 0;
    while (index < letters.length) {
      let syllable = '';
      if ('jklmnpstw'.includes(letters[index])) { syllable += letters[index]; index += 1; }
      if ('aeiou'.includes(letters[index])) { syllable += letters[index]; index += 1; }
      if (letters[index] === 'n'
          && (index + 1 >= letters.length || !'aeiou'.includes(letters[index + 1]))) {
        syllable += 'n';
        index += 1;
      }
      if (!syllable) return null;                 // kein toki-pona-Wort
      out.push(syllable);
    }
    return out.length ? out : null;
  }

  // ---------------------------------------------------------- Wortverbände

  // Welche Wörter treten mit welchen zusammen auf? Das liest der Parser aus
  // fertigen Sätzen — Kopfwort und seine einfachen Beifügungen.
  function phrasesIn(text) {
    const found = [];
    for (const part of splitUtterances(text)) {
      const result = parse(part);
      if (!result.isValid || !result.utterance) continue;
      for (const phrase of collectPhrases(result.utterance)) {
        const words = phraseTokens(phrase)
          .filter((token) => token.word && token.kind === 'known')
          .map((token) => token.text);
        if (words.length > 1) found.push(words);
      }
    }
    return found;
  }

  // --------------------------------------------------- Namen und Fremdwörter

  // toki pona hat 14 Buchstaben und nur Silben der Form (K)V(n). Fremde Namen
  // werden nicht übersetzt, sondern nachgesprochen: Deutschland wird zu
  // ma Tosi, Klaus zu jan Kalusi. Das hier ist die Nachsprech-Maschine —
  // sie liefert garantiert etwas, das die Lautlehre besteht (unten geprüft).
  const FOLD = {
    'ä': 'a', 'à': 'a', 'á': 'a', 'â': 'a', 'å': 'a', 'ã': 'a', 'æ': 'e',
    'ë': 'e', 'è': 'e', 'é': 'e', 'ê': 'e',
    'ï': 'i', 'ì': 'i', 'í': 'i', 'î': 'i',
    'ö': 'o', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ø': 'o',
    'ü': 'u', 'ù': 'u', 'ú': 'u', 'û': 'u',
    'ß': 's', 'ç': 's', 'ñ': 'n', 'ý': 'i', 'ÿ': 'i', 'ł': 'l', 'đ': 't',
  };

  // Buchstabenpaare zuerst: sch klingt wie s, ch wie k, x wie ks.
  const DIGRAPHS = [
    ['tsch', 's'], ['sch', 's'], ['sh', 's'], ['ch', 'k'], ['ck', 'k'],
    ['ph', 'p'], ['th', 't'], ['gh', 'k'], ['qu', 'ku'], ['x', 'ks'],
  ];

  const SINGLE = {
    b: 'p', c: 'k', d: 't', f: 'p', g: 'k', h: '', q: 'k', r: 'l', v: 'w',
    y: 'i', z: 's',
  };

  const VOWELS_TP = 'aeiou';
  const CONSONANTS_TP = 'jklmnpstw';

  function foreignName(input) {
    let text = String(input || '').toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    text = text.replace(/[^a-zäöüßçñøåæýÿłđ]/g, ' ').trim();
    if (!text) return null;

    const parts = text.split(/\s+/).map((word) => {
      let letters = word.split('').map((c) => FOLD[c] || c).join('');
      // c vor hellen Vokalen klingt wie s (Cecilia), sonst wie k (Carla).
      letters = letters.replace(/c(?=[ei])/g, 's');
      for (const [from, to] of DIGRAPHS) letters = letters.split(from).join(to);
      letters = letters.split('').map((c) => (SINGLE[c] !== undefined ? SINGLE[c] : c)).join('');
      letters = letters.split('').filter((c) => VOWELS_TP.includes(c) || CONSONANTS_TP.includes(c)).join('');
      if (!letters) return '';

      // Nächster Vokal im Wort — er füllt eingeschobene Silben.
      const nextVowel = (from) => {
        for (let i = from; i < letters.length; i += 1) {
          if (VOWELS_TP.includes(letters[i])) return letters[i];
        }
        return null;
      };

      const syllables = [];
      let index = 0;
      let last = 'a';
      while (index < letters.length) {
        let onset = '';
        if (CONSONANTS_TP.includes(letters[index])) {
          onset = letters[index];
          index += 1;
          // Doppelkonsonant: nn, ll … der zweite fällt weg.
          while (index < letters.length && letters[index] === onset) index += 1;
        }
        let vowel;
        if (index < letters.length && VOWELS_TP.includes(letters[index])) {
          vowel = letters[index];
          index += 1;
          // Vokalfolgen ziehen sich zusammen: au wird a, ei wird e.
          while (index < letters.length && VOWELS_TP.includes(letters[index])) index += 1;
        } else if (onset) {
          vowel = nextVowel(index) || last;      // eingeschobener Vokal
        } else {
          index += 1;
          continue;
        }
        last = vowel;

        // Ein n darf die Silbe schließen — aber nicht vor n oder m.
        let coda = '';
        if (letters[index] === 'n') {
          const after = letters[index + 1];
          if (!after || (CONSONANTS_TP.includes(after) && after !== 'n' && after !== 'm')) {
            coda = 'n';
            index += 1;
          }
        }
        // Silben ohne Anlaut gibt es nur am Wortanfang.
        if (!onset && syllables.length) onset = 'k';
        // Vier Silben gibt es nicht: ti ji wo wu. Ersetzt wird der Anlaut,
        // damit die Silbe nicht ihren Halt verliert — nur ganz am Anfang darf
        // sie auch ohne Anlaut stehen.
        if (onset === 't' && vowel === 'i') onset = 's';
        else if (onset === 'w' && (vowel === 'o' || vowel === 'u')) onset = 'p';
        else if (onset === 'j' && vowel === 'i') onset = syllables.length ? 's' : '';
        if (!onset && syllables.length) onset = 'k';
        syllables.push(onset + vowel + coda);
      }

      let built = syllables.join('');
      // Letzter Rettungsanker: solange kürzen, bis die Lautlehre zufrieden ist.
      let guard = 0;
      while (built && phonoCheck(built) && guard < 12) {
        built = built.slice(0, -1);
        guard += 1;
      }
      return built;
    }).filter(Boolean);

    if (!parts.length) return null;
    const joined = parts.join(' ').split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return joined;
  }

  // ------------------------------------------------- gleichwertige Stellung

  // Beifügungen desselben Kopfworts dürfen die Plätze tauschen, ohne dass sich
  // die Aussage ändert: „jan lili mije“ und „jan mije lili“ sind beide der
  // kleine männliche Mensch. Ein paar Wörter binden allerdings fester und
  // dürfen nicht wandern — Zahlen und Mengen, die Verneinung, und die
  // Präpositionen, die feste Fügungen bilden (tomo tawa ist ein Fahrzeug).
  const FIXED_ORDER = new Set([
    'ala', 'taso', 'kin', 'seme', 'nanpa', 'mute', 'wan', 'tu', 'luka', 'ale', 'ali',
    'tawa', 'lon', 'tan', 'kepeken', 'sama',
  ]);

  // Alle Wortgruppen eines Satzes einsammeln — dieselben Stellen, die auch das
  // Satzröntgen beschriftet.
  function collectPhrases(utterance, out) {
    const found = out || [];
    if (!utterance) return found;
    const take = (phrase) => {
      if (!phrase) return;
      found.push(phrase);
      if (phrase.embedded) collectPhrases(phrase.embedded, found);
    };
    const clause = (node) => {
      if (!node) return;
      node.subjects.forEach(take);
      for (const predicate of node.predicates) {
        if (predicate.core.kind === 'phrase') take(predicate.core.phrase);
        else if (predicate.core.phrase) take(predicate.core.phrase.object);
        predicate.objects.forEach(take);
        for (const prepositional of predicate.prepositions) take(prepositional.object);
      }
    };
    for (const context of utterance.contexts) {
      if (context.kind === 'phrase') take(context.phrase);
      else clause(context.clause);
    }
    clause(utterance.clause);
    return found;
  }

  // Vergleichsform eines Satzes: fehlerfrei geparst, und in jeder Wortgruppe
  // stehen die vertauschbaren Beifügungen alphabetisch. Zwei Sätze mit
  // derselben Vergleichsform sagen dasselbe.
  function canonical(input) {
    const { tokens, utterance, isValid } = parse(input);
    if (!isValid || !utterance) return null;
    const words = tokens.map((token) => token.text);

    for (const phrase of collectPhrases(utterance)) {
      const modifiers = phrase.modifiers || [];
      if (modifiers.length < 2) continue;
      // pi-Gruppen bleiben, wo sie sind: ihre Reichweite hängt am Platz.
      if (modifiers.some((modifier) => modifier.kind !== 'simple')) continue;
      // Namen bleiben am Kopfwort kleben: jan Sonja suli, nicht jan suli Sonja.
      if (modifiers.some((modifier) => modifier.token.kind !== 'known')) continue;
      const texts = modifiers.map((modifier) => modifier.token.text);
      if (texts.some((text) => FIXED_ORDER.has(text))) continue;
      const places = modifiers.map((modifier) => modifier.token.index);
      // Nur zusammenhängende Beifügungen umsortieren.
      if (places.some((place, i) => i > 0 && place !== places[i - 1] + 1)) continue;
      const sorted = texts.slice().sort();
      places.forEach((place, i) => { words[place] = sorted[i]; });
    }
    return words.join(' ');
  }

  // Sagen zwei Sätze dasselbe, obwohl sie verschieden geschrieben sind?
  function sameMeaning(a, b) {
    const left = canonical(a);
    const right = canonical(b);
    return Boolean(left && right && left === right);
  }

  function xray(utterance) {
    if (!utterance) return [];
    const spans = [];
    const push = (tokens, role) => spans.push({
      text: tokens.map((t) => t.text).join(' '), role, indices: tokens.map((t) => t.index),
    });

    for (const context of utterance.contexts) {
      if (context.kind === 'phrase') push(phraseTokens(context.phrase), 'context');
      else spans.push(...clauseSpans(context.clause, true));
    }
    if (utterance.clause) spans.push(...clauseSpans(utterance.clause, false));
    for (const particle of utterance.finalParticles) push([particle], 'particle');
    return spans;

    function clauseSpans(clause, contextual) {
      const out = [];
      const add = (tokens, role) => out.push({
        text: tokens.map((t) => t.text).join(' '), role, indices: tokens.map((t) => t.index),
      });
      const vocative = clause.kind === 'vocative' || clause.kind === 'imperative';
      for (const subject of clause.subjects) {
        add(phraseTokens(subject), vocative ? 'vocative' : (contextual ? 'context' : 'subject'));
        if (subject.embedded) out.push(...xray(subject.embedded));
      }
      for (const predicate of clause.predicates) {
        if (predicate.marker) {
          add([predicate.marker], predicate.marker.text === 'o' ? 'directive' : 'predicateMarker');
        }
        for (const preverb of predicate.preverbs) add([preverb.token], 'preverb');
        if (predicate.core.kind === 'phrase') {
          add(phraseTokens(predicate.core.phrase), 'verb');
          if (predicate.core.phrase.embedded) out.push(...xray(predicate.core.phrase.embedded));
        } else if (predicate.core.kind === 'prepositional') {
          add([predicate.core.phrase.preposition], 'verb');
          if (predicate.core.phrase.object) add(phraseTokens(predicate.core.phrase.object), 'complement');
        }
        for (const object of predicate.objects) {
          add(phraseTokens(object), 'object');
          if (object.embedded) out.push(...xray(object.embedded));
        }
        for (const prepositional of predicate.prepositions) {
          add([prepositional.preposition], 'preposition');
          if (prepositional.object) add(phraseTokens(prepositional.object), 'complement');
        }
      }
      return out;
    }
  }

  return {
    parse, tokenize, splitUtterances, xray, phonoCheck, suggest, editDistance, describe, roleLabel,
    lookup, phraseText, canonical, sameMeaning, foreignName, syllables, phrasesIn,
    lexicon: LEX,
  };
})(typeof TOKIPONA_DATA !== 'undefined' ? TOKIPONA_DATA : require('./data.js'));

if (typeof module !== 'undefined') { module.exports = TokiPona; }

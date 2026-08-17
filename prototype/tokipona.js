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

  const PHONO_MESSAGE = {
    emptyString: () => 'Leere Zeichenkette.',
    foreignLetter: (c) => `„${c}“ gehört nicht zu den 14 Buchstaben von toki pona.`,
    forbiddenSyllable: (s) => `Die Silbe „${s}“ ist in toki pona nicht erlaubt.`,
    missingVowel: () => 'Jede Silbe braucht einen Vokal.',
    danglingConsonant: () => 'Nach dem letzten Vokal ist nur „n“ erlaubt.',
  };

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

    report(rule, tokens, message, correction = null) {
      if (this.suppress && (rule === 'unknownWord' || rule === 'properNameNotTokiponized')) return;
      this.violations.push({
        rule, message, correction,
        concept: CONCEPT_OF_RULE[rule] || null,
        tokenIndices: tokens.map((t) => t.index),
      });
    }

    run() {
      if (!this.tokens.length) { this.report('emptyUtterance', [], 'Der Satz ist leer.'); return null; }
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
          this.report('emptyContext', [this.tokens[la]], 'Vor „la“ fehlt der Kontext.');
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
        this.report('contextWithoutClause', [this.tokens[end - 1]], 'Nach „la“ fehlt der Hauptsatz.');
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
            token.suggestion
              ? `„${token.original}“ steht nicht im Wortschatz. Meintest du „${token.suggestion}“?`
              : `„${token.original}“ steht nicht im Wortschatz.`,
            token.suggestion);
        } else if (token.kind === 'malformedName') {
          const message = PHONO_MESSAGE[token.problem.kind](token.problem.detail);
          this.report('properNameNotTokiponized', [token],
            `„${token.original}“ ist kein toki-pona-Name: ${message}`);
        }
      }
    }

    parseClause(from, to) {
      if (from >= to) return null;

      const oIndex = this.indexOfTopLevel('o', from, to);
      if (oIndex !== null) return this.parseDirective(from, oIndex, to);

      const liIndex = this.indexOfTopLevel('li', from, to);

      if (liIndex === from) {
        this.report('missingSubject', [this.tokens[liIndex]], 'Vor „li“ fehlt das Satzsubjekt.');
      }
      if (liIndex === from + 1 && this.isBarePronoun(this.tokens[from])) {
        this.report('liAfterMiSina', [this.tokens[liIndex]],
          `Nach „${this.tokens[from].text}“ als alleinigem Subjekt entfällt „li“.`,
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
            this.report('missingLi', [this.tokens[this.pos]], 'Vor dem Prädikat fehlt „li“.',
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
        this.report('vocativeWithoutContent', [marker],
          '„o“ braucht eine Anrede davor oder einen Befehl danach.');
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
          this.report('repeatedParticle', [this.tokens[this.pos]], '„li“ steht doppelt.');
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
        this.report('missingPredicate', marker ? [marker] : [],
          marker ? `Nach „${marker.text}“ fehlt das Prädikat.` : 'Dem Satz fehlt das Prädikat.');
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
            this.report('repeatedParticle', [this.tokens[this.pos]], '„e“ steht doppelt.');
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
            this.report('objectWithoutNoun', [token], 'Nach „e“ fehlt das Objekt.');
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
        this.report('unexpectedToken', [this.tokens[this.pos]],
          `„${this.tokens[this.pos].original}“ passt an dieser Stelle nicht in den Satzbau.`);
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
        this.report('particleInPhrasePosition', [head],
          `„${head.text}“ ist ein Partikel und kann keine Phrase anführen.`);
        return null;
      }
      if (isProperName(head)) {
        this.report('properNameAsHead', [head],
          'Namen stehen als Beifügung hinter einem Wort wie jan, ma oder toki.',
          `jan ${head.original}`);
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
            this.report('piWithoutContent', [token], 'Nach „pi“ fehlt die Wortgruppe.');
          } else if (group.length === 1) {
            this.report('piWithSingleWord', [token, group[0]],
              '„pi“ gruppiert nur mehrwortige Beifügungen um; vor einem einzelnen Wort entfällt es.',
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
      this.report('unexpectedToken', [this.tokens[this.pos]],
        `„${this.tokens[this.pos].original}“ passt an dieser Stelle nicht in den Satzbau.`);
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

  function xray(utterance) {
    if (!utterance) return [];
    const spans = [];
    const push = (tokens, role) => spans.push({
      text: tokens.map((t) => t.text).join(' '), role, indices: tokens.map((t) => t.index),
    });

    for (const context of utterance.contexts) {
      if (context.kind === 'phrase') push(phraseTokens(context.phrase), 'Kontext');
      else spans.push(...clauseSpans(context.clause, true));
    }
    if (utterance.clause) spans.push(...clauseSpans(utterance.clause, false));
    for (const particle of utterance.finalParticles) push([particle], 'Partikel');
    return spans;

    function clauseSpans(clause, contextual) {
      const out = [];
      const add = (tokens, role) => out.push({
        text: tokens.map((t) => t.text).join(' '), role, indices: tokens.map((t) => t.index),
      });
      const vocative = clause.kind === 'vocative' || clause.kind === 'imperative';
      for (const subject of clause.subjects) {
        add(phraseTokens(subject), vocative ? 'Anrede' : (contextual ? 'Kontext' : 'Subjekt'));
        if (subject.embedded) out.push(...xray(subject.embedded));
      }
      for (const predicate of clause.predicates) {
        if (predicate.marker) {
          add([predicate.marker], predicate.marker.text === 'o' ? 'Befehl' : 'Prädikat');
        }
        for (const preverb of predicate.preverbs) add([preverb.token], 'Präverb');
        if (predicate.core.kind === 'phrase') {
          add(phraseTokens(predicate.core.phrase), 'Verb');
          if (predicate.core.phrase.embedded) out.push(...xray(predicate.core.phrase.embedded));
        } else if (predicate.core.kind === 'prepositional') {
          add([predicate.core.phrase.preposition], 'Verb');
          if (predicate.core.phrase.object) add(phraseTokens(predicate.core.phrase.object), 'Ergänzung');
        }
        for (const object of predicate.objects) {
          add(phraseTokens(object), 'Objekt');
          if (object.embedded) out.push(...xray(object.embedded));
        }
        for (const prepositional of predicate.prepositions) {
          add([prepositional.preposition], 'Präposition');
          if (prepositional.object) add(phraseTokens(prepositional.object), 'Ergänzung');
        }
      }
      return out;
    }
  }

  return {
    parse, tokenize, splitUtterances, xray, phonoCheck, suggest, editDistance,
    lookup, phraseText, lexicon: LEX,
  };
})(typeof TOKIPONA_DATA !== 'undefined' ? TOKIPONA_DATA : require('./data.js'));

if (typeof module !== 'undefined') { module.exports = TokiPona; }

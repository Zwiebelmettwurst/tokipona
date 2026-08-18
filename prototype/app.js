// Prototyp des Übungsflows. Zeigt den Kernkreislauf des Plans:
// bauen statt erkennen, sofortige Rückmeldung mit Satzröntgen, sichtbarer
// Fortschritt — ohne Herzen und ohne Bestenliste.

(function (DATA, MUSI, TP) {
  const KEY = 'o-toki-fortschritt-v1';
  const GOAL = 40;

  // Alles, was die Oberfläche sagt, steht hier — die Lektionen selbst kommen
  // aus den Kursdaten, die in derselben Sprache vorliegen.
  const T = {
    de: {
      level: 'Stufe', xpToday: (a, b) => `${a}/${b} XP heute`, days: 'Tage',
      greeting: 'o kama pona!',
      introFirst: 'Zwölf Lektionen. Du baust Sätze, statt Vokabeln abzuhaken.',
      introBack: (title) => `Weiter bei „${title}“.`,
      dueCards: (n) => `${n} ${n === 1 ? 'Karte' : 'Karten'} fällig`,
      dueSub: 'wörter, sätze und umschreibungen von vorher',
      concepts: 'konzepte',
      askWord: 'was heißt das wort?', askMeaning: 'was bedeutet der satz?',
      askBuild: 'bau den satz', askFix: 'hier stimmt ein wort nicht — tipp es an',
      askCompound: 'dafür gibt es kein wort — wie sagst du es?',
      askGlyph: 'welches wort ist das?', askFree: 'schreib es selbst — freie eingabe',
      hintFix: 'Ein Wort steht zu viel oder fehlt an dieser Stelle.',
      hintBuild: 'Antippen nimmt ein Wort zurück, Ziehen sortiert um.',
      hintFree: 'Der Parser prüft den Satzbau, während du tippst. Andere Wortwahl als '
        + 'die Musterlösung ist in Ordnung, solange die Grammatik stimmt.',
      check: 'Prüfen', next: 'Weiter', understood: 'Verstanden', again: 'Nochmal üben',
      good: 'pona!', notYet: 'Noch nicht',
      variantRight: 'Richtig — andere Wortwahl, gleiche Aussage',
      model: 'Musterlösung:', comesBack: 'Kommt in einer der nächsten Wiederholungen zurück.',
      structureOk: '✓ Satzbau in Ordnung', structureLive: '✓ Satzbau in Ordnung',
      missing: (words) => `Satzbau stimmt, aber es fehlt: ${words}`,
      covers: (word, list) => `<b>${word}</b> deckt: ${list}.`,
      literally: (tp, literal) => `<b>${tp}</b> — wörtlich: ${literal}.`,
      glyphIs: (word, list) => `ist <b>${word}</b> — ${list}.`,
      reviewDone: 'Wiederholung geschafft',
      reviewNote: 'Die Karten kommen wieder, wenn es Zeit dafür ist.',
      cards: 'karten', words: 'wörter', correct: 'richtig', xp: 'xp',
      search: 'Wort oder Bedeutung suchen …',
      sandboxTitle: 'o toki!',
      sandboxIntro: 'Schreib irgendetwas auf toki pona. Der Parser zerlegt es und sagt dir, '
        + 'was er sieht — oder was nicht stimmt.',
      sandboxQuestion: ' — eine Frage', sandboxTry: 'Probier:',
      sitelenHint: 'Die Zeichenschrift: ein Zeichen je Wort. Angeschaltet kommt in '
        + 'jeder Lektion eine Zeichenaufgabe dazu, und die Zeichen wandern in die '
        + 'Wiederholung. Der Kurs selbst bleibt unverändert.',
      sitelenOn: 'Zeichen dazulernen', sitelenOff: 'Zeichen abschalten',
      backupTitle: 'fortschritt sichern',
      backupState: (summary) => `Dein Stand liegt nur auf diesem Gerät: ${summary}. `
        + 'Safari räumt ihn nach sieben Tagen ohne Besuch weg — als Homescreen-App nicht.',
      backupSave: 'Sichern', backupLoad: 'Wiederherstellen',
      backupFile: 'Als Datei sichern oder teilen', backupCopy: 'Code in die Zwischenablage',
      backupCopied: 'Kopiert. Sicher ihn dir irgendwo, wo er nicht verlorengeht.',
      backupCopyFailed: 'Kopieren ging nicht — nimm die Datei.',
      backupPick: 'Sicherungsdatei wählen', backupPaste: '… oder Code hier einfügen',
      backupUnreadable: 'Das ist kein lesbarer Sicherungstext.',
      backupForeign: 'Darin steckt kein Fortschritt dieser App.',
      backupUnreadableFile: 'Datei ließ sich nicht lesen.',
      backupFound: (found, exported, now) => `Gefunden: ${found}`
        + `${exported ? ` · gesichert am ${exported}` : ''}.<br>Ersetzt deinen jetzigen Stand: ${now}.`,
      backupApply: 'Diesen Stand übernehmen',
      summary: (lvl, lessons, cards, xp) => `Stufe ${lvl}, ${lessons} Lektionen, ${cards} Karten, ${xp} XP`,
      langLabel: 'sprache', langOther: 'English',
      musiTab: 'musi', musiTitle: 'utala musi',
      musiLead: 'Sticheln, kontern, Frieden schließen — mit 137 Wörtern und ohne ein '
        + 'einziges Schimpfwort.',
      musiStart: 'utala anfangen',
      musiForgeTitle: 'nimi sin — frisch gebaut',
      musiForgeHint: 'Ein Muster, viele Füllungen. Der Parser prüft jeden Wurf, '
        + 'bevor er hier steht.',
      musiForge: 'Noch einen', musiPattern: 'Muster',
      musiSting: 'Frechheit', musiLiteral: 'wörtlich',
      musiSection: (name, count) => `${name} · ${count}`,
      musiPeace: 'Und danach: <i>mi musi taso</i> — war nur Spaß.',
      updateReady: 'Neue Fassung ist da.', updateLoad: 'Jetzt laden',
      versionLabel: (v) => `Fassung ${v}`,
      credit: (link) => `Prototyp. Übungssätze aus ${link} (MIT, © 2020 /dev/urandom `
        + 'und Mitwirkende), geprüft von TokiPonaKit.',
    },
    en: {
      level: 'Level', xpToday: (a, b) => `${a}/${b} XP today`, days: 'days',
      greeting: 'o kama pona!',
      introFirst: 'Twelve lessons. You build sentences instead of ticking off words.',
      introBack: (title) => `Continue with “${title}”.`,
      dueCards: (n) => `${n} ${n === 1 ? 'card' : 'cards'} due`,
      dueSub: 'words, sentences and paraphrases from before',
      concepts: 'concepts',
      askWord: 'what does this word mean?', askMeaning: 'what does this sentence mean?',
      askBuild: 'build the sentence', askFix: 'one word is wrong — tap it',
      askCompound: 'there is no word for this — how do you say it?',
      askGlyph: 'which word is this?', askFree: 'write it yourself — free input',
      hintFix: 'One word is too many or wrong in this spot.',
      hintBuild: 'Tap to take a word back, drag to reorder.',
      hintFree: 'The parser checks the structure as you type. A different word choice than '
        + 'the model answer is fine, as long as the grammar holds.',
      check: 'Check', next: 'Continue', understood: 'Got it', again: 'Practise again',
      good: 'pona!', notYet: 'Not yet',
      variantRight: 'Correct — different words, same meaning',
      model: 'Model answer:', comesBack: 'This will come back in one of the next reviews.',
      structureOk: '✓ structure is sound', structureLive: '✓ structure is sound',
      missing: (words) => `The structure holds, but this is missing: ${words}`,
      covers: (word, list) => `<b>${word}</b> covers: ${list}.`,
      literally: (tp, literal) => `<b>${tp}</b> — literally: ${literal}.`,
      glyphIs: (word, list) => `is <b>${word}</b> — ${list}.`,
      reviewDone: 'Review done',
      reviewNote: 'The cards return when it is time for them.',
      cards: 'cards', words: 'words', correct: 'correct', xp: 'xp',
      search: 'Search word or meaning …',
      sandboxTitle: 'o toki!',
      sandboxIntro: 'Write anything in toki pona. The parser takes it apart and tells you '
        + 'what it sees — or what does not hold.',
      sandboxQuestion: ' — a question', sandboxTry: 'Try:',
      sitelenHint: 'The writing system: one glyph per word. Switched on, every lesson gains '
        + 'a glyph exercise and the glyphs join the review queue. The course itself stays '
        + 'the same.',
      sitelenOn: 'Learn the glyphs', sitelenOff: 'Turn glyphs off',
      backupTitle: 'back up progress',
      backupState: (summary) => `Your progress lives on this device only: ${summary}. `
        + 'Safari clears it after seven days without a visit — not as a home screen app.',
      backupSave: 'Back up', backupLoad: 'Restore',
      backupFile: 'Save or share as a file', backupCopy: 'Copy code to clipboard',
      backupCopied: 'Copied. Keep it somewhere it will not get lost.',
      backupCopyFailed: 'Copying failed — use the file instead.',
      backupPick: 'Choose backup file', backupPaste: '… or paste the code here',
      backupUnreadable: 'That is not readable backup text.',
      backupForeign: 'There is no progress from this app in there.',
      backupUnreadableFile: 'The file could not be read.',
      backupFound: (found, exported, now) => `Found: ${found}`
        + `${exported ? ` · backed up on ${exported}` : ''}.<br>Replaces your current progress: ${now}.`,
      backupApply: 'Use this progress',
      summary: (lvl, lessons, cards, xp) => `level ${lvl}, ${lessons} lessons, ${cards} cards, ${xp} XP`,
      langLabel: 'language', langOther: 'Deutsch',
      musiTab: 'musi', musiTitle: 'utala musi',
      musiLead: 'Taunt, counter, make peace — with 137 words and not a single '
        + 'swear word.',
      musiStart: 'start the sparring',
      musiForgeTitle: 'nimi sin — freshly built',
      musiForgeHint: 'One pattern, many fillings. The parser checks every roll '
        + 'before it lands here.',
      musiForge: 'One more', musiPattern: 'pattern',
      musiSting: 'cheek', musiLiteral: 'literally',
      musiSection: (name, count) => `${name} · ${count}`,
      musiPeace: 'And afterwards: <i>mi musi taso</i> — it was only play.',
      updateReady: 'A new version is here.', updateLoad: 'Load it now',
      versionLabel: (v) => `Version ${v}`,
      credit: (link) => `Prototype. Exercise sentences from ${link} (MIT, © 2020 /dev/urandom `
        + 'and contributors), checked by TokiPonaKit.',
    },
  };

  const CONCEPT_LABELS = {
    de: {
      c_mi_sina: 'mi und sina ohne li',
      c_li: 'li vor dem Prädikat',
      c_modifikator: 'Beifügung folgt dem Kopf',
      c_e_objekt: 'e vor dem Objekt',
      c_pi: 'pi gruppiert um',
      c_la: 'la stellt Kontext voran',
      c_praeposition: 'Präpositionen',
      c_praeverb: 'Präverben',
      c_frage: 'Fragen',
      c_o: 'o für Anrede und Befehl',
      c_namen: 'Namen',
      c_ni: 'ni zeigt auf etwas',
      c_en: 'en verbindet Subjekte',
      c_zahlen: 'Zahlen',
    },
    en: {
      c_mi_sina: 'mi and sina without li',
      c_li: 'li before the predicate',
      c_modifikator: 'modifier follows the head',
      c_e_objekt: 'e before the object',
      c_pi: 'pi regroups',
      c_la: 'la fronts the context',
      c_praeposition: 'prepositions',
      c_praeverb: 'preverbs',
      c_frage: 'questions',
      c_o: 'o for address and command',
      c_namen: 'names',
      c_ni: 'ni points at something',
      c_en: 'en joins subjects',
      c_zahlen: 'numbers',
    },
  };

  // Die Kernfertigkeit von toki pona: ausdrücken, wofür es kein Wort gibt.
  // Jede Umschreibung ist beim Bauen durch den Parser gelaufen.
  const COMPOUNDS = [
    { name: { de: 'Auto', en: 'Car' }, tp: 'tomo tawa',
      literal: { de: 'sich bewegendes Haus', en: 'moving house' } },
    { name: { de: 'Kaffee', en: 'Coffee' }, tp: 'telo pimeja wawa',
      literal: { de: 'dunkles starkes Wasser', en: 'dark strong water' } },
    { name: { de: 'Computer', en: 'Computer' }, tp: 'ilo sona',
      literal: { de: 'Wissens-Gerät', en: 'knowledge tool' } },
    { name: { de: 'Telefon', en: 'Phone' }, tp: 'ilo toki',
      literal: { de: 'Sprech-Gerät', en: 'talking tool' } },
    { name: { de: 'Uhr', en: 'Clock' }, tp: 'ilo tenpo',
      literal: { de: 'Zeit-Gerät', en: 'time tool' } },
    { name: { de: 'Fahrrad', en: 'Bicycle' }, tp: 'ilo tawa',
      literal: { de: 'Bewegungs-Gerät', en: 'moving tool' } },
    { name: { de: 'Brille', en: 'Glasses' }, tp: 'len lukin',
      literal: { de: 'Seh-Kleidung', en: 'seeing cloth' } },
    { name: { de: 'Bibliothek', en: 'Library' }, tp: 'tomo lipu',
      literal: { de: 'Dokumenten-Haus', en: 'document house' } },
    { name: { de: 'Restaurant', en: 'Restaurant' }, tp: 'tomo moku',
      literal: { de: 'Essens-Haus', en: 'food house' } },
    { name: { de: 'Schule', en: 'School' }, tp: 'tomo sona',
      literal: { de: 'Wissens-Haus', en: 'knowledge house' } },
    { name: { de: 'Kino', en: 'Cinema' }, tp: 'tomo pi sitelen tawa',
      literal: { de: 'Haus der bewegten Bilder', en: 'house of moving pictures' } },
    { name: { de: 'Musik', en: 'Music' }, tp: 'kalama musi',
      literal: { de: 'unterhaltsamer Klang', en: 'entertaining sound' } },
    { name: { de: 'Regen', en: 'Rain' }, tp: 'telo tan sewi',
      literal: { de: 'Wasser von oben', en: 'water from above' } },
    { name: { de: 'Bier', en: 'Beer' }, tp: 'telo nasa',
      literal: { de: 'seltsames Wasser', en: 'strange water' } },
    { name: { de: 'Suppe', en: 'Soup' }, tp: 'telo moku',
      literal: { de: 'Ess-Wasser', en: 'food water' } },
    { name: { de: 'Arzt', en: 'Doctor' }, tp: 'jan pi pona sijelo',
      literal: { de: 'Mensch der Körper-Güte', en: 'person of body goodness' } },
    { name: { de: 'Lehrerin', en: 'Teacher' }, tp: 'jan pi pana sona',
      literal: { de: 'Mensch, der Wissen gibt', en: 'person who gives knowledge' } },
    { name: { de: 'Freund', en: 'Friend' }, tp: 'jan pona',
      literal: { de: 'guter Mensch', en: 'good person' } },
  ];


  const app = document.getElementById('app');
  const today = () => new Date().toISOString().slice(0, 10);

  const blank = {
    xp: 0, streak: 0, lastDay: null, dayXp: 0, done: {}, mastery: {}, seenWords: {}, srs: {},
    sitelen: false,
    lang: (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en',
  };

  // Lernschritte wie in bewährten Karteikartensystemen: erst zehn Minuten,
  // dann Tage. Der kurze erste Schritt macht die Wiederholung schon in der
  // ersten Sitzung sichtbar, statt sie auf morgen zu vertagen.
  const MINUTE = 60000;
  const DAY = 86400000;
  const STEPS = [10 * MINUTE, DAY, 3 * DAY, 7 * DAY];

  // Übersetzung nachschlagen; fehlt ein Eintrag, greift Deutsch.
  const t = (key, ...args) => {
    const table = T[state.lang] || T.de;
    const value = table[key] !== undefined ? table[key] : T.de[key];
    return typeof value === 'function' ? value(...args) : value;
  };

  const lessons = () => (DATA.languages[state.lang] || DATA.languages.de).lessons;
  const glossesOf = (word) => {
    const entry = TP.lexicon[word];
    if (!entry) return [];
    return entry.glosses[state.lang] || entry.glosses.de;
  };
  const conceptLabel = (id) => (CONCEPT_LABELS[state.lang] || CONCEPT_LABELS.de)[id] || id;
  const say = (violation) => TP.describe(violation, state.lang);

  // Nicht jedes Wort hat in der Schrift ein Zeichen — die 2020er Fassung kennt
  // mehrere nimi ku suli noch nicht. Fällt die Ligatur aus, stünde das
  // lateinische Wort in Zeichengröße da. Also einmal messen statt raten:
  // ein echtes Zeichen ist etwa quadratisch, ein ausgeschriebenes Wort viel breiter.
  let GLYPHS = {};
  const hasGlyph = (word) => Boolean(GLYPHS[word]);

  async function probeGlyphs() {
    if (!document.fonts || !document.fonts.ready) return;
    await document.fonts.ready;
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;'
      + "font-size:40px;font-family:'linja pimeja'";
    document.body.append(probe);
    const found = {};
    for (const word of Object.keys(TP.lexicon)) {
      probe.textContent = word;
      found[word] = probe.getBoundingClientRect().width <= 64;
    }
    probe.remove();
    GLYPHS = found;
    render();
  }

  let state = load();
  let session = null;
  let tab = 'pfad';

  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY));
      return stored ? Object.assign({}, blank, stored) : Object.assign({}, blank);
    } catch (error) {
      return Object.assign({}, blank);
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) { /* egal */ }
  }

  function level() { return Math.floor(state.xp / 100) + 1; }
  function levelProgress() { return state.xp % 100; }

  function award(points) {
    const day = today();
    if (state.lastDay !== day) {
      // Schongang: ein verpasster Tag kostet einen Punkt, nicht die ganze Serie.
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      state.streak = state.lastDay === yesterday ? state.streak + 1 : Math.max(1, state.streak - 1);
      state.lastDay = day;
      state.dayXp = 0;
    }
    state.xp += points;
    state.dayXp += points;
    save();
  }

  function schedule(key, correct) {
    const now = Date.now();
    const card = state.srs[key] || { reps: 0, interval: 0, ease: 2.5, due: now };
    if (correct) {
      card.reps += 1;
      if (card.reps <= STEPS.length) card.interval = STEPS[card.reps - 1];
      else card.interval = Math.round(card.interval * card.ease);
      card.ease = Math.min(2.8, card.ease + 0.05);
    } else {
      card.reps = 0;
      card.interval = STEPS[0];
      card.ease = Math.max(1.4, card.ease - 0.2);
    }
    card.due = now + card.interval;
    state.srs[key] = card;
  }

  const dueKeys = () => {
    const now = Date.now();
    return Object.keys(state.srs).filter((key) => state.srs[key].due <= now);
  };

  function taskFromKey(key) {
    const [kind, rest] = [key.slice(0, 1), key.slice(2)];
    if (kind === 'w') {
      const lesson = lessons().find((l) => l.words.includes(rest)) || lessons()[0];
      return TP.lexicon[rest] ? { type: 'word', word: rest, lesson, concepts: [] } : null;
    }
    if (kind === 'g') {
      const lesson = lessons().find((l) => l.words.includes(rest)) || lessons()[0];
      return TP.lexicon[rest] && hasGlyph(rest)
        ? { type: 'glyph', word: rest, lesson, concepts: [] } : null;
    }
    if (kind === 'c') {
      const compound = COMPOUNDS[Number(rest)];
      return compound ? { type: 'compound', compound, lesson: lessons()[0], concepts: [] } : null;
    }
    for (const lesson of lessons().concat([musiLesson()])) {
      const item = lesson.items.find((i) => i.id === rest);
      if (item) {
        return { type: item.direction === 'de_tp' ? 'build' : 'choose', item, lesson,
                 concepts: lessonConcepts(lesson) };
      }
    }
    return null;
  }

  function keyOf(task) {
    if (task.type === 'glyph') return 'g:' + task.word;
    if (task.type === 'word') return 'w:' + task.word;
    if (task.type === 'compound') return 'c:' + COMPOUNDS.indexOf(task.compound);
    if (task.item) return 's:' + task.item.id;
    return null;
  }

  function bumpMastery(concepts, correct) {
    for (const concept of concepts || []) {
      const value = state.mastery[concept] || 0;
      state.mastery[concept] = Math.max(0, Math.min(1, value + (correct ? 0.12 : -0.08)));
    }
  }

  const lessonOf = (number) => lessons().find((l) => l.number === number);
  const unlocked = (number) => number === lessons()[0].number
    || Boolean(state.done[lessons()[lessons().findIndex((l) => l.number === number) - 1].number]);

  // ------------------------------------------------------------ Aufgabenbau

  const shuffle = (list) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  function buildSession(lesson) {
    const builds = shuffle(lesson.items.filter((i) => i.direction === 'de_tp'));
    const reads = shuffle(lesson.items.filter((i) => i.direction === 'tp_de'));
    const words = shuffle(lesson.words.filter((w) => TP.lexicon[w]));
    const tasks = [];

    words.slice(0, 2).forEach((word) => tasks.push({ type: 'word', word, lesson, concepts: [] }));
    builds.slice(0, 3).forEach((item) =>
      tasks.push({ type: 'build', item, lesson, concepts: lessonConcepts(lesson) }));
    reads.slice(0, 2).forEach((item) =>
      tasks.push({ type: 'choose', item, lesson, concepts: lessonConcepts(lesson) }));

    const flawed = brokenSentence(lesson);
    if (flawed) tasks.push({ type: 'fix', flawed, lesson, concepts: [flawed.violation.concept].filter(Boolean) });

    const compound = availableCompounds(lesson)[0];
    if (compound) tasks.push({ type: 'compound', compound, lesson, concepts: [] });

    const glyphWord = words.find(hasGlyph);
    if (state.sitelen && glyphWord) {
      tasks.push({ type: 'glyph', word: glyphWord, lesson, concepts: [] });
    }

    if (builds[3]) tasks.push({ type: 'free', item: builds[3], lesson, concepts: lessonConcepts(lesson) });

    return {
      lesson,
      queue: tasks.length ? tasks : builds.slice(0, 4).map((item) => ({ type: 'build', item, lesson, concepts: [] })),
      index: 0,
      correct: 0,
      total: 0,
      xp: 0,
      retried: new Set(),
    };
  }

  // Der Spaßmodus sieht für die Übungsmaschine aus wie eine Lektion — Nummer
  // 99, damit die Ablenkungswörter aus dem ganzen Kurs kommen dürfen.
  let musiCache = null;
  function musiLesson() {
    if (musiCache && musiCache.lang === state.lang) return musiCache.lesson;
    const lesson = {
      number: 99,
      musi: true,
      title: t('musiTitle'),
      note: '',
      words: [...new Set(MUSI.lines
        .flatMap((line) => TP.tokenize(line.tp).map((token) => token.text))
        .filter((word) => TP.lexicon[word]))],
      items: MUSI.lines.map((line) => ({
        id: line.id,
        direction: 'tp_de',
        tp: line.tp,
        also: [],
        target: line[state.lang] || line.de,
        kind: line.kind,
        sting: line.sting,
        lit: line.lit[state.lang] || line.lit.de,
      })),
    };
    musiCache = { lang: state.lang, lesson };
    return lesson;
  }

  function buildMusiSession() {
    const lesson = musiLesson();
    // Aus jeder Sorte etwas, damit die Runde nicht nur aus Sticheleien besteht.
    const bySort = ['utala', 'utala', 'konter', 'wawa', 'pona'].map((kind) =>
      shuffle(lesson.items.filter((item) => item.kind === kind))[0]).filter(Boolean);
    const picks = [...new Set(bySort.concat(shuffle(lesson.items)))].slice(0, 6);
    const tasks = shuffle(picks).map((item, index) => ({
      type: index % 2 ? 'build' : 'choose', item, lesson, concepts: [],
    }));
    const flawed = brokenSentence(lesson);
    if (flawed) {
      tasks.splice(Math.min(3, tasks.length), 0,
        { type: 'fix', flawed, lesson, concepts: [flawed.violation.concept].filter(Boolean) });
    }
    return { lesson, musi: true, queue: tasks, index: 0, correct: 0, total: 0, xp: 0,
             retried: new Set() };
  }

  function buildReviewSession() {
    const tasks = shuffle(dueKeys()).map(taskFromKey).filter(Boolean).slice(0, 12);
    return {
      lesson: null, review: true, queue: tasks, index: 0, correct: 0, total: 0, xp: 0,
      retried: new Set(),
    };
  }

  // Umschreibungen, deren Wörter die Lernende schon kennt.
  function availableCompounds(lesson) {
    const known = new Set(lessons().filter((l) => l.number <= lesson.number).flatMap((l) => l.words));
    return shuffle(COMPOUNDS.filter((compound) =>
      TP.tokenize(compound.tp).every((token) => token.text === 'pi' || known.has(token.text))));
  }

  // Fehlersätze entstehen aus richtigen: eine Regel gezielt verletzen und vom
  // Parser bestätigen lassen, dass genau sie anschlägt. Kein Handbetrieb.
  const MUTATIONS = [
    { rule: 'liAfterMiSina', apply: (words) =>
        (['mi', 'sina'].includes(words[0]) && words[1] !== 'li' ? [words[0], 'li', ...words.slice(1)] : null) },
    { rule: 'missingLi', apply: (words) =>
        (words.includes('li') && words.includes('e') && !['mi', 'sina'].includes(words[0])
          ? words.filter((w, i) => i !== words.indexOf('li')) : null) },
    { rule: 'piWithSingleWord', apply: (words) =>
        (words.length > 2 && !words.includes('pi') && !TP.lexicon[words[1]]?.roles.includes('particle')
          ? [words[0], 'pi', ...words.slice(1)] : null) },
  ];

  function brokenSentence(lesson) {
    for (const item of shuffle(lesson.items)) {
      const words = TP.tokenize(item.tp).map((t) => t.text);
      for (const mutation of shuffle(MUTATIONS)) {
        const broken = mutation.apply(words);
        if (!broken) continue;
        const result = TP.parse(broken.join(' ') + '.');
        if (result.violations.length !== 1) continue;
        if (result.violations[0].rule !== mutation.rule) continue;
        return { words: broken, correct: item.tp, violation: result.violations[0] };
      }
    }
    return null;
  }

  function lessonConcepts(lesson) {
    const map = {
      1: ['c_mi_sina', 'c_li'], 2: ['c_modifikator'], 3: ['c_e_objekt'], 4: ['c_e_objekt'],
      5: ['c_ni', 'c_en'], 6: ['c_praeposition'], 7: ['c_frage', 'c_o', 'c_namen'],
      8: ['c_modifikator'], 9: ['c_pi', 'c_la'], 10: ['c_praeverb'], 11: ['c_zahlen'], 12: [],
    };
    return map[lesson.number] || [];
  }

  function distractorWords(lesson, exclude, count) {
    const pool = lessons()
      .filter((l) => l.number <= lesson.number)
      .flatMap((l) => l.words)
      .filter((w) => !exclude.includes(w) && TP.lexicon[w]);
    return shuffle([...new Set(pool)]).slice(0, count);
  }

  // ------------------------------------------------------------ Darstellung

  const el = (html) => {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  };
  const escape = (text) => String(text).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Beim Austausch des Baums kann Safari den Fokus auf ein frisches Element
  // legen. Der Fokusring sieht aus wie eine getroffene Auswahl — auf einem
  // Bildschirm, den noch niemand berührt hat, gehört er nirgendwo hin.
  function clearStrayFocus() {
    const active = document.activeElement;
    if (active && active !== document.body && app.contains(active) && active.blur) {
      active.blur();
    }
  }

  function render() {
    hideGloss();
    app.innerHTML = '';
    if (session) { renderSession(); clearStrayFocus(); return; }
    app.append(topbar());
    if (tab === 'pfad') app.append(pathScreen());
    else if (tab === 'nimi') app.append(wordScreen());
    else if (tab === 'musi') app.append(musiScreen());
    else app.append(sandboxScreen());
    app.append(tabs());
    clearStrayFocus();
  }

  function topbar() {
    const bar = el(`
      <div>
        <div class="topbar">
          <div class="level"><div class="ring">${level()}</div><span>${escape(t('level'))}</span></div>
          <div class="metric spacer gold">${escape(t('xpToday', state.dayXp, GOAL))}</div>
          <div class="metric"><b>${state.streak}</b> ${escape(t('days'))}</div>
        </div>
        <div class="goalbar"><span style="width:${Math.min(100, (state.dayXp / GOAL) * 100)}%"></span></div>
      </div>`);
    return bar;
  }

  function tabs() {
    const bar = el(`
      <nav class="tabs">
        <button data-tab="pfad"><span class="glyph">◈</span>nasin</button>
        <button data-tab="nimi"><span class="glyph">◍</span>nimi</button>
        <button data-tab="musi"><span class="glyph">◇</span>musi</button>
        <button data-tab="toki"><span class="glyph">◐</span>o toki</button>
      </nav>`);
    bar.querySelectorAll('button').forEach((button) => {
      button.dataset.active = button.dataset.tab === tab;
      button.onclick = () => { tab = button.dataset.tab; render(); };
    });
    return bar;
  }

  function pathScreen() {
    const next = lessons().find((l) => !state.done[l.number]) || lessons()[lessons().length - 1];
    const screen = el(`
      <div class="screen">
        <div class="hello">
          <h1>${escape(t('greeting'))}</h1>
          <p>${state.xp ? escape(t('introBack', next.title)) : escape(t('introFirst'))}</p>
        </div>
        <div class="path"></div>
      </div>`);

    const due = dueKeys().length;
    if (due) {
      const card = el(`
        <button class="lesson review" data-state="current">
          <span class="badge">↻</span>
          <span class="body">
            <b>${escape(t('dueCards', due))}</b>
            <span>${escape(t('dueSub'))}</span>
          </span>
        </button>`);
      card.onclick = () => { session = buildReviewSession(); render(); };
      screen.querySelector('.hello').after(card);
    }

    const path = screen.querySelector('.path');
    lessons().forEach((lesson) => {
      const open = unlocked(lesson.number);
      const done = Boolean(state.done[lesson.number]);
      const stateName = done ? 'done' : (open ? (lesson.number === next.number ? 'current' : 'open') : 'locked');
      const card = el(`
        <button class="lesson" data-state="${stateName}">
          <span class="badge">${done ? '✓' : lesson.number}</span>
          <span class="body">
            <b>${escape(lesson.title)}</b>
            <span>${lesson.words.slice(0, 5).join(' · ')}</span>
          </span>
          <span class="dots">${lesson.words.map((word) =>
            `<i class="${state.seenWords[word] ? 'on' : ''}"></i>`).join('')}</span>
        </button>`);
      if (open) card.onclick = () => { session = buildSession(lesson); render(); };
      else card.disabled = true;
      path.append(card);
    });

    const active = Object.keys(state.mastery);
    if (active.length) {
      const card = el(`<div class="card"><h2>${escape(t('concepts'))}</h2>`
        + '<div class="concepts"></div></div>');
      const list = card.querySelector('.concepts');
      active.sort((a, b) => state.mastery[b] - state.mastery[a]).forEach((concept) => {
        list.append(el(`
          <div class="concept">
            <span>${escape(conceptLabel(concept))}</span>
            <span class="bar"><i style="width:${Math.round(state.mastery[concept] * 100)}%"></i></span>
          </div>`));
      });
      screen.append(card);
    }

    screen.append(languageCard());
    screen.append(sitelenCard());
    screen.append(backupCard());

    screen.append(el(`
      <p class="foot">${t('credit',
        `<a href="https://lipu-sona.pona.la/${state.lang}/">lipu sona pona</a>`)}
        ${window.OTOKI_VERSION ? `<br><span class="version">${escape(t('versionLabel', window.OTOKI_VERSION))}</span>` : ''}</p>`));
    return screen;
  }

  function languageCard() {
    const card = el(`
      <div class="card">
        <h2>${escape(t('langLabel'))}</h2>
        <div class="row"><button class="ghost">${escape(t('langOther'))}</button></div>
      </div>`);
    card.querySelector('.ghost').onclick = () => {
      state.lang = state.lang === 'de' ? 'en' : 'de';
      save();
      render();
    };
    return card;
  }

  function sitelenCard() {
    const card = el(`
      <div class="card">
        <h2>sitelen pona</h2>
        <div class="glyph-row sp">toki pona li pona</div>
        <p class="hint">${escape(t('sitelenHint'))}</p>
        <div class="row"><button class="ghost"></button></div>
      </div>`);

    const button = card.querySelector('.ghost');
    const label = () => { button.textContent = t(state.sitelen ? 'sitelenOff' : 'sitelenOn'); };
    label();
    button.onclick = () => {
      state.sitelen = !state.sitelen;
      save();
      render();
    };
    return card;
  }

  // ------------------------------------------------------------ Wortnachschlag

  // Auf dem Telefon gibt es kein Hover — dort ist Antippen die Geste. Am
  // Zeigegerät kommt Überfahren dazu.
  let bubble = null;

  function hideGloss() {
    if (bubble) { bubble.remove(); bubble = null; }
  }

  function showGloss(anchor, word) {
    const list = glossesOf(word);
    if (!list.length) return;
    hideGloss();
    const entry = TP.lexicon[word];
    bubble = el(`
      <div class="bubble" role="status">
        ${hasGlyph(word) ? `<span class="sp bubble-glyph">${escape(word)}</span>` : ''}
        <span class="bubble-body">
          <b>${escape(word)}</b>
          <span>${escape(list.join(', '))}</span>
        </span>
        <em>${entry.book === 'pu' ? 'pu' : 'ku'}</em>
      </div>`);
    app.append(bubble);

    // Unter dem Wort, aber innerhalb des Fensters gehalten.
    const target = anchor.getBoundingClientRect();
    const frame = app.getBoundingClientRect();
    const box = bubble.getBoundingClientRect();
    const left = Math.max(8, Math.min(
      target.left + target.width / 2 - box.width / 2 - frame.left,
      frame.width - box.width - 8,
    ));
    bubble.style.left = `${left}px`;
    bubble.style.top = `${target.bottom - frame.top + 6}px`;
  }

  // Ein Tipp irgendwo sonst schließt die Blase wieder.
  document.addEventListener('pointerdown', (event) => {
    if (!bubble) return;
    if (event.target.closest && event.target.closest('.gloss-word')) return;
    hideGloss();
  }, true);

  const canHover = () => window.matchMedia && window.matchMedia('(hover: hover)').matches;

  // Satz mit nachschlagbaren Wörtern. Satzzeichen und Namen bleiben stehen,
  // nur bekannte Wörter werden anfassbar.
  function glossed(text, className) {
    const wrap = el(`<span class="${className}"></span>`);
    for (const part of String(text).split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { wrap.append(document.createTextNode(part)); continue; }
      const bare = part.toLowerCase().replace(/[^a-z]/g, '');
      const entry = bare && (TP.lexicon[bare] || TP.lexicon[DATA.variants[bare]]);
      if (!entry) { wrap.append(document.createTextNode(part)); continue; }
      const key = TP.lexicon[bare] ? bare : DATA.variants[bare];
      const word = el(`<button class="gloss-word" type="button">${escape(part)}</button>`);
      word.onclick = (event) => {
        event.stopPropagation();
        if (bubble && bubble.dataset.word === key) { hideGloss(); return; }
        showGloss(word, key);
        if (bubble) bubble.dataset.word = key;
      };
      if (canHover()) {
        word.onmouseenter = () => { showGloss(word, key); if (bubble) bubble.dataset.word = key; };
        word.onmouseleave = hideGloss;
      }
      wrap.append(word);
    }
    return wrap;
  }

  // ------------------------------------------------------------ Sicherung

  const stamp = () => new Date().toISOString().slice(0, 10);

  function backupText() {
    return JSON.stringify({ app: 'o toki!', version: 1, exported: new Date().toISOString(), state });
  }

  // Nimmt sowohl eine Sicherungsdatei als auch einen rohen Zustand an.
  function readBackup(text) {
    let payload;
    try {
      payload = JSON.parse(text.trim());
    } catch (error) {
      throw new Error(t('backupUnreadable'));
    }
    const found = payload && payload.state ? payload.state : payload;
    if (!found || typeof found !== 'object' || ['xp', 'done', 'srs'].some((f) => !(f in found))) {
      throw new Error(t('backupForeign'));
    }
    return {
      state: Object.assign({}, blank, found),
      exported: payload && payload.exported ? payload.exported.slice(0, 10) : null,
    };
  }

  const summarise = (value) => t('summary', Math.floor((value.xp || 0) / 100) + 1,
    Object.keys(value.done || {}).length, Object.keys(value.srs || {}).length, value.xp || 0);

  function backupCard() {
    const card = el(`
      <div class="card">
        <h2>${escape(t('backupTitle'))}</h2>
        <p class="hint">${escape(t('backupState', summarise(state)))}</p>
        <div class="row">
          <button class="ghost" data-do="save">${escape(t('backupSave'))}</button>
          <button class="ghost" data-do="load">${escape(t('backupLoad'))}</button>
        </div>
        <div class="drawer"></div>
      </div>`);

    const drawer = card.querySelector('.drawer');
    const note = (text, bad) => {
      const line = el(`<p class="hint ${bad ? 'bad' : 'good'}">${escape(text)}</p>`);
      drawer.append(line);
    };

    card.querySelector('[data-do="save"]').onclick = async () => {
      drawer.innerHTML = '';
      const text = backupText();
      const name = `o-toki-fortschritt-${stamp()}.json`;

      const share = el(`<button class="ghost">${escape(t('backupFile'))}</button>`);
      share.onclick = async () => {
        const file = new File([text], name, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'o toki! — Fortschritt' });
            return;
          } catch (error) { /* abgebrochen: dann eben herunterladen */ }
        }
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };

      const copy = el(`<button class="ghost">${escape(t('backupCopy'))}</button>`);
      copy.onclick = async () => {
        try {
          await navigator.clipboard.writeText(text);
          note(t('backupCopied'));
        } catch (error) {
          note(t('backupCopyFailed'), true);
        }
      };

      drawer.append(share, copy);
    };

    card.querySelector('[data-do="load"]').onclick = () => {
      drawer.innerHTML = '';
      const form = el(`
        <div>
          <label class="ghost pickwrap">${escape(t('backupPick'))}
            <input class="pick" type="file" accept="application/json,.json,text/plain">
          </label>
          <textarea class="paste" rows="3" placeholder="${escape(t('backupPaste'))}"
            aria-label="${escape(t('backupPaste'))}"></textarea>
          <div class="preview"></div>
        </div>`);
      const preview = form.querySelector('.preview');

      const offer = (text) => {
        preview.innerHTML = '';
        let backup;
        try {
          backup = readBackup(text);
        } catch (error) {
          preview.append(el(`<p class="hint bad">${escape(error.message)}</p>`));
          return;
        }
        preview.append(el(`<p class="hint">${t('backupFound', escape(summarise(backup.state)),
          backup.exported ? escape(backup.exported) : null, escape(summarise(state)))}</p>`));
        const confirm = el(`<button class="primary">${escape(t('backupApply'))}</button>`);
        confirm.onclick = () => {
          state = backup.state;
          save();
          tab = 'pfad';
          render();
        };
        preview.append(confirm);
      };

      form.querySelector('.paste').oninput = (event) => {
        if (event.target.value.trim()) offer(event.target.value);
        else preview.innerHTML = '';
      };
      form.querySelector('.pick').onchange = (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => offer(String(reader.result));
        reader.onerror = () => preview.append(el(`<p class="hint bad">${escape(t('backupUnreadableFile'))}</p>`));
        reader.readAsText(file);
      };

      drawer.append(form);
    };

    return card;
  }

  // ------------------------------------------------------------ Übungslauf

  function renderSession() {
    if (session.index >= session.queue.length) { renderDone(); return; }
    const task = session.queue[session.index];

    const head = el(`
      <div class="exbar">
        <button aria-label="Abbrechen">✕</button>
        <span class="track"><i style="width:${(session.index / session.queue.length) * 100}%"></i></span>
        <span class="metric">✓ <b>${session.correct}</b></span>
      </div>`);
    head.querySelector('button').onclick = () => { session = null; render(); };
    app.append(head);

    if (task.type === 'word') app.append(wordTask(task));
    else if (task.type === 'build') app.append(buildTask(task));
    else if (task.type === 'choose') app.append(chooseTask(task));
    else if (task.type === 'fix') app.append(fixTask(task));
    else if (task.type === 'compound') app.append(compoundTask(task));
    else if (task.type === 'glyph') app.append(glyphTask(task));
    else app.append(freeTask(task));
  }

  function screenWith(inner) {
    return el(`<div class="screen">${inner}</div>`);
  }

  function wordTask(task) {
    const entry = TP.lexicon[task.word];
    const right = glossesOf(task.word).slice(0, 3).join(', ');
    const options = shuffle([right, ...distractorWords(task.lesson, [task.word], 3)
      .map((w) => (TP.lexicon[w].glosses[state.lang] || TP.lexicon[w].glosses.de).slice(0, 3).join(', '))]);

    const screen = screenWith(`
      <p class="prompt">${escape(t('askWord'))}</p>
      <h2 class="question tp">${escape(task.word)}</h2>
      <div class="choices"></div>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    let picked = null;
    const list = screen.querySelector('.choices');
    const button = screen.querySelector('.primary');
    options.forEach((option) => {
      const choice = el(`<button class="choice">${escape(option)}</button>`);
      choice.onclick = () => {
        picked = option;
        list.querySelectorAll('.choice').forEach((c) => { c.dataset.picked = 'false'; });
        choice.dataset.picked = 'true';
        button.disabled = false;
      };
      list.append(choice);
    });

    button.onclick = () => {
      state.seenWords[task.word] = true;
      finish(task, picked === right, {
        solution: `${task.word} — ${right}`,
        xray: null,                     // eine Wortbedeutung hat keinen Satzbau
        reason: picked === right ? null
          : t('covers', escape(task.word), escape(glossesOf(task.word).join(', '))),
      });
    };
    return screen;
  }

  function chooseTask(task) {
    const right = task.item.target[0];
    const pool = task.lesson.items
      .filter((i) => i.id !== task.item.id)
      .flatMap((i) => i.target)
      .filter((text) => text !== right);
    const options = shuffle([right, ...shuffle(pool).slice(0, 2)]);

    const screen = screenWith(`
      <p class="prompt">${escape(t('askMeaning'))}</p>
      <h2 class="question tp glossable"></h2>
      <div class="choices"></div>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    screen.querySelector('.question').append(glossed(task.item.tp, 'glossline'));

    let picked = null;
    const list = screen.querySelector('.choices');
    const button = screen.querySelector('.primary');
    options.forEach((option) => {
      const choice = el(`<button class="choice">${escape(option)}</button>`);
      choice.onclick = () => {
        picked = option;
        list.querySelectorAll('.choice').forEach((c) => { c.dataset.picked = 'false'; });
        choice.dataset.picked = 'true';
        button.disabled = false;
      };
      list.append(choice);
    });

    button.onclick = () => finish(task, picked === right, {
      solution: right,
      xray: task.item.tp,
    });
    return screen;
  }

  // Fehlersuche: das falsche Wort antippen. Die Stelle kommt aus dem Parser,
  // nicht aus einer Handliste — deshalb stimmt sie immer.
  function fixTask(task) {
    const screen = screenWith(`
      <p class="prompt">${escape(t('askFix'))}</p>
      <div class="pickline"></div>
      <p class="hint">${escape(t('hintFix'))}</p>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    const line = screen.querySelector('.pickline');
    const button = screen.querySelector('.primary');
    let picked = null;

    task.flawed.words.forEach((word, index) => {
      const chip = el(`<button class="tile">${escape(word)}</button>`);
      chip.onclick = () => {
        picked = index;
        line.querySelectorAll('.tile').forEach((t) => t.classList.remove('placed'));
        chip.classList.add('placed');
        button.disabled = false;
      };
      line.append(chip);
    });

    button.onclick = () => {
      const wanted = task.flawed.violation.tokenIndices;
      const correct = wanted.includes(picked);
      finish(task, correct, {
        solution: task.flawed.correct,
        xray: task.flawed.correct,
        reason: escape(task.flawed.violation.message),
      });
    };
    return screen;
  }

  // sitelen pona: ein Zeichen je Wort. Die Schrift bildet das über Ligaturen
  // ab — im Text steht weiterhin das lateinische Wort.
  function glyphTask(task) {
    const options = shuffle([task.word, ...distractorWords(task.lesson, [task.word], 3)]);

    const screen = screenWith(`
      <p class="prompt">${escape(t('askGlyph'))}</p>
      <div class="glyph sp">${escape(task.word)}</div>
      <div class="choices"></div>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    let picked = null;
    const list = screen.querySelector('.choices');
    const button = screen.querySelector('.primary');
    options.forEach((option) => {
      const choice = el(`<button class="choice tp">${escape(option)}</button>`);
      choice.onclick = () => {
        picked = option;
        list.querySelectorAll('.choice').forEach((c) => { c.dataset.picked = 'false'; });
        choice.dataset.picked = 'true';
        button.disabled = false;
      };
      list.append(choice);
    });

    button.onclick = () => {
      const entry = TP.lexicon[task.word];
      finish(task, picked === task.word, {
        solution: task.word,
        xray: null,
        reason: `<span class="sp glyph-inline">${escape(task.word)}</span> `
          + t('glyphIs', escape(task.word), escape(glossesOf(task.word).slice(0, 3).join(', '))),
      });
    };
    return screen;
  }

  // Umschreiben: der Kern der Sprache. Nicht „wie heißt Kaffee“, sondern
  // „wie drückst du Kaffee mit 120 Wörtern aus“.
  function compoundTask(task) {
    const right = task.compound;
    const options = shuffle([right, ...shuffle(COMPOUNDS.filter((c) => c !== right)).slice(0, 2)]);

    const screen = screenWith(`
      <p class="prompt">${escape(t('askCompound'))}</p>
      <h2 class="question">${escape(right.name[state.lang] || right.name.de)}</h2>
      <div class="choices"></div>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    let picked = null;
    const list = screen.querySelector('.choices');
    const button = screen.querySelector('.primary');
    options.forEach((option) => {
      const choice = el(`<button class="choice tp">${escape(option.tp)}</button>`);
      choice.onclick = () => {
        picked = option;
        list.querySelectorAll('.choice').forEach((c) => { c.dataset.picked = 'false'; });
        choice.dataset.picked = 'true';
        button.disabled = false;
      };
      list.append(choice);
    });

    button.onclick = () => finish(task, picked === right, {
      solution: right.tp,
      xray: right.tp,
      reason: t('literally', escape(right.tp), escape(right.literal[state.lang] || right.literal.de)),
    });
    return screen;
  }

  function buildTask(task) {
    const solution = TP.tokenize(task.item.tp).map((t) => t.text);
    const extras = distractorWords(task.lesson, solution, Math.min(3, Math.max(2, 6 - solution.length)));
    // Jede Kachel bekommt eine eigene Nummer. Kommt „li“ dreimal vor, sind das
    // drei unterscheidbare Kacheln — sonst greift ein Tipp auf die falsche.
    const bank = shuffle(solution.concat(extras)).map((word, index) => ({ word, id: String(index) }));
    const wordOf = new Map(bank.map((chip) => [chip.id, chip.word]));

    const screen = screenWith(`
      <p class="prompt">${escape(t('askBuild'))}</p>
      <h2 class="question">${escape(task.item.target[0])}</h2>
      <div class="slot"></div>
      <p class="hint">${escape(t('hintBuild'))}</p>
      <div class="bank"></div>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    const slot = screen.querySelector('.slot');
    const bankRow = screen.querySelector('.bank');
    const button = screen.querySelector('.primary');
    const chosen = [];

    // Die gelegten Kacheln sind die Wahrheit: nach jedem Ziehen wird die
    // Wortfolge aus der Reihenfolge im Baum neu gelesen.
    const readOrder = () => Array.from(slot.children).map((node) => node.dataset.id);

    const refreshBank = () => {
      bankRow.querySelectorAll('.tile').forEach((tile) => {
        // Belegt ist genau die Kachel, die oben liegt — nicht irgendeine mit
        // demselben Wort.
        tile.classList.toggle('used', chosen.includes(tile.dataset.id));
      });
      button.disabled = chosen.length === 0;
    };

    const commit = () => {
      chosen.length = 0;
      chosen.push(...readOrder());
      refreshBank();
    };

    const remove = (node) => {
      node.remove();
      commit();
    };

    // Ziehen über Pointer-Events; HTML5-Drag gibt es auf iOS nicht.
    // Unter der Schwelle bleibt es ein Tipp und entfernt die Kachel.
    const THRESHOLD = 8;

    function grab(node, event) {
      if (event.button !== undefined && event.button !== 0) return;
      // Am Fenster lauschen, nicht an der Kachel: Das Umhängen im Baum löst
      // eine Pointer-Erfassung wieder, und danach käme kein pointerup mehr an.
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      const box = node.getBoundingClientRect();
      const holdX = startX - box.left;
      const holdY = startY - box.top;
      let dragging = false;

      const follow = (move) => {
        if (move.pointerId !== pointerId) return;
        if (!dragging) {
          if (Math.hypot(move.clientX - startX, move.clientY - startY) < THRESHOLD) return;
          dragging = true;
          node.classList.add('dragging');
        }

        node.style.transform = '';
        const base = node.getBoundingClientRect();
        node.style.transform = `translate(${move.clientX - holdX - base.left}px, `
          + `${move.clientY - holdY - base.top}px)`;

        // Nächste Nachbarkachel suchen; Zeilen zählen stärker als Spalten,
        // damit der Umbruch nicht gegen die Absicht arbeitet.
        let closest = null;
        let best = Infinity;
        let after = false;
        for (const other of slot.children) {
          if (other === node) continue;
          const rect = other.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const distance = Math.hypot(move.clientX - cx, (move.clientY - cy) * 2.5);
          if (distance < best) {
            best = distance;
            closest = other;
            after = move.clientX > cx;
          }
        }
        if (closest) slot.insertBefore(node, after ? closest.nextSibling : closest);
      };

      const release = (up) => {
        if (up && up.pointerId !== pointerId) return;
        window.removeEventListener('pointermove', follow);
        window.removeEventListener('pointerup', release);
        window.removeEventListener('pointercancel', release);
        node.style.transform = '';
        node.classList.remove('dragging');
        if (dragging) commit();
        else remove(node);
      };

      window.addEventListener('pointermove', follow);
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
    }

    // Ohne Zeigegerät bedienbar: mit den Pfeiltasten verschieben.
    function shift(node, direction) {
      const sibling = direction < 0 ? node.previousElementSibling : node.nextElementSibling;
      if (!sibling) return;
      slot.insertBefore(direction < 0 ? node : sibling, direction < 0 ? sibling : node);
      commit();
      node.focus();
    }

    const place = (id) => {
      const word = wordOf.get(id);
      const tile = el(`<button class="tile placed" data-word="${escape(word)}" data-id="${escape(id)}"
        aria-label="${escape(word)} — antippen entfernt, ziehen oder Pfeiltasten sortieren um"
        >${escape(word)}</button>`);
      tile.addEventListener('pointerdown', (event) => grab(tile, event));
      tile.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); shift(tile, -1); }
        else if (event.key === 'ArrowRight') { event.preventDefault(); shift(tile, 1); }
        else if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault();
          remove(tile);
        }
      });
      slot.append(tile);
    };

    const sync = () => {
      slot.innerHTML = '';
      chosen.forEach(place);
      refreshBank();
    };

    bank.forEach(({ word, id }) => {
      const tile = el(`<button class="tile" data-word="${escape(word)}" data-id="${escape(id)}"
        >${escape(word)}</button>`);
      tile.onclick = () => {
        if (chosen.includes(id)) return;
        chosen.push(id);
        sync();
      };
      bankRow.append(tile);
    });
    sync();

    button.onclick = () => {
      const answer = chosen.map((id) => wordOf.get(id)).join(' ');
      const accepted = [task.item.tp, ...task.item.also]
        .map((s) => TP.tokenize(s).map((t) => t.text).join(' '));
      const correct = accepted.includes(answer);
      finish(task, correct, {
        solution: task.item.tp,
        xray: answer || task.item.tp,
        grade: correct ? null : grade(answer, task.item),
      });
    };
    return screen;
  }

  function freeTask(task) {
    const screen = screenWith(`
      <p class="prompt">${escape(t('askFree'))}</p>
      <h2 class="question">${escape(task.item.target[0])}</h2>
      <input class="typed" autocomplete="off" autocapitalize="off" spellcheck="false"
             placeholder="toki pona …" aria-label="toki pona">
      <p class="live"></p>
      <p class="hint">${escape(t('hintFree'))}</p>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    const input = screen.querySelector('.typed');
    const live = screen.querySelector('.live');
    const button = screen.querySelector('.primary');

    input.oninput = () => {
      const text = input.value.trim();
      button.disabled = !text;
      if (!text) { live.textContent = ''; live.className = 'live'; return; }
      const result = TP.parse(text);
      if (result.isValid) {
        live.textContent = t('structureLive');
        live.className = 'live good';
      } else {
        live.textContent = '• ' + say(result.violations[0]);
        live.className = 'live bad';
      }
    };
    input.onkeydown = (event) => { if (event.key === 'Enter' && !button.disabled) button.click(); };

    button.onclick = () => {
      const answer = input.value.trim();
      const verdict = grade(answer, task.item);
      finish(task, verdict.correct, {
        solution: task.item.tp,
        xray: answer || task.item.tp,
        grade: verdict,
      });
    };
    setTimeout(() => input.focus(), 50);
    return screen;
  }

  // ------------------------------------------------------------ Bewertung

  // Schichten aus Plan, Abschnitt 6: normalisieren, strukturell parsen,
  // gegen Musterlösung und Pflichtbausteine abgleichen.
  function grade(answer, item) {
    const normalise = (text) => TP.tokenize(text).map((t) => t.text).join(' ');
    const accepted = [item.tp, ...item.also].map(normalise);
    const given = normalise(answer);

    if (accepted.includes(given)) return { correct: true, exact: true, violations: [] };

    const result = TP.parse(answer);
    if (!result.isValid) {
      return { correct: false, exact: false, violations: result.violations, utterance: result.utterance };
    }

    // Grammatisch sauber: zählt, wenn die tragenden Inhaltswörter vorkommen.
    const content = TP.tokenize(item.tp)
      .filter((t) => t.word && !t.word.roles.includes('particle') && !t.word.roles.includes('pronoun'))
      .map((t) => t.text);
    const mine = new Set(TP.tokenize(answer).map((t) => t.text));
    const missing = content.filter((word) => !mine.has(word));

    if (!missing.length) {
      return { correct: true, exact: false, variant: true, violations: [], utterance: result.utterance };
    }
    return {
      correct: false, exact: false, violations: [], utterance: result.utterance,
      missing,
    };
  }

  function finish(task, correct, detail) {
    session.total += 1;
    if (correct) {
      session.correct += 1;
      const points = session.retried.has(session.index) ? 5 : 10;
      session.xp += points;
      award(points);
    } else if ((task.attempts || 0) < 1) {
      // Ein zweiter Anlauf in derselben Sitzung, mehr nicht. Danach ist es
      // Sache des Wiederholungssystems — niemand soll festhängen.
      task.attempts = 1;
      session.retried.add(session.queue.length);
      session.queue.push(task);
    } else {
      task.attempts = 2;
    }
    const key = keyOf(task);
    if (key) schedule(key, correct);
    bumpMastery(task.concepts, correct);
    save();
    showSheet(correct, Object.assign({ parked: task.attempts === 2 }, detail));
  }

  function showSheet(correct, detail) {
    // Die Aufgabe ist beantwortet: „Prüfen“ hat seinen Zweck erfüllt und
    // verschwindet, damit nur noch ein Knopf im Bild ist. Die Antwort bleibt
    // lesbar, lässt sich aber nicht mehr ändern.
    const screen = app.querySelector('.screen');
    if (screen) {
      const actions = screen.querySelector('.actions');
      if (actions) actions.remove();
      screen.classList.add('answered');
    }

    const sheet = el(`
      <div class="sheet">
        <div class="verdict ${correct ? 'good' : 'bad'}">
          <span class="mark">${correct ? '✓' : '✕'}</span>
          <span>${escape(correct
            ? (detail.grade && detail.grade.variant ? t('variantRight') : t('good'))
            : t('notYet'))}</span>
        </div>
      </div>`);

    if (detail.grade && detail.grade.violations && detail.grade.violations.length) {
      const violation = detail.grade.violations[0];
      sheet.append(el(`
        <div class="violation">
          ${escape(say(violation))}
          ${violation.correction ? `<br><code>→ ${escape(violation.correction)}</code>` : ''}
        </div>`));
    } else if (detail.grade && detail.grade.missing) {
      sheet.append(el(`<p class="reason">${escape(t('missing',
        detail.grade.missing.join(', ')))}</p>`));
    } else if (detail.reason) {
      sheet.append(el(`<p class="reason">${detail.reason}</p>`));
    }

    if (!correct || (detail.grade && detail.grade.variant)) {
      const line = el(`<p class="reason">${escape(t('model'))} </p>`);
      line.append(glossed(detail.solution, 'solution'));
      sheet.append(line);
    }
    if (!correct && detail.parked) {
      sheet.append(el(`<p class="hint">${escape(t('comesBack'))}</p>`));
    }

    if (detail.xray) {
      const spans = TP.xray(TP.parse(detail.xray).utterance);
      if (spans.length) {
        sheet.append(el(`<div class="xray">${spans.map((span) => `
          <span class="span" data-role="${escape(span.role)}">
            <b>${escape(span.text)}</b><i>${escape(TP.roleLabel(span.role, state.lang))}</i>
          </span>`).join('')}</div>`));
      }
    }

    const next = el(`<button class="primary">${escape(t(correct ? 'next' : 'understood'))}</button>`);
    next.onclick = () => { session.index += 1; render(); };
    sheet.append(next);
    app.append(sheet);
    next.focus();
  }

  function renderDone() {
    const lesson = session.lesson;
    const review = Boolean(session.review);
    const musi = Boolean(session.musi);
    // Der Spaßmodus hakt keine Lektion ab — der Kursfortschritt bleibt seiner.
    if (lesson && !musi) {
      state.done[lesson.number] = true;
      lesson.words.forEach((word) => { state.seenWords[word] = true; });
    }
    save();

    const screen = el(`
      <div class="screen done">
        <div class="burst">pona!</div>
        <h2>${escape(review ? t('reviewDone') : lesson.title)}</h2>
        <p>${escape(review ? t('reviewNote')
          : (musi ? t('musiLead') : lesson.note.replace(/<[^>]+>/g, '')))}</p>
        <div class="tally">
          <div><b>+${session.xp}</b><span>${escape(t('xp'))}</span></div>
          <div><b>${session.correct}</b><span>${escape(t('correct'))}</span></div>
          <div><b>${review || musi ? session.queue.length : lesson.words.length}</b><span>${escape(t(review || musi ? 'cards' : 'words'))}</span></div>
        </div>
        <div class="actions">
          <button class="primary">${escape(t('next'))}</button>
          ${review ? '' : `<button class="ghost">${escape(t('again'))}</button>`}
        </div>
      </div>`);

    screen.querySelector('.primary').onclick = () => {
      session = null;
      tab = musi ? 'musi' : 'pfad';
      render();
    };
    if (!review) {
      screen.querySelector('.ghost').onclick = () => {
        session = musi ? buildMusiSession() : buildSession(lesson);
        render();
      };
    }
    app.append(topbar());
    app.append(screen);
  }

  // ------------------------------------------------------------ musi

  // Würfelt aus einem Muster einen frischen Satz. Geprüft wird er vom selben
  // Parser wie alles andere — was hier steht, ist garantiert grammatisch.
  function forge() {
    const column = state.lang === 'en' ? 2 : 1;
    for (let tries = 0; tries < 30; tries += 1) {
      const pattern = MUSI.patterns[Math.floor(Math.random() * MUSI.patterns.length)];
      const picks = pattern.slots.map((slot) => slot[Math.floor(Math.random() * slot.length)]);
      const tp = pattern.frame
        .replace('{a}', picks[0][0])
        .replace('{b}', picks[1] ? picks[1][0] : '');
      if (TP.parse(tp).violations.length) continue;
      const say = (pattern.say[state.lang] || pattern.say.de)(...picks.map((pick) => pick[column]));
      return { tp, say, name: pattern.name[state.lang] || pattern.name.de };
    }
    return null;
  }

  const stingDots = (level) => '●'.repeat(level) + '○'.repeat(Math.max(0, 3 - level));

  function musiScreen() {
    const screen = screenWith(`
      <div class="card">
        <h2>${escape(t('musiTitle'))}</h2>
        <p class="hint">${MUSI.intro[state.lang] || MUSI.intro.de}</p>
        <div class="row"><button class="primary">${escape(t('musiStart'))}</button></div>
      </div>`);
    screen.querySelector('.primary').onclick = () => { session = buildMusiSession(); render(); };

    const forgeCard = el(`
      <div class="card">
        <h2>${escape(t('musiForgeTitle'))}</h2>
        <p class="hint">${escape(t('musiForgeHint'))}</p>
        <div class="forged"></div>
        <div class="row"><button class="ghost">${escape(t('musiForge'))}</button></div>
      </div>`);
    const box = forgeCard.querySelector('.forged');
    const roll = () => {
      const made = forge();
      box.innerHTML = '';
      if (!made) return;
      const line = el('<p class="tp glossable"></p>');
      line.append(glossed(made.tp, 'glossline'));
      box.append(line);
      box.append(el(`<p class="meaning">${escape(made.say)}</p>`));
      box.append(el(`<p class="hint">${escape(t('musiPattern'))}: <code>${escape(made.name)}</code></p>`));
    };
    forgeCard.querySelector('.ghost').onclick = roll;
    roll();
    screen.append(forgeCard);

    const items = musiLesson().items;
    Object.keys(MUSI.kinds).forEach((kind) => {
      const group = items.filter((item) => item.kind === kind);
      if (!group.length) return;
      const name = MUSI.kinds[kind][state.lang] || MUSI.kinds[kind].de;
      const card = el(`
        <div class="card">
          <h2>${escape(t('musiSection', name, group.length))}</h2>
          <div class="musilines"></div>
        </div>`);
      const list = card.querySelector('.musilines');
      group.forEach((item) => {
        const row = el(`<div class="musiline" data-kind="${escape(kind)}"></div>`);
        const line = el('<p class="tp glossable"></p>');
        line.append(glossed(item.tp, 'glossline'));
        row.append(line);
        row.append(el(`<p class="meaning">${escape(item.target[0])}</p>`));
        row.append(el(`
          <p class="hint">${escape(t('musiLiteral'))}: ${escape(item.lit)}
            <span class="sting" title="${escape(t('musiSting'))}">${stingDots(item.sting)}</span>
          </p>`));
        list.append(row);
      });
      screen.append(card);
    });

    screen.append(el(`<p class="foot">${t('musiPeace')}</p>`));
    return screen;
  }

  // ------------------------------------------------------------ Wörter

  function wordScreen() {
    const screen = screenWith(`
      <input class="search" placeholder="${escape(t('search'))}" aria-label="${escape(t('search'))}">
      <div class="words"></div>`);
    const list = screen.querySelector('.words');
    const input = screen.querySelector('.search');

    const draw = (query) => {
      list.innerHTML = '';
      const term = query.trim().toLowerCase();
      Object.keys(TP.lexicon).sort().forEach((word) => {
        const entry = TP.lexicon[word];
        const text = glossesOf(word).join(', ');
        if (term && !word.includes(term) && !text.toLowerCase().includes(term)) return;
        list.append(el(`
          <div class="word">
            <span class="${hasGlyph(word) ? 'sp glyph-inline' : 'glyph-inline empty'}"
              aria-hidden="true">${hasGlyph(word) ? escape(word) : ''}</span>
            <b>${escape(word)}</b>
            <span>${escape(text)}</span>
            <em>${entry.book === 'pu' ? 'pu' : 'ku'}${state.seenWords[word] ? ' ✓' : ''}</em>
          </div>`));
      });
    };
    input.oninput = () => draw(input.value);
    draw('');
    return screen;
  }

  // ------------------------------------------------------------ Sandkasten

  function sandboxScreen() {
    const screen = screenWith(`
      <div class="hello">
        <h1>${escape(t('sandboxTitle'))}</h1>
        <p>${escape(t('sandboxIntro'))}</p>
      </div>
      <input class="typed" autocomplete="off" autocapitalize="off" spellcheck="false"
             value="jan suli li pana e lipu tawa mi." aria-label="Satz">
      <div class="result"></div>`);

    const input = screen.querySelector('.typed');
    const result = screen.querySelector('.result');

    const draw = () => {
      result.innerHTML = '';
      const text = input.value.trim();
      if (!text) return;
      TP.splitUtterances(text).forEach((utterance) => {
        const parsed = TP.parse(utterance);
        const card = el('<div class="card" style="margin-top:0.8rem"></div>');
        const spans = TP.xray(parsed.utterance);
        if (spans.length) {
          card.append(el(`<div class="xray">${spans.map((span) => `
            <span class="span" data-role="${escape(span.role)}">
              <b>${escape(span.text)}</b><i>${escape(TP.roleLabel(span.role, state.lang))}</i>
            </span>`).join('')}</div>`));
        }
        if (parsed.isValid) {
          card.append(el(`<p class="reason" style="margin-top:0.7rem;color:var(--accent)">`
            + `${escape(t('structureOk'))}`
            + `${parsed.utterance && parsed.utterance.isQuestion ? escape(t('sandboxQuestion')) : ''}</p>`));
        } else {
          parsed.violations.forEach((violation) => {
            card.append(el(`
              <div class="violation" style="margin-top:0.7rem">
                ${escape(say(violation))}
                ${violation.correction ? `<br><code>→ ${escape(violation.correction)}</code>` : ''}
                ${violation.concept ? `<br><code>${escape(conceptLabel(violation.concept))}</code>` : ''}
              </div>`));
          });
        }
        result.append(card);
      });
    };

    input.oninput = draw;
    draw();

    screen.append(el(`
      <p class="foot" style="padding-top:1rem">
        ${escape(t('sandboxTry'))} <code>mi li moku.</code> · <code>jan pi pona li lape.</code> ·
        <code>soweli moku e kili.</code> · <code>jan Claude li pona.</code>
      </p>`));
    return screen;
  }

  // ------------------------------------------------------- neue Fassung
  // Der Service Worker meldet sich, sobald eine neue Fassung bereitliegt.
  // Wer gerade nichts löst, bekommt sie sofort; mitten in einer Übung fragt
  // ein schmaler Streifen, statt die halbe Antwort wegzuwerfen.
  window.otokiUpdateReady = (mayReload) => {
    if (mayReload && !session) { location.reload(); return; }
    if (document.querySelector('.updatebar')) return;
    const bar = el(`
      <div class="updatebar">
        <span>${escape(t('updateReady'))}</span>
        <button class="ghost">${escape(t('updateLoad'))}</button>
      </div>`);
    bar.querySelector('button').onclick = () => location.reload();
    document.body.append(bar);
  };

  render();
  probeGlyphs();
})(TOKIPONA_DATA, TOKIPONA_MUSI, TokiPona);

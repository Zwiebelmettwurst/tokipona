  const app = document.getElementById('app');
  const today = () => new Date().toISOString().slice(0, 10);

  const blank = {
    xp: 0, streak: 0, lastDay: null, dayXp: 0, goal: 40, days: {}, read: {},
    done: {}, mastery: {}, seenWords: {}, srs: {},
    size: 'mittel',
    diary: {},
    sitelen: false,
    sound: true,
    nameHead: 'jan',
    voice: 'kalaasi',
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

  // Der Kurs mit der Einführung davor. Sie kommt nicht aus dem Import,
  // sondern aus prototype/toki.js — sie erklärt Satzbau, keine Vokabeln.
  const lessons = () => [introLesson()]
    .concat((DATA.languages[state.lang] || DATA.languages.de).lessons);
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
  // Gleich zurückschreiben: dann steht im Speicher nur noch, was geprüft ist.
  save();
  let session = null;
  let reading = null;
  let diary = false;
  let tab = 'pfad';

  // Was aus dem Speicher oder aus einer Sicherungsdatei kommt, ist erst einmal
  // fremder Text. Übernommen wird nur, was es geben darf, und nur in der Form,
  // in der es sein muss — sonst reicht ein „__proto__“ in der Datei, um den
  // Zustand zu verbiegen.
  function sanitise(raw) {
    const state = Object.assign({}, blank);
    if (!raw || typeof raw !== 'object') return state;
    const number = (value, fallback, max) => (typeof value === 'number' && Number.isFinite(value)
      && value >= 0 && value <= max ? value : fallback);
    const plain = (value, check) => {
      const out = {};
      if (!value || typeof value !== 'object') return out;
      for (const key of Object.keys(value)) {
        // Nur Schlüssel, wie die App sie selbst vergibt.
        if (!/^[A-Za-z0-9_:.\-]{1,48}$/.test(key)) continue;
        const kept = check(value[key]);
        if (kept !== undefined) out[key] = kept;
      }
      return out;
    };

    state.xp = number(raw.xp, 0, 1e9);
    state.dayXp = number(raw.dayXp, 0, 1e9);
    state.streak = number(raw.streak, 0, 1e6);
    state.goal = GOALS.includes(raw.goal) ? raw.goal : blank.goal;
    state.lastDay = typeof raw.lastDay === 'string' ? raw.lastDay.slice(0, 10) : null;
    state.lang = DATA.languages[raw.lang] ? raw.lang : blank.lang;
    state.nameHead = typeof raw.nameHead === 'string' ? raw.nameHead.slice(0, 16) : blank.nameHead;
    state.voice = VOICES.some((entry) => entry.id === raw.voice) ? raw.voice : blank.voice;
    state.size = SIZES.some((entry) => entry.id === raw.size) ? raw.size : blank.size;
    state.sitelen = raw.sitelen === true;
    state.sound = raw.sound !== false;
    state.done = plain(raw.done, (value) => (value ? true : undefined));
    state.read = plain(raw.read, (value) => (value ? true : undefined));
    state.seenWords = plain(raw.seenWords, (value) => (value ? true : undefined));
    state.days = plain(raw.days, (value) => number(value, undefined, 1e9));
    // Tagebucheinträge sind eigener Text — begrenzt, aber sonst unangetastet.
    state.diary = plain(raw.diary, (value) => (typeof value === 'string' && value.trim()
      ? value.slice(0, 600) : undefined));
    state.mastery = plain(raw.mastery, (value) => number(value, undefined, 1));
    state.srs = plain(raw.srs, (card) => {
      if (!card || typeof card !== 'object') return undefined;
      return {
        reps: number(card.reps, 0, 1e6),
        interval: number(card.interval, 0, 1e13),
        ease: number(card.ease, 2.5, 10),
        due: number(card.due, Date.now(), 1e15),
      };
    });
    return state;
  }

  function load() {
    try {
      return sanitise(JSON.parse(localStorage.getItem(KEY)));
    } catch (error) {
      return Object.assign({}, blank);
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) { /* egal */ }
  }

  // Eine Stufe alle 100 Punkte hieß: alle zehn Aufgaben eine Stufe. Nach zwei
  // Tagen stand da Stufe 9, und die Zahl sagte nichts mehr. Jetzt wächst der
  // Abstand: Stufe n beginnt bei 25·n·(n−1) Punkten — 50, 150, 300, 500, 750 …
  const xpForLevel = (n) => 25 * n * (n - 1);
  const levelOf = (xp) => Math.max(1, Math.floor((Math.sqrt(1 + (8 * Math.max(0, xp)) / 50) + 1) / 2));
  function level() { return levelOf(state.xp); }
  function toNextLevel() { return xpForLevel(level() + 1) - state.xp; }
  function levelProgress() {
    const from = xpForLevel(level());
    const to = xpForLevel(level() + 1);
    return Math.round(((state.xp - from) / (to - from)) * 100);
  }

  const goal = () => state.goal || 40;
  // Datum von vor n Tagen, als Zeichenkette — die Tagesschlüssel sind sortierbar.
  const weekStart = (back) => new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);

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
    // Für die Wochenübersicht: die letzten Tage bleiben stehen, ältere fliegen raus.
    state.days = state.days || {};
    state.days[day] = state.dayXp;
    for (const key of Object.keys(state.days)) {
      if (key < weekStart(13)) delete state.days[key];
    }
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

  // Aufgaben-Kennung → Lektion und Aufgabe. Vorher lief für jede Karte eine
  // Schleife über alle Lektionen; bei fälligen Karten war das eine Schleife
  // in einer Schleife, bei jedem Zeichnen der Startseite.
  let itemCache = null;
  function itemIndex() {
    if (itemCache && itemCache.lang === state.lang) return itemCache.map;
    const map = new Map();
    for (const lesson of lessons().concat([musiLesson(), phraseLesson()])) {
      for (const item of lesson.items) {
        if (!map.has(item.id)) map.set(item.id, { lesson, item });
      }
    }
    itemCache = { lang: state.lang, map };
    return map;
  }

  // Fällige Karten, die sich auch bauen lassen. Verschwindet eine Aufgabe aus
  // dem Kurs, bleibt ihre Karte sonst für immer fällig: die Startseite meldet
  // „3 Karten fällig“, und ein Tipp darauf führt geradewegs auf eine leere
  // Runde. Also wird hier gebaut, bevor gezählt wird.
  function dueTasks() {
    const now = Date.now();
    const tasks = [];
    let dropped = false;
    for (const key of Object.keys(state.srs)) {
      if (state.srs[key].due > now) continue;
      const task = taskFromKey(key);
      if (task) { tasks.push(task); continue; }
      // Zeichenkarten hängen an der Schriftmessung, die erst nach dem Laden
      // durchläuft — vor ihr sind sie nur vorübergehend nicht zu bauen.
      if (key.startsWith('g:') || key.startsWith('t:')) continue;
      delete state.srs[key];
      dropped = true;
    }
    if (dropped) save();
    return tasks;
  }

  function taskFromKey(key) {
    const [kind, rest] = [key.slice(0, 1), key.slice(2)];
    if (kind === 'w') {
      const lesson = lessons().find((l) => l.words.includes(rest)) || lessons()[0];
      return TP.lexicon[rest] ? { type: 'word', word: rest, lesson, concepts: [] } : null;
    }
    if (kind === 't') {
      const lesson = lessons().find((l) => l.words.includes(rest)) || lessons()[0];
      return TP.lexicon[rest] && hasGlyph(rest)
        ? { type: 'trace', word: rest, lesson, concepts: [] } : null;
    }
    if (kind === 'g') {
      const lesson = lessons().find((l) => l.words.includes(rest)) || lessons()[0];
      return TP.lexicon[rest] && hasGlyph(rest)
        ? { type: 'glyph', word: rest, lesson, concepts: [] } : null;
    }
    if (kind === 's') {
      const join = OPEN.joins.find((entry) => entry.id === rest);
      if (join) return joinTask(join, lessonOf(join.stage) || lessons()[0]);
    }

    if (kind === 'r') {
      const [textId, index] = rest.split('-');
      const text = LIPU.texts.find((entry) => entry.id === textId);
      const question = text && text.questions[Number(index)];
      return question ? { type: 'quiz', question, text, index: Number(index),
                          lesson: lessonOf(text.stage) || lessons()[0], concepts: [] } : null;
    }
    if (kind === 'q') {
      const prompt = OPEN.prompts.find((entry) => entry.id === rest);
      return prompt ? { type: 'answer', prompt, lesson: lessonOf(prompt.stage) || lessons()[0],
                        concepts: [] } : null;
    }
    if (kind === 'v') {
      const style = OPEN.styles.find((entry) => entry.id === rest);
      return style ? { type: 'style', style, lesson: lessons()[0], concepts: [] } : null;
    }
    if (kind === 'y') {
      return TP.lexicon[rest] && (TP.syllables(rest) || []).length >= 2
        ? { type: 'syllable', word: rest, lesson: lessons()[0], concepts: [] } : null;
    }
    if (kind === 'n') {
      const compound = COMPOUNDS[Number(rest)];
      return compound ? { type: 'coin', compound, lesson: lessons()[0], concepts: [] } : null;
    }
    if (kind === 'c') {
      const compound = COMPOUNDS[Number(rest)];
      return compound ? { type: 'compound', compound, lesson: lessons()[0], concepts: [] } : null;
    }
    const found = itemIndex().get(rest);
    if (found) {
      return { type: found.item.direction === 'de_tp' ? 'build' : 'choose',
               item: found.item, lesson: found.lesson,
               concepts: lessonConcepts(found.lesson) };
    }
    return null;
  }

  function keyOf(task) {
    if (task.type === 'quiz') return 'r:' + task.text.id + '-' + task.index;
    if (task.type === 'answer') return 'q:' + task.prompt.id;
    if (task.type === 'trace') return 't:' + task.word;
    if (task.type === 'glyph') return 'g:' + task.word;
    if (task.type === 'word') return 'w:' + task.word;
    if (task.type === 'style') return 'v:' + task.style.id;
    if (task.type === 'syllable') return 'y:' + task.word;
    if (task.type === 'coin') return 'n:' + COMPOUNDS.indexOf(task.compound);
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
  // Die Einführung steht neben der Kette, nicht darin: sie ist immer offen,
  // und Lektion 1 hängt weiterhin an nichts. Wer den Kurs schon begonnen hat,
  // findet ihn deshalb unverändert vor.
  const courseChain = () => lessons().filter((lesson) => lesson.number !== 0);
  const unlocked = (number) => {
    if (number === 0) return true;
    const chain = courseChain();
    const index = chain.findIndex((lesson) => lesson.number === number);
    return index <= 0 || Boolean(state.done[chain[index - 1].number]);
  };

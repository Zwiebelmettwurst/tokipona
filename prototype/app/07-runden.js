  // ------------------------------------------------------------ Aufgabenbau

  const shuffle = (list) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  const sizeOf = () => SIZES.find((entry) => entry.id === state.size) || SIZES[1];

  // Zuschneiden, ohne die Runde eintönig zu machen: erst von jeder Sorte eine
  // Aufgabe sichern, dann in der ursprünglichen Reihenfolge auffüllen.
  function trimQueue(tasks, limit) {
    if (tasks.length <= limit) return tasks;
    const kept = new Set();
    const seen = new Set();
    for (const task of tasks) {
      if (kept.size >= limit) break;
      if (seen.has(task.type)) continue;
      seen.add(task.type);
      kept.add(task);
    }
    for (const task of tasks) {
      if (kept.size >= limit) break;
      kept.add(task);
    }
    return tasks.filter((task) => kept.has(task));
  }

  function buildSession(lesson) {
    const size = sizeOf();
    const builds = shuffle(lesson.items.filter((i) => i.direction === 'de_tp'));
    const reads = shuffle(lesson.items.filter((i) => i.direction === 'tp_de'));
    const words = shuffle(lesson.words.filter((w) => TP.lexicon[w]));
    const tasks = [];

    words.slice(0, size.words).forEach((word) => tasks.push({ type: 'word', word, lesson, concepts: [] }));
    // In jeder zweiten Lektion wird ein Wort nicht abgefragt, sondern gebaut.
    const longWord = words.find((word) => (TP.syllables(word) || []).length >= 2);
    if (longWord && lesson.number % 2 === 1) {
      tasks.push({ type: 'syllable', word: longWord, lesson, concepts: [] });
    }

    const style = shuffle(OPEN.styles)[0];
    if (style && lesson.number >= 5) {
      tasks.push({ type: 'style', style, lesson, concepts: [] });
    }
    builds.slice(0, size.builds).forEach((item) =>
      tasks.push({ type: 'build', item, lesson, concepts: lessonConcepts(lesson) }));
    reads.slice(0, size.reads).forEach((item) =>
      tasks.push({ type: 'choose', item, lesson, concepts: lessonConcepts(lesson) }));

    const flawed = brokenSentence(lesson);
    if (flawed) tasks.push({ type: 'fix', flawed, lesson, concepts: [flawed.violation.concept].filter(Boolean) });

    const compound = availableCompounds(lesson)[0];
    if (compound) {
      // Ab Lektion 4 wird nicht mehr nur erkannt, sondern selbst umschrieben.
      const build = lesson.number >= 4 && lesson.number % 2 === 0;
      tasks.push({ type: build ? 'coin' : 'compound', compound, lesson, concepts: [] });
    }

    const glyphWord = words.find(hasGlyph);
    if (state.sitelen && glyphWord) {
      tasks.push({ type: 'glyph', word: glyphWord, lesson, concepts: [] });
      const traceWord = words.filter(hasGlyph)[1] || glyphWord;
      tasks.push({ type: 'trace', word: traceWord, lesson, concepts: [] });
    }

    const heard = reads[size.reads] || builds[size.builds + 1];
    if (state.sound && speechAvailable() && heard) {
      // Gerade Lektionen diktieren, ungerade lassen wählen.
      const kind = lesson.number % 2 === 0 ? 'dictation' : 'listen';
      tasks.push({ type: kind, item: heard, lesson, concepts: lessonConcepts(lesson) });
    }

    // Eine offene Frage ersetzt das freie Übersetzen: beides ist Tippen, aber
    // die eigene Antwort ist die interessantere Übung.
    const join = shuffle(OPEN.joins.filter((entry) => entry.stage <= lesson.number))[0];
    if (join) tasks.push(joinTask(join, lesson));

    const prompt = shuffle(OPEN.prompts.filter((entry) => entry.stage <= lesson.number))[0];
    if (prompt) tasks.push({ type: 'answer', prompt, lesson, concepts: lessonConcepts(lesson) });
    else if (builds[size.builds]) {
      tasks.push({ type: 'free', item: builds[size.builds], lesson, concepts: lessonConcepts(lesson) });
    }

    return {
      lesson,
      queue: trimQueue(tasks.length ? tasks
        : builds.slice(0, 4).map((item) => ({ type: 'build', item, lesson, concepts: [] })), size.cap),
      index: 0,
      correct: 0,
      total: 0,
      xp: 0,
      retried: new Set(),
    };
  }

  // ------------------------------------------------------- Lektion 0
  //
  // Vor den Wörtern der Satzbau. Vier Regeln, jede mit Beispiel und
  // Gegenbeispiel, dahinter Aufgaben, die genau diese Regel brauchen.
  let introCache = null;
  function introLesson() {
    if (introCache && introCache.lang === state.lang) return introCache.lesson;
    const nasin = OPEN.nasin;
    const lesson = {
      number: 0,
      intro: true,
      title: nasin.title[state.lang] || nasin.title.de,
      note: nasin.note[state.lang] || nasin.note.de,
      words: nasin.words.slice(),
      items: nasin.items.map((item) => ({
        id: item.id,
        direction: item.direction,
        tp: item.tp,
        also: [],
        target: item[state.lang] || item.de,
        rule: item.rule,
      })),
    };
    introCache = { lang: state.lang, lesson };
    return lesson;
  }

  function buildIntroSession() {
    const lesson = introLesson();
    // Kurze Runde: eine Aufgabe je Regel. Sonst zwei. Die Regeln selbst
    // bleiben immer alle stehen — sie sind der Inhalt, nicht das Beiwerk.
    const perRule = sizeOf().id === 'kurz' ? 1 : 2;
    const tasks = [];
    OPEN.nasin.rules.forEach((rule) => {
      tasks.push({ type: 'rule', rule, lesson, concepts: [] });
      shuffle(lesson.items.filter((item) => item.rule === rule.id))
        .slice(0, perRule)
        .forEach((item) => tasks.push({
          type: item.direction === 'de_tp' ? 'build' : 'choose',
          item,
          lesson,
          concepts: rule.concepts || [],
        }));
    });
    // Zum Schluss ein kaputter Satz: gelernt ist es erst, wenn man den Fehler
    // sieht, ohne dass jemand daneben schreibt, dass da einer ist.
    const flawed = brokenSentence(lesson);
    if (flawed) {
      tasks.push({ type: 'fix', flawed, lesson,
                   concepts: [flawed.violation.concept].filter(Boolean) });
    }
    return { lesson, intro: true, home: 'pfad', restart: buildIntroSession,
             queue: tasks, index: 0, correct: 0, total: 0, xp: 0, retried: new Set() };
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
    const picks = [...new Set(bySort.concat(shuffle(lesson.items)))]
      .slice(0, Math.max(3, sizeOf().cap - 2));
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

  // Eine Fügung ist eine Bauaufgabe mit anderer Aufschrift: die beiden Teile
  // stehen da, gebaut wird der eine Satz.
  function joinTask(join, lesson) {
    return {
      type: 'build',
      join,
      lesson,
      concepts: [join.kind === 'pi' ? 'c_pi' : 'c_la'],
      item: { id: join.id, direction: 'de_tp', tp: join.tp, also: [],
              target: join[state.lang] || join.de },
    };
  }

  function buildReviewSession() {
    const tasks = shuffle(dueTasks()).slice(0, sizeOf().cap);
    return {
      lesson: null, review: true, queue: tasks, index: 0, correct: 0, total: 0, xp: 0,
      retried: new Set(),
    };
  }

  // ------------------------------------------------------- Schwachstellen

  // Wackelig ist, was danebenging — nicht, was noch nie dran war. Eine falsche
  // Antwort senkt die Leichtigkeit unter den Anfangswert; das ist die einzige
  // Spur, die ein Fehler hinterlässt. Übersprungene Karten bleiben bei 2,5 und
  // zählen deshalb nicht mit: Überspringen ist kein Fehler.
  // Der Fälligkeitstermin spielt hier keine Rolle — darum geht es ja gerade.
  function weakKeys() {
    const scored = Object.keys(state.srs).map((key) => {
      const card = state.srs[key];
      // Kleiner Wert heißt: sitzt schlecht.
      const score = (card.reps ? 1 : 0) + (card.ease - 1.4) / 1.4;
      return { key, score, slipped: card.ease < 2.5 };
    }).filter((entry) => entry.slipped && entry.score < 1.4);
    scored.sort((a, b) => a.score - b.score);
    return scored.map((entry) => entry.key);
  }

  // Bei Konzepten fehlt diese Spur: ein frisches Konzept steht genauso niedrig
  // wie ein misslungenes. Also zählt nur, was in einer abgeschlossenen Lektion
  // vorkam — wer eine Lektion sauber durchspielt, landet über der Hälfte.
  function weakConcepts() {
    const covered = new Set(lessons()
      .filter((lesson) => state.done[lesson.number])
      .flatMap(lessonConcepts));
    return Object.keys(state.mastery)
      .filter((concept) => covered.has(concept) && state.mastery[concept] < 0.5)
      .sort((a, b) => state.mastery[a] - state.mastery[b]);
  }

  // Zu einem schwachen Konzept passt jede Lektion, die es überhaupt behandelt —
  // und aus den freigeschalteten davon kommen die Sätze.
  function itemsForConcept(concept) {
    const open = lessons().filter((lesson) => unlocked(lesson.number)
      && lessonConcepts(lesson).includes(concept));
    return shuffle(open).flatMap((lesson) => shuffle(lesson.items)
      .slice(0, 2)
      .map((item) => ({
        type: item.direction === 'de_tp' ? 'build' : 'choose',
        item,
        lesson,
        concepts: [concept],
      })));
  }

  function weakSession() {
    const cap = sizeOf().cap;
    const fromCards = weakKeys().map(taskFromKey).filter(Boolean);
    const fromConcepts = weakConcepts().flatMap(itemsForConcept);
    // Abwechselnd auffädeln: sonst stehen erst zehn Wörter und dann zehn Sätze.
    const queue = [];
    const seen = new Set();
    for (let i = 0; i < Math.max(fromCards.length, fromConcepts.length); i += 1) {
      for (const task of [fromCards[i], fromConcepts[i]]) {
        if (!task) continue;
        const id = keyOf(task) || String(queue.length);
        if (seen.has(id)) continue;
        seen.add(id);
        queue.push(task);
      }
    }
    return queue.slice(0, cap);
  }

  function buildWeakSession() {
    return {
      lesson: null, review: true, weak: true, queue: weakSession(),
      index: 0, correct: 0, total: 0, xp: 0, retried: new Set(),
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
      0: ['c_li', 'c_e_objekt', 'c_mi_sina'],
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

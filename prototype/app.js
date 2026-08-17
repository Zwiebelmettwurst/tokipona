// Prototyp des Übungsflows. Zeigt den Kernkreislauf des Plans:
// bauen statt erkennen, sofortige Rückmeldung mit Satzröntgen, sichtbarer
// Fortschritt — ohne Herzen und ohne Bestenliste.

(function (DATA, TP) {
  const KEY = 'o-toki-fortschritt-v1';
  const GOAL = 40;
  const CONCEPT_LABELS = {
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
  };

  // Die Kernfertigkeit von toki pona: ausdrücken, wofür es kein Wort gibt.
  // Jede Umschreibung ist beim Bauen durch den Parser gelaufen.
  const COMPOUNDS = [
    { de: 'Auto', tp: 'tomo tawa', literal: 'sich bewegendes Haus' },
    { de: 'Kaffee', tp: 'telo pimeja wawa', literal: 'dunkles starkes Wasser' },
    { de: 'Computer', tp: 'ilo sona', literal: 'Wissens-Gerät' },
    { de: 'Telefon', tp: 'ilo toki', literal: 'Sprech-Gerät' },
    { de: 'Uhr', tp: 'ilo tenpo', literal: 'Zeit-Gerät' },
    { de: 'Fahrrad', tp: 'ilo tawa', literal: 'Bewegungs-Gerät' },
    { de: 'Brille', tp: 'len lukin', literal: 'Seh-Kleidung' },
    { de: 'Bibliothek', tp: 'tomo lipu', literal: 'Dokumenten-Haus' },
    { de: 'Restaurant', tp: 'tomo moku', literal: 'Essens-Haus' },
    { de: 'Schule', tp: 'tomo sona', literal: 'Wissens-Haus' },
    { de: 'Kino', tp: 'tomo pi sitelen tawa', literal: 'Haus der bewegten Bilder' },
    { de: 'Musik', tp: 'kalama musi', literal: 'unterhaltsamer Klang' },
    { de: 'Regen', tp: 'telo tan sewi', literal: 'Wasser von oben' },
    { de: 'Bier', tp: 'telo nasa', literal: 'seltsames Wasser' },
    { de: 'Suppe', tp: 'telo moku', literal: 'Ess-Wasser' },
    { de: 'Arzt', tp: 'jan pi pona sijelo', literal: 'Mensch der Körper-Güte' },
    { de: 'Lehrerin', tp: 'jan pi pana sona', literal: 'Mensch, der Wissen gibt' },
    { de: 'Freund', tp: 'jan pona', literal: 'guter Mensch' },
  ];

  const app = document.getElementById('app');
  const today = () => new Date().toISOString().slice(0, 10);

  const blank = {
    xp: 0, streak: 0, lastDay: null, dayXp: 0, done: {}, mastery: {}, seenWords: {}, srs: {},
  };

  // Lernschritte wie in bewährten Karteikartensystemen: erst zehn Minuten,
  // dann Tage. Der kurze erste Schritt macht die Wiederholung schon in der
  // ersten Sitzung sichtbar, statt sie auf morgen zu vertagen.
  const MINUTE = 60000;
  const DAY = 86400000;
  const STEPS = [10 * MINUTE, DAY, 3 * DAY, 7 * DAY];

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
      const lesson = DATA.lessons.find((l) => l.words.includes(rest)) || DATA.lessons[0];
      return TP.lexicon[rest] ? { type: 'word', word: rest, lesson, concepts: [] } : null;
    }
    if (kind === 'c') {
      const compound = COMPOUNDS[Number(rest)];
      return compound ? { type: 'compound', compound, lesson: DATA.lessons[0], concepts: [] } : null;
    }
    for (const lesson of DATA.lessons) {
      const item = lesson.items.find((i) => i.id === rest);
      if (item) {
        return { type: item.direction === 'de_tp' ? 'build' : 'choose', item, lesson,
                 concepts: lessonConcepts(lesson) };
      }
    }
    return null;
  }

  function keyOf(task) {
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

  const lessonOf = (number) => DATA.lessons.find((l) => l.number === number);
  const unlocked = (number) => number === DATA.lessons[0].number
    || Boolean(state.done[DATA.lessons[DATA.lessons.findIndex((l) => l.number === number) - 1].number]);

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

  function buildReviewSession() {
    const tasks = shuffle(dueKeys()).map(taskFromKey).filter(Boolean).slice(0, 12);
    return {
      lesson: null, review: true, queue: tasks, index: 0, correct: 0, total: 0, xp: 0,
      retried: new Set(),
    };
  }

  // Umschreibungen, deren Wörter die Lernende schon kennt.
  function availableCompounds(lesson) {
    const known = new Set(DATA.lessons.filter((l) => l.number <= lesson.number).flatMap((l) => l.words));
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
    const pool = DATA.lessons
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
    app.innerHTML = '';
    if (session) { renderSession(); clearStrayFocus(); return; }
    app.append(topbar());
    if (tab === 'pfad') app.append(pathScreen());
    else if (tab === 'nimi') app.append(wordScreen());
    else app.append(sandboxScreen());
    app.append(tabs());
    clearStrayFocus();
  }

  function topbar() {
    const bar = el(`
      <div>
        <div class="topbar">
          <div class="level"><div class="ring">${level()}</div><span>Stufe</span></div>
          <div class="metric spacer gold"><b>${state.dayXp}</b>/${GOAL} XP heute</div>
          <div class="metric"><b>${state.streak}</b> Tage</div>
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
        <button data-tab="toki"><span class="glyph">◐</span>o toki</button>
      </nav>`);
    bar.querySelectorAll('button').forEach((button) => {
      button.dataset.active = button.dataset.tab === tab;
      button.onclick = () => { tab = button.dataset.tab; render(); };
    });
    return bar;
  }

  function pathScreen() {
    const next = DATA.lessons.find((l) => !state.done[l.number]) || DATA.lessons[DATA.lessons.length - 1];
    const screen = el(`
      <div class="screen">
        <div class="hello">
          <h1>o kama pona!</h1>
          <p>${state.xp ? `Weiter bei „${escape(next.title)}“.`
                        : 'Zwölf Lektionen. Du baust Sätze, statt Vokabeln abzuhaken.'}</p>
        </div>
        <div class="path"></div>
      </div>`);

    const due = dueKeys().length;
    if (due) {
      const card = el(`
        <button class="lesson review" data-state="current">
          <span class="badge">↻</span>
          <span class="body">
            <b>${due} ${due === 1 ? 'Karte' : 'Karten'} fällig</b>
            <span>wörter, sätze und umschreibungen von vorher</span>
          </span>
        </button>`);
      card.onclick = () => { session = buildReviewSession(); render(); };
      screen.querySelector('.hello').after(card);
    }

    const path = screen.querySelector('.path');
    DATA.lessons.forEach((lesson) => {
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
      const card = el('<div class="card"><h2>konzepte</h2><div class="concepts"></div></div>');
      const list = card.querySelector('.concepts');
      active.sort((a, b) => state.mastery[b] - state.mastery[a]).forEach((concept) => {
        list.append(el(`
          <div class="concept">
            <span>${escape(CONCEPT_LABELS[concept] || concept)}</span>
            <span class="bar"><i style="width:${Math.round(state.mastery[concept] * 100)}%"></i></span>
          </div>`));
      });
      screen.append(card);
    }

    screen.append(backupCard());

    screen.append(el(`
      <p class="foot">
        Prototyp. Übungssätze aus <a href="https://lipu-sona.pona.la/de/">lipu sona pona</a>
        (MIT, © 2020 /dev/urandom und Mitwirkende), geprüft von TokiPonaKit.
      </p>`));
    return screen;
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
      throw new Error('Das ist kein lesbarer Sicherungstext.');
    }
    const found = payload && payload.state ? payload.state : payload;
    if (!found || typeof found !== 'object' || ['xp', 'done', 'srs'].some((f) => !(f in found))) {
      throw new Error('Darin steckt kein Fortschritt dieser App.');
    }
    return {
      state: Object.assign({}, blank, found),
      exported: payload && payload.exported ? payload.exported.slice(0, 10) : null,
    };
  }

  const summarise = (value) => `Stufe ${Math.floor((value.xp || 0) / 100) + 1}, `
    + `${Object.keys(value.done || {}).length} Lektionen, `
    + `${Object.keys(value.srs || {}).length} Karten, ${value.xp || 0} XP`;

  function backupCard() {
    const card = el(`
      <div class="card">
        <h2>fortschritt sichern</h2>
        <p class="hint">Dein Stand liegt nur auf diesem Gerät: ${escape(summarise(state))}.
          Safari räumt ihn nach sieben Tagen ohne Besuch weg — als Homescreen-App nicht.</p>
        <div class="row">
          <button class="ghost" data-do="save">Sichern</button>
          <button class="ghost" data-do="load">Wiederherstellen</button>
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

      const share = el('<button class="ghost">Als Datei sichern oder teilen</button>');
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

      const copy = el('<button class="ghost">Code in die Zwischenablage</button>');
      copy.onclick = async () => {
        try {
          await navigator.clipboard.writeText(text);
          note('Kopiert. Sicher ihn dir irgendwo, wo er nicht verlorengeht.');
        } catch (error) {
          note('Kopieren ging nicht — nimm die Datei.', true);
        }
      };

      drawer.append(share, copy);
    };

    card.querySelector('[data-do="load"]').onclick = () => {
      drawer.innerHTML = '';
      const form = el(`
        <div>
          <label class="ghost pickwrap">Sicherungsdatei wählen
            <input class="pick" type="file" accept="application/json,.json,text/plain">
          </label>
          <textarea class="paste" rows="3" placeholder="… oder Code hier einfügen" aria-label="Sicherungscode"></textarea>
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
        preview.append(el(`<p class="hint">Gefunden: ${escape(summarise(backup.state))}`
          + `${backup.exported ? ` · gesichert am ${escape(backup.exported)}` : ''}.<br>`
          + `Ersetzt deinen jetzigen Stand: ${escape(summarise(state))}.</p>`));
        const confirm = el('<button class="primary">Diesen Stand übernehmen</button>');
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
        reader.onerror = () => preview.append(el('<p class="hint bad">Datei ließ sich nicht lesen.</p>'));
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
    else app.append(freeTask(task));
  }

  function screenWith(inner) {
    return el(`<div class="screen">${inner}</div>`);
  }

  function wordTask(task) {
    const entry = TP.lexicon[task.word];
    const right = entry.glosses.slice(0, 3).join(', ');
    const options = shuffle([right, ...distractorWords(task.lesson, [task.word], 3)
      .map((w) => TP.lexicon[w].glosses.slice(0, 3).join(', '))]);

    const screen = screenWith(`
      <p class="prompt">was heißt das wort?</p>
      <h2 class="question tp">${escape(task.word)}</h2>
      <div class="choices"></div>
      <div class="actions"><button class="primary" disabled>Prüfen</button></div>`);

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
          : `<b>${escape(task.word)}</b> deckt: ${escape(entry.glosses.join(', '))}.`,
      });
    };
    return screen;
  }

  function chooseTask(task) {
    const right = task.item.de[0];
    const pool = task.lesson.items
      .filter((i) => i.id !== task.item.id)
      .flatMap((i) => i.de)
      .filter((text) => text !== right);
    const options = shuffle([right, ...shuffle(pool).slice(0, 2)]);

    const screen = screenWith(`
      <p class="prompt">was bedeutet der satz?</p>
      <h2 class="question tp">${escape(task.item.tp)}</h2>
      <div class="choices"></div>
      <div class="actions"><button class="primary" disabled>Prüfen</button></div>`);

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
      <p class="prompt">hier stimmt ein wort nicht — tipp es an</p>
      <div class="pickline"></div>
      <p class="hint">Ein Wort steht zu viel oder fehlt an dieser Stelle.</p>
      <div class="actions"><button class="primary" disabled>Prüfen</button></div>`);

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

  // Umschreiben: der Kern der Sprache. Nicht „wie heißt Kaffee“, sondern
  // „wie drückst du Kaffee mit 120 Wörtern aus“.
  function compoundTask(task) {
    const right = task.compound;
    const options = shuffle([right, ...shuffle(COMPOUNDS.filter((c) => c !== right)).slice(0, 2)]);

    const screen = screenWith(`
      <p class="prompt">dafür gibt es kein wort — wie sagst du es?</p>
      <h2 class="question">${escape(right.de)}</h2>
      <div class="choices"></div>
      <div class="actions"><button class="primary" disabled>Prüfen</button></div>`);

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
      reason: `<b>${escape(right.tp)}</b> — wörtlich: ${escape(right.literal)}.`,
    });
    return screen;
  }

  function buildTask(task) {
    const solution = TP.tokenize(task.item.tp).map((t) => t.text);
    const extras = distractorWords(task.lesson, solution, Math.min(3, Math.max(2, 6 - solution.length)));
    const bank = shuffle(solution.concat(extras));

    const screen = screenWith(`
      <p class="prompt">bau den satz</p>
      <h2 class="question">${escape(task.item.de[0])}</h2>
      <div class="slot"></div>
      <p class="hint">Antippen nimmt ein Wort zurück, Ziehen sortiert um.</p>
      <div class="bank"></div>
      <div class="actions"><button class="primary" disabled>Prüfen</button></div>`);

    const slot = screen.querySelector('.slot');
    const bankRow = screen.querySelector('.bank');
    const button = screen.querySelector('.primary');
    const chosen = [];

    // Die gelegten Kacheln sind die Wahrheit: nach jedem Ziehen wird die
    // Wortfolge aus der Reihenfolge im Baum neu gelesen.
    const readOrder = () => Array.from(slot.children).map((node) => node.dataset.word);

    const refreshBank = () => {
      bankRow.querySelectorAll('.tile').forEach((tile) => {
        const used = chosen.filter((w) => w === tile.dataset.word).length;
        const available = bank.filter((w) => w === tile.dataset.word).length;
        tile.classList.toggle('used', Number(tile.dataset.slot) < used || used >= available);
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

    const place = (word) => {
      const tile = el(`<button class="tile placed" data-word="${escape(word)}"
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

    bank.forEach((word, position) => {
      const tile = el(`<button class="tile" data-word="${escape(word)}" data-slot="${position}">${escape(word)}</button>`);
      tile.onclick = () => { chosen.push(word); sync(); };
      bankRow.append(tile);
    });
    sync();

    button.onclick = () => {
      const answer = chosen.join(' ');
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
      <p class="prompt">schreib es selbst — freie eingabe</p>
      <h2 class="question">${escape(task.item.de[0])}</h2>
      <input class="typed" autocomplete="off" autocapitalize="off" spellcheck="false"
             placeholder="toki pona …" aria-label="Deine Antwort">
      <p class="live"></p>
      <p class="hint">Der Parser prüft den Satzbau, während du tippst. Andere Wortwahl als
        die Musterlösung ist in Ordnung, solange die Grammatik stimmt.</p>
      <div class="actions"><button class="primary" disabled>Prüfen</button></div>`);

    const input = screen.querySelector('.typed');
    const live = screen.querySelector('.live');
    const button = screen.querySelector('.primary');

    input.oninput = () => {
      const text = input.value.trim();
      button.disabled = !text;
      if (!text) { live.textContent = ''; live.className = 'live'; return; }
      const result = TP.parse(text);
      if (result.isValid) {
        live.textContent = '✓ Satzbau in Ordnung';
        live.className = 'live good';
      } else {
        live.textContent = '• ' + result.violations[0].message;
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
          <span>${correct
            ? (detail.grade && detail.grade.variant ? 'Richtig — andere Wortwahl, gleiche Aussage' : 'pona!')
            : 'Noch nicht'}</span>
        </div>
      </div>`);

    if (detail.grade && detail.grade.violations && detail.grade.violations.length) {
      const violation = detail.grade.violations[0];
      sheet.append(el(`
        <div class="violation">
          ${escape(violation.message)}
          ${violation.correction ? `<br><code>→ ${escape(violation.correction)}</code>` : ''}
        </div>`));
    } else if (detail.grade && detail.grade.missing) {
      sheet.append(el(`<p class="reason">Satzbau stimmt, aber es fehlt:
        <code>${detail.grade.missing.map(escape).join(', ')}</code></p>`));
    } else if (detail.reason) {
      sheet.append(el(`<p class="reason">${detail.reason}</p>`));
    }

    if (!correct || (detail.grade && detail.grade.variant)) {
      sheet.append(el(`<p class="reason">Musterlösung: <span class="solution">${escape(detail.solution)}</span></p>`));
    }
    if (!correct && detail.parked) {
      sheet.append(el('<p class="hint">Kommt in einer der nächsten Wiederholungen zurück.</p>'));
    }

    if (detail.xray) {
      const spans = TP.xray(TP.parse(detail.xray).utterance);
      if (spans.length) {
        sheet.append(el(`<div class="xray">${spans.map((span) => `
          <span class="span" data-role="${escape(span.role)}">
            <b>${escape(span.text)}</b><i>${escape(span.role)}</i>
          </span>`).join('')}</div>`));
      }
    }

    const next = el(`<button class="primary">${correct ? 'Weiter' : 'Verstanden'}</button>`);
    next.onclick = () => { session.index += 1; render(); };
    sheet.append(next);
    app.append(sheet);
    next.focus();
  }

  function renderDone() {
    const lesson = session.lesson;
    const review = Boolean(session.review);
    if (lesson) {
      state.done[lesson.number] = true;
      lesson.words.forEach((word) => { state.seenWords[word] = true; });
    }
    save();

    const screen = el(`
      <div class="screen done">
        <div class="burst">pona!</div>
        <h2>${escape(review ? 'Wiederholung geschafft' : lesson.title)}</h2>
        <p>${escape(review
          ? 'Die Karten kommen wieder, wenn es Zeit dafür ist.'
          : lesson.note.replace(/<[^>]+>/g, ''))}</p>
        <div class="tally">
          <div><b>+${session.xp}</b><span>xp</span></div>
          <div><b>${session.correct}</b><span>richtig</span></div>
          <div><b>${review ? session.queue.length : lesson.words.length}</b><span>${review ? 'karten' : 'wörter'}</span></div>
        </div>
        <div class="actions">
          <button class="primary">Weiter</button>
          ${review ? '' : '<button class="ghost">Nochmal üben</button>'}
        </div>
      </div>`);

    screen.querySelector('.primary').onclick = () => { session = null; tab = 'pfad'; render(); };
    if (!review) {
      screen.querySelector('.ghost').onclick = () => { session = buildSession(lesson); render(); };
    }
    app.append(topbar());
    app.append(screen);
  }

  // ------------------------------------------------------------ Wörter

  function wordScreen() {
    const screen = screenWith(`
      <input class="search" placeholder="Wort oder Bedeutung suchen …" aria-label="Suche">
      <div class="words"></div>`);
    const list = screen.querySelector('.words');
    const input = screen.querySelector('.search');

    const draw = (query) => {
      list.innerHTML = '';
      const term = query.trim().toLowerCase();
      Object.keys(TP.lexicon).sort().forEach((word) => {
        const entry = TP.lexicon[word];
        const text = entry.glosses.join(', ');
        if (term && !word.includes(term) && !text.toLowerCase().includes(term)) return;
        list.append(el(`
          <div class="word">
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
        <h1>o toki!</h1>
        <p>Schreib irgendetwas auf toki pona. Der Parser zerlegt es und sagt dir,
           was er sieht — oder was nicht stimmt.</p>
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
              <b>${escape(span.text)}</b><i>${escape(span.role)}</i>
            </span>`).join('')}</div>`));
        }
        if (parsed.isValid) {
          card.append(el(`<p class="reason" style="margin-top:0.7rem;color:var(--accent)">
            ✓ Satzbau in Ordnung${parsed.utterance && parsed.utterance.isQuestion ? ' — eine Frage' : ''}</p>`));
        } else {
          parsed.violations.forEach((violation) => {
            card.append(el(`
              <div class="violation" style="margin-top:0.7rem">
                ${escape(violation.message)}
                ${violation.correction ? `<br><code>→ ${escape(violation.correction)}</code>` : ''}
                ${violation.concept ? `<br><code>${escape(CONCEPT_LABELS[violation.concept] || violation.concept)}</code>` : ''}
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
        Probier: <code>mi li moku.</code> · <code>jan pi pona li lape.</code> ·
        <code>soweli moku e kili.</code> · <code>jan Claude li pona.</code>
      </p>`));
    return screen;
  }

  render();
})(TOKIPONA_DATA, TokiPona);

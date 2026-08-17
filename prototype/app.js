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

  const app = document.getElementById('app');
  const today = () => new Date().toISOString().slice(0, 10);

  const blank = {
    xp: 0, streak: 0, lastDay: null, dayXp: 0, done: {}, mastery: {}, seenWords: {},
  };

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

    words.slice(0, 2).forEach((word) => tasks.push({ type: 'word', word, concepts: [] }));
    builds.slice(0, 3).forEach((item) => tasks.push({ type: 'build', item, concepts: lessonConcepts(lesson) }));
    reads.slice(0, 2).forEach((item) => tasks.push({ type: 'choose', item, concepts: lessonConcepts(lesson) }));
    if (builds[3]) tasks.push({ type: 'free', item: builds[3], concepts: lessonConcepts(lesson) });

    return {
      lesson,
      queue: tasks.length ? tasks : builds.slice(0, 4).map((item) => ({ type: 'build', item, concepts: [] })),
      index: 0,
      correct: 0,
      total: 0,
      xp: 0,
      retried: new Set(),
    };
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

  function render() {
    app.innerHTML = '';
    if (session) { renderSession(); return; }
    app.append(topbar());
    if (tab === 'pfad') app.append(pathScreen());
    else if (tab === 'nimi') app.append(wordScreen());
    else app.append(sandboxScreen());
    app.append(tabs());
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

    screen.append(el(`
      <p class="foot">
        Prototyp. Übungssätze aus <a href="https://lipu-sona.pona.la/de/">lipu sona pona</a>
        (MIT, © 2020 /dev/urandom und Mitwirkende), geprüft von TokiPonaKit.
      </p>`));
    return screen;
  }

  // ------------------------------------------------------------ Übungslauf

  function renderSession() {
    if (session.index >= session.queue.length) { renderDone(); return; }
    const task = session.queue[session.index];

    const head = el(`
      <div class="exbar">
        <button aria-label="Zurück">✕</button>
        <span class="track"><i style="width:${(session.index / session.queue.length) * 100}%"></i></span>
        <span class="metric">✓ <b>${session.correct}</b></span>
      </div>`);
    head.querySelector('button').onclick = () => { session = null; render(); };
    app.append(head);

    if (task.type === 'word') app.append(wordTask(task));
    else if (task.type === 'build') app.append(buildTask(task));
    else if (task.type === 'choose') app.append(chooseTask(task));
    else app.append(freeTask(task));
  }

  function screenWith(inner) {
    return el(`<div class="screen">${inner}</div>`);
  }

  function wordTask(task) {
    const entry = TP.lexicon[task.word];
    const right = entry.glosses.slice(0, 3).join(', ');
    const options = shuffle([right, ...distractorWords(session.lesson, [task.word], 3)
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
    const pool = session.lesson.items
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

  function buildTask(task) {
    const solution = TP.tokenize(task.item.tp).map((t) => t.text);
    const extras = distractorWords(session.lesson, solution, Math.min(3, Math.max(2, 6 - solution.length)));
    const bank = shuffle(solution.concat(extras));

    const screen = screenWith(`
      <p class="prompt">bau den satz</p>
      <h2 class="question">${escape(task.item.de[0])}</h2>
      <div class="slot"></div>
      <div class="bank"></div>
      <div class="actions"><button class="primary" disabled>Prüfen</button></div>`);

    const slot = screen.querySelector('.slot');
    const bankRow = screen.querySelector('.bank');
    const button = screen.querySelector('.primary');
    const chosen = [];

    const sync = () => {
      slot.innerHTML = '';
      chosen.forEach((word, position) => {
        const tile = el(`<button class="tile placed">${escape(word)}</button>`);
        tile.onclick = () => {
          chosen.splice(position, 1);
          sync();
        };
        slot.append(tile);
      });
      bankRow.querySelectorAll('.tile').forEach((tile) => {
        const used = chosen.filter((w) => w === tile.dataset.word).length;
        const available = bank.filter((w) => w === tile.dataset.word).length;
        tile.classList.toggle('used', Number(tile.dataset.slot) < used || used >= available);
      });
      button.disabled = chosen.length === 0;
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
    } else {
      session.retried.add(session.queue.length);
      session.queue.push(task);      // falsch beantwortet: kommt noch einmal
    }
    bumpMastery(task.concepts, correct);
    save();
    showSheet(correct, detail);
  }

  function showSheet(correct, detail) {
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
    state.done[lesson.number] = true;
    lesson.words.forEach((word) => { state.seenWords[word] = true; });
    save();

    const screen = el(`
      <div class="screen done">
        <div class="burst">pona!</div>
        <h2>${escape(lesson.title)}</h2>
        <p>${escape(lesson.note.replace(/<[^>]+>/g, ''))}</p>
        <div class="tally">
          <div><b>+${session.xp}</b><span>xp</span></div>
          <div><b>${session.correct}</b><span>richtig</span></div>
          <div><b>${lesson.words.length}</b><span>wörter</span></div>
        </div>
        <div class="actions">
          <button class="primary">Weiter</button>
          <button class="ghost">Nochmal üben</button>
        </div>
      </div>`);

    screen.querySelector('.primary').onclick = () => { session = null; tab = 'pfad'; render(); };
    screen.querySelector('.ghost').onclick = () => { session = buildSession(lesson); render(); };
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

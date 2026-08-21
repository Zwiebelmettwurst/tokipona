  // ------------------------------------------------------------ Übungslauf

  // Kurze Einblendung, die von selbst wieder verschwindet.
  let toastTimer = null;
  function toast(text) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const box = el(`<div class="toast" role="status">${escape(text)}</div>`);
    document.body.append(box);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.remove(), 2200);
  }

  function skipTask(task) {
    const key = keyOf(task);
    if (key) {
      const card = state.srs[key] || { reps: 0, interval: 0, ease: 2.5, due: Date.now() };
      // Kein Rückschritt bei den Wiederholungen: nur bald nochmal zeigen.
      card.due = Date.now() + STEPS[0];
      card.interval = Math.min(card.interval || STEPS[0], STEPS[0]);
      state.srs[key] = card;
    }
    session.skipped = (session.skipped || 0) + 1;
    session.index += 1;
    save();
    render();
    toast(t('skipNote'));
  }

  function renderSession() {
    if (session.index >= session.queue.length) { renderDone(); return; }
    const task = session.queue[session.index];

    const head = el(`
      <div class="exbar">
        <button aria-label="${escape(t('cancel'))}">✕</button>
        <span class="track"><i style="width:${(session.index / session.queue.length) * 100}%"></i></span>
        <span class="metric">✓ <b>${session.correct}</b></span>
      </div>`);
    head.querySelector('button').onclick = () => { session = null; render(); };
    // Manchmal ist keine Zeit für Fingerarbeit. Überspringen kostet keine
    // Punkte und straft nicht ab — die Karte ist gleich wieder dran.
    const skip = el(`<button class="skip">${escape(t('skip'))}</button>`);
    skip.onclick = () => skipTask(task);
    head.append(skip);
    app.append(head);

    if (task.type === 'rule') app.append(ruleTask(task));
    else if (task.type === 'word') app.append(wordTask(task));
    else if (task.type === 'build') app.append(buildTask(task));
    else if (task.type === 'choose') app.append(chooseTask(task));
    else if (task.type === 'fix') app.append(fixTask(task));
    else if (task.type === 'compound') app.append(compoundTask(task));
    else if (task.type === 'glyph') app.append(glyphTask(task));
    else if (task.type === 'listen') app.append(listenTask(task));
    else if (task.type === 'dictation') app.append(dictationTask(task));
    else if (task.type === 'answer') app.append(answerTask(task));
    else if (task.type === 'quiz') app.append(quizTask(task));
    else if (task.type === 'trace') app.append(traceTask(task));
    else if (task.type === 'coin') app.append(coinTask(task));
    else if (task.type === 'style') app.append(styleTask(task));
    else if (task.type === 'syllable') app.append(syllableTask(task));
    else app.append(freeTask(task));
  }

  function screenWith(inner) {
    return el(`<div class="screen">${inner}</div>`);
  }

  // Eine Regel, kein Rätsel: Beispiel, Bau, Erklärung, Gegenbeispiel. Es gibt
  // nichts zu antworten und deshalb auch keine Punkte — die kommen aus den
  // Aufgaben, die darauf folgen.
  function ruleTask(task) {
    const rule = task.rule;
    const screen = screenWith(`
      <p class="prompt">${escape(t('askRule'))}</p>
      <h2 class="question tp"></h2>
      <p class="hint">${escape(rule[state.lang] || rule.de)}</p>
      <div class="rulebody"></div>
      <div class="actions"><button class="primary">${escape(t('understood'))}</button></div>`);

    const asked = screen.querySelector('.question');
    asked.append(glossed(rule.tp, 'glossline'));
    withSay(asked, rule.tp);

    const body = screen.querySelector('.rulebody');
    const xray = xrayBlock(rule.tp, null, null);
    if (xray) body.append(xray);
    // Die Erklärung ist eigener Text aus prototype/toki.js und darf Auszeichnung
    // tragen — sie kommt nicht von außen.
    body.append(el(`<p class="reason">${rule.point[state.lang] || rule.point.de}</p>`));
    if (rule.bad) {
      const wrong = rule.bad.kind === 'falsch';
      body.append(el(`
        <div class="rulebad" data-kind="${escape(rule.bad.kind)}">
          <p class="badline"><span class="mark">${wrong ? '✕' : '≠'}</span>
            <code>${escape(rule.bad.tp)}</code></p>
          <p class="hint">${rule.bad[state.lang] || rule.bad.de}</p>
        </div>`));
    }

    screen.querySelector('.primary').onclick = () => {
      session.index += 1;
      render();
    };
    return screen;
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

    withSay(screen.querySelector('.question'), task.word);

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
        speak: task.word,
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

    const asked = screen.querySelector('.question');
    asked.append(glossed(task.item.tp, 'glossline'));
    withSay(asked, task.item.tp);

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
      speak: task.item.tp,
      xray: task.item.tp,
    });
    return screen;
  }

  // Fehlersuche: das falsche Wort antippen. Die Stelle kommt aus dem Parser,
  // nicht aus einer Handliste — deshalb stimmt sie immer.
  // Diktat: hören und schreiben. Die härteste der Höraufgaben — und die
  // einzige, die Lautung und Schreibung zusammenbringt.
  function dictationTask(task) {
    const screen = screenWith(`
      <p class="prompt">${escape(t('askDictation'))}</p>
      <div class="playbox">
        <button class="play" type="button" aria-label="${escape(t('listenAgain'))}">♪</button>
        <span class="hint">${escape(t('listenAgain'))}</span>
      </div>
      <input class="typed" autocomplete="off" autocapitalize="off" spellcheck="false"
             placeholder="toki pona …" aria-label="toki pona">
      <p class="live"></p>
      <p class="hint">${escape(t('dictationHint'))}</p>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    const play = screen.querySelector('.play');
    play.onclick = () => speak(task.item.tp);
    setTimeout(() => speak(task.item.tp), 300);

    const input = screen.querySelector('.typed');
    const live = screen.querySelector('.live');
    const button = screen.querySelector('.primary');

    input.oninput = () => {
      const text = input.value.trim();
      button.disabled = !text;
      if (!text) { live.textContent = ''; live.className = 'live'; return; }
      const result = TP.parse(TP.splitUtterances(text)[0] || text);
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
      // Beim Diktat zählt nur Wort für Wort — die Erklärung kommt trotzdem
      // aus derselben Bewertung.
      finish(task, Boolean(verdict.exact), {
        solution: task.item.tp,
        speak: task.item.tp,
        xray: answer || task.item.tp,
        xrayMine: Boolean(answer),
        dictation: true,
        grade: verdict.exact ? null : verdict,
      });
    };
    setTimeout(() => input.focus(), 400);
    return screen;
  }

  // Höraufgabe: der Satz wird nur gesprochen, nicht gezeigt. Auf iOS darf
  // Ton erst nach einer Berührung kommen — deshalb der große Knopf.
  function listenTask(task) {
    const right = task.item.target[0];
    const pool = task.lesson.items
      .filter((item) => item.id !== task.item.id)
      .flatMap((item) => item.target)
      .filter((text) => text !== right);
    const options = shuffle([right, ...shuffle(pool).slice(0, 2)]);

    const screen = screenWith(`
      <p class="prompt">${escape(t('askListen'))}</p>
      <div class="playbox">
        <button class="play" type="button" aria-label="${escape(t('listenAgain'))}">♪</button>
        <span class="hint">${escape(t('listenAgain'))}</span>
      </div>
      <div class="choices"></div>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    const play = screen.querySelector('.play');
    play.onclick = () => speak(task.item.tp);
    // Am Rechner spielt es von selbst; auf dem Telefon wartet es auf den Knopf.
    setTimeout(() => speak(task.item.tp), 300);

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
      solution: task.item.tp,
      speak: task.item.tp,
      xray: task.item.tp,
    });
    return screen;
  }

  // sitelen pona selbst schreiben. Bewertet wird mit zwei Zahlen: wie viel
  // der Vorlage getroffen wurde, und wie viel der eigenen Linie auf der
  // Vorlage sitzt. Beides zählt — nur Kritzeln füllt zwar die Vorlage, sitzt
  // aber daneben.
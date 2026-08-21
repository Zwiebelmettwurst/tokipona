  function readerScreen(text) {
    const screen = screenWith(`
      <div class="exbar">
        <button aria-label="${escape(t('readBack'))}">✕</button>
        <span class="track"></span>
        <span class="metric">lipu</span>
      </div>
      <h1 class="lipu-title">${escape(text.title[state.lang] || text.title.de)}</h1>
      <p class="ask">${escape(text.about[state.lang] || text.about.de)}</p>
      <div class="row lipuactions">
        <button class="ghost sayall">${escape(t('readAll'))}</button>
        <button class="ghost showall">${escape(t('readShowAll'))}</button>
      </div>
      <div class="lipulines"></div>
      <div class="actions"><button class="primary">${escape(t('readQuestions'))}</button></div>`);

    const lines = screen.querySelector('.lipulines');
    text.lines.forEach((line) => {
      const row = el('<div class="lipuline"></div>');
      const tp = el('<p class="tp glossable"></p>');
      tp.append(glossed(line.tp, 'glossline'));
      withSay(tp, line.tp);
      row.append(tp);
      const meaning = el(`<p class="meaning" hidden>${escape(line[state.lang] || line.de)}</p>`);
      row.append(meaning);
      // Aufdecken über einen eigenen Knopf — ein Tipp auf ein Wort schlägt
      // dieses Wort nach, das darf sich nicht in die Quere kommen.
      const reveal = el(`<button class="reveal" type="button"
        aria-label="${escape(t('readReveal'))}">${escape(t('readReveal'))}</button>`);
      const toggle = () => {
        meaning.hidden = !meaning.hidden;
        reveal.hidden = !meaning.hidden;
      };
      reveal.onclick = (event) => { event.stopPropagation(); toggle(); };
      row.append(reveal);
      row.onclick = (event) => {
        if (event.target.closest('.gloss-word') || event.target.closest('.say')) return;
        toggle();
      };
      lines.append(row);
    });

    // Ganzen Text vorlesen, Satz für Satz mitleuchtend.
    const sayAll = screen.querySelector('.sayall');
    if (!speechAvailable() || !state.sound) sayAll.hidden = true;
    let playing = false;
    const highlight = (index) => {
      lines.querySelectorAll('.lipuline').forEach((row, i) => {
        row.dataset.spoken = String(i === index);
      });
    };
    const stopAll = () => {
      playing = false;
      stopSpeaking();
      sayAll.textContent = t('readAll');
      highlight(-1);
    };
    sayAll.onclick = () => {
      if (playing) { stopAll(); return; }
      playing = true;
      sayAll.textContent = t('readStop');
      speakLines(text.lines.map((line) => line.tp), highlight, stopAll);
    };

    // Alles aufdecken — oder wieder zudecken.
    const showAll = screen.querySelector('.showall');
    let open = false;
    showAll.onclick = () => {
      open = !open;
      lines.querySelectorAll('.lipuline').forEach((row) => {
        const meaning = row.querySelector('.meaning');
        const reveal = row.querySelector('.reveal');
        meaning.hidden = !open;
        reveal.hidden = open;
      });
      showAll.textContent = t(open ? 'readHideAll' : 'readShowAll');
    };

    screen.querySelector('.exbar button').onclick = () => { stopAll(); reading = null; render(); };

    screen.querySelector('.primary').onclick = () => {
      stopAll();
      session = buildQuizSession(text);
      reading = null;
      render();
    };
    return screen;
  }

  function buildQuizSession(text) {
    const tasks = text.questions.map((question, index) => ({
      type: 'quiz', question, text, index, lesson: lessonOf(text.stage) || lessons()[0],
      concepts: [],
    }));
    return { lesson: null, quiz: text, queue: tasks, index: 0, correct: 0, total: 0, xp: 0,
             retried: new Set() };
  }

  // Sieben Tage als Balken. Kein Vergleich mit anderen, nur mit gestern.
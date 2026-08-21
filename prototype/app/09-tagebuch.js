  // ------------------------------------------------------------ Tagebuch

  // Wie viele Tage am Stück geschrieben wurde, von heute (oder gestern) zurück.
  function diaryStreak() {
    const entries = state.diary || {};
    let days = 0;
    let cursor = new Date();
    if (!entries[today()]) cursor = new Date(Date.now() - 86400000);
    for (;;) {
      const key = cursor.toISOString().slice(0, 10);
      if (!entries[key]) return days;
      days += 1;
      cursor = new Date(cursor.getTime() - 86400000);
    }
  }

  // Ein Anstoß, der sich am Tag festmacht statt zu würfeln: wer zweimal
  // hinschaut, findet dieselbe Frage vor.
  function diaryNudge() {
    const open = OPEN.prompts.filter((entry) => unlocked(entry.stage));
    if (!open.length) return null;
    const day = today();
    let sum = 0;
    for (let i = 0; i < day.length; i += 1) sum = (sum * 31 + day.charCodeAt(i)) % 100003;
    return open[sum % open.length];
  }

  function diaryCard() {
    const entries = Object.keys(state.diary || {});
    const streak = diaryStreak();
    const card = el(`
      <div class="card">
        <h2>${escape(t('diaryTitle'))}</h2>
        <p class="hint">${escape(t('diaryHint'))}</p>
        <div class="row"><button class="ghost">${escape(t('diaryOpen'))}</button></div>
        <p class="hint">${escape(entries.length
          ? t('diaryCount', entries.length, streak) : t('diaryEmpty'))}</p>
      </div>`);
    card.querySelector('.ghost').onclick = () => { diary = true; render(); };
    return card;
  }

  function diaryScreen() {
    const day = today();
    const nudge = diaryNudge();
    const screen = screenWith(`
      <div class="exbar">
        <button aria-label="${escape(t('diaryBack'))}">✕</button>
        <span class="track"></span>
        <span class="metric">sitelen</span>
      </div>
      <div class="hello">
        <h1>${escape(t('diaryTitle'))}</h1>
        <p>${escape(t('diaryLead'))}</p>
      </div>
      <div class="card diarywrite">
        <h2>${escape(t('diaryToday'))} · ${escape(day)}</h2>
        <textarea class="typed diarytext" rows="4" autocomplete="off" autocapitalize="off"
                  spellcheck="false" placeholder="${escape(t('diaryPlaceholder'))}"
                  aria-label="toki pona"></textarea>
        <p class="live"></p>
        <div class="actions"><button class="primary">${escape(t('diarySave'))}</button></div>
      </div>
      <div class="diarypast"></div>`);

    screen.querySelector('.exbar button').onclick = () => { diary = false; render(); };

    if (nudge) {
      const box = el(`
        <div class="card diarynudge">
          <h2>${escape(t('diaryPrompt'))}</h2>
          <p class="question tp">${escape(nudge.tp)}</p>
          <p class="hint">${escape((nudge[state.lang] || nudge.de)[0])}</p>
        </div>`);
      const listen = sayButton(nudge.tp, t('listen'));
      if (listen) box.querySelector('.question').append(listen);
      screen.querySelector('.hello').after(box);
    }

    const input = screen.querySelector('.diarytext');
    const live = screen.querySelector('.live');
    const button = screen.querySelector('.primary');
    input.value = (state.diary && state.diary[day]) || '';
    button.after(lookupHelper(input));

    // Mitlesen, nicht benoten: gezählt wird, wie viele Sätze durchgehen, und
    // beim ersten Stolperer steht daneben, woran es liegt.
    const draw = () => {
      const text = input.value.trim();
      if (!text) { live.textContent = ''; live.className = 'live'; return; }
      const parts = TP.splitUtterances(text);
      const results = parts.map((part) => TP.parse(part));
      const ok = results.filter((result) => result.isValid).length;
      const first = results.find((result) => !result.isValid);
      live.textContent = t('diaryLines', ok, results.length)
        + (first ? ' · ' + say(first.violations[0]) : '');
      live.className = 'live ' + (first ? 'bad' : 'good');
    };
    input.oninput = draw;
    draw();

    button.onclick = () => {
      const text = input.value.trim();
      const fresh = !(state.diary && state.diary[day]);
      state.diary = state.diary || {};
      if (text) state.diary[day] = text.slice(0, 600);
      else delete state.diary[day];
      save();
      // Einmal am Tag gibt es Punkte — fürs Schreiben, nicht fürs Richtigsein.
      if (text && fresh) { award(15); toast(t('diaryReward')); }
      else toast(t('diarySaved'));
      render();
    };

    const past = screen.querySelector('.diarypast');
    Object.keys(state.diary || {}).sort().reverse()
      .filter((key) => key !== day)
      .forEach((key) => {
        const text = state.diary[key];
        const entry = el(`
          <div class="card diaryentry">
            <h2>${escape(key)}</h2>
            <p class="question tp">${escape(text)}</p>
            <div class="row"><button class="ghost">${escape(t('diaryXray'))}</button></div>
          </div>`);
        const toggle = entry.querySelector('.ghost');
        toggle.onclick = () => {
          if (entry.querySelector('.xraywrap')) {
            entry.querySelectorAll('.xraywrap').forEach((box) => box.remove());
            return;
          }
          TP.splitUtterances(text).forEach((part) => {
            const box = xrayBlock(part, null, null);
            if (box) toggle.parentElement.before(box);
          });
        };
        past.append(entry);
      });

    return screen;
  }

  // Der Text selbst: Zeile für Zeile, Übersetzung erst auf Tippen.
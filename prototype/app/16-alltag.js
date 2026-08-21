  function styleCard() {
    const card = el(`
      <div class="card" style="margin-top:1rem">
        <h2>${escape(t('styleTitle'))}</h2>
        <p class="hint">${escape(t('styleHint'))}</p>
        <div class="stylelist"></div>
      </div>`);
    const list = card.querySelector('.stylelist');
    OPEN.styles.forEach((entry) => {
      const row = el(`<div class="styleline"><p class="netlabel">`
        + `${escape(entry.topic[state.lang] || entry.topic.de)}</p></div>`);
      entry.options.forEach((option) => {
        const line = el('<p class="tp glossable"></p>');
        line.append(glossed(option.tp, 'glossline'));
        withSay(line, option.tp);
        row.append(line);
        row.append(el(`<p class="hint">${escape(option.note[state.lang] || option.note.de)}</p>`));
      });
      list.append(row);
    });
    return card;
  }

  function phraseCard() {
    const card = el(`
      <div class="card" style="margin-top:1rem">
        <h2>${escape(t('phraseTitle'))}</h2>
        <p class="hint">${escape(t('phraseHint'))}</p>
        <div class="row"><button class="primary">${escape(t('phrasePractice'))}</button></div>
      </div>`);
    card.querySelector('.primary').onclick = () => { session = buildPhraseSession(); render(); };
    return card;
  }

  function phraseGroup(group) {
    const card = el(`
      <div class="card">
        <h2>${escape(t('musiSection', group.name[state.lang] || group.name.de, group.lines.length))}</h2>
        <div class="musilines"></div>
      </div>`);
    const list = card.querySelector('.musilines');
    group.lines.forEach((line) => {
      const row = el('<div class="musiline"></div>');
      const tp = el('<p class="tp glossable"></p>');
      tp.append(glossed(line.tp, 'glossline'));
      withSay(tp, line.tp);
      row.append(tp);
      row.append(el(`<p class="meaning">${escape(line[state.lang] || line.de)}</p>`));
      row.append(el(`<p class="hint">${escape(t('phraseLiteral'))}: `
        + `${escape(line.lit[state.lang] || line.lit.de)}</p>`));
      list.append(row);
    });
    return card;
  }

  // Alltagssätze als Übungsrunde — dieselbe Maschine wie der Kurs.
  const phraseItems = () => OPEN.phrases.flatMap((group) => group.lines.map((line) => ({
    id: line.id, direction: 'tp_de', tp: line.tp, also: [],
    target: [line[state.lang] || line.de], lit: line.lit[state.lang] || line.lit.de,
  })));

  let phraseCache = null;
  function phraseLesson() {
    if (phraseCache && phraseCache.lang === state.lang) return phraseCache.lesson;
    const items = phraseItems();
    const lesson = {
      number: 98,
      phrases: true,
      title: t('phraseTitle'),
      note: '',
      words: [...new Set(items.flatMap((item) => TP.tokenize(item.tp).map((token) => token.text))
        .filter((word) => TP.lexicon[word]))],
      items,
    };
    phraseCache = { lang: state.lang, lesson };
    return lesson;
  }

  function buildPhraseSession() {
    const lesson = phraseLesson();
    const picks = shuffle(lesson.items).slice(0, 6);
    const tasks = picks.map((item, index) => ({
      type: index % 2 ? 'build' : 'choose', item, lesson, concepts: [],
    }));
    return { lesson, musi: true, home: 'toki', restart: buildPhraseSession,
             queue: tasks, index: 0, correct: 0, total: 0, xp: 0, retried: new Set() };
  }

  // Beim Tippen braucht man das Wörterbuch griffbereit — sonst schreibt man
  // nur, was man ohnehin schon weiß. Antippen setzt das Wort in die Zeile.
  function lookupHelper(input) {
    const box = el(`
      <div class="lookup">
        <button class="ghost lookuptoggle" type="button">${escape(t('lookupOpen'))}</button>
        <div class="lookupbody" hidden>
          <input class="search lookupsearch" autocomplete="off" spellcheck="false"
                 placeholder="${escape(t('lookupSearch'))}"
                 aria-label="${escape(t('lookupSearch'))}">
          <div class="lookuphits"></div>
          <p class="hint">${escape(t('lookupTake'))}</p>
        </div>
      </div>`);

    const toggle = box.querySelector('.lookuptoggle');
    const body = box.querySelector('.lookupbody');
    const search = box.querySelector('.lookupsearch');
    const hits = box.querySelector('.lookuphits');

    const draw = () => {
      const term = search.value.trim().toLowerCase();
      hits.innerHTML = '';
      const found = Object.keys(TP.lexicon).filter((word) => {
        if (!term) return false;
        if (word.includes(term)) return true;
        return glossesOf(word).some((gloss) => gloss.toLowerCase().includes(term));
      }).slice(0, 12);
      if (!found.length) {
        hits.append(el(`<p class="hint">${escape(term ? t('lookupNone') : '')}</p>`));
        return;
      }
      found.forEach((word) => {
        const chip = el(`<button class="hit" type="button"><b>${escape(word)}</b>
          <span>${escape(glossesOf(word).slice(0, 2).join(', '))}</span></button>`);
        chip.onclick = () => {
          const text = input.value.trim();
          input.value = (text ? text + ' ' : '') + word;
          input.dispatchEvent(new Event('input'));
          input.focus();
        };
        hits.append(chip);
      });
    };

    toggle.onclick = () => {
      body.hidden = !body.hidden;
      toggle.textContent = t(body.hidden ? 'lookupOpen' : 'lookupClose');
      if (!body.hidden) search.focus();
    };
    search.oninput = draw;
    return box;
  }

  // Umschreiben, aber selbst gebaut: für „Kaffee“ gibt es kein Wort, also
  // muss eins entstehen. Richtig ist alles, was eine gültige Wortgruppe ist —
  // danach zeigt die App, was die Sprechenden üblicherweise sagen.
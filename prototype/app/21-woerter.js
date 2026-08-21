  // ------------------------------------------------------------ Wörter

  // Zu jedem Wort ein Satz, in dem es vorkommt — der kürzeste, den der Kurs
  // (oder der Spaßmodus) hergibt, samt Übersetzung.
  let exampleCache = null;
  function examples() {
    if (exampleCache && exampleCache.lang === state.lang) return exampleCache.map;
    const pool = [];
    for (const lesson of lessons()) {
      for (const item of lesson.items) pool.push({ tp: item.tp, say: item.target[0] });
    }
    for (const line of MUSI.lines) {
      pool.push({ tp: line.tp, say: (line[state.lang] || line.de)[0] });
    }
    for (const group of OPEN.phrases) {
      for (const line of group.lines) pool.push({ tp: line.tp, say: line[state.lang] || line.de });
    }
    for (const text of LIPU.texts) {
      for (const line of text.lines) pool.push({ tp: line.tp, say: line[state.lang] || line.de });
    }
    pool.sort((a, b) => a.tp.length - b.tp.length);
    const map = new Map();
    // Wörter, die im Kurs nicht vorkommen, haben ihren eigenen Satz.
    for (const [word, extra] of Object.entries(OPEN.extras)) {
      map.set(word, { tp: extra.tp, say: extra[state.lang] || extra.de });
    }
    for (const sentence of pool) {
      for (const token of TP.tokenize(sentence.tp)) {
        if (TP.lexicon[token.text] && !map.has(token.text)) map.set(token.text, sentence);
      }
    }
    exampleCache = { lang: state.lang, map };
    return map;
  }

  // Namen und Fremdwörter nachsprechen — das kann nur eine App, die die
  // Lautlehre kennt. Was hier herauskommt, besteht sie immer.
  function nameCard() {
    const heads = t('nameHeads');
    const card = el(`
      <div class="card namecard">
        <h2>${escape(t('nameTitle'))}</h2>
        <p class="hint">${escape(t('nameHint'))}</p>
        <input class="typed nameinput" autocomplete="off" autocapitalize="words"
               spellcheck="false" placeholder="${escape(t('namePlaceholder'))}"
               aria-label="${escape(t('namePlaceholder'))}">
        <div class="row heads"></div>
        <p class="nameout"></p>
      </div>`);

    const input = card.querySelector('.nameinput');
    const out = card.querySelector('.nameout');
    const row = card.querySelector('.heads');
    let head = state.nameHead && heads[state.nameHead] ? state.nameHead : 'jan';

    const draw = () => {
      out.innerHTML = '';
      const made = TP.foreignName(input.value);
      if (!made) {
        out.append(el(`<span class="hint">${escape(t('nameEmpty'))}</span>`));
        return;
      }
      const full = `${head} ${made}`;
      const line = el('<span class="tp"></span>');
      line.append(glossed(full, 'glossline'));
      out.append(line);
      withSay(out, full);
    };

    Object.keys(heads).forEach((word) => {
      const chip = el(`<button class="ghost" data-picked="${word === head}">${escape(word)}
        <small>${escape(heads[word])}</small></button>`);
      chip.onclick = () => {
        head = word;
        state.nameHead = word;
        save();
        row.querySelectorAll('.ghost').forEach((b) => { b.dataset.picked = 'false'; });
        chip.dataset.picked = 'true';
        draw();
      };
      row.append(chip);
    });

    input.oninput = draw;
    draw();
    return card;
  }

  // Wortverbände: was steht bei diesem Wort? Gelesen aus allem, was die App
  // an Sätzen mitbringt — Kurs, Lesetexte, Alltagssätze, Spaßmodus.
  let netCache = null;
  function wordNet() {
    if (netCache) return netCache;
    const pool = [];
    for (const pack of Object.values(DATA.languages)) {
      for (const lesson of pack.lessons) {
        for (const item of lesson.items) pool.push(item.tp, ...item.also);
      }
    }
    pool.push(...DATA.corpus.external, ...DATA.corpus.valid);
    for (const line of MUSI.lines) pool.push(line.tp);
    for (const group of OPEN.phrases) for (const line of group.lines) pool.push(line.tp);
    for (const join of OPEN.joins) pool.push(join.tp);
    for (const extra of Object.values(OPEN.extras)) pool.push(extra.tp);
    for (const text of LIPU.texts) for (const line of text.lines) pool.push(line.tp);
    for (const compound of COMPOUNDS) pool.push(compound.tp);

    const heads = {};
    const mods = {};
    for (const sentence of pool) {
      for (const phrase of TP.phrasesIn(sentence)) {
        const head = phrase[0];
        for (const word of phrase.slice(1)) {
          if (word === head) continue;
          heads[head] = heads[head] || {};
          heads[head][word] = (heads[head][word] || 0) + 1;
          mods[word] = mods[word] || {};
          mods[word][head] = (mods[word][head] || 0) + 1;
        }
      }
    }
    netCache = { heads, mods };
    return netCache;
  }

  const netTop = (table, word, limit) => Object.entries((table || {})[word] || {})
    .sort((a, b) => b[1] - a[1]).slice(0, limit);

  function netBox(word) {
    const net = wordNet();
    const asHead = netTop(net.heads, word, 6);
    const asMod = netTop(net.mods, word, 4);
    const box = el('<div class="net"></div>');
    if (!asHead.length && !asMod.length) {
      box.append(el(`<p class="hint">${escape(t('netNone'))}</p>`));
      return box;
    }
    const line = (label, pairs, order) => {
      if (!pairs.length) return;
      // div statt span: .word span ist im Wörterbuch schon belegt.
      const row = el(`<div class="netline"><div class="netlabel">${escape(label)}</div></div>`);
      pairs.forEach(([other, count]) => {
        const text = order === 'head' ? `${word} ${other}` : `${other} ${word}`;
        row.append(el(`<code>${escape(text)}<i>${count}</i></code>`));
      });
      box.append(row);
    };
    line(t('netAsHead'), asHead, 'head');
    line(t('netAsMod'), asMod, 'mod');
    box.append(el(`<p class="hint">${escape(t('netHint'))}</p>`));
    return box;
  }

  // Wie fest sitzt ein Wort? Aus dem, was die Wiederholung über es weiß.
  function wordStrength(word) {
    const cards = ['w:', 'g:', 't:', 'y:'].map((prefix) => state.srs[prefix + word])
      .filter(Boolean);
    if (!cards.length) return state.seenWords[word] ? 1 : 0;
    const best = cards.reduce((a, b) => (a.interval >= b.interval ? a : b));
    if (best.interval >= 7 * DAY) return 3;
    if (best.reps >= 1) return 2;
    return state.seenWords[word] ? 1 : 0;
  }

  // Die ganze Sprache auf einen Blick: 137 Kästchen, die sich füllen.
  function mapCard() {
    const words = Object.keys(TP.lexicon).sort();
    const strengths = words.map(wordStrength);
    const met = strengths.filter((value) => value > 0).length;
    const firm = strengths.filter((value) => value === 3).length;
    const legend = t('mapLegend');

    const card = el(`
      <div class="card mapcard">
        <h2>${escape(t('mapTitle'))}</h2>
        <p class="hint">${escape(t('mapHint'))}</p>
        <div class="wordmap"></div>
        <p class="hint maptally">${escape(t('mapCount', met, words.length))}
          · ${escape(t('mapFirm', firm))}</p>
        <div class="maplegend">${legend.map((label, level) =>
          `<span data-level="${level}"><i></i>${escape(label)}</span>`).join('')}</div>
      </div>`);

    const grid = card.querySelector('.wordmap');
    words.forEach((word, index) => {
      const cell = el(`<button class="cell" type="button" data-level="${strengths[index]}"
        aria-label="${escape(word)}">${hasGlyph(word)
          ? `<span class="sp">${escape(word)}</span>`
          : `<small>${escape(word)}</small>`}</button>`);
      cell.onclick = (event) => {
        event.stopPropagation();
        if (bubble && bubble.dataset.word === word) { hideGloss(); return; }
        showGloss(cell, word);
        if (bubble) bubble.dataset.word = word;
      };
      grid.append(cell);
    });
    return card;
  }

  function wordScreen() {
    const screen = screenWith(`
      <input class="search" placeholder="${escape(t('search'))}" aria-label="${escape(t('search'))}">
      <div class="words"></div>`);
    screen.prepend(recordCard());
    screen.prepend(voiceCard());
    screen.prepend(nameCard());
    screen.prepend(mapCard());
    const list = screen.querySelector('.words');
    const input = screen.querySelector('.search');

    const draw = (query) => {
      list.innerHTML = '';
      const shown = examples();
      const term = query.trim().toLowerCase();
      Object.keys(TP.lexicon).sort().forEach((word) => {
        const entry = TP.lexicon[word];
        const text = glossesOf(word).join(', ');
        if (term && !word.includes(term) && !text.toLowerCase().includes(term)) return;
        const row = el(`
          <div class="word">
            <span class="${hasGlyph(word) ? 'sp glyph-inline' : 'glyph-inline empty'}"
              aria-hidden="true">${hasGlyph(word) ? escape(word) : ''}</span>
            <b>${escape(word)}</b>
            <span>${escape(text)}</span>
            <em>${entry.book === 'pu' ? 'pu' : 'ku'}${state.seenWords[word] ? ' ✓' : ''}</em>
          </div>`);
        withSay(row, word);
        const mic = recordButton(word);
        if (mic) row.append(mic);
        // Aufklappen geht per Knopf (auch mit der Tastatur) und per Tipp auf
        // die Zeile — eine Zeile allein ist für Tastaturen unerreichbar.
        const toggle = el(`<button class="netopen" type="button"
          aria-expanded="false" aria-label="${escape(t('netOpen', word))}">nasin</button>`);
        const flip = () => {
          const open = row.dataset.open === 'true';
          row.dataset.open = String(!open);
          toggle.setAttribute('aria-expanded', String(!open));
          if (!open && !row.querySelector('.net')) row.append(netBox(word));
        };
        toggle.onclick = (event) => { event.stopPropagation(); flip(); };
        row.append(toggle);
        row.onclick = (event) => {
          if (event.target.closest('.say') || event.target.closest('.netopen')) return;
          flip();
        };
        const example = shown.get(word);
        if (example) {
          row.append(el(`<p class="example"><code>${escape(example.tp)}</code>
            ${escape(example.say)}</p>`));
        }
        list.append(row);
      });
    };
    input.oninput = () => draw(input.value);
    draw('');
    return screen;
  }

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

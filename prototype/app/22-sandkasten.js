  // ------------------------------------------------------------ Sandkasten

  function sandboxScreen() {
    const screen = screenWith(`
      <div class="hello">
        <h1>${escape(t('sandboxTitle'))}</h1>
        <p>${escape(t('sandboxIntro'))}</p>
      </div>
      <input class="typed" autocomplete="off" autocapitalize="off" spellcheck="false"
             value="jan suli li pana e lipu tawa mi." aria-label="${escape(t('sentenceLabel'))}">
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
              <b>${escape(span.text)}</b><i>${escape(TP.roleLabel(span.role, state.lang))}</i>
            </span>`).join('')}</div>`));
        }
        if (parsed.isValid) {
          card.append(el(`<p class="reason" style="margin-top:0.7rem;color:var(--accent)">`
            + `${escape(t('structureOk'))}`
            + `${parsed.utterance && parsed.utterance.isQuestion ? escape(t('sandboxQuestion')) : ''}</p>`));
          const row = el('<div class="row cardrow"></div>');
          row.append(cardButton(utterance, null));
          card.append(row);
        } else {
          parsed.violations.forEach((violation) => {
            card.append(el(`
              <div class="violation" style="margin-top:0.7rem">
                ${escape(say(violation))}
                ${violation.correction ? `<br><code>→ ${escape(violation.correction)}</code>` : ''}
                ${violation.concept ? `<br><code>${escape(conceptLabel(violation.concept))}</code>` : ''}
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
        ${escape(t('sandboxTry'))} <code>mi li moku.</code> · <code>jan pi pona li lape.</code> ·
        <code>soweli moku e kili.</code> · <code>jan Claude li pona.</code>
      </p>`));

    screen.append(styleCard());
    screen.append(phraseCard());
    OPEN.phrases.forEach((group) => screen.append(phraseGroup(group)));
    return screen;
  }

  // ------------------------------------------------------- neue Fassung
  // Der Service Worker meldet sich, sobald eine neue Fassung bereitliegt.
  // Wer gerade nichts löst, bekommt sie sofort; mitten in einer Übung fragt
  // ein schmaler Streifen, statt die halbe Antwort wegzuwerfen.
  window.otokiUpdateReady = (mayReload) => {
    if (mayReload && !session) { location.reload(); return; }
    if (document.querySelector('.updatebar')) return;
    const bar = el(`
      <div class="updatebar">
        <span>${escape(t('updateReady'))}</span>
        <button type="button">${escape(t('updateLoad'))}</button>
      </div>`);
    bar.querySelector('button').onclick = () => location.reload();
    document.body.append(bar);
  };

  render();
  probeGlyphs();
  loadRecordings();
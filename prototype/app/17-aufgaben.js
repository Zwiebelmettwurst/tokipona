  function coinTask(task) {
    const right = task.compound;
    const screen = screenWith(`
      <p class="prompt">${escape(t('askCoin'))}</p>
      <h2 class="question">${escape(right.name[state.lang] || right.name.de)}</h2>
      <input class="typed" autocomplete="off" autocapitalize="off" spellcheck="false"
             placeholder="toki pona …" aria-label="toki pona">
      <p class="live"></p>
      <p class="hint">${escape(t('coinHint'))}</p>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    const input = screen.querySelector('.typed');
    input.after(lookupHelper(input));
    const live = screen.querySelector('.live');
    const button = screen.querySelector('.primary');

    const judge = (text) => {
      const words = TP.tokenize(text).filter((token) => token.word);
      const unknown = TP.tokenize(text).filter((token) => !token.word && token.text);
      if (unknown.length) return { ok: false, unknown: unknown.map((token) => token.text) };
      if (words.length < 2) return { ok: false, thin: true };
      const result = TP.parse(text);
      if (!result.isValid) return { ok: false, violations: result.violations };
      return { ok: true };
    };

    input.oninput = () => {
      const text = input.value.trim();
      button.disabled = !text;
      const verdict = judge(text);
      if (!text) { live.textContent = ''; live.className = 'live'; return; }
      if (verdict.ok) {
        live.textContent = t('structureLive');
        live.className = 'live good';
      } else {
        live.textContent = '• ' + (verdict.violations ? say(verdict.violations[0])
          : verdict.thin ? t('coinThin') : t('coinBroken'));
        live.className = 'live bad';
      }
    };
    input.onkeydown = (event) => { if (event.key === 'Enter' && !button.disabled) button.click(); };

    button.onclick = () => {
      const text = input.value.trim();
      const verdict = judge(text);
      const usual = TP.tokenize(right.tp).map((token) => token.text).join(' ');
      const mine = TP.tokenize(text).map((token) => token.text).join(' ');
      const exact = verdict.ok && mine === usual;
      finish(task, verdict.ok, {
        solution: right.tp,
        speak: right.tp,
        xray: verdict.ok ? text : right.tp,
        xrayMine: verdict.ok,
        coin: Object.assign({ exact }, verdict),
        reason: verdict.ok && !exact
          ? t('coinUsual', escape(right.tp), escape(right.literal[state.lang] || right.literal.de))
          : (verdict.ok ? t('literally', escape(right.tp),
              escape(right.literal[state.lang] || right.literal.de)) : null),
      });
    };
    setTimeout(() => input.focus(), 50);
    return screen;
  }

  // Zwei gültige Sätze, ein Unterschied: welcher sagt, was gemeint ist?
  function styleTask(task) {
    const entry = task.style;
    const right = entry.options[entry.right];

    const screen = screenWith(`
      <p class="prompt">${escape(t('askStyle'))}</p>
      <h2 class="question ask">${escape(entry.ask[state.lang] || entry.ask.de)}</h2>
      <div class="choices"></div>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    let picked = null;
    const list = screen.querySelector('.choices');
    const button = screen.querySelector('.primary');
    shuffle(entry.options.slice()).forEach((option) => {
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
      speak: right.tp,
      xray: right.tp,
      // Nach der Antwort stehen beide Wege da — darum geht es.
      reason: entry.options.map((option) =>
        `<code>${escape(option.tp)}</code> — ${escape(option.note[state.lang] || option.note.de)}`)
        .join('<br>'),
    });
    return screen;
  }

  // Silben: jedes Wort zerfällt in (K)V(n). Aus den Bausteinen wird es wieder
  // zusammengesetzt — Lautlehre zum Anfassen.
  function syllableTask(task) {
    const parts = TP.syllables(task.word) || [task.word];
    const others = shuffle(Object.keys(TP.lexicon)
      .flatMap((word) => TP.syllables(word) || [])
      .filter((part) => !parts.includes(part)));
    const tiles = shuffle(parts.concat(others.slice(0, Math.min(2, parts.length))))
      .map((text, index) => ({ text, id: String(index) }));

    const screen = screenWith(`
      <p class="prompt">${escape(t('askSyllable'))}</p>
      <h2 class="question">${escape(glossesOf(task.word).slice(0, 3).join(', '))}</h2>
      <div class="slot syllables"></div>
      <p class="hint">${escape(t('syllableHint'))}</p>
      <div class="bank syllables"></div>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    const slot = screen.querySelector('.slot');
    const bank = screen.querySelector('.bank');
    const button = screen.querySelector('.primary');
    const chosen = [];

    const sync = () => {
      slot.innerHTML = '';
      chosen.forEach((id) => {
        const part = tiles.find((chip) => chip.id === id).text;
        const tile = el(`<button class="tile placed" data-word="${escape(part)}"
          data-id="${escape(id)}" aria-label="${escape(t('syllableBack', part))}"
          >${escape(part)}</button>`);
        tile.onclick = () => {
          chosen.splice(chosen.indexOf(id), 1);
          sync();
        };
        slot.append(tile);
      });
      bank.querySelectorAll('.tile').forEach((tile) => {
        tile.classList.toggle('used', chosen.includes(tile.dataset.id));
      });
      button.disabled = !chosen.length;
    };

    tiles.forEach((chip) => {
      const tile = el(`<button class="tile" data-id="${escape(chip.id)}"
        data-word="${escape(chip.text)}">${escape(chip.text)}</button>`);
      tile.onclick = () => {
        if (chosen.includes(chip.id)) return;
        chosen.push(chip.id);
        sync();
      };
      bank.append(tile);
    });
    sync();

    button.onclick = () => {
      const built = chosen.map((id) => tiles.find((chip) => chip.id === id).text).join('');
      const correct = built === task.word;
      state.seenWords[task.word] = true;
      finish(task, correct, {
        solution: task.word,
        speak: task.word,
        xray: null,
        reason: t('syllableWord', escape(parts.join(' · ')),
          escape(glossesOf(task.word).slice(0, 3).join(', '))),
      });
    };
    return screen;
  }

  // Frage zum gelesenen Text.
  function quizTask(task) {
    const question = task.question;
    const options = question.options[state.lang] || question.options.de;
    const right = options[question.right];

    const screen = screenWith(`
      <p class="prompt">${escape(t('askQuiz'))}</p>
      ${question.tp ? '<h2 class="question tp glossable"></h2>' : ''}
      <p class="ask">${escape(question[state.lang] || question.de)}</p>
      <div class="choices"></div>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    const asked = screen.querySelector('.question');
    if (asked) {
      asked.append(glossed(question.tp, 'glossline'));
      withSay(asked, question.tp);
    }

    let picked = null;
    const list = screen.querySelector('.choices');
    const button = screen.querySelector('.primary');
    shuffle(options.slice()).forEach((option) => {
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
      speak: question.tp || null,
      xray: question.tp || null,
    });
    return screen;
  }

  // Offene Frage: eine Antwort, die es so noch nicht gibt.
  function answerTask(task) {
    const prompt = task.prompt;
    const needs = (prompt.need || []).map(needLabel).join(' + ');

    const screen = screenWith(`
      <p class="prompt">${escape(t('askAnswer'))}</p>
      <h2 class="question tp glossable"></h2>
      <p class="ask">${escape((prompt[state.lang] || prompt.de)[0])}</p>
      <input class="typed" autocomplete="off" autocapitalize="off" spellcheck="false"
             placeholder="toki pona …" aria-label="toki pona">
      <p class="live"></p>
      <p class="hint">${needs ? t('answerNeeds', needs) : escape(t('answerHint'))}</p>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    const asked = screen.querySelector('.question');
    asked.append(glossed(prompt.tp, 'glossline'));
    withSay(asked, prompt.tp);

    const input = screen.querySelector('.typed');
    const live = screen.querySelector('.live');
    const button = screen.querySelector('.primary');
    input.after(lookupHelper(input));

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
      const text = input.value.trim();
      const verdict = gradeAnswer(text, prompt);
      const models = prompt.models.slice(0, 2).join('  ·  ');
      finish(task, verdict.ok, {
        solution: prompt.models[0],
        speak: prompt.models[0],
        xray: verdict.ok ? text : prompt.models[0],
        xrayMine: verdict.ok,
        open: verdict,
        reason: verdict.ok
          ? `${escape(t('answerAlso'))} <code>${escape(models)}</code>`
          : null,
      });
    };
    setTimeout(() => input.focus(), 50);
    return screen;
  }

  function fixTask(task) {
    const screen = screenWith(`
      <p class="prompt">${escape(t('askFix'))}</p>
      <div class="pickline"></div>
      <p class="hint">${escape(t('hintFix'))}</p>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

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
        speak: task.flawed.correct,
        xray: task.flawed.correct,
        // Der Verstoß trägt keinen fertigen Satz in sich, nur einen Schlüssel —
        // `say` macht daraus die Erklärung in der eingestellten Sprache.
        reason: escape(say(task.flawed.violation)),
      });
    };
    return screen;
  }

  // sitelen pona: ein Zeichen je Wort. Die Schrift bildet das über Ligaturen
  // ab — im Text steht weiterhin das lateinische Wort.
  function glyphTask(task) {
    const options = shuffle([task.word, ...distractorWords(task.lesson, [task.word], 3)]);

    const screen = screenWith(`
      <p class="prompt">${escape(t('askGlyph'))}</p>
      <div class="glyph sp">${escape(task.word)}</div>
      <div class="choices"></div>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    let picked = null;
    const list = screen.querySelector('.choices');
    const button = screen.querySelector('.primary');
    options.forEach((option) => {
      const choice = el(`<button class="choice tp">${escape(option)}</button>`);
      choice.onclick = () => {
        picked = option;
        list.querySelectorAll('.choice').forEach((c) => { c.dataset.picked = 'false'; });
        choice.dataset.picked = 'true';
        button.disabled = false;
      };
      list.append(choice);
    });

    button.onclick = () => {
      const entry = TP.lexicon[task.word];
      finish(task, picked === task.word, {
        solution: task.word,
        speak: task.word,
        xray: null,
        reason: `<span class="sp glyph-inline">${escape(task.word)}</span> `
          + t('glyphIs', escape(task.word), escape(glossesOf(task.word).slice(0, 3).join(', '))),
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
      <p class="prompt">${escape(t('askCompound'))}</p>
      <h2 class="question">${escape(right.name[state.lang] || right.name.de)}</h2>
      <div class="choices"></div>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

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
      speak: right.tp,
      xray: right.tp,
      reason: t('literally', escape(right.tp), escape(right.literal[state.lang] || right.literal.de)),
    });
    return screen;
  }

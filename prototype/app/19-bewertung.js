  // ------------------------------------------------------------ Bewertung

  // Schichten aus Plan, Abschnitt 6: normalisieren, strukturell parsen,
  // gegen Musterlösung und Pflichtbausteine abgleichen.
  // Steht auf beiden Seiten dasselbe, nur als Subjekt statt als Objekt?
  // „soweli li moku e jan“ ist nicht „jan li moku e soweli“.
  function swappedRoles(a, b) {
    const heads = (text) => {
      const result = TP.parse(text);
      if (!result.isValid || !result.utterance) return null;
      const spans = TP.xray(result.utterance);
      const first = (role) => {
        const span = spans.find((s) => s.role === role);
        return span ? span.text.split(/\s+/)[0] : null;
      };
      return { subject: first('subject'), object: first('object') };
    };
    const mine = heads(a);
    const model = heads(b);
    if (!mine || !model) return false;
    if (!mine.subject || !mine.object || !model.subject || !model.object) return false;
    return mine.subject !== model.subject
      && mine.subject === model.object && mine.object === model.subject;
  }

  // Die Teilchen tragen den Satzbau. Fehlt eins, ist das die Erklärung —
  // und nicht „irgendwas an der Stellung“.
  const PARTICLE_HELP = {
    de: {
      li: 'li trennt Subjekt und Prädikat.',
      e: 'e kündigt das Objekt an.',
      la: 'la stellt den Rahmen voran.',
      pi: 'pi gruppiert mehrwortige Beifügungen um.',
      o: 'o macht daraus Anrede oder Aufforderung.',
      en: 'en verbindet zwei Subjekte.',
      anu: 'anu stellt zur Wahl.',
    },
    en: {
      li: 'li separates subject and predicate.',
      e: 'e announces the object.',
      la: 'la fronts the context.',
      pi: 'pi regroups modifiers of two or more words.',
      o: 'o turns it into an address or a command.',
      en: 'en joins two subjects.',
      anu: 'anu offers a choice.',
    },
  };
  const particleHelp = (word) => (PARTICLE_HELP[state.lang] || PARTICLE_HELP.de)[word] || '';

  // Welche Teilchen fehlen, welche sind zu viel? Verglichen wird als Menge,
  // damit die Reihenfolge hier nichts verwischt.
  function particleGap(answer, solution) {
    const bag = (text) => {
      const counts = {};
      for (const token of TP.tokenize(text)) {
        if (!token.word) continue;
        counts[token.text] = (counts[token.text] || 0) + 1;
      }
      return counts;
    };
    const mine = bag(answer);
    const model = bag(solution);
    const missing = [];
    const extra = [];
    for (const word of new Set([...Object.keys(mine), ...Object.keys(model)])) {
      const diff = (model[word] || 0) - (mine[word] || 0);
      for (let i = 0; i < diff; i += 1) missing.push(word);
      for (let i = 0; i < -diff; i += 1) extra.push(word);
    }
    const isParticle = (word) => Boolean(PARTICLE_HELP.de[word]);
    if (!missing.length && !extra.length) return null;
    if (!missing.every(isParticle) || !extra.every(isParticle)) return null;
    return { missing, extra };
  }

  function grade(answer, item) {
    const normalise = (text) => TP.tokenize(text).map((t) => t.text).join(' ');
    const accepted = [item.tp, ...item.also].map(normalise);
    const given = normalise(answer);

    if (accepted.includes(given)) return { correct: true, exact: true, violations: [] };

    const result = TP.parse(answer);
    if (!result.isValid) {
      return { correct: false, exact: false, violations: result.violations, utterance: result.utterance };
    }

    // Dieselbe Aussage, nur die Beifügungen in anderer Reihenfolge:
    // „jan mije lili sina“ ist derselbe Sohn wie „jan lili mije sina“.
    if ([item.tp, ...item.also].some((solution) => TP.sameMeaning(answer, solution))) {
      return { correct: true, exact: false, order: true, violations: [], utterance: result.utterance };
    }

    // Grammatisch sauber: zählt, wenn die tragenden Inhaltswörter vorkommen.
    const content = TP.tokenize(item.tp)
      .filter((t) => t.word && !t.word.roles.includes('particle') && !t.word.roles.includes('pronoun'))
      .map((t) => t.text);
    const mine = new Set(TP.tokenize(answer).map((t) => t.text));
    const missing = content.filter((word) => !mine.has(word));

    // Es hängt nur an einem Teilchen? Dann sagen wir genau das.
    for (const solution of [item.tp, ...item.also]) {
      const gap = particleGap(answer, solution);
      if (gap) {
        return { correct: false, exact: false, violations: [], utterance: result.utterance,
                 particles: gap };
      }
    }

    if (!missing.length) {
      // Alle Wörter da heißt noch nicht dasselbe gesagt: wer Subjekt und
      // Objekt vertauscht, dreht die Aussage um.
      if ([item.tp, ...item.also].some((solution) => swappedRoles(answer, solution))) {
        return { correct: false, exact: false, variant: true, violations: [],
                 utterance: result.utterance };
      }
      return { correct: true, exact: false, variant: true, violations: [], utterance: result.utterance };
    }
    return {
      correct: false, exact: false, violations: [], utterance: result.utterance,
      missing,
    };
  }

  // Freie Antwort: hier gibt es keine Musterlösung. Geprüft wird, was der
  // Parser wirklich weiß — Bau in Ordnung, und die Satzteile da, nach denen
  // gefragt war.
  function gradeAnswer(text, prompt) {
    const utterances = TP.splitUtterances(text).filter((part) => part.trim());
    if (!utterances.length) return { ok: false, empty: true };

    const violations = [];
    const roles = new Set();
    for (const part of utterances) {
      const result = TP.parse(part);
      violations.push(...result.violations);
      TP.xray(result.utterance).forEach((span) => roles.add(span.role));
    }
    if (violations.length) return { ok: false, violations };

    const words = TP.tokenize(text).filter((token) => token.word
      && !token.word.roles.includes('particle'));
    if (words.length < 2) return { ok: false, thin: true };

    const norm = (value) => TP.tokenize(value).map((token) => token.text).join(' ');
    if (norm(text) === norm(prompt.tp)) return { ok: false, echo: true };

    const missing = (prompt.need || []).filter((role) => !roles.has(role));
    if (missing.length) return { ok: false, missing };
    return { ok: true };
  }

  const needLabel = (role) => {
    const entry = OPEN.needs[role];
    return entry ? (entry[state.lang] || entry.de) : role;
  };

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

  // Fast: der Satz ist grammatisch in Ordnung, es hakt nur am Inhalt.
  function nearMiss(detail) {
    if (detail.open) return !detail.open.violations;
    if (!detail.grade) return false;
    return !(detail.grade.violations && detail.grade.violations.length);
  }

  // Ein beschriftetes Satzröntgen. Ohne Beschriftung weiß niemand, ob da der
  // eigene Satz steht oder die Musterlösung.
  const spanKey = (span) => `${span.text}|${span.role}`;

  function xrayBlock(text, label, otherKeys) {
    const spans = TP.xray(TP.parse(text).utterance);
    if (!spans.length) return null;
    const box = el('<div class="xraywrap"></div>');
    if (label) box.append(el(`<p class="xraylabel">${escape(label)}</p>`));
    box.append(el(`<div class="xray">${spans.map((span) => `
      <span class="span" data-role="${escape(span.role)}"
        data-diff="${otherKeys ? String(!otherKeys.has(spanKey(span))) : 'false'}">
        <b>${escape(span.text)}</b><i>${escape(TP.roleLabel(span.role, state.lang))}</i>
      </span>`).join('')}</div>`));
    return box;
  }

  // Was steht im einen Satz, aber nicht im anderen? Genau das wird markiert.
  const spanKeys = (text) => {
    const parsed = TP.parse(text);
    return new Set(TP.xray(parsed.utterance).map(spanKey));
  };

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

    // Vorlesehilfen bekommen das Urteil mit: das Blatt erscheint ohne
    // Seitenwechsel, sonst bliebe es unbemerkt.
    const sheet = el(`
      <div class="sheet" role="status" aria-live="polite">
        <div class="verdict ${correct ? 'good' : 'bad'}">
          <span class="mark">${correct ? '✓' : '✕'}</span>
          <span>${escape(correct
            ? (detail.dictation ? t('dictationRight')
              : detail.coin ? t(detail.coin.exact ? 'coinExact' : 'coinGood')
              : detail.open ? t('answerFree')
              : detail.grade && detail.grade.order ? t('orderRight')
              : (detail.grade && detail.grade.variant ? t('variantRight') : t('good')))
            : t(nearMiss(detail) ? 'almost' : 'notYet'))}</span>
        </div>
      </div>`);

    if (detail.grade && detail.grade.violations && detail.grade.violations.length) {
      const violation = detail.grade.violations[0];
      sheet.append(el(`
        <div class="violation">
          ${escape(say(violation))}
          ${violation.correction ? `<br><code>→ ${escape(violation.correction)}</code>` : ''}
        </div>`));
    } else if (detail.coin && !detail.coin.ok) {
      sheet.append(el(`<p class="reason">${escape(detail.coin.violations
        ? say(detail.coin.violations[0])
        : detail.coin.unknown ? t('unknownWords', detail.coin.unknown.join(', '))
          : detail.coin.thin ? t('coinThin') : t('coinBroken'))}</p>`));
    } else if (detail.open && !detail.open.ok) {
      // Die Parsermeldung trägt das getippte Wort in sich — sie muss entschärft
      // werden. Nur die Anforderungsnamen bringen eigene Auszeichnung mit.
      const reason = detail.open.violations ? escape(say(detail.open.violations[0]))
        : detail.open.echo ? escape(t('answerEcho'))
          : detail.open.missing ? t('answerMissing', detail.open.missing.map(needLabel).join(' + '))
            : escape(t('answerEmpty'));
      sheet.append(el(`<p class="reason">${reason}</p>`));
    } else if (detail.grade && detail.grade.particles) {
      const gap = detail.grade.particles;
      const lines = gap.missing.map((word) =>
        t('particleMissing', `<code>${escape(word)}</code>`, escape(particleHelp(word))))
        .concat(gap.extra.map((word) =>
          t('particleExtra', `<code>${escape(word)}</code>`, escape(particleHelp(word)))));
      sheet.append(el(`<p class="reason">${lines.join('<br>')}</p>`));
    } else if (detail.grade && detail.grade.order) {
      sheet.append(el(`<p class="reason">${escape(t('orderNote'))}</p>`));
    } else if (detail.grade && detail.grade.variant && !correct) {
      // Alle Bausteine da, aber in anderer Rolle — die häufigste Verwechslung.
      sheet.append(el(`<p class="reason">${escape(t('orderWrong'))}</p>`));
    } else if (detail.grade && detail.grade.missing) {
      sheet.append(el(`<p class="reason">${escape(t('missing',
        detail.grade.missing.join(', ')))}</p>`));
    } else if (detail.reason) {
      sheet.append(el(`<p class="reason">${detail.reason}</p>`));
    }

    // Der eigene Satz zuerst — er ist der, über den gerade nachgedacht wird.
    const model = detail.speak && detail.speak !== detail.xray ? detail.speak : null;
    const compare = Boolean(detail.xrayMine && model && !correct);
    if (detail.xray) {
      const block = xrayBlock(detail.xray, detail.xrayMine ? t('yourSentence') : null,
        compare ? spanKeys(model) : null);
      if (block) sheet.append(block);
    }

    if ((!correct && !detail.open) || (detail.grade && (detail.grade.variant || detail.grade.order))) {
      const line = el(`<p class="reason">${escape(t('model'))} </p>`);
      line.append(glossed(detail.solution, 'solution'));
      if (detail.speak) withSay(line, detail.speak);
      sheet.append(line);
      // … und daneben, wie die Musterlösung gebaut ist.
      if (detail.xrayMine && model) {
        const block = xrayBlock(model, t('modelSentence'),
          compare ? spanKeys(detail.xray) : null);
        if (block) sheet.append(block);
      }
    }
    if (!correct && detail.parked) {
      sheet.append(el(`<p class="hint">${escape(t('comesBack'))}</p>`));
    }

    // Ein gelungener Satz darf das Blatt verlassen.
    const sentence = correct ? (detail.xrayMine ? detail.xray : detail.speak) : null;
    if (sentence && TP.parse(sentence).isValid) {
      const row = el('<div class="row cardrow"></div>');
      row.append(cardButton(sentence, detail.subtitle || null));
      sheet.append(row);
    }

    const next = el(`<button class="primary">${escape(t(correct ? 'next' : 'understood'))}</button>`);
    next.onclick = () => { session.index += 1; render(); };
    sheet.append(next);
    app.append(sheet);
    next.focus();
  }

  function renderDone() {
    const lesson = session.lesson;
    const review = Boolean(session.review);
    const musi = Boolean(session.musi);
    const quiz = session.quiz || null;
    if (quiz) {
      state.read = state.read || {};
      state.read[quiz.id] = true;
    }
    // Der Spaßmodus hakt keine Lektion ab — der Kursfortschritt bleibt seiner.
    if (lesson && !musi) {
      state.done[lesson.number] = true;
      lesson.words.forEach((word) => { state.seenWords[word] = true; });
    }
    save();

    const screen = el(`
      <div class="screen done">
        <div class="burst">pona!</div>
        <h2>${escape(quiz ? (quiz.title[state.lang] || quiz.title.de)
          : (review ? t(session.weak ? 'weakDone' : 'reviewDone') : lesson.title))}</h2>
        <p>${escape(quiz ? (quiz.about[state.lang] || quiz.about.de)
          : (review ? t(session.weak ? 'weakNote' : 'reviewNote')
            : (musi ? t('musiLead') : lesson.note.replace(/<[^>]+>/g, ''))))}</p>
        <div class="tally">
          <div><b>+${session.xp}</b><span>${escape(t('xp'))}</span></div>
          <div><b>${session.correct}</b><span>${escape(t('correct'))}</span></div>
          <div><b>${review || musi || quiz ? session.queue.length : lesson.words.length}</b><span>${escape(t(review || musi || quiz ? 'cards' : 'words'))}</span></div>
        </div>
        <div class="actions">
          <button class="primary">${escape(t('next'))}</button>
          ${review || quiz ? '' : `<button class="ghost">${escape(t('again'))}</button>`}
        </div>
      </div>`);

    const home = session.home || (musi ? 'musi' : 'pfad');
    const restart = session.restart || (musi ? buildMusiSession : () => buildSession(lesson));
    screen.querySelector('.primary').onclick = () => {
      session = null;
      tab = home;
      render();
    };
    if (!review && !quiz) {
      screen.querySelector('.ghost').onclick = () => { session = restart(); render(); };
    }
    app.append(topbar());
    app.append(screen);
  }

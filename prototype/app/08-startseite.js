  // ------------------------------------------------------------ Darstellung

  const el = (html) => {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  };
  const escape = (text) => String(text).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Beim Austausch des Baums kann Safari den Fokus auf ein frisches Element
  // legen. Der Fokusring sieht aus wie eine getroffene Auswahl — auf einem
  // Bildschirm, den noch niemand berührt hat, gehört er nirgendwo hin.
  function clearStrayFocus() {
    const active = document.activeElement;
    if (active && active !== document.body && app.contains(active) && active.blur) {
      active.blur();
    }
  }

  function render() {
    hideGloss();
    // Seitensprache mitführen: Vorlesehilfen und Browser richten sich danach.
    document.documentElement.lang = state.lang;
    document.title = t('pageTitle');
    app.innerHTML = '';
    if (session) { renderSession(); clearStrayFocus(); return; }
    if (reading) { app.append(readerScreen(reading)); clearStrayFocus(); return; }
    if (diary) { app.append(diaryScreen()); clearStrayFocus(); return; }
    app.append(topbar());
    if (tab === 'pfad') app.append(pathScreen());
    else if (tab === 'nimi') app.append(wordScreen());
    else if (tab === 'musi') app.append(musiScreen());
    else app.append(sandboxScreen());
    app.append(tabs());
    clearStrayFocus();
  }

  function topbar() {
    const bar = el(`
      <div>
        <div class="topbar">
          <div class="level" title="${escape(t('levelNext', toNextLevel()))}">
            <div class="ring" style="--fill:${levelProgress()}%"><b>${level()}</b></div>
            <span>${escape(t('level'))}</span>
          </div>
          <div class="metric spacer gold">${escape(state.dayXp >= goal()
            ? t('goalMet', state.dayXp) : t('xpToday', state.dayXp, goal()))}</div>
          <div class="metric"><b>${state.streak}</b> ${escape(t('days'))}</div>
        </div>
        <div class="goalbar"><span style="width:${Math.min(100, (state.dayXp / goal()) * 100)}%"></span></div>
      </div>`);
    return bar;
  }

  function tabs() {
    const bar = el(`
      <nav class="tabs">
        <button data-tab="pfad"><span class="glyph">◈</span>nasin</button>
        <button data-tab="nimi"><span class="glyph">◍</span>nimi</button>
        <button data-tab="musi"><span class="glyph">◇</span>musi</button>
        <button data-tab="toki"><span class="glyph">◐</span>o toki</button>
      </nav>`);
    bar.querySelectorAll('button').forEach((button) => {
      button.dataset.active = button.dataset.tab === tab;
      button.onclick = () => { tab = button.dataset.tab; render(); };
    });
    return bar;
  }

  function pathScreen() {
    // Weitergezählt wird im Kurs; die Einführung steht daneben. Wer schon
    // mittendrin ist, soll nicht an den Anfang zurückgeschickt werden.
    const chain = courseChain();
    const next = chain.find((l) => !state.done[l.number]) || chain[chain.length - 1];
    const started = chain.some((l) => state.done[l.number]);
    // Genau eine Karte ist die, wo man gerade steht: am Anfang die Einführung,
    // danach die nächste Kurslektion.
    const current = !started && !state.done[0] ? 0 : next.number;
    const here = lessons().find((lesson) => lesson.number === current) || next;
    const screen = el(`
      <div class="screen">
        <div class="hello">
          <h1>${escape(t('greeting'))}</h1>
          <p>${state.xp ? escape(t('introBack', here.title)) : escape(t('introFirst'))}</p>
        </div>
        <div class="path"></div>
      </div>`);

    const due = dueTasks().length;
    if (due) {
      const card = el(`
        <button class="lesson review due" data-state="current">
          <span class="badge">↻</span>
          <span class="body">
            <b>${escape(t('dueCards', due))}</b>
            <span>${escape(t('dueSub'))}</span>
          </span>
        </button>`);
      card.onclick = () => { session = buildReviewSession(); render(); };
      screen.querySelector('.hello').after(card);
    }

    // Was wackelt, kommt sonst erst dann wieder, wenn die Wiederholung es
    // vorsieht. Hier steht es sofort zur Verfügung.
    const weak = weakSession();
    if (weak.length >= 4) {
      const card = el(`
        <button class="lesson review weak" data-state="current">
          <span class="badge">△</span>
          <span class="body">
            <b>${escape(t('weakTitle'))}</b>
            <span>${escape(t('weakSub', weak.length))}</span>
          </span>
        </button>`);
      card.onclick = () => { session = buildWeakSession(); render(); };
      (screen.querySelector('.lesson.review') || screen.querySelector('.hello')).after(card);
    }

    const path = screen.querySelector('.path');
    lessons().forEach((lesson) => {
      const open = unlocked(lesson.number);
      const done = Boolean(state.done[lesson.number]);
      const stateName = done ? 'done'
        : (open ? (lesson.number === current ? 'current' : 'open') : 'locked');
      const card = el(`
        <button class="lesson${lesson.intro ? ' intro' : ''}" data-state="${stateName}">
          <span class="badge">${done ? '✓' : lesson.number}</span>
          <span class="body">
            <b>${escape(lesson.title)}</b>
            <span>${lesson.words.slice(0, 5).join(' · ')}</span>
          </span>
          <span class="dots">${lesson.words.map((word) =>
            `<i class="${state.seenWords[word] ? 'on' : ''}"></i>`).join('')}</span>
        </button>`);
      if (open) {
        card.onclick = () => {
          session = lesson.intro ? buildIntroSession() : buildSession(lesson);
          render();
        };
      }
      else card.disabled = true;
      path.append(card);
    });

    const active = Object.keys(state.mastery);
    if (active.length) {
      const card = el(`<div class="card"><h2>${escape(t('concepts'))}</h2>`
        + '<div class="concepts"></div></div>');
      const list = card.querySelector('.concepts');
      active.sort((a, b) => state.mastery[b] - state.mastery[a]).forEach((concept) => {
        list.append(el(`
          <div class="concept">
            <span>${escape(conceptLabel(concept))}</span>
            <span class="bar"><i style="width:${Math.round(state.mastery[concept] * 100)}%"></i></span>
          </div>`));
      });
      screen.append(card);
    }

    screen.append(readingCard());
    screen.append(diaryCard());
    screen.append(weekCard());
    screen.append(goalCard());
    screen.append(sizeCard());
    screen.append(languageCard());
    screen.append(soundCard());
    screen.append(sitelenCard());
    screen.append(backupCard());

    screen.append(el(`
      <p class="foot">${t('credit',
        `<a href="https://lipu-sona.pona.la/${state.lang}/">lipu sona pona</a>`)}
        ${window.OTOKI_VERSION ? `<br><span class="version">${escape(t('versionLabel', window.OTOKI_VERSION))}</span>` : ''}</p>`));
    return screen;
  }

  function readingCard() {
    const card = el(`
      <div class="card">
        <h2>${escape(t('readTitle'))}</h2>
        <p class="hint">${escape(t('readHint'))} ${escape(t('readCount',
          LIPU.texts.filter((text) => state.read && state.read[text.id]).length,
          LIPU.texts.length))}</p>
        <div class="lipulist"></div>
      </div>`);
    const list = card.querySelector('.lipulist');
    LIPU.texts.forEach((text) => {
      const open = unlocked(text.stage);
      const done = Boolean(state.read && state.read[text.id]);
      const row = el(`
        <button class="lipurow" data-state="${done ? 'done' : (open ? 'open' : 'locked')}">
          <span class="body">
            <b>${escape(text.title[state.lang] || text.title.de)}</b>
            <span>${escape(text.about[state.lang] || text.about.de)}</span>
          </span>
          <span class="mark">${done ? '✓' : (open ? '›' : '·')}</span>
        </button>`);
      if (open) row.onclick = () => { reading = text; render(); };
      else {
        row.disabled = true;
        row.querySelector('.body span').textContent = t('readLocked', text.stage);
      }
      list.append(row);
    });
    return card;
  }

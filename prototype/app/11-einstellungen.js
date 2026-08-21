  function weekCard() {
    const days = [];
    for (let back = 6; back >= 0; back -= 1) {
      const key = weekStart(back);
      const date = new Date(Date.now() - back * 86400000);
      days.push({ key, xp: (state.days && state.days[key]) || 0, weekday: (date.getDay() + 6) % 7 });
    }
    const highest = Math.max(goal(), ...days.map((day) => day.xp));
    const names = t('weekDays');
    const total = days.reduce((sum, day) => sum + day.xp, 0);
    const reached = days.filter((day) => day.xp >= goal()).length;

    const card = el(`
      <div class="card">
        <h2>${escape(t('weekTitle'))}</h2>
        <div class="week">${days.map((day, index) => `
          <div class="day" data-today="${index === days.length - 1}" data-done="${day.xp >= goal()}">
            <span class="bar"><i style="height:${Math.round((day.xp / highest) * 100)}%"></i></span>
            <span class="tick">${escape(names[day.weekday])}</span>
          </div>`).join('')}</div>
        <p class="hint">${escape(t('weekSum', total, reached))}<br>
          ${escape(t('levelLine', level(), toNextLevel()))}</p>
      </div>`);
    return card;
  }

  // Eine Reihe Auswahlknöpfe, wie sie an mehreren Stellen gebraucht wird.
  // `options` sind Paare aus Beschriftung und Wert.
  function pickRow(options, picked, onPick, className) {
    const row = el(`<div class="row${className ? ' ' + className : ''}"></div>`);
    options.forEach((option) => {
      const chip = el(`<button class="ghost" type="button"
        data-picked="${option.value === picked}">${escape(option.label)}</button>`);
      chip.onclick = () => onPick(option.value);
      row.append(chip);
    });
    return row;
  }

  // Eine Einstellungskarte: Überschrift, Erklärung, eine Reihe zum Auswählen.
  function settingCard(titleKey, hintKey, options, picked, onPick) {
    const card = el(`
      <div class="card">
        <h2>${escape(t(titleKey))}</h2>
        <p class="hint">${escape(t(hintKey))}</p>
      </div>`);
    card.append(pickRow(options, picked, onPick));
    return card;
  }

  const goalCard = () => settingCard('goalTitle', 'goalHint',
    GOALS.map((value) => ({ value, label: t('goalPick', value) })),
    goal(),
    (value) => { state.goal = value; save(); render(); });

  const sizeCard = () => settingCard('sizeTitle', 'sizeHint',
    SIZES.map((entry) => ({ value: entry.id, label: t(SIZE_LABELS[entry.id]) })),
    sizeOf().id,
    (value) => { state.size = value; save(); render(); });

  function languageCard() {
    const card = el(`
      <div class="card">
        <h2>${escape(t('langLabel'))}</h2>
        <div class="row"><button class="ghost">${escape(t('langOther'))}</button></div>
      </div>`);
    card.querySelector('.ghost').onclick = () => {
      state.lang = state.lang === 'de' ? 'en' : 'de';
      save();
      render();
    };
    return card;
  }

  function soundCard() {
    const card = el(`
      <div class="card">
        <h2>${escape(t('soundTitle'))}</h2>
        <p class="hint">${escape(t('soundHint'))}</p>
        <div class="row"></div>
      </div>`);
    const row = card.querySelector('.row');
    if (!speechAvailable()) {
      row.append(el(`<p class="hint">${escape(t('soundNone'))}</p>`));
      return card;
    }
    row.before(el(`<p class="hint">${escape(t('soundSwitch'))}</p>`));
    const button = el(`<button class="ghost">${escape(t(state.sound ? 'soundOff' : 'soundOn'))}</button>`);
    button.onclick = () => {
      state.sound = !state.sound;
      save();
      render();
    };
    row.append(button);
    const demo = sayButton('toki pona li pona.', t('listen'));
    if (demo) row.append(demo);
    return card;
  }

  function sitelenCard() {
    const card = el(`
      <div class="card">
        <h2>sitelen pona</h2>
        <div class="glyph-row sp">toki pona li pona</div>
        <p class="hint">${escape(t('sitelenHint'))}</p>
        <div class="row"><button class="ghost"></button></div>
      </div>`);

    const button = card.querySelector('.ghost');
    const label = () => { button.textContent = t(state.sitelen ? 'sitelenOff' : 'sitelenOn'); };
    label();
    button.onclick = () => {
      state.sitelen = !state.sitelen;
      save();
      render();
    };
    return card;
  }

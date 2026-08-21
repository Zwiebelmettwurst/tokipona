  // ------------------------------------------------------------ musi

  // Würfelt aus einem Muster einen frischen Satz. Geprüft wird er vom selben
  // Parser wie alles andere — was hier steht, ist garantiert grammatisch.
  function forge() {
    const column = state.lang === 'en' ? 2 : 1;
    for (let tries = 0; tries < 30; tries += 1) {
      const pattern = MUSI.patterns[Math.floor(Math.random() * MUSI.patterns.length)];
      const picks = pattern.slots.map((slot) => slot[Math.floor(Math.random() * slot.length)]);
      const tp = pattern.frame
        .replace('{a}', picks[0][0])
        .replace('{b}', picks[1] ? picks[1][0] : '');
      if (TP.parse(tp).violations.length) continue;
      const say = (pattern.say[state.lang] || pattern.say.de)(...picks.map((pick) => pick[column]));
      return { tp, say, name: pattern.name[state.lang] || pattern.name.de };
    }
    return null;
  }

  const stingDots = (level) => '●'.repeat(level) + '○'.repeat(Math.max(0, 3 - level));

  function musiScreen() {
    const screen = screenWith(`
      <div class="card">
        <h2>${escape(t('musiTitle'))}</h2>
        <p class="hint">${MUSI.intro[state.lang] || MUSI.intro.de}</p>
        <div class="row"><button class="primary">${escape(t('musiStart'))}</button></div>
      </div>`);
    screen.querySelector('.primary').onclick = () => { session = buildMusiSession(); render(); };

    const forgeCard = el(`
      <div class="card">
        <h2>${escape(t('musiForgeTitle'))}</h2>
        <p class="hint">${escape(t('musiForgeHint'))}</p>
        <div class="forged"></div>
        <div class="row"><button class="ghost">${escape(t('musiForge'))}</button></div>
      </div>`);
    const box = forgeCard.querySelector('.forged');
    const roll = () => {
      const made = forge();
      box.innerHTML = '';
      if (!made) return;
      const line = el('<p class="tp glossable"></p>');
      line.append(glossed(made.tp, 'glossline'));
      withSay(line, made.tp);
      box.append(line);
      box.append(el(`<p class="meaning">${escape(made.say)}</p>`));
      box.append(el(`<p class="hint">${escape(t('musiPattern'))}: <code>${escape(made.name)}</code></p>`));
    };
    forgeCard.querySelector('.ghost').onclick = roll;
    roll();
    screen.append(forgeCard);

    const items = musiLesson().items;
    Object.keys(MUSI.kinds).forEach((kind) => {
      const group = items.filter((item) => item.kind === kind);
      if (!group.length) return;
      const name = MUSI.kinds[kind][state.lang] || MUSI.kinds[kind].de;
      const card = el(`
        <div class="card">
          <h2>${escape(t('musiSection', name, group.length))}</h2>
          <div class="musilines"></div>
        </div>`);
      const list = card.querySelector('.musilines');
      group.forEach((item) => {
        const row = el(`<div class="musiline" data-kind="${escape(kind)}"></div>`);
        const line = el('<p class="tp glossable"></p>');
        line.append(glossed(item.tp, 'glossline'));
        withSay(line, item.tp);
        row.append(line);
        row.append(el(`<p class="meaning">${escape(item.target[0])}</p>`));
        row.append(el(`
          <p class="hint">${escape(t('musiLiteral'))}: ${escape(item.lit)}
            <span class="sting" title="${escape(t('musiSting'))}">${stingDots(item.sting)}</span>
          </p>`));
        list.append(row);
      });
      screen.append(card);
    });

    screen.append(el(`<p class="foot">${t('musiPeace')}</p>`));
    return screen;
  }

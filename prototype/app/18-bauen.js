  function buildTask(task) {
    const solution = TP.tokenize(task.item.tp).map((t) => t.text);
    const extras = distractorWords(task.lesson, solution, Math.min(3, Math.max(2, 6 - solution.length)));
    // Jede Kachel bekommt eine eigene Nummer. Kommt „li“ dreimal vor, sind das
    // drei unterscheidbare Kacheln — sonst greift ein Tipp auf die falsche.
    const bank = shuffle(solution.concat(extras)).map((word, index) => ({ word, id: String(index) }));
    const wordOf = new Map(bank.map((chip) => [chip.id, chip.word]));

    const screen = screenWith(`
      <p class="prompt">${escape(task.join ? t('askJoin') : t('askBuild'))}</p>
      <h2 class="question">${escape(task.item.target[0])}</h2>
      ${task.join ? `<p class="parts"><span>${escape(t('joinParts'))}</span>
        ${task.join.parts.map((part) => `<code>${escape(part)}</code>`).join('')}</p>` : ''}
      <div class="slot"></div>
      <p class="hint">${escape(t('hintBuild'))}</p>
      <div class="bank"></div>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    const slot = screen.querySelector('.slot');
    const bankRow = screen.querySelector('.bank');
    const button = screen.querySelector('.primary');
    const chosen = [];

    // Die gelegten Kacheln sind die Wahrheit: nach jedem Ziehen wird die
    // Wortfolge aus der Reihenfolge im Baum neu gelesen.
    const readOrder = () => Array.from(slot.children).map((node) => node.dataset.id);

    const refreshBank = () => {
      bankRow.querySelectorAll('.tile').forEach((tile) => {
        // Belegt ist genau die Kachel, die oben liegt — nicht irgendeine mit
        // demselben Wort.
        tile.classList.toggle('used', chosen.includes(tile.dataset.id));
      });
      button.disabled = chosen.length === 0;
    };

    const commit = () => {
      chosen.length = 0;
      chosen.push(...readOrder());
      refreshBank();
    };

    const remove = (node) => {
      node.remove();
      commit();
    };

    // Ziehen über Pointer-Events; HTML5-Drag gibt es auf iOS nicht.
    // Unter der Schwelle bleibt es ein Tipp und entfernt die Kachel.
    const THRESHOLD = 8;

    function grab(node, event) {
      if (event.button !== undefined && event.button !== 0) return;
      // Am Fenster lauschen, nicht an der Kachel: Das Umhängen im Baum löst
      // eine Pointer-Erfassung wieder, und danach käme kein pointerup mehr an.
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      const box = node.getBoundingClientRect();
      const holdX = startX - box.left;
      const holdY = startY - box.top;
      let dragging = false;

      const follow = (move) => {
        if (move.pointerId !== pointerId) return;
        if (!dragging) {
          if (Math.hypot(move.clientX - startX, move.clientY - startY) < THRESHOLD) return;
          dragging = true;
          node.classList.add('dragging');
        }

        node.style.transform = '';
        const base = node.getBoundingClientRect();
        node.style.transform = `translate(${move.clientX - holdX - base.left}px, `
          + `${move.clientY - holdY - base.top}px)`;

        // Nächste Nachbarkachel suchen; Zeilen zählen stärker als Spalten,
        // damit der Umbruch nicht gegen die Absicht arbeitet.
        let closest = null;
        let best = Infinity;
        let after = false;
        for (const other of slot.children) {
          if (other === node) continue;
          const rect = other.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const distance = Math.hypot(move.clientX - cx, (move.clientY - cy) * 2.5);
          if (distance < best) {
            best = distance;
            closest = other;
            after = move.clientX > cx;
          }
        }
        if (closest) slot.insertBefore(node, after ? closest.nextSibling : closest);
      };

      const release = (up) => {
        if (up && up.pointerId !== pointerId) return;
        window.removeEventListener('pointermove', follow);
        window.removeEventListener('pointerup', release);
        window.removeEventListener('pointercancel', release);
        node.style.transform = '';
        node.classList.remove('dragging');
        if (dragging) commit();
        else remove(node);
      };

      window.addEventListener('pointermove', follow);
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
    }

    // Ohne Zeigegerät bedienbar: mit den Pfeiltasten verschieben.
    function shift(node, direction) {
      const sibling = direction < 0 ? node.previousElementSibling : node.nextElementSibling;
      if (!sibling) return;
      slot.insertBefore(direction < 0 ? node : sibling, direction < 0 ? sibling : node);
      commit();
      node.focus();
    }

    const place = (id) => {
      const word = wordOf.get(id);
      const tile = el(`<button class="tile placed" data-word="${escape(word)}" data-id="${escape(id)}"
        aria-label="${escape(t('tileHelp', word))}"
        >${escape(word)}</button>`);
      tile.addEventListener('pointerdown', (event) => grab(tile, event));
      tile.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); shift(tile, -1); }
        else if (event.key === 'ArrowRight') { event.preventDefault(); shift(tile, 1); }
        else if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault();
          remove(tile);
        }
      });
      slot.append(tile);
    };

    const sync = () => {
      slot.innerHTML = '';
      chosen.forEach(place);
      refreshBank();
    };

    bank.forEach(({ word, id }) => {
      const tile = el(`<button class="tile" data-word="${escape(word)}" data-id="${escape(id)}"
        >${escape(word)}</button>`);
      tile.onclick = () => {
        if (chosen.includes(id)) return;
        chosen.push(id);
        sync();
      };
      bankRow.append(tile);
    });
    sync();

    button.onclick = () => {
      const answer = chosen.map((id) => wordOf.get(id)).join(' ');
      const verdict = grade(answer, task.item);
      // Beim Bauen zählt die Musterlösung oder eine reine Umstellung der
      // Beifügungen. Dieselben Wörter in anderer Rolle sagen etwas anderes —
      // dafür gibt es keinen Punkt, aber eine Erklärung.
      const correct = Boolean(verdict.exact || verdict.order);
      finish(task, correct, {
        solution: task.item.tp,
        speak: task.item.tp,
        xray: answer || task.item.tp,
        xrayMine: Boolean(answer),
        subtitle: task.item.target[0],
        grade: verdict.exact ? null : verdict,
        reason: task.join && correct ? t(task.join.kind === 'pi' ? 'joinPi' : 'joinLa') : null,
      });
    };
    return screen;
  }

  function freeTask(task) {
    const screen = screenWith(`
      <p class="prompt">${escape(t('askFree'))}</p>
      <h2 class="question">${escape(task.item.target[0])}</h2>
      <input class="typed" autocomplete="off" autocapitalize="off" spellcheck="false"
             placeholder="toki pona …" aria-label="toki pona">
      <p class="live"></p>
      <p class="hint">${escape(t('hintFree'))}</p>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    const input = screen.querySelector('.typed');
    const live = screen.querySelector('.live');
    const button = screen.querySelector('.primary');
    input.after(lookupHelper(input));

    input.oninput = () => {
      const text = input.value.trim();
      button.disabled = !text;
      if (!text) { live.textContent = ''; live.className = 'live'; return; }
      const result = TP.parse(text);
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
      const answer = input.value.trim();
      const verdict = grade(answer, task.item);
      finish(task, verdict.correct, {
        solution: task.item.tp,
        speak: task.item.tp,
        xray: answer || task.item.tp,
        xrayMine: Boolean(answer),
        grade: verdict,
      });
    };
    setTimeout(() => input.focus(), 50);
    return screen;
  }

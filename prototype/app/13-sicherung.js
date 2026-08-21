  // ------------------------------------------------------------ Sicherung

  const stamp = () => new Date().toISOString().slice(0, 10);

  function backupText() {
    return JSON.stringify({ app: 'o toki!', version: 1, exported: new Date().toISOString(), state });
  }

  // Nimmt sowohl eine Sicherungsdatei als auch einen rohen Zustand an.
  function readBackup(text) {
    let payload;
    try {
      payload = JSON.parse(text.trim());
    } catch (error) {
      throw new Error(t('backupUnreadable'));
    }
    const found = payload && payload.state ? payload.state : payload;
    if (!found || typeof found !== 'object' || ['xp', 'done', 'srs'].some((f) => !(f in found))) {
      throw new Error(t('backupForeign'));
    }
    return {
      state: sanitise(found),
      exported: payload && typeof payload.exported === 'string'
        ? payload.exported.slice(0, 10) : null,
    };
  }

  const summarise = (value) => t('summary', Math.floor((value.xp || 0) / 100) + 1,
    Object.keys(value.done || {}).length, Object.keys(value.srs || {}).length, value.xp || 0);

  function backupCard() {
    const card = el(`
      <div class="card">
        <h2>${escape(t('backupTitle'))}</h2>
        <p class="hint">${escape(t('backupState', summarise(state)))}</p>
        <div class="row">
          <button class="ghost" data-do="save">${escape(t('backupSave'))}</button>
          <button class="ghost" data-do="load">${escape(t('backupLoad'))}</button>
        </div>
        <div class="drawer"></div>
      </div>`);

    const drawer = card.querySelector('.drawer');
    const note = (text, bad) => {
      const line = el(`<p class="hint ${bad ? 'bad' : 'good'}">${escape(text)}</p>`);
      drawer.append(line);
    };

    card.querySelector('[data-do="save"]').onclick = async () => {
      drawer.innerHTML = '';
      const text = backupText();
      const name = `o-toki-fortschritt-${stamp()}.json`;

      const share = el(`<button class="ghost">${escape(t('backupFile'))}</button>`);
      share.onclick = async () => {
        const file = new File([text], name, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'o toki! — Fortschritt' });
            return;
          } catch (error) { /* abgebrochen: dann eben herunterladen */ }
        }
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };

      const copy = el(`<button class="ghost">${escape(t('backupCopy'))}</button>`);
      copy.onclick = async () => {
        try {
          await navigator.clipboard.writeText(text);
          note(t('backupCopied'));
        } catch (error) {
          note(t('backupCopyFailed'), true);
        }
      };

      drawer.append(share, copy);
    };

    card.querySelector('[data-do="load"]').onclick = () => {
      drawer.innerHTML = '';
      const form = el(`
        <div>
          <label class="ghost pickwrap">${escape(t('backupPick'))}
            <input class="pick" type="file" accept="application/json,.json,text/plain">
          </label>
          <textarea class="paste" rows="3" placeholder="${escape(t('backupPaste'))}"
            aria-label="${escape(t('backupPaste'))}"></textarea>
          <div class="preview"></div>
        </div>`);
      const preview = form.querySelector('.preview');

      const offer = (text) => {
        preview.innerHTML = '';
        let backup;
        try {
          backup = readBackup(text);
        } catch (error) {
          preview.append(el(`<p class="hint bad">${escape(error.message)}</p>`));
          return;
        }
        preview.append(el(`<p class="hint">${t('backupFound', escape(summarise(backup.state)),
          backup.exported ? escape(backup.exported) : null, escape(summarise(state)))}</p>`));
        const confirm = el(`<button class="primary">${escape(t('backupApply'))}</button>`);
        confirm.onclick = () => {
          state = backup.state;
          save();
          tab = 'pfad';
          render();
        };
        preview.append(confirm);
      };

      form.querySelector('.paste').oninput = (event) => {
        if (event.target.value.trim()) offer(event.target.value);
        else preview.innerHTML = '';
      };
      form.querySelector('.pick').onchange = (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => offer(String(reader.result));
        reader.onerror = () => preview.append(el(`<p class="hint bad">${escape(t('backupUnreadableFile'))}</p>`));
        reader.readAsText(file);
      };

      drawer.append(form);
    };

    return card;
  }

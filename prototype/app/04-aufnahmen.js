  // ------------------------------------------------------- eigene Aufnahmen

  // Echte Aufnahmen kann die App nicht mitbringen — aber sie kann deine
  // benutzen. Was hier landet, bleibt auf dem Gerät (IndexedDB) und wird
  // überall statt der Gerätestimme abgespielt.
  const REC_DB = 'o-toki-kalama';
  const REC_STORE = 'nimi';
  const RECORDED = new Map();          // Text → Blob
  let recorder = null;

  const canRecord = () => Boolean(typeof navigator !== 'undefined'
    && navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    && typeof window.MediaRecorder === 'function');

  function withStore(mode, work) {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('kein Speicher')); return; }
      const open = window.indexedDB.open(REC_DB, 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(REC_STORE)) open.result.createObjectStore(REC_STORE);
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(REC_STORE, mode);
        const request = work(tx.objectStore(REC_STORE));
        tx.oncomplete = () => { open.result.close(); resolve(request && request.result); };
        tx.onerror = () => { open.result.close(); reject(tx.error); };
      };
    });
  }

  async function loadRecordings() {
    try {
      const keys = await withStore('readonly', (store) => store.getAllKeys());
      const blobs = await withStore('readonly', (store) => store.getAll());
      (keys || []).forEach((key, index) => RECORDED.set(key, (blobs || [])[index]));
      if (RECORDED.size && !session) render();
    } catch (error) { /* ohne Speicher eben ohne Aufnahmen */ }
  }

  // Zwei Sprecherinnen, dazu die Möglichkeit zu wechseln. „abwechselnd“ nimmt
  // je nach Wort mal die eine, mal die andere — dieselbe Wahl bleibt für
  // dasselbe Wort immer gleich.
  const voiceFolder = (word) => {
    if (state.voice === 'jlakuse') return 'jlakuse';
    if (state.voice !== 'ante') return 'kalaasi';
    let sum = 0;
    for (let i = 0; i < word.length; i += 1) sum += word.charCodeAt(i);
    return sum % 2 ? 'jlakuse' : 'kalaasi';
  };

  // Für jedes einzelne Wort gibt es eine echte Aufnahme; sie liegt neben der
  // Seite und wird vom Service Worker mitgecacht.
  const spokenWord = (text) => {
    const word = String(text).trim().toLowerCase().replace(/[.!?:,]/g, '');
    return TP.lexicon[word] ? word : null;
  };

  // Ein einziges Abspielgerät für alle Aufnahmen, aus zwei Gründen, beide von
  // iOS: die Erlaubnis abzuspielen hängt dort am Element, das die erste
  // Berührung gesehen hat, und ein Element, auf das niemand mehr zeigt, wird
  // mitten im Abspielen weggeräumt. Vorher entstand bei jedem Tipp ein neues.
  let player = null;
  let playerUrl = null;

  function audioPlayer() {
    if (!player) {
      player = new Audio();
      player.preload = 'auto';
    }
    player.onended = null;
    player.onerror = null;
    if (playerUrl) { URL.revokeObjectURL(playerUrl); playerUrl = null; }
    return player;
  }

  // Spielt eine Aufnahme, falls es eine gibt. Ob sie wirklich klingt, stellt
  // sich erst danach heraus — eine fehlende Datei meldet sich als Ereignis,
  // ein verweigertes Abspielen über das Versprechen. In beiden Fällen
  // übernimmt `onFail`, statt dass gar nichts passiert.
  function playRecording(text, onState, onFail) {
    if (state.voice === 'ilo') return false;
    const key = String(text).trim();
    const blob = RECORDED.get(key);
    const word = spokenWord(key);
    if (!blob && !word) return false;

    let audio;
    let source;
    try {
      audio = audioPlayer();
      source = blob ? URL.createObjectURL(blob)
        : `./kalama/${voiceFolder(word)}/${word}.mp3`;
    } catch (error) { return false; }
    if (blob) playerUrl = source;

    let settled = false;
    const stop = (failed) => {
      if (settled) return;
      settled = true;
      if (onState) onState(false);
      if (failed && onFail) onFail();
    };
    // Notbremse: meldet das Gerät weder Ende noch Fehler, gibt der Knopf
    // trotzdem irgendwann wieder Ruhe.
    setTimeout(() => stop(false), 8000);
    audio.onended = () => stop(false);
    audio.onerror = () => stop(true);
    audio.src = source;
    if (onState) onState(true);
    try {
      const started = audio.play();
      if (started && started.catch) started.catch(() => stop(true));
    } catch (error) { stop(true); }
    return true;
  }

  async function recordFor(text, onState) {
    if (!canRecord()) { toast(t('recNone')); return false; }
    if (recorder) { recorder.stop(); return false; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) { toast(t('recDenied')); return false; }

    return new Promise((resolve) => {
      const chunks = [];
      recorder = new window.MediaRecorder(stream);
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        recorder = null;
        if (onState) onState(false);
        const blob = new Blob(chunks, { type: chunks[0] ? chunks[0].type : 'audio/webm' });
        if (!blob.size) { resolve(false); return; }
        RECORDED.set(text, blob);
        try { await withStore('readwrite', (store) => store.put(blob, text)); } catch (error) { /* egal */ }
        toast(t('recSaved', text));
        resolve(true);
      };
      recorder.start();
      if (onState) onState(true);
      // Ein Wort braucht keine drei Sekunden; ein Satz auch nicht viel mehr.
      setTimeout(() => { if (recorder) recorder.stop(); }, 3000);
    });
  }

  async function dropRecordings() {
    RECORDED.clear();
    try { await withStore('readwrite', (store) => store.clear()); } catch (error) { /* egal */ }
    render();
  }

  function recordButton(text) {
    if (!canRecord()) return null;
    const button = el(`<button class="rec" type="button" data-has="${RECORDED.has(text)}"
      aria-label="${escape(t('recStart'))}">●</button>`);
    button.onclick = async (event) => {
      event.stopPropagation();
      await recordFor(text, (busy) => {
        button.dataset.busy = String(busy);
        button.textContent = busy ? '■' : '●';
      });
      button.dataset.has = String(RECORDED.has(text));
    };
    return button;
  }

  // Die mitgelieferten Aufnahmen: woher sie kommen, und wie sie offline
  // verfügbar bleiben.
  let fetching = false;
  function voiceCard() {
    const card = el(`
      <div class="card">
        <h2>${escape(t('voiceTitle'))}</h2>
        <p class="hint">${escape(t('voiceHint'))}</p>
        <div class="row"></div>
        <p class="hint voicecredit"><a href="https://github.com/lipu-linku/ijo"
          rel="noopener">${escape(t('voiceCredit'))}</a></p>
      </div>`);
    const names = t('voiceNames');
    const picker = pickRow(
      VOICES.map((entry) => ({ value: entry.id, label: names[entry.id] })),
      state.voice,
      (value) => { state.voice = value; save(); render(); speak('toki'); },
      'voicepick',
    );
    card.querySelector('.row').before(picker);

    const row = card.querySelector('.row:not(.voicepick)');
    const button = el(`<button class="ghost">${escape(t('voiceFetch'))}</button>`);
    button.onclick = async () => {
      if (fetching) return;
      fetching = true;
      const words = Object.keys(TP.lexicon);
      let done = 0;
      button.disabled = true;
      for (const word of words) {
        try {
          await fetch(`./kalama/${voiceFolder(word)}/${word}.mp3`, { cache: 'force-cache' });
        } catch (error) { /* weiter */ }
        done += 1;
        if (done % 10 === 0 || done === words.length) button.textContent = t('voiceFetching', done, words.length);
      }
      button.textContent = t('voiceReady');
      fetching = false;
    };
    row.append(button);
    const probe = sayButton('toki', t('listen'));
    if (probe) row.append(probe);
    return card;
  }

  function recordCard() {
    const card = el(`
      <div class="card">
        <h2>${escape(t('recTitle'))}</h2>
        <p class="hint">${escape(canRecord() ? t('recHint') : t('recNone'))}</p>
        <div class="row"></div>
      </div>`);
    if (!canRecord()) return card;
    const row = card.querySelector('.row');
    row.append(el(`<p class="hint">${escape(t('recCount', RECORDED.size))}</p>`));
    if (RECORDED.size) {
      const drop = el(`<button class="ghost">${escape(t('recDrop'))}</button>`);
      drop.onclick = () => dropRecordings();
      row.append(drop);
    }
    return card;
  }

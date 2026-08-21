  // ------------------------------------------------------------ Aussprache

  // toki pona wird gesprochen, wie es dasteht: fünf Vokale, keine Dehnung,
  // Betonung auf der ersten Silbe. Am nächsten kommt eine italienische Stimme,
  // danach eine spanische — beide sprechen die Vokale sauber und kurz.
  const VOICE_ORDER = ['it-it', 'it', 'es-es', 'es', 'pt-br', 'fi-fi', 'sw'];
  let voice = null;

  const speechAvailable = () => typeof window !== 'undefined'
    && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

  function pickVoice() {
    if (!speechAvailable()) return null;
    let voices = [];
    try { voices = window.speechSynthesis.getVoices() || []; } catch (error) { return null; }
    const tag = (entry) => String(entry.lang || '').toLowerCase().replace('_', '-');
    for (const wanted of VOICE_ORDER) {
      const found = voices.find((entry) => tag(entry).startsWith(wanted));
      if (found) return found;
    }
    return voices[0] || null;
  }

  function utteranceFor(text) {
    const clean = String(text).replace(/[.!?:]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) return null;
    const utterance = new window.SpeechSynthesisUtterance(clean);
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
    else utterance.lang = 'it-IT';
    utterance.rate = 0.85;              // langsam genug zum Mitlesen
    return utterance;
  }

  function speakDevice(text, onState) {
    if (!speechAvailable()) return false;
    voice = voice || pickVoice();
    const utterance = utteranceFor(text);
    if (!utterance) return false;
    let settled = false;
    const stop = () => { if (settled) return; settled = true; if (onState) onState(false); };
    setTimeout(stop, 20000);
    utterance.onend = stop;
    utterance.onerror = stop;
    try {
      // Nur abbrechen, wenn wirklich etwas läuft: ein Abbruch unmittelbar vor
      // dem Sprechen verschluckt auf manchen Geräten die neue Äußerung.
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
      window.speechSynthesis.speak(utterance);
    } catch (error) { return false; }
    if (onState) onState(true);
    return true;
  }

  // Nur ein Knopf leuchtet: fängt woanders etwas Neues an, geht der vorige aus.
  // Sonst bliebe er hängen, weil sein Ende nie gemeldet wird — das Abspielgerät
  // ist für alle dasselbe.
  let releaseSay = null;
  function claimSay(onState) {
    if (releaseSay) releaseSay(false);
    const wrapped = (on) => {
      if (onState) onState(on);
      if (on) releaseSay = wrapped;
      else if (releaseSay === wrapped) releaseSay = null;
    };
    return wrapped;
  }

  // Reihenfolge: eigene Aufnahme, mitgelieferte, Gerätestimme. Die Aufnahmen
  // melden erst hinterher, ob sie wirklich klingen — misslingt es, springt die
  // Gerätestimme ein, statt dass der Knopf stumm bleibt.
  function speak(text, onState) {
    const report = claimSay(onState);
    if (playRecording(text, report, () => speakDevice(text, report))) return true;
    return speakDevice(text, report);
  }

  // Ganze Texte am Stück: die Sätze werden hintereinander in die Warteschlange
  // gelegt, der Browser spielt sie der Reihe nach ab.
  function speakLines(list, onLine, onEnd) {
    if (!speechAvailable()) return false;
    voice = voice || pickVoice();
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    } catch (error) { return false; }
    let spoken = 0;
    list.forEach((text, index) => {
      const utterance = utteranceFor(text);
      if (!utterance) return;
      spoken += 1;
      utterance.onstart = () => { if (onLine) onLine(index); };
      if (index === list.length - 1 && onEnd) utterance.onend = onEnd;
      try { window.speechSynthesis.speak(utterance); } catch (error) { /* egal */ }
    });
    return spoken > 0;
  }

  const stopSpeaking = () => {
    if (!speechAvailable()) return;
    try { window.speechSynthesis.cancel(); } catch (error) { /* egal */ }
  };

  // Stimmen kommen in manchen Browsern erst nach einem Augenblick.
  if (speechAvailable() && window.speechSynthesis.addEventListener) {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      const found = pickVoice();
      if (found && !voice) { voice = found; if (!session) render(); }
    });
  }

  // Hörknopf an einem Satz oder Wort. Ohne Sprachausgabe gibt es ihn nicht.
  function sayButton(text, label) {
    if (!state.sound || !speechAvailable()) return null;
    const button = el(`<button class="say" type="button"
      aria-label="${escape(label || t('listen'))}" title="${escape(label || t('listen'))}">♪</button>`);
    // Sichtbare Rückmeldung: solange etwas läuft, ist der Knopf angefasst.
    // Kommt gar kein Ton zustande, sagt es die App, statt stumm zu bleiben.
    button.onclick = (event) => {
      event.stopPropagation();
      const busy = (on) => { button.dataset.busy = String(on); };
      if (!speak(text, busy)) { busy(false); toast(t('soundFailed')); }
    };
    return button;
  }

  const withSay = (node, text) => {
    const button = sayButton(text);
    if (button) node.append(button);
    return node;
  };

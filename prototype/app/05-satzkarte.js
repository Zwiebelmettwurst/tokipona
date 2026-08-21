  // ------------------------------------------------------------ Satzkarte

  // Ein Satz als Bild: Zeichen groß, Schrift klein, Satzbau darunter. Alles
  // auf einer Leinwand gezeichnet — kein Netz, kein Dienst, kein Konto.
  const CARD = { width: 1080, height: 1350, pad: 90 };

  function drawCard(tp, subtitle) {
    const canvas = document.createElement('canvas');
    canvas.width = CARD.width;
    canvas.height = CARD.height;
    const pen = canvas.getContext('2d');
    const style = getComputedStyle(document.body);
    const paper = style.getPropertyValue('--surface').trim() || '#ffffff';
    const ink = style.getPropertyValue('--ink').trim() || '#14181A';
    const accent = style.getPropertyValue('--accent').trim() || '#1C6F6A';
    const faint = style.getPropertyValue('--ink-faint').trim() || '#667069';

    pen.fillStyle = paper;
    pen.fillRect(0, 0, CARD.width, CARD.height);
    pen.strokeStyle = accent;
    pen.lineWidth = 6;
    pen.strokeRect(30, 30, CARD.width - 60, CARD.height - 60);

    const words = TP.tokenize(tp).map((token) => token.text);
    const inner = CARD.width - CARD.pad * 2;

    // Zeichen — Wörter ohne Zeichen stehen lateinisch da.
    const glyphRows = [];
    let row = [];
    let rowWidth = 0;
    pen.font = '150px "linja pimeja", monospace';
    for (const word of words) {
      const usable = hasGlyph(word);
      pen.font = usable ? '150px "linja pimeja", monospace' : '90px ui-monospace, monospace';
      const width = pen.measureText(word).width + 30;
      if (rowWidth + width > inner && row.length) { glyphRows.push(row); row = []; rowWidth = 0; }
      row.push({ word, usable, width });
      rowWidth += width;
    }
    if (row.length) glyphRows.push(row);

    // Der Block aus Zeichen und Schrift steht in der Mitte, nicht oben.
    const blockHeight = glyphRows.length * 190 + (subtitle ? 190 : 120);
    let y = Math.max(CARD.pad + 190, (CARD.height - 220 - blockHeight) / 2 + 120);
    pen.textAlign = 'left';
    pen.textBaseline = 'middle';
    for (const line of glyphRows) {
      const total = line.reduce((sum, chip) => sum + chip.width, 0);
      let x = (CARD.width - total) / 2;
      for (const chip of line) {
        pen.fillStyle = accent;
        pen.font = chip.usable ? '150px "linja pimeja", monospace' : '90px ui-monospace, monospace';
        pen.fillText(chip.word, x + 15, y);
        x += chip.width;
      }
      y += 190;
    }

    // Schrift so weit verkleinern, bis sie passt — abschneiden erst als letzte
    // Möglichkeit, sonst fehlt am Ende ein halbes Wort.
    const fitted = (text, size, min, family) => {
      let current = size;
      pen.font = `${current}px ${family}`;
      while (pen.measureText(text).width > inner && current > min) {
        current -= 2;
        pen.font = `${current}px ${family}`;
      }
      let shown = text;
      while (pen.measureText(shown).width > inner && shown.length > 4) shown = shown.slice(0, -2);
      return shown;
    };

    pen.textAlign = 'center';
    pen.fillStyle = ink;
    pen.fillText(fitted(tp, 58, 30, 'ui-monospace, monospace'), CARD.width / 2, y + 40);

    if (subtitle) {
      pen.fillStyle = faint;
      pen.fillText(fitted(subtitle, 40, 24, '-apple-system, \"Helvetica Neue\", Arial, sans-serif'),
        CARD.width / 2, y + 120);
    }

    // Satzbau als Kette
    const spans = TP.xray(TP.parse(tp).utterance);
    if (spans.length) {
      pen.font = '30px ui-monospace, monospace';
      const labels = spans.map((span) => `${span.text} · ${TP.roleLabel(span.role, state.lang)}`);
      let line = '';
      const lines = [];
      for (const label of labels) {
        const next = line ? `${line}   ${label}` : label;
        if (pen.measureText(next).width > inner) { lines.push(line); line = label; }
        else line = next;
      }
      if (line) lines.push(line);
      pen.fillStyle = faint;
      lines.slice(0, 3).forEach((text, index) => {
        pen.fillText(text, CARD.width / 2, CARD.height - CARD.pad - 150 + index * 44);
      });
    }

    pen.fillStyle = accent;
    pen.font = '34px ui-monospace, monospace';
    pen.fillText('o toki! · toki pona', CARD.width / 2, CARD.height - CARD.pad + 10);
    return canvas;
  }

  async function shareCard(tp, subtitle) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const canvas = drawCard(tp, subtitle);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) { toast(t('cardFailed')); return null; }
    const name = `o-toki-${tp.replace(/[^a-z ]/gi, '').trim().replace(/\s+/g, '-').slice(0, 40)}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    // Teilen, wo das Gerät es kann — sonst bleibt der Weg über die Datei.
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file] });
        return 'geteilt';
      } catch (error) { /* abgebrochen — dann eben sichern */ }
    }
    const link = el(`<a class="cardlink" download="${escape(name)}">${escape(t('cardSave'))}</a>`);
    link.href = URL.createObjectURL(blob);
    document.body.append(link);
    link.click();
    setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 4000);
    return 'gesichert';
  }

  // Knopf, der aus einem Satz eine Karte macht.
  function cardButton(tp, subtitle) {
    const button = el(`<button class="ghost cardbutton" type="button">${escape(t('cardMake'))}</button>`);
    button.onclick = async (event) => {
      event.stopPropagation();
      button.disabled = true;
      try { await shareCard(tp, subtitle); } finally { button.disabled = false; }
    };
    return button;
  }

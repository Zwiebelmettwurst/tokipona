  const TRACE = { size: 260, pen: 16, slack: 9, needHit: 0.55, needClean: 0.5 };

  function traceTask(task) {
    const screen = screenWith(`
      <p class="prompt">${escape(t('askTrace'))}</p>
      <h2 class="question tp">${escape(task.word)}</h2>
      <p class="ask">${escape(glossesOf(task.word).slice(0, 3).join(', '))}</p>
      <div class="tracebox">
        <canvas class="trace" width="${TRACE.size}" height="${TRACE.size}"
          aria-label="${escape(t('askTrace'))}"></canvas>
      </div>
      <div class="row"><button class="ghost">${escape(t('traceClear'))}</button></div>
      <p class="hint">${escape(t('traceHint'))}</p>
      <div class="actions"><button class="primary" disabled>${escape(t('check'))}</button></div>`);

    const canvas = screen.querySelector('.trace');
    const ctx = canvas.getContext('2d');
    const button = screen.querySelector('.primary');

    // Vorlage und ihre großzügige Umgebung liegen in eigenen Flächen.
    const mask = (thick) => {
      const off = document.createElement('canvas');
      off.width = TRACE.size;
      off.height = TRACE.size;
      const pen = off.getContext('2d');
      pen.textAlign = 'center';
      pen.textBaseline = 'middle';
      pen.font = `${Math.round(TRACE.size * 0.78)}px "linja pimeja", monospace`;
      pen.fillStyle = '#000';
      const middle = TRACE.size / 2;
      if (!thick) pen.fillText(task.word, middle, middle);
      else {
        for (let angle = 0; angle < 360; angle += 30) {
          const rad = (angle * Math.PI) / 180;
          pen.fillText(task.word, middle + Math.cos(rad) * thick, middle + Math.sin(rad) * thick);
        }
        pen.fillText(task.word, middle, middle);
      }
      return pen.getImageData(0, 0, TRACE.size, TRACE.size).data;
    };

    const template = mask(0);
    const templateWide = mask(TRACE.slack);

    const strokes = [];
    let current = null;

    const paint = () => {
      ctx.clearRect(0, 0, TRACE.size, TRACE.size);
      // Vorlage blass im Hintergrund
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(TRACE.size * 0.78)}px "linja pimeja", monospace`;
      ctx.fillStyle = getComputedStyle(canvas).color;
      ctx.fillText(task.word, TRACE.size / 2, TRACE.size / 2);
      ctx.restore();

      ctx.lineWidth = TRACE.pen;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = getComputedStyle(canvas).color;
      for (const stroke of strokes) {
        if (!stroke.length) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (const point of stroke.slice(1)) ctx.lineTo(point.x, point.y);
        if (stroke.length === 1) ctx.lineTo(stroke[0].x + 0.1, stroke[0].y + 0.1);
        ctx.stroke();
      }
    };

    // Die eigene Linie als Fläche, einmal dünn und einmal großzügig.
    const drawn = (thick) => {
      const off = document.createElement('canvas');
      off.width = TRACE.size;
      off.height = TRACE.size;
      const pen = off.getContext('2d');
      pen.lineWidth = TRACE.pen + thick * 2;
      pen.lineCap = 'round';
      pen.lineJoin = 'round';
      pen.strokeStyle = '#000';
      for (const stroke of strokes) {
        if (!stroke.length) continue;
        pen.beginPath();
        pen.moveTo(stroke[0].x, stroke[0].y);
        for (const point of stroke.slice(1)) pen.lineTo(point.x, point.y);
        if (stroke.length === 1) pen.lineTo(stroke[0].x + 0.1, stroke[0].y + 0.1);
        pen.stroke();
      }
      return pen.getImageData(0, 0, TRACE.size, TRACE.size).data;
    };

    const score = () => {
      const mine = drawn(0);
      const mineWide = drawn(TRACE.slack);
      let ink = 0;
      let inkHit = 0;
      let line = 0;
      let lineClean = 0;
      for (let i = 3; i < template.length; i += 4) {
        const isInk = template[i] > 40;
        const isLine = mine[i] > 40;
        if (isInk) { ink += 1; if (mineWide[i] > 40) inkHit += 1; }
        if (isLine) { line += 1; if (templateWide[i] > 40) lineClean += 1; }
      }
      return {
        hit: ink ? inkHit / ink : 0,
        clean: line ? lineClean / line : 0,
      };
    };

    const place = (event) => {
      const box = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - box.left) / box.width) * TRACE.size,
        y: ((event.clientY - box.top) / box.height) * TRACE.size,
      };
    };

    canvas.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      current = [place(event)];
      strokes.push(current);
      button.disabled = false;
      paint();
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!current) return;
      current.push(place(event));
      paint();
    });
    const stop = () => { current = null; };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('pointerleave', stop);

    screen.querySelector('.ghost').onclick = () => {
      strokes.length = 0;
      current = null;
      button.disabled = true;
      paint();
    };

    button.onclick = () => {
      const marks = score();
      const hit = Math.round(marks.hit * 100);
      const clean = Math.round(marks.clean * 100);
      const correct = marks.hit >= TRACE.needHit && marks.clean >= TRACE.needClean;
      state.seenWords[task.word] = true;
      finish(task, correct, {
        solution: task.word,
        speak: task.word,
        xray: null,
        reason: `${escape(t('traceScore', hit, clean))}`
          + (correct ? '' : ` ${escape(marks.hit < TRACE.needHit ? t('traceThin') : t('traceWide'))}`),
      });
    };

    // Erst zeichnen, wenn die Schrift wirklich da ist — sonst steht die
    // Vorlage als lateinische Buchstabe da.
    paint();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint);
    return screen;
  }

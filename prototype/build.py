#!/usr/bin/env python3
"""Baut den Prototyp zu einer einzelnen HTML-Datei zusammen.

    python3 prototype/build.py

Die Artefakt-Umgebung erlaubt keine externen Dateien, deshalb landen Stil,
Daten, Parser und Anwendung inline in docs/prototype.html.
"""
import base64
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HERE = ROOT / "prototype"

TEMPLATE = """<title>o toki!</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Sätze bauen statt Vokabeln abhaken: zwölf Lektionen toki pona mit echter Grammatikprüfung.">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="./apple-touch-icon.png">
<link rel="icon" href="./icon-192.png">
<meta name="theme-color" content="#143A38">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="o toki!">
<script>window.OTOKI_VERSION = '__VERSION__';</script>

<style>
/*__FONT__*/
/*__STYLE__*/
</style>

<div id="app"></div>

<script>
/*__DATA__*/
</script>
<script>
/*__MUSI__*/
</script>
<script>
/*__TOKI__*/
</script>
<script>
/*__LIPU__*/
</script>
<script>
/*__PARSER__*/
</script>
<script>
/*__APP__*/
</script>

<script>
// Nur auf der gehosteten Seite: dort macht der Service Worker die App
// offline verfügbar. In einer eingebetteten Vorschau bleibt er aus.
if ('serviceWorker' in navigator && window.self === window.top
    && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  (() => {
    // Ob es etwas Neues gibt, entscheidet nicht der Lebenslauf des Service
    // Workers — der meldet sich auch beim ersten Einrichten —, sondern der
    // Vergleich der Fassungsnummern: die der Seite gegen die des Workers.
    const askWorker = () => new Promise((resolve) => {
      const worker = navigator.serviceWorker.controller;
      if (!worker) { resolve(null); return; }
      const channel = new MessageChannel();
      const giveUp = setTimeout(() => resolve(null), 2000);
      channel.port1.onmessage = (event) => { clearTimeout(giveUp); resolve(event.data); };
      try { worker.postMessage('version', [channel.port2]); } catch (error) { resolve(null); }
    });

    let told = false;
    const check = async () => {
      if (told || !window.OTOKI_VERSION) return;
      const live = await askWorker();
      if (!live || live === window.OTOKI_VERSION) return;
      told = true;
      // Beim zweiten Mal nicht noch einmal von selbst neu laden: sonst dreht
      // sich die Seite im Kreis, falls der Server doch Altes ausliefert.
      let again = false;
      try {
        again = sessionStorage.getItem('otoki-fassung') === live;
        sessionStorage.setItem('otoki-fassung', live);
      } catch (error) { /* ohne sessionStorage eben ohne Gedächtnis */ }
      // Die App entscheidet: mitten in einer Übung stört ein Neuladen.
      if (typeof window.otokiUpdateReady === 'function') window.otokiUpdateReady(!again);
      else if (!again) location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', check);

    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        // Beim Start und bei jeder Rückkehr zur App nachsehen, ob es etwas
        // Neues gibt. iOS hält installierte Apps sonst tagelang eingefroren.
        const look = () => {
          registration.update().catch(() => {});
          setTimeout(check, 400);
        };
        look();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') look();
        });
        window.addEventListener('online', look);

        registration.addEventListener('updatefound', () => {
          const fresh = registration.installing;
          if (!fresh) return;
          fresh.addEventListener('statechange', () => {
            if (fresh.state === 'activated') check();
          });
        });
      })
      .catch(() => {});
  })();
}
</script>
"""


FONT = """/* linja pimeja 1.9 — jan Inkepa, CC0. Siehe prototype/SCHRIFT.md.
   Eingebettet, weil die Artefakt-Umgebung keine externen Dateien lädt. */
@font-face {
  font-family: 'linja pimeja';
  src: url(data:font/woff2;base64,__BASE64__) format('woff2');
  font-display: swap;
}"""


def main():
    data = (HERE / "data.js").read_text()
    parser = (HERE / "tokipona.js").read_text()
    app = (HERE / "app.js").read_text()
    style = (HERE / "style.css").read_text()
    worker = (HERE / "sw.js").read_text()
    musi = (HERE / "musi.js").read_text()
    open_tasks = (HERE / "toki.js").read_text()
    reader = (HERE / "lipu.js").read_text()

    # Der Prototyp lädt nichts nach; die Node-Zeilen fliegen raus.
    for needle in ["if (typeof module !== 'undefined') { module.exports = TOKIPONA_DATA; }\n",
                   "if (typeof module !== 'undefined') { module.exports = TOKIPONA_MUSI; }\n",
                   "if (typeof module !== 'undefined') { module.exports = TOKIPONA_TOKI; }\n",
                   "if (typeof module !== 'undefined') { module.exports = TOKIPONA_LIPU; }\n",
                   "if (typeof module !== 'undefined') { module.exports = TokiPona; }\n"]:
        data = data.replace(needle, "")
        musi = musi.replace(needle, "")
        open_tasks = open_tasks.replace(needle, "")
        reader = reader.replace(needle, "")
        parser = parser.replace(needle, "")
    parser = parser.replace(
        "})(typeof TOKIPONA_DATA !== 'undefined' ? TOKIPONA_DATA : require('./data.js'));",
        "})(TOKIPONA_DATA);")

    font = FONT.replace("__BASE64__",
                        base64.b64encode((HERE / "linja-pimeja-1.9.woff2").read_bytes()).decode())

    # Die Fassungsnummer kommt aus dem Inhalt, nicht aus der Uhr: derselbe
    # Quelltext ergibt immer dieselbe Nummer, sonst schlüge die Drift-Prüfung
    # in der Werkbank bei jedem Lauf an.
    fingerprint = hashlib.sha256()
    for part in (TEMPLATE, FONT, style, data, musi, open_tasks, reader, parser, app, worker):
        fingerprint.update(part.encode())
    version = fingerprint.hexdigest()[:10]

    page = TEMPLATE.replace("__VERSION__", version)
    for marker, payload in (("/*__FONT__*/", font), ("/*__STYLE__*/", style), ("/*__DATA__*/", data),
                            ("/*__MUSI__*/", musi), ("/*__TOKI__*/", open_tasks), ("/*__LIPU__*/", reader),
                            ("/*__PARSER__*/", parser), ("/*__APP__*/", app)):
        page = page.replace(marker, payload)

    out = ROOT / "docs/prototype.html"
    out.write_text(page)

    sw = ROOT / "docs/sw.js"
    sw.write_text(worker.replace("__VERSION__", version))

    print(f"{out.relative_to(ROOT)}: {out.stat().st_size // 1024} KB, Fassung {version}")


if __name__ == "__main__":
    main()

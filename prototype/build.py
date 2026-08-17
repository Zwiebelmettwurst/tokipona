#!/usr/bin/env python3
"""Baut den Prototyp zu einer einzelnen HTML-Datei zusammen.

    python3 prototype/build.py

Die Artefakt-Umgebung erlaubt keine externen Dateien, deshalb landen Stil,
Daten, Parser und Anwendung inline in docs/prototype.html.
"""
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

<style>
/*__STYLE__*/
</style>

<div id="app"></div>

<script>
/*__DATA__*/
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
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
</script>
"""


def main():
    data = (HERE / "data.js").read_text()
    parser = (HERE / "tokipona.js").read_text()
    app = (HERE / "app.js").read_text()
    style = (HERE / "style.css").read_text()

    # Der Prototyp lädt nichts nach; die Node-Zeilen fliegen raus.
    for needle in ["if (typeof module !== 'undefined') { module.exports = TOKIPONA_DATA; }\n",
                   "if (typeof module !== 'undefined') { module.exports = TokiPona; }\n"]:
        data = data.replace(needle, "")
        parser = parser.replace(needle, "")
    parser = parser.replace(
        "})(typeof TOKIPONA_DATA !== 'undefined' ? TOKIPONA_DATA : require('./data.js'));",
        "})(TOKIPONA_DATA);")

    page = TEMPLATE
    for marker, payload in (("/*__STYLE__*/", style), ("/*__DATA__*/", data),
                            ("/*__PARSER__*/", parser), ("/*__APP__*/", app)):
        page = page.replace(marker, payload)

    out = ROOT / "docs/prototype.html"
    out.write_text(page)
    print(f"{out.relative_to(ROOT)}: {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()

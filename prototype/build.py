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

<style>
{style}
</style>

<div id="app"></div>

<script>
{data}
</script>
<script>
{parser}
</script>
<script>
{app}
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

    out = ROOT / "docs/prototype.html"
    out.write_text(TEMPLATE.format(style=style, data=data, parser=parser, app=app))
    print(f"{out.relative_to(ROOT)}: {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()

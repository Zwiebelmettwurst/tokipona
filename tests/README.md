# Prüfungen

Zwei Sorten:

- `node prototype/test.js` — Sprachkern und Inhalte. Läuft ohne Browser,
  prüft Parser, Korpora, Lektionen, Lesetexte, Alltagssätze, Umschreibungen,
  Namen, Silben, Stilpaare und die Zweisprachigkeit der Oberfläche.
- `node tests/run.js` — die Oberfläche im echten Browser (Playwright,
  Chromium). Jede Datei ist eine eigenständige Prüfung und lässt sich
  einzeln starten: `node tests/lesen.js`.

Einzelne Prüfungen filtern: `node tests/run.js drag lang`.

Der Browser kommt aus `PLAYWRIGHT_BROWSERS_PATH` oder aus `CHROME_PATH`;
ohne beides nimmt Playwright seinen eigenen (`npx playwright install chromium`).
Bildschirmfotos landen in `tests/shots/` und gehören nicht ins Depot.

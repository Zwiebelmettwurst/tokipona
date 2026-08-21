# Die Anwendung, in Teilen

Hier liegt der Übungsflow. `prototype/build.py` setzt die Dateien in
alphabetischer Reihenfolge wieder zusammen und fasst sie in eine gemeinsame
Kapsel:

```js
(function (DATA, MUSI, OPEN, LIPU, TP) {
  … 01-texte.js … 22-sandkasten.js …
})(TOKIPONA_DATA, TOKIPONA_MUSI, TOKIPONA_TOKI, TOKIPONA_LIPU, TokiPona);
```

Das ist kein Modulsystem und soll keines sein. Die Teile teilen sich einen
Verschluss: `state`, `render`, `t`, `el`, `escape` und alles andere stehen
überall zur Verfügung, ohne Ein- und Ausfuhr. Der Schnitt dient dem Lesen,
nicht der Kapselung.

**Die Reihenfolge zählt.** Funktionen dürfen sich frei über die Teile hinweg
aufrufen — sie werden vorgezogen. Was mit `const` oder `let` auf oberster
Ebene steht, muss dagegen vor seiner ersten Benutzung dastehen. Genau daran
ist die App schon einmal gescheitert: `VOICES` stand hinter `sanitise()`, das
es beim Laden braucht, und der ganze Fortschritt ging beim Neuladen verloren.
Wer einen neuen Teil einschiebt, wählt die Nummer also nicht nach Geschmack.

`node prototype/test.js` prüft die Zusammensetzung: alle Teile werden gelesen,
aneinandergehängt und einmal durch `new Function` geschickt. Eine kaputte
Klammer in einem Teil fällt damit sofort auf, nicht erst beim Bauen.

## Was worin steht

| Teil | Inhalt |
| --- | --- |
| `01-texte.js` | Alles, was die Oberfläche sagt: die Tabelle `T` in beiden Sprachen, dazu `GOALS`, `SIZES`, `VOICES`. |
| `02-tabellen.js` | Konzeptnamen und die Liste der Umschreibungen (`COMPOUNDS`). |
| `03-zustand.js` | Gespeicherter Stand: Prüfen beim Laden, Sichern, Punkte und Stufen, das Wiederholungssystem, der Sammelindex der Aufgaben. |
| `04-aufnahmen.js` | Eigene Aufnahmen (IndexedDB) und die mitgelieferten Sprachdateien. |
| `05-satzkarte.js` | Ein Satz als Bild auf einer Leinwand, zum Teilen. |
| `06-aussprache.js` | Stimmenwahl, Vorlesen, der Hörknopf. |
| `07-runden.js` | Woraus eine Runde besteht: Lektion, Wiederholung, Lektion 0, Schwachstellen, Spaßmodus, Fehlersätze. |
| `08-startseite.js` | Zeichnen, Kopfzeile, Reiter, der Lernpfad. |
| `09-tagebuch.js` | `o sitelen`: ein Satz am Tag, mitgelesen vom Parser. |
| `10-lesen.js` | Die Lesetexte am Stück und die Fragen dazu. |
| `11-einstellungen.js` | Wochenübersicht und die Einstellkarten (Ziel, Rundenlänge, Sprache, Ton, Zeichen). |
| `12-nachschlag.js` | Wörter im Satz antippen und nachschlagen. |
| `13-sicherung.js` | Stand sichern und wiederherstellen. |
| `14-uebungslauf.js` | Der Lauf durch eine Runde und die einfachen Aufgabenarten. |
| `15-zeichnen.js` | Zeichen mit dem Finger nachziehen, samt Bewertung. |
| `16-alltag.js` | Alltagssätze, Stilpaare, die Nachschlaghilfe beim Tippen. |
| `17-aufgaben.js` | Die übrigen Aufgabenarten: umschreiben, Stil, Silben, Fragen, freie Antworten, Fehler finden, Zeichen. |
| `18-bauen.js` | Die Bauaufgabe mit Ziehen und Tastatur, und das freie Übersetzen. |
| `19-bewertung.js` | Benoten, Satzröntgen, Rückmeldeblatt, Abschluss. |
| `20-musi.js` | `utala musi` — der Spaßmodus samt Würfel. |
| `21-woerter.js` | Wörterbuch, Sprachkarte, Wortverbände, Namen nachsprechen. |
| `22-sandkasten.js` | `o toki!` — freies Schreiben mit Parser, und der Streifen für neue Fassungen. |

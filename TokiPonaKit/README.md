# TokiPonaKit

Sprachkern der geplanten Lern-App (siehe `docs/lipu-sona-plan.html`, Abschnitt 9):
Lexikon, Tokenizer und ein vollständiger Parser für die Grammatik von toki pona —
ohne UI, ohne Abhängigkeiten, ohne Netz.

Der Parser ist der Grund, warum die App mehr können soll als Zeichenketten
vergleichen: Er liefert zu jeder Eingabe einen Syntaxbaum *und* eine Liste
konkreter Regelverstöße mit Textstelle, deutscher Begründung und — wo eindeutig —
einem Korrekturvorschlag.

```swift
let result = Parser().parse("mi li moku.")

result.isValid                       // false
result.violations.first?.rule        // .liAfterMiSina
result.violations.first?.message     // "Nach „mi“ als alleinigem Subjekt entfällt „li“."
result.violations.first?.correction  // "mi moku"

Parser().parse("jan suli li pana e lipu tawa mi.").utterance?.xray()
// [jan suli: Subjekt] [li: Prädikat] [pana: Verb] [lipu: Nomen] [tawa: Präposition] [mi: Ergänzung]
```

## Inhalt

| Datei | Aufgabe |
| --- | --- |
| `Word.swift`, `Lexicon.swift` | 120 Wörter aus *pu*, 17 *nimi ku suli*, mit Wortarten und deutschen Lesarten |
| `Phonotactics.swift` | Lautregeln — prüft, ob ein Eigenname tokiponisiert ist |
| `Tokenizer.swift` | Zerlegung, Normalisierung, Tippfehlervorschläge (Editierdistanz 1) |
| `Parser.swift` | Recursive-Descent-Analyse mit Fehlersammlung statt Abbruch |
| `SyntaxTree.swift` | Satzbaum: Kontexte, Subjekte, Präverben, Kern, Objekte, Präpositionalphrasen |
| `Violation.swift` | 17 Regeln, jede auf ein Curriculum-Konzept abgebildet |
| `XRay.swift` | Rollenzerlegung für Erklärung, Übung und Rückmeldung |

## Abgedeckte Grammatik

Stufe 1–12 des Curriculums: `li`-Tilgung nach bloßem `mi`/`sina`, `li`-Ketten,
`e`-Objekte, Modifikatorfolgen, `pi`-Umgruppierung, Präverben, die fünf
Präpositionen (auch als Prädikat), Verneinung mit `ala`, Entscheidungsfragen
`X ala X`, `seme`, `anu seme`, `o` für Befehl und Anrede, `la`-Kontexte,
Satzeinbettung nach `ni:`, `en`/`anu`/`taso`, Zahlen und Eigennamen.

Mit `Parser(options: .pu)` gilt strikt der *pu*-Kanon: *nimi ku suli* werden dann
gemeldet, erweiterte Präverben abgelehnt.

## Präpositionen sind auch Inhaltswörter

`tomo tawa mi` heißt „mein Auto“, nicht „Haus zu mir“. Der Parser löst das über die
Position, nicht über eine Wortliste:

- **Im Subjekt** ist keine Präpositionalphrase möglich, also ist `tawa` dort
  Beifügung: `tomo tawa mi li pona.`
- **Ohne Ergänzung** ist sie ebenfalls Beifügung: `ona li toki e ijo lon.`
- **Sonst** eröffnet sie eine Phrase: `mi pana e lipu tawa sina.`

Im Objekt bleibt `e lipu tawa mi` mehrdeutig („das Dokument für mich“ / „gibt mir
das Dokument“). Der Parser wählt die Phrasenlesart, meldet aber keinen Fehler —
beide sind zulässig, und Rückmeldung darf nur beanstanden, was sicher falsch ist.

## Bekannte Grenzen

- **Ohne Doppelpunkt keine Einbettung.** `e ni sina kama` ist strukturell eine
  Nominalphrase und wird deshalb nicht beanstandet. `ni:` ist Konvention, nicht Regel.
- **Semantik bleibt außen vor.** `kiwen li moku e telo` ist grammatisch fehlerfrei.
  Die inhaltliche Bewertung gehört in den Grader, der Musterlösungen und
  Pflichtbausteine kennt (Plan, Abschnitt 6) — er kommt als nächstes.

## Prüfstand

`Tests/TokiPonaKitTests/GoldenCorpus.swift` enthält 71 Sätze über alle zwölf
Stufen, die fehlerfrei analysierbar sein müssen, und 16 Fehlersätze, die je genau
eine Regel auslösen sollen. Für v1.0 wächst dieser Bestand laut Plan auf rund 600
Sätze; jeder Redaktionssatz kommt hier zuerst an.

Zusätzlich wurde der Parser gegen fremdes Material gemessen: die 238 toki-pona-Sätze
des Kurses [lipu sona pona](https://lipu-sona.pona.la/de/) (MIT-Lizenz,
© 2020 /dev/urandom und Mitwirkende) — Beispielsätze und Musterlösungen aus zwölf
Lektionen. Die erste Messung ergab 90 %; die vier Lücken (Präposition als Beifügung
im Subjekt, Präposition ohne Ergänzung, `anu` zwischen Prädikaten, `X ala X` an
einem präverbfähigen Hauptverb) sind behoben, seither **238 von 238**. Das Lexikon
stimmt mit dem Kurs exakt überein: 120 + 17.

```
swift test
```

> **Stand der Prüfung:** In der Umgebung, in der dieses Paket entstanden ist, war
> keine Swift-Toolchain erreichbar (die Netz-Policy blockiert `download.swift.org`).
> Grammatiklogik, Lexikonzahlen und der gesamte Golden-Korpus wurden deshalb über
> einen zeilennahen Port derselben Algorithmen geprüft — alle Erwartungen erfüllt.
> Ein `swift build` ist damit **nicht** ersetzt: Syntax- und Typfehler kann nur der
> Compiler ausschließen. Das ist der erste Schritt auf einer Maschine mit Toolchain.

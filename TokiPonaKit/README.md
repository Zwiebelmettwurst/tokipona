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
| `Violation.swift` | 18 Regeln, jede auf ein Curriculum-Konzept abgebildet |
| `XRay.swift` | Rollenzerlegung für Erklärung, Übung und Rückmeldung |

## Abgedeckte Grammatik

Stufe 1–12 des Curriculums: `li`-Tilgung nach bloßem `mi`/`sina`, `li`-Ketten,
`e`-Objekte, Modifikatorfolgen, `pi`-Umgruppierung, Präverben, die fünf
Präpositionen (auch als Prädikat), Verneinung mit `ala`, Entscheidungsfragen
`X ala X`, `seme`, `anu seme`, `o` für Befehl und Anrede, `la`-Kontexte,
Satzeinbettung nach `ni:`, `en`/`anu`/`taso`, Zahlen und Eigennamen.

Mit `Parser(options: .pu)` gilt strikt der *pu*-Kanon: *nimi ku suli* werden dann
gemeldet, erweiterte Präverben abgelehnt.

## Bekannte Grenzen

- **Ohne Doppelpunkt keine Einbettung.** `e ni sina kama` ist strukturell eine
  Nominalphrase und wird deshalb nicht beanstandet. `ni:` ist Konvention, nicht Regel.
- **Präpositionen beenden eine Nominalphrase.** `jan lon` als Beifügung („die
  anwesende Person“) wird als Phrasengrenze gelesen. Die Alternative wäre, jede
  Präposition doppeldeutig zu halten — das erzeugt mehr Fehldiagnosen als es verhindert.
- **Semantik bleibt außen vor.** `kiwen li moku e telo` ist grammatisch fehlerfrei.
  Die inhaltliche Bewertung gehört in den Grader, der Musterlösungen und
  Pflichtbausteine kennt (Plan, Abschnitt 6) — er kommt als nächstes.

## Prüfstand

`Tests/TokiPonaKitTests/GoldenCorpus.swift` enthält 66 Sätze über alle zwölf
Stufen, die fehlerfrei analysierbar sein müssen, und 17 Fehlersätze, die je genau
eine Regel auslösen sollen. Für v1.0 wächst dieser Bestand laut Plan auf rund 600
Sätze; jeder Redaktionssatz kommt hier zuerst an.

```
swift test
```

> **Stand der Prüfung:** In der Umgebung, in der dieses Paket entstanden ist, war
> keine Swift-Toolchain erreichbar (die Netz-Policy blockiert `download.swift.org`).
> Grammatiklogik, Lexikonzahlen und der gesamte Golden-Korpus wurden deshalb über
> einen zeilennahen Port derselben Algorithmen geprüft — alle Erwartungen erfüllt.
> Ein `swift build` ist damit **nicht** ersetzt: Syntax- und Typfehler kann nur der
> Compiler ausschließen. Das ist der erste Schritt auf einer Maschine mit Toolchain.

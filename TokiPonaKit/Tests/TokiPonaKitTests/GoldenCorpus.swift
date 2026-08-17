import TokiPonaKit

/// Prüfkorpus: nach Curriculumstufe geordnete Sätze, die fehlerfrei analysierbar
/// sein müssen, plus Fehlersätze mit der Regel, die genau greifen soll.
///
/// Der Plan veranschlagt für v1.0 rund 600 Sätze (Abschnitt 12). Dies ist der
/// Startbestand, gegen den der Parser entwickelt wird; jeder neue Redaktionssatz
/// kommt hier dazu, bevor er in den Kurs geht.
enum GoldenCorpus {

    struct Valid {
        let stage: Int
        let sentence: String
        let gloss: String
    }

    struct Invalid {
        let sentence: String
        let rule: Violation.Rule
        let note: String
    }

    static let valid: [Valid] = [
        // Stufe 1 — mi/sina ohne li
        .init(stage: 1, sentence: "mi pona.", gloss: "Mir geht es gut."),
        .init(stage: 1, sentence: "sina suli.", gloss: "Du bist groß."),
        .init(stage: 1, sentence: "mi jan.", gloss: "Ich bin ein Mensch."),
        .init(stage: 1, sentence: "mi moku.", gloss: "Ich esse."),
        .init(stage: 1, sentence: "sina pona.", gloss: "Du bist gut."),

        // Stufe 2 — Modifikator folgt dem Kopf
        .init(stage: 2, sentence: "sina jan pona.", gloss: "Du bist ein Freund."),
        .init(stage: 2, sentence: "mi jan lili.", gloss: "Ich bin ein Kind."),
        .init(stage: 2, sentence: "tomo mi li suli.", gloss: "Mein Haus ist groß."),
        .init(stage: 2, sentence: "mama sina li pona.", gloss: "Dein Elternteil ist gut."),

        // Stufe 3 — li, mehrere Prädikate
        .init(stage: 3, sentence: "ona li suli li pona.", gloss: "Es ist groß und gut."),
        .init(stage: 3, sentence: "kili li moku.", gloss: "Obst ist Nahrung."),
        .init(stage: 3, sentence: "jan li lape.", gloss: "Die Person schläft."),
        .init(stage: 3, sentence: "mi en sina li pona.", gloss: "Du und ich sind gut."),
        .init(stage: 3, sentence: "soweli mute li musi.", gloss: "Viele Tiere sind lustig."),

        // Stufe 4 — e und Objekt
        .init(stage: 4, sentence: "jan lili li moku e kili.", gloss: "Das Kind isst Obst."),
        .init(stage: 4, sentence: "mi lukin e sina.", gloss: "Ich sehe dich."),
        .init(stage: 4, sentence: "mi jo e tomo.", gloss: "Ich habe ein Haus."),
        .init(stage: 4, sentence: "ona li pana e mani e lipu.", gloss: "Sie gibt Geld und ein Dokument."),
        .init(stage: 4, sentence: "sina sitelen e nimi.", gloss: "Du schreibst ein Wort."),

        // Stufe 5 — pi
        .init(stage: 5, sentence: "jan pi toki pona li pona.", gloss: "toki-pona-Sprecher sind gut."),
        .init(stage: 5, sentence: "mi lukin e lipu pi toki pona.", gloss: "Ich lese ein toki-pona-Buch."),
        .init(stage: 5, sentence: "kulupu pi jan pona li suli.", gloss: "Die Gruppe der Freunde ist groß."),
        .init(stage: 5, sentence: "mi jo e ilo pi kalama musi.", gloss: "Ich habe ein Musikinstrument."),

        // Stufe 6 — Präverben
        .init(stage: 6, sentence: "mi wile moku.", gloss: "Ich will essen."),
        .init(stage: 6, sentence: "sina ken toki.", gloss: "Du kannst sprechen."),
        .init(stage: 6, sentence: "ona li kama sona.", gloss: "Sie lernt."),
        .init(stage: 6, sentence: "mi sona toki.", gloss: "Ich kann sprechen."),
        .init(stage: 6, sentence: "mi wile e ijo.", gloss: "Ich will etwas."),
        .init(stage: 6, sentence: "mi awen lape.", gloss: "Ich schlafe weiter."),

        // Stufe 7 — Präpositionen
        .init(stage: 7, sentence: "mi tawa tomo.", gloss: "Ich gehe nach Hause."),
        .init(stage: 7, sentence: "ona li lon ma.", gloss: "Sie ist im Land."),
        .init(stage: 7, sentence: "mi pali kepeken ilo.", gloss: "Ich arbeite mit einem Werkzeug."),
        .init(stage: 7, sentence: "jan li pana e lipu tawa mi.", gloss: "Jemand gibt mir ein Dokument."),
        .init(stage: 7, sentence: "mi lape lon tomo mi.", gloss: "Ich schlafe in meinem Haus."),
        .init(stage: 7, sentence: "mi tawa.", gloss: "Ich gehe."),
        .init(stage: 7, sentence: "ona li sama mi.", gloss: "Sie ist wie ich."),

        // Stufe 8 — Verneinung und Fragen
        .init(stage: 8, sentence: "mi moku ala.", gloss: "Ich esse nicht."),
        .init(stage: 8, sentence: "sina wile ala wile moku?", gloss: "Willst du essen?"),
        .init(stage: 8, sentence: "ona li pona ala pona?", gloss: "Ist es gut?"),
        .init(stage: 8, sentence: "sina pali e seme?", gloss: "Was machst du?"),
        .init(stage: 8, sentence: "jan seme li toki?", gloss: "Wer spricht?"),
        .init(stage: 8, sentence: "ona li pona anu seme?", gloss: "Ist es gut, oder?"),
        .init(stage: 8, sentence: "mi wile ala moku.", gloss: "Ich will nicht essen."),

        // Stufe 9 — o, a
        .init(stage: 9, sentence: "o kama pona!", gloss: "Willkommen!"),
        .init(stage: 9, sentence: "jan Sonja o toki!", gloss: "Sonja, sprich!"),
        .init(stage: 9, sentence: "sina o lape.", gloss: "Schlaf du."),
        .init(stage: 9, sentence: "mi pona a!", gloss: "Mir geht es gut!"),
        .init(stage: 9, sentence: "o pana e telo tawa mi.", gloss: "Gib mir Wasser."),
        .init(stage: 9, sentence: "jan pona o!", gloss: "Freund!"),

        // Stufe 10 — la
        .init(stage: 10, sentence: "tenpo pini la mi lon ma Tosi.", gloss: "Früher war ich in Deutschland."),
        .init(stage: 10, sentence: "sina moku la sina wawa.", gloss: "Wenn du isst, bist du stark."),
        .init(stage: 10, sentence: "tenpo suno ni la mi pali.", gloss: "Heute arbeite ich."),
        .init(stage: 10, sentence: "ken la ona li kama.", gloss: "Vielleicht kommt sie."),

        // Stufe 11 — ni:, en, anu, taso
        .init(stage: 11, sentence: "mi wile e ni: sina kama.", gloss: "Ich will, dass du kommst."),
        .init(stage: 11, sentence: "ona li toki e ni: mi pona.", gloss: "Sie sagt, dass es mir gut geht."),
        .init(stage: 11, sentence: "mi olin e sina taso.", gloss: "Ich liebe nur dich."),
        .init(stage: 11, sentence: "soweli anu waso li pona.", gloss: "Tiere oder Vögel sind gut."),
        .init(stage: 11, sentence: "taso mi wile lape.", gloss: "Aber ich will schlafen."),

        // Stufe 12 — Zahlen und Namen
        .init(stage: 12, sentence: "soweli tu li lape.", gloss: "Zwei Tiere schlafen."),
        .init(stage: 12, sentence: "jan Sonja li pali e toki pona.", gloss: "Sonja hat toki pona gemacht."),
        .init(stage: 12, sentence: "mi jo e kili wan.", gloss: "Ich habe eine Frucht."),
        .init(stage: 12, sentence: "ma Tosi li suli.", gloss: "Deutschland ist groß."),
        .init(stage: 12, sentence: "nimi mi li jan Ken.", gloss: "Mein Name ist Ken."),

        // Zusammengesetzt — die Sätze, an denen sich der Parser bewährt
        .init(stage: 12, sentence: "jan pi ma Tosi li toki e toki pona tawa mi.",
              gloss: "Jemand aus Deutschland spricht toki pona mit mir."),
        .init(stage: 12, sentence: "tenpo pini la jan Sonja li pana e lipu pu tawa jan mute.",
              gloss: "Früher gab Sonja vielen Menschen das Buch pu."),
        .init(stage: 12, sentence: "mi wile ala e ni: sina pakala e ilo mi.",
              gloss: "Ich will nicht, dass du mein Werkzeug kaputt machst.")
    ]

    static let invalid: [Invalid] = [
        .init(sentence: "mi li moku.", rule: .liAfterMiSina,
              note: "Nach bloßem mi entfällt li."),
        .init(sentence: "sina li pona.", rule: .liAfterMiSina,
              note: "Gleiches gilt für sina."),
        .init(sentence: "soweli moku e kili.", rule: .missingLi,
              note: "Dritte Person braucht li."),
        .init(sentence: "jan pi pona li lape.", rule: .piWithSingleWord,
              note: "pi nur vor mehrwortigen Beifügungen."),
        .init(sentence: "jan pi li pona.", rule: .piWithoutContent,
              note: "Nach pi fehlt die Gruppe."),
        .init(sentence: "mi moku e.", rule: .objectWithoutNoun,
              note: "e ohne Objekt."),
        .init(sentence: "mi moku e kili e.", rule: .objectWithoutNoun,
              note: "Zweites e ohne Objekt."),
        .init(sentence: "soweli li.", rule: .missingPredicate,
              note: "li ohne Prädikat."),
        .init(sentence: "li pona.", rule: .missingSubject,
              note: "li ohne Subjekt."),
        .init(sentence: "mi moku lon.", rule: .prepositionWithoutObject,
              note: "Angehängte Präposition ohne Ergänzung."),
        .init(sentence: "la mi pona.", rule: .emptyContext,
              note: "la ohne Kontext."),
        .init(sentence: "mi pona la.", rule: .contextWithoutClause,
              note: "la ohne Hauptsatz."),
        .init(sentence: "jan Claude li pona.", rule: .properNameNotTokiponized,
              note: "Name verletzt die Lautregeln."),
        .init(sentence: "Sonja li pona.", rule: .properNameAsHead,
              note: "Name braucht ein Kopfwort."),
        .init(sentence: "mi mokuu.", rule: .unknownWord,
              note: "Tippfehler."),
        .init(sentence: "o.", rule: .vocativeWithoutContent,
              note: "o allein."),
        .init(sentence: "mi li li pona.", rule: .repeatedParticle,
              note: "li doppelt.")
    ]
}

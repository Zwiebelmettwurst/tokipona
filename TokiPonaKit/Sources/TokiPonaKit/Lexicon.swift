/// Das vollständige Wortinventar: 120 Wörter aus *pu*, 17 *nimi ku suli*.
///
/// Die Glossen sind eigenständig formuliert (siehe Plan, Abschnitt 12): Wortliste
/// und Grammatik sind nicht schutzfähig, die Formulierungen in *pu*/*ku* sehr wohl.
public enum Lexicon {

    // MARK: - Zugriff

    /// Alle 137 Einträge, alphabetisch.
    public static let all: [Word] = pu + kuSuli

    /// Die 120 Wörter des Pflichtkanons.
    public static let pu: [Word] = puWords

    /// Die 17 gut etablierten Zusatzwörter.
    public static let kuSuli: [Word] = kuSuliWords

    private static let index: [String: Word] = {
        var map: [String: Word] = [:]
        for word in all { map[word.text] = word }
        // `ali` ist eine Schreibvariante von `ale`, kein eigenes Wort.
        map["ali"] = map["ale"]
        return map
    }()

    /// Schlägt ein Wort nach, inklusive der Variante `ali`.
    public static func word(_ text: String) -> Word? {
        index[text]
    }

    /// Ist die Zeichenkette ein bekanntes Wort?
    public static func contains(_ text: String) -> Bool {
        index[text] != nil
    }

    /// Alle Schreibungen inklusive Varianten — Grundlage der Tippfehlerkorrektur.
    public static let allSpellings: [String] = index.keys.sorted()

    /// Die fünf Präpositionen aus *pu*.
    public static let prepositions: Set<String> = ["lon", "tan", "tawa", "kepeken", "sama"]

    /// Präpositionen, die Teile der Community zusätzlich verwenden.
    ///
    /// Standardmäßig aus, siehe ``Parser/Options/extendedPrepositions``.
    public static let extendedPrepositions: Set<String> = ["poka", "sike"]

    /// Die sechs Präverben aus *pu*.
    public static let preverbs: Set<String> = ["wile", "ken", "kama", "awen", "sona", "lukin"]

    /// Präverben, die verbreitet, aber nicht in *pu* als solche beschrieben sind.
    public static let extendedPreverbs: Set<String> = ["alasa", "open", "pini"]

    /// Strukturpartikel ohne Inhaltslesart. Nur diese begrenzen Phrasen.
    public static let structuralParticles: Set<String> = ["li", "e", "la", "pi", "o", "en", "anu", "a"]

    // MARK: - pu

    private static let puWords: [Word] = [
        w("a", [.particle, .interjection], "Betonung", "ach", "ja"),
        w("akesi", [.content], "Reptil", "Amphibie", "Kriechtier"),
        w("ala", [.content, .particle, .number], "nicht", "nein", "kein", "null"),
        w("alasa", [.content], "jagen", "sammeln", "suchen"),
        w("ale", [.content, .number], "alles", "jede", "Universum", "hundert"),
        w("anpa", [.content], "unten", "niedrig", "unterlegen"),
        w("ante", [.content], "anders", "verändert", "Unterschied"),
        w("anu", [.particle], "oder"),
        w("awen", [.content, .preverb], "bleiben", "warten", "bewahren", "weiterhin"),
        w("e", [.particle], "Objektpartikel"),
        w("en", [.particle], "und"),
        w("esun", [.content], "Handel", "Markt", "Laden", "tauschen"),
        w("ijo", [.content], "Ding", "Sache", "etwas"),
        w("ike", [.content], "schlecht", "negativ", "kompliziert"),
        w("ilo", [.content], "Werkzeug", "Gerät", "Maschine"),
        w("insa", [.content], "Inneres", "Mitte", "Bauch"),
        w("jaki", [.content], "schmutzig", "eklig", "Müll"),
        w("jan", [.content], "Mensch", "Person", "jemand"),
        w("jelo", [.content], "gelb"),
        w("jo", [.content], "haben", "tragen", "besitzen"),
        w("kala", [.content], "Fisch", "Meerestier"),
        w("kalama", [.content], "Geräusch", "Klang", "Lärm machen"),
        w("kama", [.content, .preverb], "kommen", "werden", "ankommen", "anfangen"),
        w("kasi", [.content], "Pflanze", "Kraut", "Blatt"),
        w("ken", [.content, .preverb], "können", "dürfen", "Möglichkeit"),
        w("kepeken", [.content, .preposition], "benutzen", "mit", "mittels"),
        w("kili", [.content], "Frucht", "Gemüse", "Pilz"),
        w("kiwen", [.content], "hart", "Stein", "Metall"),
        w("ko", [.content], "halbfest", "Paste", "Pulver", "Ton"),
        w("kon", [.content], "Luft", "Atem", "Geist", "Essenz"),
        w("kule", [.content], "Farbe", "farbig", "Vielfalt"),
        w("kulupu", [.content], "Gruppe", "Gemeinschaft", "Gesellschaft"),
        w("kute", [.content], "hören", "zuhören", "Ohr"),
        w("la", [.particle], "Kontextpartikel"),
        w("lape", [.content], "schlafen", "ruhen"),
        w("laso", [.content], "blau", "grün"),
        w("lawa", [.content], "Kopf", "leiten", "Regel"),
        w("len", [.content], "Kleidung", "Stoff", "Schicht", "verborgen"),
        w("lete", [.content], "kalt", "roh", "ungekocht"),
        w("li", [.particle], "Prädikatspartikel"),
        w("lili", [.content], "klein", "wenig", "jung"),
        w("linja", [.content], "Faden", "Haar", "lange biegsame Sache"),
        w("lipu", [.content], "Blatt", "Buch", "Dokument", "flacher Gegenstand"),
        w("loje", [.content], "rot"),
        w("lon", [.content, .preposition], "sein in", "existieren", "an", "bei"),
        w("luka", [.content, .number], "Hand", "Arm", "fünf"),
        w("lukin", [.content, .preverb], "sehen", "schauen", "Auge", "versuchen"),
        w("lupa", [.content], "Loch", "Öffnung", "Tür", "Fenster"),
        w("ma", [.content], "Land", "Erde", "Gebiet", "draußen"),
        w("mama", [.content], "Elternteil", "Vorfahr", "Ursprung"),
        w("mani", [.content], "Geld", "Vermögen", "Nutztier"),
        w("meli", [.content], "Frau", "weiblich"),
        w("mi", [.content, .pronoun], "ich", "wir", "mein"),
        w("mije", [.content], "Mann", "männlich"),
        w("moku", [.content], "essen", "trinken", "Nahrung"),
        w("moli", [.content], "Tod", "sterben", "tot"),
        w("monsi", [.content], "Rückseite", "Rücken", "hinten"),
        w("mu", [.content, .interjection], "Tierlaut"),
        w("mun", [.content], "Mond", "Stern", "Himmelskörper"),
        w("musi", [.content], "Spaß", "Spiel", "Kunst", "unterhaltsam"),
        w("mute", [.content, .number], "viel", "viele", "Menge", "zwanzig"),
        w("nanpa", [.content], "Zahl", "Nummer"),
        w("nasa", [.content], "seltsam", "verrückt", "berauscht"),
        w("nasin", [.content], "Weg", "Methode", "Straße", "Lehre"),
        w("nena", [.content], "Erhebung", "Hügel", "Nase", "Knopf"),
        w("ni", [.content], "dies", "jenes"),
        w("nimi", [.content], "Wort", "Name"),
        w("noka", [.content], "Bein", "Fuß", "unterer Teil"),
        w("o", [.particle], "Anrede- und Befehlspartikel"),
        w("olin", [.content], "Liebe", "lieben"),
        w("ona", [.content, .pronoun], "er", "sie", "es", "ihr"),
        w("open", [.content], "öffnen", "anfangen", "einschalten"),
        w("pakala", [.content, .interjection], "kaputt", "Fehler", "zerstören"),
        w("pali", [.content], "machen", "tun", "arbeiten", "Werk"),
        w("palisa", [.content], "Stab", "Ast", "langer harter Gegenstand"),
        w("pan", [.content], "Getreide", "Brot", "Reis", "Nudeln"),
        w("pana", [.content], "geben", "senden", "abgeben"),
        w("pi", [.particle], "Umgruppierungspartikel"),
        w("pilin", [.content], "fühlen", "Gefühl", "Herz", "meinen"),
        w("pimeja", [.content], "dunkel", "schwarz", "Schatten"),
        w("pini", [.content], "Ende", "beendet", "vergangen"),
        w("pipi", [.content], "Insekt", "Käfer", "Spinne"),
        w("poka", [.content], "Seite", "Hüfte", "nahe bei"),
        w("poki", [.content], "Behälter", "Kiste", "Tasse", "Schublade"),
        w("pona", [.content], "gut", "einfach", "positiv", "reparieren"),
        w("pu", [.content], "das Buch pu", "mit pu umgehen"),
        w("sama", [.content, .preposition], "gleich", "ähnlich", "wie"),
        w("seli", [.content], "Feuer", "Hitze", "warm", "kochen"),
        w("selo", [.content], "Haut", "Hülle", "äußere Form"),
        w("seme", [.content], "was", "welche", "Fragewort"),
        w("sewi", [.content], "oben", "hoch", "erhaben", "göttlich"),
        w("sijelo", [.content], "Körper", "Zustand", "Verfassung"),
        w("sike", [.content], "Kreis", "rund", "Zyklus", "Jahr"),
        w("sin", [.content], "neu", "frisch", "zusätzlich", "nochmal"),
        w("sina", [.content, .pronoun], "du", "ihr", "dein"),
        w("sinpin", [.content], "Vorderseite", "Gesicht", "Wand"),
        w("sitelen", [.content], "Bild", "Zeichen", "schreiben", "zeichnen"),
        w("sona", [.content, .preverb], "Wissen", "wissen", "können"),
        w("soweli", [.content], "Landtier", "Säugetier"),
        w("suli", [.content], "groß", "lang", "wichtig", "erwachsen"),
        w("suno", [.content], "Sonne", "Licht", "Tag"),
        w("supa", [.content], "Tisch", "Bett", "waagerechte Fläche"),
        w("suwi", [.content], "süß", "niedlich", "lieb"),
        w("tan", [.content, .preposition], "von", "wegen", "Ursache"),
        w("taso", [.content, .particle], "aber", "nur", "jedoch"),
        w("tawa", [.content, .preposition], "sich bewegen", "nach", "für", "aus Sicht von"),
        w("telo", [.content], "Wasser", "Flüssigkeit", "waschen"),
        w("tenpo", [.content], "Zeit", "Moment", "Periode"),
        w("toki", [.content, .interjection], "Sprache", "sprechen", "Gruß"),
        w("tomo", [.content], "Haus", "Raum", "Gebäude"),
        w("tu", [.content, .number], "zwei", "teilen"),
        w("unpa", [.content], "Sex", "sexuell"),
        w("uta", [.content], "Mund", "Lippen", "küssen"),
        w("utala", [.content], "Kampf", "Streit", "Wettbewerb"),
        w("walo", [.content], "weiß", "hell", "blass"),
        w("wan", [.content, .number], "eins", "einzig", "vereinen"),
        w("waso", [.content], "Vogel", "fliegendes Tier"),
        w("wawa", [.content], "stark", "kräftig", "Energie"),
        w("weka", [.content], "weg", "abwesend", "entfernen"),
        w("wile", [.content, .preverb], "wollen", "brauchen", "müssen")
    ]

    // MARK: - nimi ku suli

    private static let kuSuliWords: [Word] = [
        k("epiku", [.content], "episch", "großartig"),
        k("jasima", [.content], "spiegeln", "umkehren", "Gegenteil"),
        k("kijetesantakalu", [.content], "Kleinbär", "Waschbär", "Marder"),
        k("kin", [.content, .particle], "auch", "ebenfalls", "tatsächlich"),
        k("kipisi", [.content], "schneiden", "teilen", "Stück"),
        k("kokosila", [.content], "die gemeinsame Sprache meiden"),
        k("ku", [.content], "das Buch ku", "mit ku umgehen"),
        k("lanpan", [.content], "nehmen", "ergreifen", "stehlen"),
        k("leko", [.content], "Block", "Stufe", "Ecke", "quadratisch"),
        k("meso", [.content], "mittel", "mäßig", "durchschnittlich"),
        k("misikeke", [.content], "Medizin", "heilen"),
        k("monsuta", [.content], "Angst", "Monster", "furchterregend"),
        k("n", [.content, .interjection], "hm", "äh"),
        k("namako", [.content], "Gewürz", "Zusatz", "extra"),
        k("oko", [.content], "Auge"),
        k("soko", [.content], "Pilz"),
        k("tonsi", [.content], "nichtbinär", "geschlechtsnonkonform")
    ]

    // MARK: - Hilfskonstruktoren

    private static func w(_ text: String, _ roles: Set<Word.Role>, _ glosses: String...) -> Word {
        Word(text: text, book: .pu, roles: roles, glosses: glosses)
    }

    private static func k(_ text: String, _ roles: Set<Word.Role>, _ glosses: String...) -> Word {
        Word(text: text, book: .kuSuli, roles: roles, glosses: glosses)
    }
}

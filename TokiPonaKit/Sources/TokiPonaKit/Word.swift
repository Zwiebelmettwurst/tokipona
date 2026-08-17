/// Ein Eintrag des toki-pona-Wortschatzes.
///
/// Wortarten überlappen in toki pona systematisch: `lon` ist Präposition *und*
/// Inhaltswort, `wile` ist Präverb *und* Vollverb, `ala` ist Partikel *und*
/// Inhaltswort. Deshalb trägt jedes Wort eine *Menge* von Rollen.
public struct Word: Sendable, Hashable {

    /// Herkunft eines Wortes. Bestimmt, ob es zum Pflichtkanon gehört.
    public enum Book: String, Sendable, Hashable {
        /// Die 120 Wörter aus *pu* (2014).
        case pu
        /// Die 17 gut etablierten Zusatzwörter aus *ku* (2021).
        case kuSuli
    }

    /// Syntaktische Rolle, die ein Wort einnehmen kann.
    public enum Role: String, Sendable, Hashable {
        /// Kann Kopf einer Phrase sein oder modifizieren.
        case content
        /// Strukturpartikel ohne eigene Bedeutung: `li e la pi o en anu a`.
        case particle
        /// Kann eine Präpositionalphrase eröffnen.
        case preposition
        /// Kann vor einem weiteren Prädikat stehen (`wile moku`).
        case preverb
        /// Personalpronomen.
        case pronoun
        /// Zahlwort.
        case number
        /// Eigenständiger Ausruf (`a`, `mu`, `n`).
        case interjection
    }

    public let text: String
    public let book: Book
    public let roles: Set<Role>
    /// Deutsche Lesarten, absteigend nach Gebräuchlichkeit.
    public let glosses: [String]

    public init(text: String, book: Book, roles: Set<Role>, glosses: [String]) {
        self.text = text
        self.book = book
        self.roles = roles
        self.glosses = glosses
    }

    /// Kann das Wort Kopf einer Nominalphrase sein?
    ///
    /// Reine Strukturpartikel können das nicht — `mi e moku` ist deshalb
    /// erkennbar falsch.
    public var canHeadPhrase: Bool {
        !roles.contains(.particle) || roles.contains(.content)
    }

    public var isParticle: Bool { roles.contains(.particle) }
    public var isPreposition: Bool { roles.contains(.preposition) }
    public var isPreverb: Bool { roles.contains(.preverb) }
    public var isPronoun: Bool { roles.contains(.pronoun) }
    public var isNumber: Bool { roles.contains(.number) }
}

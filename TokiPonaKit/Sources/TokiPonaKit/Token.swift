/// Ein Wort der Eingabe samt Einordnung.
public struct Token: Sendable, Hashable {

    /// Was der Tokenizer über die Zeichenkette herausgefunden hat.
    public enum Classification: Sendable, Hashable {
        /// Bekanntes Wort aus dem Lexikon.
        case known(Word)
        /// Großgeschrieben und lautgesetzlich möglich — also ein Eigenname.
        case properName
        /// Großgeschrieben, aber nicht tokiponisierbar (`Claude`, `Xerox`).
        case malformedName(Phonotactics.Problem)
        /// Kleingeschrieben und unbekannt; ggf. mit Korrekturvorschlag.
        case unknown(suggestion: String?)
    }

    /// Die Zeichenkette wie eingegeben, ohne Satzzeichen.
    public let original: String
    /// Kleingeschriebene Form, unter der nachgeschlagen wurde.
    public let text: String
    /// Position in der Tokenliste der Äußerung.
    public let index: Int
    /// Zeichenposition in der Eingabe — für Markierungen in der Oberfläche.
    public let offset: Int
    /// Stand ein Doppelpunkt direkt dahinter? Markiert `ni:` als Satzeinleitung.
    public let followedByColon: Bool
    public let classification: Classification

    public init(
        original: String,
        text: String,
        index: Int,
        offset: Int,
        followedByColon: Bool,
        classification: Classification
    ) {
        self.original = original
        self.text = text
        self.index = index
        self.offset = offset
        self.followedByColon = followedByColon
        self.classification = classification
    }

    /// Das Lexikonwort, falls bekannt.
    public var word: Word? {
        if case .known(let word) = classification { return word }
        return nil
    }

    public var isProperName: Bool {
        switch classification {
        case .properName, .malformedName: return true
        default: return false
        }
    }

    public var isUnknown: Bool {
        if case .unknown = classification { return true }
        return false
    }

    /// Ist es genau dieser Strukturpartikel?
    public func isParticle(_ particle: String) -> Bool {
        text == particle && Lexicon.structuralParticles.contains(particle) && word != nil
    }

    /// Begrenzt dieses Token eine Phrase?
    ///
    /// `pi` fehlt hier bewusst: es wird innerhalb der Nominalphrase verarbeitet.
    public var isPhraseBoundary: Bool {
        guard word != nil else { return false }
        return ["li", "e", "la", "o", "en", "anu"].contains(text)
    }

    /// Kann das Token Kopf einer Nominalphrase sein?
    ///
    /// Unbekannte Wörter zählen mit, damit ein einzelner Tippfehler nicht die
    /// gesamte Satzanalyse und damit die Rückmeldung zerstört.
    public var canHeadPhrase: Bool {
        switch classification {
        case .known(let word): return word.canHeadPhrase
        case .properName, .malformedName: return false
        case .unknown: return true
        }
    }

    /// Kann das Token als Modifikator hinter einem Kopf stehen?
    public var canModify: Bool {
        switch classification {
        case .known(let word): return word.canHeadPhrase
        case .properName, .malformedName: return true
        case .unknown: return true
        }
    }

    public func isPreposition(extended: Bool) -> Bool {
        guard word != nil else { return false }
        return Lexicon.prepositions.contains(text)
            || (extended && Lexicon.extendedPrepositions.contains(text))
    }

    public func isPreverb(extended: Bool) -> Bool {
        guard word != nil else { return false }
        return Lexicon.preverbs.contains(text)
            || (extended && Lexicon.extendedPreverbs.contains(text))
    }
}

extension Sequence where Element == Token {
    /// Die Wortfolge als Text — für Musterlösungsvergleiche und Anzeige.
    public var joinedText: String {
        map(\.text).joined(separator: " ")
    }
}

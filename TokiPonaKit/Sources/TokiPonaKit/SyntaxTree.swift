/// Ein Modifikator hinter dem Kopf einer Nominalphrase.
public enum Modifier: Sendable, Hashable {
    /// Einzelnes Wort: `jan **suli**`.
    case simple(Token)
    /// Mit `pi` umgruppierte Wortgruppe: `jan pi **toki pona**`.
    case group([Token])

    public var tokens: [Token] {
        switch self {
        case .simple(let token): return [token]
        case .group(let tokens): return tokens
        }
    }
}

/// Boxung, damit `NounPhrase` einen eingebetteten Satz enthalten kann,
/// ohne dass der Werttyp unendlich groß wird.
public indirect enum EmbeddedClause: Sendable, Hashable {
    case utterance(Utterance)

    public var utterance: Utterance {
        switch self { case .utterance(let value): return value }
    }
}

/// Kopf plus Modifikatoren: `jan pi toki pona`.
public struct NounPhrase: Sendable, Hashable {
    public let head: Token
    public let modifiers: [Modifier]
    /// Satz nach `ni:` — `mi wile e ni: sina kama.`
    public let embedded: EmbeddedClause?

    public init(head: Token, modifiers: [Modifier], embedded: EmbeddedClause? = nil) {
        self.head = head
        self.modifiers = modifiers
        self.embedded = embedded
    }

    public var tokens: [Token] { [head] + modifiers.flatMap(\.tokens) }
    public var text: String { tokens.joinedText }
}

/// Präposition mit Ergänzung: `tawa mi`.
///
/// `object` darf fehlen — `mi tawa.` ist ein vollständiger Satz.
public struct PrepositionalPhrase: Sendable, Hashable {
    public let preposition: Token
    public let object: NounPhrase?

    public init(preposition: Token, object: NounPhrase?) {
        self.preposition = preposition
        self.object = object
    }
}

/// Ein Präverb samt eigener Verneinung: `wile ala`.
public struct PreverbUse: Sendable, Hashable {
    public let token: Token
    public let isNegated: Bool

    public init(token: Token, isNegated: Bool) {
        self.token = token
        self.isNegated = isNegated
    }
}

/// Der Kern eines Prädikats.
public enum PredicateCore: Sendable, Hashable {
    /// Nominal oder verbal — in toki pona dasselbe: `li **pona**`, `li **moku**`.
    case phrase(NounPhrase)
    /// Präposition als Prädikat: `mi **lon tomo**`.
    case prepositional(PrepositionalPhrase)
    /// Nach `li` kam nichts mehr.
    case missing
}

public struct Predicate: Sendable, Hashable {
    /// Das `li`- oder `o`-Token; `nil` beim `li`-losen Prädikat nach `mi`/`sina`.
    public let marker: Token?
    public let preverbs: [PreverbUse]
    public let core: PredicateCore
    public let objects: [NounPhrase]
    public let prepositions: [PrepositionalPhrase]
    /// Verneint durch `ala` am Kern oder an einem Präverb.
    public let isNegated: Bool
    /// Entstand aus dem Muster `moku ala moku`.
    public let isPolarQuestion: Bool

    public init(
        marker: Token?,
        preverbs: [PreverbUse],
        core: PredicateCore,
        objects: [NounPhrase],
        prepositions: [PrepositionalPhrase],
        isNegated: Bool,
        isPolarQuestion: Bool
    ) {
        self.marker = marker
        self.preverbs = preverbs
        self.core = core
        self.objects = objects
        self.prepositions = prepositions
        self.isNegated = isNegated
        self.isPolarQuestion = isPolarQuestion
    }
}

public struct Clause: Sendable, Hashable {
    public enum Kind: Sendable, Hashable {
        /// `soweli li moku.`
        case declarative
        /// `o kama!` — mit oder ohne Angesprochene.
        case imperative
        /// `jan Sonja o!` — Anrede ohne Prädikat.
        case vocative
        /// Bloße Nominalphrase: `soweli suli.` Als Antwort zulässig.
        case fragment
        /// `a!`, `mu`, `toki!`
        case interjection
    }

    public let kind: Kind
    public let subjects: [NounPhrase]
    public let predicates: [Predicate]

    public init(kind: Kind, subjects: [NounPhrase], predicates: [Predicate]) {
        self.kind = kind
        self.subjects = subjects
        self.predicates = predicates
    }
}

/// Kontextteil vor `la`.
public enum Context: Sendable, Hashable {
    case phrase(NounPhrase)
    case clause(Clause)
}

/// Eine vollständige Äußerung.
public struct Utterance: Sendable, Hashable {
    /// Kontexte vor `la`, in Reihenfolge.
    public let contexts: [Context]
    public let clause: Clause?
    /// `a`, `kin` und die Frageform `anu seme` am Satzende.
    public let finalParticles: [Token]
    public let isQuestion: Bool

    public init(
        contexts: [Context],
        clause: Clause?,
        finalParticles: [Token],
        isQuestion: Bool
    ) {
        self.contexts = contexts
        self.clause = clause
        self.finalParticles = finalParticles
        self.isQuestion = isQuestion
    }
}

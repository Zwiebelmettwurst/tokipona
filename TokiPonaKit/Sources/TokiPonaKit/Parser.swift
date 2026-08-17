/// Analysiert toki-pona-Sätze strukturell.
///
/// Der Parser bricht bei Fehlern nicht ab, sondern sammelt Verstöße und liefert
/// trotzdem einen möglichst vollständigen Baum. Genau das braucht die App: Auf
/// „falsch“ folgt eine Begründung, kein leeres Ergebnis.
public struct Parser: Sendable {

    public struct Options: Sendable, Hashable {
        /// Sind die 17 *nimi ku suli* erlaubt? Aus, solange nur *pu* gelehrt wird.
        public var allowKuSuli: Bool
        /// `alasa`, `open`, `pini` als Präverben zulassen.
        public var extendedPreverbs: Bool
        /// `poka`, `sike` als Präpositionen zulassen.
        public var extendedPrepositions: Bool

        public init(
            allowKuSuli: Bool = true,
            extendedPreverbs: Bool = true,
            extendedPrepositions: Bool = false
        ) {
            self.allowKuSuli = allowKuSuli
            self.extendedPreverbs = extendedPreverbs
            self.extendedPrepositions = extendedPrepositions
        }

        /// Strikt nach *pu* — die Bewertungsgrundlage des Kurses.
        public static let pu = Options(
            allowKuSuli: false,
            extendedPreverbs: false,
            extendedPrepositions: false
        )
    }

    public let options: Options

    public init(options: Options = Options()) {
        self.options = options
    }

    public func parse(_ input: String) -> ParseResult {
        parse(tokens: Tokenizer.tokenize(input))
    }

    public func parse(tokens: [Token]) -> ParseResult {
        let engine = ParseEngine(tokens: tokens, options: options)
        let utterance = engine.run()
        return ParseResult(
            tokens: tokens,
            utterance: utterance,
            violations: engine.violations
        )
    }

    /// Prüft mehrere Sätze am Stück — Grundlage der Redaktionsprüfung.
    public func parseAll(_ input: String) -> [ParseResult] {
        Tokenizer.splitUtterances(input).map { parse($0) }
    }
}

public struct ParseResult: Sendable {
    public let tokens: [Token]
    public let utterance: Utterance?
    public let violations: [Violation]

    public var isValid: Bool { violations.isEmpty }

    public var result: Result<Utterance, ParseError> {
        if let utterance, violations.isEmpty { return .success(utterance) }
        return .failure(ParseError(violations: violations))
    }

    /// Erste Regel, die verletzt wurde — für knappe Rückmeldungen.
    public var primaryViolation: Violation? { violations.first }
}

// MARK: - Analyse

final class ParseEngine {

    private let tokens: [Token]
    private let options: Parser.Options
    private var pos = 0
    private var limit: Int
    private(set) var violations: [Violation] = []
    /// Der äußere Durchlauf hat unbekannte Wörter schon gemeldet.
    var suppressLexicalIssues = false

    init(tokens: [Token], options: Parser.Options) {
        self.tokens = tokens
        self.options = options
        self.limit = tokens.count
    }

    // MARK: Einstieg

    func run() -> Utterance? {
        guard !tokens.isEmpty else {
            report(.emptyUtterance, tokens: [], message: "Der Satz ist leer.")
            return nil
        }

        reportLexicalIssues()

        var start = 0
        var end = tokens.count
        var finalParticles: [Token] = []
        var isQuestion = tokens.contains { $0.text == "seme" && $0.word != nil }

        // Führendes `taso` verbindet zum vorigen Satz und gehört nicht zur Struktur.
        if end - start > 1, tokens[start].text == "taso", tokens[start].word != nil {
            start += 1
        }

        var changed = true
        while changed {
            changed = false
            if end - start >= 3,
               tokens[end - 2].text == "anu", tokens[end - 2].word != nil,
               tokens[end - 1].text == "seme", tokens[end - 1].word != nil {
                isQuestion = true
                finalParticles.insert(contentsOf: [tokens[end - 2], tokens[end - 1]], at: 0)
                end -= 2
                changed = true
            }
            while end - start > 1,
                  tokens[end - 1].word != nil,
                  tokens[end - 1].text == "a" || tokens[end - 1].text == "kin" {
                finalParticles.insert(tokens[end - 1], at: 0)
                end -= 1
                changed = true
            }
        }

        guard start < end else {
            let clause = Clause(kind: .interjection, subjects: [], predicates: [])
            return Utterance(
                contexts: [],
                clause: clause,
                finalParticles: finalParticles,
                isQuestion: isQuestion
            )
        }

        // Einzelner Ausruf: `a!`, `mu`, `toki!`
        if end - start == 1, let word = tokens[start].word, word.roles.contains(.interjection) {
            let clause = Clause(kind: .interjection, subjects: [], predicates: [])
            return Utterance(
                contexts: [],
                clause: clause,
                finalParticles: finalParticles,
                isQuestion: isQuestion
            )
        }

        // Kontexte vor `la` abtrennen.
        var contexts: [Context] = []
        var segmentStart = start
        while let laIndex = indexOfTopLevel("la", from: segmentStart, to: end) {
            if laIndex == segmentStart {
                report(
                    .emptyContext,
                    tokens: [tokens[laIndex]],
                    message: "Vor „la“ fehlt der Kontext."
                )
            } else if let clause = parseClause(from: segmentStart, to: laIndex) {
                if clause.kind == .fragment, clause.subjects.count == 1 {
                    contexts.append(.phrase(clause.subjects[0]))
                } else {
                    contexts.append(.clause(clause))
                }
            }
            segmentStart = laIndex + 1
        }

        guard segmentStart < end else {
            report(
                .contextWithoutClause,
                tokens: [tokens[end - 1]],
                message: "Nach „la“ fehlt der Hauptsatz."
            )
            return Utterance(
                contexts: contexts,
                clause: nil,
                finalParticles: finalParticles,
                isQuestion: isQuestion
            )
        }

        let clause = parseClause(from: segmentStart, to: end)
        if let clause, clause.predicates.contains(where: \.isPolarQuestion) {
            isQuestion = true
        }

        return Utterance(
            contexts: contexts,
            clause: clause,
            finalParticles: finalParticles,
            isQuestion: isQuestion
        )
    }

    /// Unbekannte Wörter und untokiponisierte Namen einmal zentral melden — so
    /// hängt die Meldung nicht davon ab, ob die Satzanalyse die Stelle erreicht.
    private func reportLexicalIssues() {
        for token in tokens {
            switch token.classification {
            case .unknown(let suggestion):
                report(
                    .unknownWord,
                    tokens: [token],
                    message: suggestion.map {
                        "„\(token.original)“ steht nicht im Wortschatz. Meintest du „\($0)“?"
                    } ?? "„\(token.original)“ steht nicht im Wortschatz.",
                    correction: suggestion
                )
            case .malformedName(let problem):
                report(
                    .properNameNotTokiponized,
                    tokens: [token],
                    message: "„\(token.original)“ ist kein toki-pona-Name: \(problem.message)"
                )
            case .known(let word):
                if word.book == .kuSuli && !options.allowKuSuli {
                    report(
                        .unknownWord,
                        tokens: [token],
                        message: "„\(token.text)“ gehört zu den nimi ku suli, nicht zu pu."
                    )
                }
            case .properName:
                break
            }
        }
    }

    // MARK: Teilsatz

    private func parseClause(from: Int, to: Int) -> Clause? {
        guard from < to else { return nil }

        if let oIndex = indexOfTopLevel("o", from: from, to: to) {
            return parseDirective(from: from, oIndex: oIndex, to: to)
        }

        let liIndex = indexOfTopLevel("li", from: from, to: to)

        if let liIndex, liIndex == from {
            report(
                .missingSubject,
                tokens: [tokens[liIndex]],
                message: "Vor „li“ fehlt das Satzsubjekt."
            )
        }

        // `mi li moku` — nach bloßem mi/sina entfällt li.
        if let liIndex, liIndex == from + 1, isBarePronoun(tokens[from]) {
            report(
                .liAfterMiSina,
                tokens: [tokens[liIndex]],
                message: "Nach „\(tokens[from].text)“ als alleinigem Subjekt entfällt „li“.",
                correction: tokens[from].text + " " + tokens[(from + 2)..<to].joinedText
            )
        }

        var subjects: [NounPhrase] = []
        var predicates: [Predicate] = []

        if let liIndex {
            if liIndex > from {
                pos = from
                limit = liIndex
                subjects = parseSubjectChain()
                reportLeftovers(upTo: liIndex)
            }
            pos = liIndex
            limit = to
            predicates = parsePredicateChain()
        } else if isBarePronoun(tokens[from]) {
            pos = from
            limit = to
            if let subject = parseNounPhraseBounded(to: from + 1) {
                subjects = [subject]
            }
            pos = from + 1
            limit = to
            if pos < to {
                predicates = [parsePredicate(marker: nil)]
                predicates.append(contentsOf: parsePredicateChain())
            }
        } else {
            // Kein `li` und kein mi/sina: entweder bloße Nominalphrase (als
            // Antwort zulässig) oder ein vergessenes `li`. Ein `e` entscheidet —
            // eine Nominalphrase kann kein Objekt tragen.
            pos = from
            limit = to
            subjects = parseSubjectChain()
            if pos < to {
                if tokens[pos].isParticle("e") {
                    // Das Objekt gehört zu einem Prädikat, das die Phrase mangels
                    // `li` verschluckt hat. Eine Meldung reicht; ein zweiter
                    // Durchlauf würde nur Folgefehler erzeugen.
                    report(
                        .missingLi,
                        tokens: [tokens[pos]],
                        message: "Vor dem Prädikat fehlt „li“.",
                        correction: correctionWithInsertedLi(from: from, to: to)
                    )
                    pos = to
                    return Clause(kind: .declarative, subjects: subjects, predicates: [])
                }
                reportLeftovers(upTo: to)
            }
            return Clause(kind: .fragment, subjects: subjects, predicates: [])
        }

        return Clause(kind: .declarative, subjects: subjects, predicates: predicates)
    }

    /// `o kama!`, `jan Sonja o!`, `sina o lape!`
    private func parseDirective(from: Int, oIndex: Int, to: Int) -> Clause {
        var subjects: [NounPhrase] = []
        if oIndex > from {
            pos = from
            limit = oIndex
            subjects = parseSubjectChain()
            reportLeftovers(upTo: oIndex)
        }

        let marker = tokens[oIndex]
        pos = oIndex + 1
        limit = to

        var predicates: [Predicate] = []
        if pos < to {
            predicates.append(parsePredicate(marker: marker))
            predicates.append(contentsOf: parsePredicateChain())
        }

        if subjects.isEmpty && predicates.isEmpty {
            report(
                .vocativeWithoutContent,
                tokens: [marker],
                message: "„o“ braucht eine Anrede davor oder einen Befehl danach."
            )
        }

        return Clause(
            kind: predicates.isEmpty ? .vocative : .imperative,
            subjects: subjects,
            predicates: predicates
        )
    }

    private func parseSubjectChain() -> [NounPhrase] {
        var phrases: [NounPhrase] = []
        guard let first = parseNounPhrase() else { return phrases }
        phrases.append(first)
        while pos < limit, tokens[pos].isParticle("en") || tokens[pos].isParticle("anu") {
            pos += 1
            guard let next = parseNounPhrase() else { break }
            phrases.append(next)
        }
        return phrases
    }

    private func parsePredicateChain() -> [Predicate] {
        var predicates: [Predicate] = []
        while pos < limit, tokens[pos].isParticle("li") {
            let marker = tokens[pos]
            pos += 1
            if pos < limit, tokens[pos].isParticle("li") {
                report(
                    .repeatedParticle,
                    tokens: [tokens[pos]],
                    message: "„li“ steht doppelt."
                )
                continue
            }
            predicates.append(parsePredicate(marker: marker))
        }
        return predicates
    }

    // MARK: Prädikat

    private func parsePredicate(marker: Token?) -> Predicate {
        var preverbs: [PreverbUse] = []
        var isNegated = false
        var isPolarQuestion = false

        while pos < limit, tokens[pos].isPreverb(extended: options.extendedPreverbs) {
            let preverb = tokens[pos]
            guard pos + 1 < limit else { break }
            let next = tokens[pos + 1]
            if next.isPhraseBoundary { break }

            if next.text == "ala", next.word != nil {
                if pos + 2 < limit, tokens[pos + 2].text == preverb.text {
                    // `wile ala wile` — Entscheidungsfrage.
                    isPolarQuestion = true
                    preverbs.append(PreverbUse(token: preverb, isNegated: false))
                    pos += 3
                    continue
                }
                if pos + 2 < limit, !tokens[pos + 2].isPhraseBoundary {
                    preverbs.append(PreverbUse(token: preverb, isNegated: true))
                    isNegated = true
                    pos += 2
                    continue
                }
                break  // `mi wile ala.` — wile ist hier Vollverb.
            }

            preverbs.append(PreverbUse(token: preverb, isNegated: false))
            pos += 1
        }

        var core: PredicateCore = .missing
        if pos < limit, tokens[pos].isPreposition(extended: options.extendedPrepositions) {
            core = .prepositional(parsePrepositionalPhrase(isCore: true))
        } else if pos < limit, !tokens[pos].isPhraseBoundary {
            if let phrase = parseNounPhrase() {
                core = .phrase(phrase)
            }
        } else {
            report(
                .missingPredicate,
                tokens: marker.map { [$0] } ?? [],
                message: marker.map { "Nach „\($0.text)“ fehlt das Prädikat." }
                    ?? "Dem Satz fehlt das Prädikat."
            )
        }

        if case .phrase(let phrase) = core {
            let mods = phrase.modifiers
            for (offset, modifier) in mods.enumerated() {
                guard case .simple(let token) = modifier, token.text == "ala", token.word != nil else { continue }
                if offset + 1 < mods.count,
                   case .simple(let following) = mods[offset + 1],
                   following.text == phrase.head.text {
                    isPolarQuestion = true
                } else {
                    isNegated = true
                }
            }
        }

        var objects: [NounPhrase] = []
        var prepositions: [PrepositionalPhrase] = []

        loop: while pos < limit {
            let token = tokens[pos]
            if token.isParticle("e") {
                pos += 1
                if pos < limit, tokens[pos].isParticle("e") {
                    report(.repeatedParticle, tokens: [tokens[pos]], message: "„e“ steht doppelt.")
                    continue
                }
                if let object = parseNounPhrase() {
                    objects.append(object)
                    while pos < limit, tokens[pos].isParticle("en") {
                        pos += 1
                        guard let further = parseNounPhrase() else { break }
                        objects.append(further)
                    }
                } else {
                    report(
                        .objectWithoutNoun,
                        tokens: [token],
                        message: "Nach „e“ fehlt das Objekt."
                    )
                }
            } else if token.isPreposition(extended: options.extendedPrepositions) {
                prepositions.append(parsePrepositionalPhrase(isCore: false))
            } else {
                break loop
            }
        }

        if pos < limit, !tokens[pos].isParticle("li") {
            report(
                .unexpectedToken,
                tokens: [tokens[pos]],
                message: "„\(tokens[pos].original)“ passt an dieser Stelle nicht in den Satzbau."
            )
            while pos < limit, !tokens[pos].isParticle("li") { pos += 1 }
        }

        return Predicate(
            marker: marker,
            preverbs: preverbs,
            core: core,
            objects: objects,
            prepositions: prepositions,
            isNegated: isNegated,
            isPolarQuestion: isPolarQuestion
        )
    }

    private func parsePrepositionalPhrase(isCore: Bool) -> PrepositionalPhrase {
        let preposition = tokens[pos]
        pos += 1

        var object: NounPhrase?
        if pos < limit, !tokens[pos].isPhraseBoundary, !tokens[pos].isParticle("pi") {
            object = parseNounPhrase()
        }

        if object == nil && !isCore {
            report(
                .prepositionWithoutObject,
                tokens: [preposition],
                message: "Nach „\(preposition.text)“ fehlt die Ergänzung."
            )
        }

        return PrepositionalPhrase(preposition: preposition, object: object)
    }

    // MARK: Nominalphrase

    private func parseNounPhraseBounded(to bound: Int) -> NounPhrase? {
        let saved = limit
        limit = Swift.min(bound, saved)
        defer { limit = saved }
        return parseNounPhrase()
    }

    private func parseNounPhrase() -> NounPhrase? {
        guard pos < limit else { return nil }
        let head = tokens[pos]

        if head.isPhraseBoundary || head.isParticle("pi") {
            report(
                .particleInPhrasePosition,
                tokens: [head],
                message: "„\(head.text)“ ist ein Partikel und kann keine Phrase anführen."
            )
            return nil
        }

        if head.isProperName {
            report(
                .properNameAsHead,
                tokens: [head],
                message: "Namen stehen als Beifügung hinter einem Wort wie jan, ma oder toki.",
                correction: "jan \(head.original)"
            )
        }

        pos += 1

        var modifiers: [Modifier] = []
        var embedded: EmbeddedClause?

        if head.followedByColon {
            embedded = parseEmbeddedUtterance()
            return NounPhrase(head: head, modifiers: modifiers, embedded: embedded)
        }

        while pos < limit {
            let token = tokens[pos]

            if token.isParticle("pi") {
                pos += 1
                var group: [Token] = []
                while pos < limit,
                      !tokens[pos].isPhraseBoundary,
                      !tokens[pos].isParticle("pi"),
                      tokens[pos].canModify {
                    group.append(tokens[pos])
                    pos += 1
                }
                if group.isEmpty {
                    report(
                        .piWithoutContent,
                        tokens: [token],
                        message: "Nach „pi“ fehlt die Wortgruppe."
                    )
                } else if group.count == 1 {
                    report(
                        .piWithSingleWord,
                        tokens: [token, group[0]],
                        message: "„pi“ gruppiert nur mehrwortige Beifügungen um; vor einem einzelnen Wort entfällt es.",
                        correction: "\(head.text) \(group[0].text)"
                    )
                    modifiers.append(.simple(group[0]))
                } else {
                    modifiers.append(.group(group))
                }
                continue
            }

            if token.isPhraseBoundary { break }
            if token.isPreposition(extended: options.extendedPrepositions) { break }
            if !token.canModify { break }

            modifiers.append(.simple(token))
            pos += 1

            if token.followedByColon {
                embedded = parseEmbeddedUtterance()
                break
            }
        }

        return NounPhrase(head: head, modifiers: modifiers, embedded: embedded)
    }

    /// Alles nach `ni:` ist ein eigenständiger Satz.
    private func parseEmbeddedUtterance() -> EmbeddedClause? {
        guard pos < limit else { return nil }
        let slice = Array(tokens[pos..<limit])
        pos = limit
        let engine = ParseEngine(tokens: slice, options: options)
        // Lexikalische Meldungen hat der äußere Durchlauf bereits erzeugt.
        engine.suppressLexicalIssues = true
        guard let utterance = engine.run() else { return nil }
        violations.append(contentsOf: engine.violations)
        return .utterance(utterance)
    }

    // MARK: Hilfsmittel

    /// Sucht einen Partikel auf oberster Ebene; der Bereich nach `ni:` gehört
    /// bereits zum eingebetteten Satz und wird nicht durchsucht.
    private func indexOfTopLevel(_ particle: String, from: Int, to: Int) -> Int? {
        var index = from
        while index < to {
            let token = tokens[index]
            if token.isParticle(particle) { return index }
            if token.followedByColon { return nil }
            index += 1
        }
        return nil
    }

    /// Baut den Verbesserungsvorschlag für ein vergessenes `li`.
    ///
    /// Wo das `li` hingehört, ist ohne Bedeutung nicht entscheidbar; das Wort
    /// direkt vor dem ersten `e` ist in aller Regel das Verb.
    private func correctionWithInsertedLi(from: Int, to: Int) -> String? {
        guard let objectIndex = indexOfTopLevel("e", from: from, to: to) else { return nil }
        let insertion = Swift.max(from + 1, objectIndex - 1)
        var words = tokens[from..<to].map(\.text)
        words.insert("li", at: insertion - from)
        return words.joined(separator: " ")
    }

    private func isBarePronoun(_ token: Token) -> Bool {
        guard let word = token.word, word.isPronoun else { return false }
        return token.text == "mi" || token.text == "sina"
    }

    private func reportLeftovers(upTo bound: Int) {
        guard pos < bound else { return }
        report(
            .unexpectedToken,
            tokens: [tokens[pos]],
            message: "„\(tokens[pos].original)“ passt an dieser Stelle nicht in den Satzbau."
        )
        pos = bound
    }

    private func report(
        _ rule: Violation.Rule,
        tokens: [Token],
        message: String,
        correction: String? = nil
    ) {
        if suppressLexicalIssues,
           rule == .unknownWord || rule == .properNameNotTokiponized {
            return
        }
        violations.append(
            Violation(
                rule: rule,
                tokenIndices: tokens.map(\.index),
                message: message,
                correction: correction
            )
        )
    }
}

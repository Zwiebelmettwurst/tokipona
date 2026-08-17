/// Ein konkreter Regelverstoß mit Textstelle und deutscher Begründung.
///
/// Jede Regel zeigt auf ein Curriculum-Konzept (Plan, Abschnitt 4). Damit wird aus
/// jedem Fehler automatisch eine Lernempfehlung, ohne zweite Zuordnungstabelle.
public struct Violation: Sendable, Hashable {

    public enum Rule: String, Sendable, Hashable, CaseIterable {
        case emptyUtterance
        case unknownWord
        case properNameNotTokiponized
        case properNameAsHead
        case liAfterMiSina
        case missingLi
        case missingSubject
        case missingPredicate
        case repeatedParticle
        case particleInPhrasePosition
        case objectWithoutNoun
        case piWithSingleWord
        case piWithoutContent
        case emptyContext
        case contextWithoutClause
        case vocativeWithoutContent
        case unexpectedToken

        /// Konzept aus dem Curriculum, das dieser Fehler betrifft.
        ///
        /// Bewusst ohne Stufennummer: Die Reihenfolge der Stufen kann sich
        /// ändern, die Identität des Konzepts nicht.
        public var conceptID: String? {
            switch self {
            case .liAfterMiSina: return "c_mi_sina"
            case .missingLi, .missingSubject, .missingPredicate, .repeatedParticle: return "c_li"
            case .objectWithoutNoun: return "c_e_objekt"
            case .piWithSingleWord, .piWithoutContent: return "c_pi"
            case .vocativeWithoutContent: return "c_o"
            case .emptyContext, .contextWithoutClause: return "c_la"
            case .properNameNotTokiponized, .properNameAsHead: return "c_namen"
            case .unknownWord, .particleInPhrasePosition, .unexpectedToken, .emptyUtterance: return nil
            }
        }
    }

    public let rule: Rule
    /// Betroffene Tokenindizes; leer, wenn sich der Fehler auf die ganze Äußerung bezieht.
    public let tokenIndices: [Int]
    /// Anzeigefertige Begründung in einem Satz.
    public let message: String
    /// Vorschlag, wie es richtig hieße — falls eindeutig ableitbar.
    public let correction: String?

    public init(rule: Rule, tokenIndices: [Int], message: String, correction: String? = nil) {
        self.rule = rule
        self.tokenIndices = tokenIndices
        self.message = message
        self.correction = correction
    }
}

/// Fehlgeschlagene Analyse — für die `Result`-Schnittstelle des Parsers.
public struct ParseError: Sendable, Hashable, Error {
    public let violations: [Violation]
    public init(violations: [Violation]) { self.violations = violations }
}

/// Zerlegung eines Satzes in benannte Rollen — das „Satzröntgen“ aus dem Plan.
///
/// Dieselbe Ausgabe trägt drei Stellen der App: die Konzepterklärung, den
/// Übungstyp „Rollen zuordnen“ und die Rückmeldung nach einer Antwort.
public struct XRaySpan: Sendable, Hashable {
    public enum Role: String, Sendable, Hashable {
        case context = "Kontext"
        case contextMarker = "la"
        case subject = "Subjekt"
        case predicateMarker = "Prädikat"
        case preverb = "Präverb"
        case predicate = "Verb"
        case objectMarker = "Objekt"
        case object = "Nomen"
        case preposition = "Präposition"
        case complement = "Ergänzung"
        case vocative = "Anrede"
        case directive = "Befehl"
        case particle = "Partikel"
    }

    public let text: String
    public let role: Role
    public let tokenIndices: [Int]

    public init(text: String, role: Role, tokenIndices: [Int]) {
        self.text = text
        self.role = role
        self.tokenIndices = tokenIndices
    }
}

extension Utterance {

    /// Rollenzerlegung von links nach rechts.
    public func xray() -> [XRaySpan] {
        var spans: [XRaySpan] = []

        for context in contexts {
            switch context {
            case .phrase(let phrase):
                spans.append(span(phrase.tokens, .context))
            case .clause(let clause):
                spans.append(contentsOf: XRayBuilder.spans(for: clause, contextual: true))
            }
        }

        if let clause {
            spans.append(contentsOf: XRayBuilder.spans(for: clause, contextual: false))
        }

        for particle in finalParticles {
            spans.append(span([particle], .particle))
        }

        return spans
    }

    private func span(_ tokens: [Token], _ role: XRaySpan.Role) -> XRaySpan {
        XRaySpan(text: tokens.joinedText, role: role, tokenIndices: tokens.map(\.index))
    }
}

enum XRayBuilder {

    static func spans(for clause: Clause, contextual: Bool) -> [XRaySpan] {
        var spans: [XRaySpan] = []

        for subject in clause.subjects {
            spans.append(
                span(subject.tokens, clause.kind == .vocative || clause.kind == .imperative
                     ? .vocative
                     : (contextual ? .context : .subject))
            )
            if let embedded = subject.embedded {
                spans.append(contentsOf: embedded.utterance.xray())
            }
        }

        for predicate in clause.predicates {
            if let marker = predicate.marker {
                spans.append(
                    span([marker], marker.text == "o" ? .directive : .predicateMarker)
                )
            }
            for preverb in predicate.preverbs {
                spans.append(span([preverb.token], .preverb))
            }
            switch predicate.core {
            case .phrase(let phrase):
                spans.append(span(phrase.tokens, .predicate))
                if let embedded = phrase.embedded {
                    spans.append(contentsOf: embedded.utterance.xray())
                }
            case .prepositional(let prepositional):
                spans.append(span([prepositional.preposition], .predicate))
                if let object = prepositional.object {
                    spans.append(span(object.tokens, .complement))
                }
            case .missing:
                break
            }
            for object in predicate.objects {
                spans.append(span(object.tokens, .object))
                if let embedded = object.embedded {
                    spans.append(contentsOf: embedded.utterance.xray())
                }
            }
            for prepositional in predicate.prepositions {
                spans.append(span([prepositional.preposition], .preposition))
                if let object = prepositional.object {
                    spans.append(span(object.tokens, .complement))
                }
            }
        }

        return spans
    }

    private static func span(_ tokens: [Token], _ role: XRaySpan.Role) -> XRaySpan {
        XRaySpan(text: tokens.joinedText, role: role, tokenIndices: tokens.map(\.index))
    }
}

import Foundation

/// Zerlegt Eingabetext in ``Token``.
///
/// toki pona ist trivial zu tokenisieren — Wortgrenzen sind Leerzeichen. Die
/// Arbeit steckt in der Normalisierung: Satzzeichen entfernen, Großschreibung
/// als Eigennamensignal bewahren, Tippfehler vorschlagen.
public enum Tokenizer {

    private static let stripped: Set<Character> = [
        ".", ",", ";", "!", "?", "\"", "'", "„", "“", "»", "«",
        "(", ")", "[", "]", "…", "·", "-", "–", "—"
    ]

    private static let utteranceTerminators: Set<Character> = [".", "!", "?"]

    /// Teilt einen Text in einzelne Äußerungen.
    ///
    /// Der Doppelpunkt trennt *nicht*: `mi wile e ni: sina kama.` ist ein Satz.
    public static func splitUtterances(_ input: String) -> [String] {
        var utterances: [String] = []
        var current = ""
        for character in input {
            current.append(character)
            if utteranceTerminators.contains(character) {
                let trimmed = current.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty { utterances.append(trimmed) }
                current = ""
            }
        }
        let rest = current.trimmingCharacters(in: .whitespacesAndNewlines)
        if !rest.isEmpty { utterances.append(rest) }
        return utterances
    }

    /// Zerlegt eine einzelne Äußerung.
    public static func tokenize(_ input: String) -> [Token] {
        var tokens: [Token] = []
        var raw = ""
        var rawStart = 0

        func flush() {
            defer { raw = "" }
            guard !raw.isEmpty else { return }
            var body = raw
            var colon = false
            while let last = body.last, last == ":" {
                colon = true
                body.removeLast()
            }
            body = String(body.filter { !stripped.contains($0) })
            guard !body.isEmpty else { return }
            tokens.append(
                classify(body, index: tokens.count, offset: rawStart, colon: colon)
            )
        }

        for (position, character) in input.enumerated() {
            if character.isWhitespace {
                flush()
            } else {
                if raw.isEmpty { rawStart = position }
                raw.append(character)
            }
        }
        flush()
        return tokens
    }

    private static func classify(
        _ body: String,
        index: Int,
        offset: Int,
        colon: Bool
    ) -> Token {
        let lower = body.lowercased()
        let isCapitalized = body.first?.isUppercase ?? false

        let classification: Token.Classification
        if isCapitalized {
            // Großschreibung ist in toki pona ausschließlich Eigennamensignal —
            // auch dann, wenn zufällig ein Lexikonwort dasteht (`jan Pona`).
            if let problem = Phonotactics.check(lower) {
                classification = .malformedName(problem)
            } else {
                classification = .properName
            }
        } else if let word = Lexicon.word(lower) {
            classification = .known(word)
        } else {
            classification = .unknown(suggestion: suggestion(for: lower))
        }

        return Token(
            original: body,
            text: lower,
            index: index,
            offset: offset,
            followedByColon: colon,
            classification: classification
        )
    }

    /// Nächstes Lexikonwort mit Editierdistanz 1.
    ///
    /// Distanz 2 wäre bei 137 kurzen Wörtern zu großzügig — `mi` läge dann neben
    /// einem Dutzend anderer Wörter.
    static func suggestion(for text: String) -> String? {
        var best: String?
        for candidate in Lexicon.allSpellings {
            if abs(candidate.count - text.count) > 1 { continue }
            if editDistance(text, candidate) == 1 {
                if let current = best, current.count <= candidate.count { continue }
                best = candidate
            }
        }
        return best
    }

    /// Levenshtein-Distanz, abgebrochen sobald sie 1 überschreitet.
    static func editDistance(_ a: String, _ b: String) -> Int {
        let source = Array(a)
        let target = Array(b)
        if source.isEmpty { return target.count }
        if target.isEmpty { return source.count }

        var previous = Array(0...target.count)
        var current = [Int](repeating: 0, count: target.count + 1)

        for i in 1...source.count {
            current[0] = i
            for j in 1...target.count {
                let cost = source[i - 1] == target[j - 1] ? 0 : 1
                current[j] = Swift.min(
                    previous[j] + 1,
                    current[j - 1] + 1,
                    previous[j - 1] + cost
                )
            }
            previous = current
        }
        return previous[target.count]
    }
}

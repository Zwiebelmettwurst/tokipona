/// Prüft, ob eine Zeichenkette den Lautregeln von toki pona folgt.
///
/// Gebraucht wird das für Eigennamen: „jan Sonja“ ist zulässig, „jan Claude“
/// nicht — der Name müsste tokiponisiert werden. Die Regeln:
///
/// - nur die 14 Buchstaben `a e i j k l m n o p s t u w`
/// - Silbenbau (K)V(n); nur die erste Silbe darf vokalisch beginnen
/// - verboten: `ji`, `ti`, `wo`, `wu`, `nn`, `nm`
public enum Phonotactics {

    public static let vowels: Set<Character> = ["a", "e", "i", "o", "u"]
    public static let consonants: Set<Character> = ["j", "k", "l", "m", "n", "p", "s", "t", "w"]

    /// Warum eine Zeichenkette nicht toki pona sein kann.
    public enum Problem: Sendable, Hashable {
        case emptyString
        case foreignLetter(Character)
        case forbiddenSyllable(String)
        case missingVowel
        case danglingConsonant

        /// Deutsche Begründung, direkt anzeigbar.
        public var message: String {
            switch self {
            case .emptyString:
                return "Leere Zeichenkette."
            case .foreignLetter(let c):
                return "„\(c)“ gehört nicht zu den 14 Buchstaben von toki pona."
            case .forbiddenSyllable(let s):
                return "Die Silbe „\(s)“ ist in toki pona nicht erlaubt."
            case .missingVowel:
                return "Jede Silbe braucht einen Vokal."
            case .danglingConsonant:
                return "Nach dem letzten Vokal ist nur „n“ erlaubt."
            }
        }
    }

    /// Verbotene Silbenanfänge.
    private static let forbidden: Set<String> = ["ji", "ti", "wo", "wu"]

    /// Zerlegt in Silben und meldet den ersten Regelverstoß.
    public static func check(_ text: String) -> Problem? {
        let lower = text.lowercased()
        guard !lower.isEmpty else { return .emptyString }

        let chars = Array(lower)
        for c in chars where !vowels.contains(c) && !consonants.contains(c) {
            return .foreignLetter(c)
        }

        var i = 0
        var isFirstSyllable = true
        while i < chars.count {
            var syllable = ""

            // Anlaut: außer in der ersten Silbe verpflichtend. Ein „n“ kann hier
            // stehen (`so·na`); die Fälle `nn` und `nm` fängt die Auslautregel
            // weiter unten ab, bevor die nächste Silbe beginnt.
            if consonants.contains(chars[i]) {
                syllable.append(chars[i])
                i += 1
            } else if !isFirstSyllable {
                return .missingVowel
            }

            guard i < chars.count, vowels.contains(chars[i]) else {
                return syllable.isEmpty ? .missingVowel : .danglingConsonant
            }
            syllable.append(chars[i])
            i += 1

            if forbidden.contains(syllable) {
                return .forbiddenSyllable(syllable)
            }

            // Auslaut „n“ — aber nur, wenn danach kein Vokal folgt (dann gehört
            // das „n“ zur nächsten Silbe) und kein „n“/„m“ folgt.
            if i < chars.count, chars[i] == "n" {
                let next = i + 1 < chars.count ? chars[i + 1] : nil
                if let next, vowels.contains(next) {
                    // „n“ eröffnet die nächste Silbe.
                } else if let next, next == "n" || next == "m" {
                    return .forbiddenSyllable(String([chars[i], next]))
                } else {
                    syllable.append("n")
                    i += 1
                }
            }

            isFirstSyllable = false
        }

        return nil
    }

    /// Folgt die Zeichenkette den Lautregeln?
    public static func isWellFormed(_ text: String) -> Bool {
        check(text) == nil
    }
}

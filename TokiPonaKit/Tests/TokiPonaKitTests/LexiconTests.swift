import XCTest
@testable import TokiPonaKit

final class LexiconTests: XCTestCase {

    func testWordCounts() {
        XCTAssertEqual(Lexicon.pu.count, 120, "pu definiert genau 120 Wörter.")
        XCTAssertEqual(Lexicon.kuSuli.count, 17, "ku ordnet 17 Wörter als nimi ku suli ein.")
        XCTAssertEqual(Lexicon.all.count, 137)
    }

    func testNoDuplicateEntries() {
        let texts = Lexicon.all.map(\.text)
        XCTAssertEqual(Set(texts).count, texts.count, "Doppelte Einträge im Lexikon.")
    }

    func testEntriesAreAlphabeticalWithinBook() {
        XCTAssertEqual(Lexicon.pu.map(\.text), Lexicon.pu.map(\.text).sorted())
        XCTAssertEqual(Lexicon.kuSuli.map(\.text), Lexicon.kuSuli.map(\.text).sorted())
    }

    func testEveryWordHasAtLeastOneGloss() {
        for word in Lexicon.all {
            XCTAssertFalse(word.glosses.isEmpty, "„\(word.text)“ hat keine Bedeutung.")
            XCTAssertFalse(word.roles.isEmpty, "„\(word.text)“ hat keine Wortart.")
        }
    }

    func testAliIsAVariantOfAle() {
        XCTAssertEqual(Lexicon.word("ali")?.text, "ale")
        XCTAssertFalse(Lexicon.all.contains { $0.text == "ali" }, "„ali“ ist kein eigener Eintrag.")
    }

    func testStructuralParticlesAreTaggedAsParticles() {
        for particle in Lexicon.structuralParticles {
            let word = Lexicon.word(particle)
            XCTAssertNotNil(word, "„\(particle)“ fehlt im Lexikon.")
            XCTAssertTrue(word?.isParticle ?? false)
        }
    }

    func testPrepositionsAndPreverbsAreTaggedConsistently() {
        for preposition in Lexicon.prepositions {
            XCTAssertTrue(
                Lexicon.word(preposition)?.isPreposition ?? false,
                "„\(preposition)“ ist nicht als Präposition markiert."
            )
        }
        for preverb in Lexicon.preverbs {
            XCTAssertTrue(
                Lexicon.word(preverb)?.isPreverb ?? false,
                "„\(preverb)“ ist nicht als Präverb markiert."
            )
        }
    }

    func testEveryWordIsPhonotacticallyValidExceptTheHesitationSound() {
        for word in Lexicon.all where word.text != "n" {
            XCTAssertTrue(
                Phonotactics.isWellFormed(word.text),
                "„\(word.text)“ verletzt die eigenen Lautregeln."
            )
        }
    }
}

final class PhonotacticsTests: XCTestCase {

    func testAcceptsWellFormedNames() {
        for name in ["sonja", "tosi", "ken", "kalu", "anpa", "kijetesantakalu", "olin", "mun"] {
            XCTAssertNil(Phonotactics.check(name), "„\(name)“ sollte zulässig sein.")
        }
    }

    func testRejectsForeignLetters() {
        guard case .foreignLetter(let character)? = Phonotactics.check("claude") else {
            return XCTFail("„claude“ enthält fremde Buchstaben.")
        }
        XCTAssertEqual(character, "c")
    }

    func testRejectsForbiddenSyllables() {
        for name in ["ti", "ji", "wu", "wo", "tina", "wute"] {
            XCTAssertNotNil(Phonotactics.check(name), "„\(name)“ enthält eine verbotene Silbe.")
        }
    }

    func testRejectsDoubleNasals() {
        XCTAssertNotNil(Phonotactics.check("sonna"))
        XCTAssertNotNil(Phonotactics.check("anma"))
    }

    func testRejectsDanglingConsonants() {
        XCTAssertNotNil(Phonotactics.check("pok"))
        XCTAssertNotNil(Phonotactics.check("tomos"))
    }

    func testRequiresConsonantOrVowelStructure() {
        XCTAssertNotNil(Phonotactics.check(""))
        XCTAssertNil(Phonotactics.check("aselo"))
    }
}

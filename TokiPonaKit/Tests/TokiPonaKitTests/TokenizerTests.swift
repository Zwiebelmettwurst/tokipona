import XCTest
@testable import TokiPonaKit

final class TokenizerTests: XCTestCase {

    func testStripsPunctuationAndLowercases() {
        let tokens = Tokenizer.tokenize("Mi pona!")
        XCTAssertEqual(tokens.map(\.text), ["mi", "pona"])
        XCTAssertEqual(tokens[0].original, "Mi")
    }

    func testKeepsColonAsClauseSignal() {
        let tokens = Tokenizer.tokenize("mi wile e ni: sina kama.")
        XCTAssertEqual(tokens.map(\.text), ["mi", "wile", "e", "ni", "sina", "kama"])
        XCTAssertTrue(tokens[3].followedByColon)
        XCTAssertFalse(tokens[0].followedByColon)
    }

    func testRecordsTokenOffsets() {
        let tokens = Tokenizer.tokenize("mi lukin e sina.")
        XCTAssertEqual(tokens.map(\.offset), [0, 3, 9, 11])
        XCTAssertEqual(tokens.map(\.index), [0, 1, 2, 3])
    }

    func testCapitalizedWordsBecomeProperNames() {
        let tokens = Tokenizer.tokenize("jan Sonja li pona.")
        guard case .properName = tokens[1].classification else {
            return XCTFail("„Sonja“ ist ein Eigenname.")
        }
        // Auch ein großgeschriebenes Lexikonwort ist ein Name — `jan Pona`.
        let named = Tokenizer.tokenize("jan Pona")
        guard case .properName = named[1].classification else {
            return XCTFail("Großschreibung markiert in toki pona ausschließlich Namen.")
        }
    }

    func testMalformedNamesCarryTheirReason() {
        let tokens = Tokenizer.tokenize("jan Claude")
        guard case .malformedName(let problem) = tokens[1].classification else {
            return XCTFail("„Claude“ verletzt die Lautregeln.")
        }
        XCTAssertEqual(problem, .foreignLetter("c"))
    }

    func testSuggestsNearestWordForTypos() {
        XCTAssertEqual(Tokenizer.suggestion(for: "mokku"), "moku")
        XCTAssertEqual(Tokenizer.suggestion(for: "ponaa"), "pona")
        XCTAssertNil(Tokenizer.suggestion(for: "xyzzyx"), "Zu weit weg für einen Vorschlag.")
    }

    func testEditDistance() {
        XCTAssertEqual(Tokenizer.editDistance("moku", "moku"), 0)
        XCTAssertEqual(Tokenizer.editDistance("moku", "mokku"), 1)
        XCTAssertEqual(Tokenizer.editDistance("moku", "toki"), 2)
    }

    func testSplitsUtterancesOnTerminatorsOnly() {
        let utterances = Tokenizer.splitUtterances("mi pona. sina seme? o kama! mi wile e ni: sina kama.")
        XCTAssertEqual(utterances.count, 4)
        XCTAssertEqual(utterances.last, "mi wile e ni: sina kama.")
    }

    func testHandlesEmptyAndWhitespaceInput() {
        XCTAssertTrue(Tokenizer.tokenize("").isEmpty)
        XCTAssertTrue(Tokenizer.tokenize("   \n ").isEmpty)
        XCTAssertTrue(Tokenizer.splitUtterances("").isEmpty)
    }
}

final class XRayTests: XCTestCase {

    func testSentenceIsBrokenIntoRoles() throws {
        let result = Parser().parse("jan suli li pana e lipu tawa mi.")
        let spans = try XCTUnwrap(result.utterance).xray()

        XCTAssertEqual(
            spans.map(\.role),
            [.subject, .predicateMarker, .predicate, .object, .preposition, .complement]
        )
        XCTAssertEqual(
            spans.map(\.text),
            ["jan suli", "li", "pana", "lipu", "tawa", "mi"]
        )
    }

    func testContextAndDirectiveAreLabelled() throws {
        let context = try XCTUnwrap(Parser().parse("tenpo pini la mi lape.").utterance).xray()
        XCTAssertEqual(context.first?.role, .context)
        XCTAssertEqual(context.first?.text, "tenpo pini")

        let directive = try XCTUnwrap(Parser().parse("jan Sonja o kama!").utterance).xray()
        XCTAssertEqual(directive.map(\.role), [.vocative, .directive, .predicate])
    }
}

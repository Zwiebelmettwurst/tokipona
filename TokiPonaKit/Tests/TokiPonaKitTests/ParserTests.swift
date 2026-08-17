import XCTest
@testable import TokiPonaKit

final class ParserGoldenTests: XCTestCase {

    private let parser = Parser()

    func testEveryGoldenSentenceParsesWithoutViolation() {
        for entry in GoldenCorpus.valid {
            let result = parser.parse(entry.sentence)
            XCTAssertTrue(
                result.isValid,
                """
                Stufe \(entry.stage): „\(entry.sentence)“ (\(entry.gloss)) \
                sollte fehlerfrei sein, meldet aber \
                \(result.violations.map { "\($0.rule.rawValue): \($0.message)" }.joined(separator: " | "))
                """
            )
            XCTAssertNotNil(result.utterance, "„\(entry.sentence)“ liefert keinen Baum.")
        }
    }

    func testGoldenCorpusCoversEveryStage() {
        let stages = Set(GoldenCorpus.valid.map(\.stage))
        XCTAssertEqual(stages, Set(1...12), "Jede Curriculumstufe braucht Prüfsätze.")
    }

    func testSubjectAndPredicateAreIdentified() throws {
        let result = parser.parse("jan suli li pana e lipu tawa mi.")
        let clause = try XCTUnwrap(result.utterance?.clause)

        XCTAssertEqual(clause.kind, .declarative)
        XCTAssertEqual(clause.subjects.count, 1)
        XCTAssertEqual(clause.subjects[0].text, "jan suli")

        let predicate = try XCTUnwrap(clause.predicates.first)
        guard case .phrase(let core) = predicate.core else {
            return XCTFail("Erwartet wurde ein nominaler Prädikatskern.")
        }
        XCTAssertEqual(core.text, "pana")
        XCTAssertEqual(predicate.objects.map(\.text), ["lipu"])
        XCTAssertEqual(predicate.prepositions.count, 1)
        XCTAssertEqual(predicate.prepositions[0].preposition.text, "tawa")
        XCTAssertEqual(predicate.prepositions[0].object?.text, "mi")
    }

    func testLiIsDroppedAfterBarePronounButNotAfterModifiedOne() throws {
        let bare = parser.parse("mi moku e kili.")
        XCTAssertTrue(bare.isValid)
        XCTAssertEqual(bare.utterance?.clause?.subjects.first?.text, "mi")

        let modified = parser.parse("mi mute li moku e kili.")
        XCTAssertTrue(modified.isValid, "„mi mute“ ist mehr als das bloße Pronomen und braucht li.")
        XCTAssertEqual(modified.utterance?.clause?.subjects.first?.text, "mi mute")
    }

    func testPiGroupsMultiWordModifier() throws {
        let result = parser.parse("jan pi toki pona li pona.")
        XCTAssertTrue(result.isValid)
        let subject = try XCTUnwrap(result.utterance?.clause?.subjects.first)
        XCTAssertEqual(subject.head.text, "jan")
        XCTAssertEqual(subject.modifiers.count, 1)
        guard case .group(let group) = subject.modifiers[0] else {
            return XCTFail("pi muss eine Gruppe bilden.")
        }
        XCTAssertEqual(group.map(\.text), ["toki", "pona"])
    }

    func testPreverbChainIsSeparatedFromCore() throws {
        let result = parser.parse("mi wile kama sona e toki pona.")
        XCTAssertTrue(result.isValid, result.violations.map(\.message).joined(separator: " | "))
        let predicate = try XCTUnwrap(result.utterance?.clause?.predicates.first)
        XCTAssertEqual(predicate.preverbs.map(\.token.text), ["wile", "kama"])
        guard case .phrase(let core) = predicate.core else {
            return XCTFail("Erwartet wurde ein nominaler Kern.")
        }
        XCTAssertEqual(core.text, "sona")
        XCTAssertEqual(predicate.objects.map(\.text), ["toki pona"])
    }

    func testPrepositionCanBePredicateWithoutObject() throws {
        let result = parser.parse("mi tawa.")
        XCTAssertTrue(result.isValid, "„mi tawa.“ ist ein vollständiger Satz.")
        let predicate = try XCTUnwrap(result.utterance?.clause?.predicates.first)
        guard case .prepositional(let phrase) = predicate.core else {
            return XCTFail("tawa steht hier als Prädikat.")
        }
        XCTAssertNil(phrase.object)
    }

    func testNegationAndPolarQuestionAreDistinguished() throws {
        let negated = parser.parse("mi moku ala.")
        XCTAssertTrue(negated.isValid)
        XCTAssertEqual(negated.utterance?.clause?.predicates.first?.isNegated, true)
        XCTAssertEqual(negated.utterance?.clause?.predicates.first?.isPolarQuestion, false)

        let question = parser.parse("sina moku ala moku?")
        XCTAssertTrue(question.isValid)
        XCTAssertEqual(question.utterance?.clause?.predicates.first?.isPolarQuestion, true)
        XCTAssertEqual(question.utterance?.isQuestion, true)

        let preverbQuestion = parser.parse("sina wile ala wile moku?")
        XCTAssertTrue(preverbQuestion.isValid)
        XCTAssertEqual(preverbQuestion.utterance?.isQuestion, true)
    }

    func testContextBeforeLaIsSeparated() throws {
        let result = parser.parse("tenpo pini la mi lon ma Tosi.")
        XCTAssertTrue(result.isValid, result.violations.map(\.message).joined(separator: " | "))
        let utterance = try XCTUnwrap(result.utterance)
        XCTAssertEqual(utterance.contexts.count, 1)
        guard case .phrase(let context) = utterance.contexts[0] else {
            return XCTFail("„tenpo pini“ ist eine Nominalphrase.")
        }
        XCTAssertEqual(context.text, "tenpo pini")
        XCTAssertEqual(utterance.clause?.subjects.first?.text, "mi")
    }

    func testEmbeddedClauseAfterNiColon() throws {
        let result = parser.parse("mi wile e ni: sina kama.")
        XCTAssertTrue(result.isValid, result.violations.map(\.message).joined(separator: " | "))
        let object = try XCTUnwrap(result.utterance?.clause?.predicates.first?.objects.first)
        XCTAssertEqual(object.head.text, "ni")
        let embedded = try XCTUnwrap(object.embedded?.utterance)
        XCTAssertEqual(embedded.clause?.subjects.first?.text, "sina")
        XCTAssertEqual(embedded.clause?.predicates.count, 1)
    }

    func testImperativeAndVocative() throws {
        let imperative = parser.parse("o kama pona!")
        XCTAssertTrue(imperative.isValid)
        XCTAssertEqual(imperative.utterance?.clause?.kind, .imperative)
        XCTAssertTrue(imperative.utterance?.clause?.subjects.isEmpty ?? false)

        let addressed = parser.parse("jan Sonja o toki!")
        XCTAssertTrue(addressed.isValid)
        XCTAssertEqual(addressed.utterance?.clause?.kind, .imperative)
        XCTAssertEqual(addressed.utterance?.clause?.subjects.first?.text, "jan sonja")

        let vocative = parser.parse("jan pona o!")
        XCTAssertTrue(vocative.isValid)
        XCTAssertEqual(vocative.utterance?.clause?.kind, .vocative)
    }

    func testBareNounPhraseIsAcceptedAsFragment() {
        let result = parser.parse("soweli suli.")
        XCTAssertTrue(result.isValid, "Eine Nominalphrase ist als Antwort zulässig.")
        XCTAssertEqual(result.utterance?.clause?.kind, .fragment)
    }

    func testMultipleUtterancesAreSplitOnTerminators() {
        let results = parser.parseAll("mi pona. sina seme? o kama!")
        XCTAssertEqual(results.count, 3)
        XCTAssertTrue(results.allSatisfy(\.isValid))
        XCTAssertEqual(results[1].utterance?.isQuestion, true)
    }

    func testKuSuliCanBeRejectedForPuOnlyCourse() {
        let strict = Parser(options: .pu)
        let result = strict.parse("mi lanpan e kili.")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.violations.first?.rule, .unknownWord)

        XCTAssertTrue(Parser().parse("mi lanpan e kili.").isValid)
    }
}

final class ViolationTests: XCTestCase {

    private let parser = Parser()

    func testEveryInvalidSentenceTriggersItsRule() {
        for entry in GoldenCorpus.invalid {
            let result = parser.parse(entry.sentence)
            XCTAssertTrue(
                result.violations.contains { $0.rule == entry.rule },
                """
                „\(entry.sentence)“ (\(entry.note)) sollte \(entry.rule.rawValue) melden, \
                gemeldet wurde: \(result.violations.map(\.rule.rawValue).joined(separator: ", "))
                """
            )
        }
    }

    func testLiAfterPronounIsReportedOnceWithCorrection() throws {
        let result = parser.parse("mi li moku.")
        XCTAssertEqual(result.violations.count, 1)
        let violation = try XCTUnwrap(result.violations.first)
        XCTAssertEqual(violation.rule, .liAfterMiSina)
        XCTAssertEqual(violation.correction, "mi moku")
        XCTAssertEqual(violation.tokenIndices, [1])
    }

    func testMissingLiSuggestsInsertionPoint() throws {
        let result = parser.parse("soweli suli moku e kili.")
        let violation = try XCTUnwrap(result.violations.first { $0.rule == .missingLi })
        XCTAssertEqual(violation.correction, "soweli suli li moku e kili")
    }

    func testUnknownWordSuggestsNearestSpelling() throws {
        let result = parser.parse("mi mokuu.")
        let violation = try XCTUnwrap(result.violations.first)
        XCTAssertEqual(violation.rule, .unknownWord)
        XCTAssertEqual(violation.correction, "moku")
    }

    func testEveryRuleMapsToAConceptOrIsDeliberatelyGeneral() {
        let general: Set<Violation.Rule> = [
            .unknownWord, .particleInPhrasePosition, .unexpectedToken, .emptyUtterance
        ]
        for rule in Violation.Rule.allCases {
            if general.contains(rule) {
                XCTAssertNil(rule.conceptID, "\(rule.rawValue) ist bewusst konzeptfrei.")
            } else {
                XCTAssertNotNil(rule.conceptID, "\(rule.rawValue) braucht ein Curriculum-Konzept.")
            }
        }
    }

    func testViolationsCarryTokenPositions() throws {
        let result = parser.parse("jan pi pona li lape.")
        let violation = try XCTUnwrap(result.violations.first { $0.rule == .piWithSingleWord })
        XCTAssertEqual(violation.tokenIndices, [1, 2])
    }
}

#!/usr/bin/env python3
"""Prüft die Grammatiklogik und die Korpora.

    python3 tools/verify_parser.py [pfad/zum/lipu-sona-klon]

Ohne Argument laufen Lexikon-, Einheiten- und Golden-Korpus-Prüfungen. Mit
Klonpfad zusätzlich die Messung gegen die Sätze des Kurses lipu sona pona.
"""
import re
import sys
import collections
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tokipona_check import (  # noqa: E402
    WORDS, PU, KU, VARIANTS, DEFAULT, PU_ONLY, ROOT,
    parse, tokenize, split_utterances, suggest, edit_distance,
    phono_check, is_toki_pona,
)

TESTS = ROOT / "Tests/TokiPonaKitTests"

failures = []


def check(condition, message):
    if not condition:
        failures.append(message)


corpus = (TESTS / "GoldenCorpus.swift").read_text()

valid_entries = re.findall(
    r'\.init\(stage:\s*(\d+),\s*sentence:\s*"([^"]+)",\s*\n?\s*gloss:\s*"([^"]*)"\)', corpus)
invalid_entries = re.findall(
    r'\.init\(sentence:\s*"([^"]+)",\s*rule:\s*\.(\w+),', corpus)

print(f"Lexikon: {len(PU)} pu + {len(KU)} ku suli = {len(WORDS)}")
print(f"Korpus:  {len(valid_entries)} gültige, {len(invalid_entries)} fehlerhafte Sätze\n")

check(len(PU) == 120, f"pu-Wortzahl ist {len(PU)}, erwartet 120")
check(len(KU) == 17, f"ku-suli-Wortzahl ist {len(KU)}, erwartet 17")
check(PU == sorted(PU), "pu-Liste ist nicht alphabetisch")
check(KU == sorted(KU), "ku-suli-Liste ist nicht alphabetisch")
for text in WORDS:
    if text != "n":
        check(phono_check(text) is None, f"Lexikonwort verletzt Lautregeln: {text}")

stages = set()
for stage, sentence, gloss in valid_entries:
    stages.add(int(stage))
    _, violations, _ = parse(sentence)
    check(not violations,
          f"SOLL FEHLERFREI  {sentence!r} → {[v['rule'] for v in violations]}")
check(stages == set(range(1, 13)), f"Stufen unvollständig: {sorted(stages)}")

for sentence, rule in invalid_entries:
    _, violations, _ = parse(sentence)
    rules = [v["rule"] for v in violations]
    check(rule in rules, f"SOLL {rule:26} {sentence!r} → {rules}")

# Unit-Test-Erwartungen aus ParserTests.swift / TokenizerTests.swift
u, v, _ = parse("jan suli li pana e lipu tawa mi.")
check(not v and u.clause.subjects[0].text == "jan suli", "Subjekt falsch erkannt")
check(u.clause.predicates[0].core[1].text == "pana", "Prädikatskern falsch")
check([o.text for o in u.clause.predicates[0].objects] == ["lipu"], "Objekt falsch")
check(u.clause.predicates[0].prepositions[0][1].text == "mi", "Präpositionalergänzung falsch")

u, v, _ = parse("mi mute li moku e kili.")
check(not v and u.clause.subjects[0].text == "mi mute", "„mi mute“ als Subjekt falsch")

u, v, _ = parse("jan pi toki pona li pona.")
check(u.clause.subjects[0].modifiers[0][0] == "group"
      and [t.text for t in u.clause.subjects[0].modifiers[0][1]] == ["toki", "pona"],
      "pi-Gruppe falsch")

u, v, _ = parse("mi wile kama sona e toki pona.")
check(not v and [p[0].text for p in u.clause.predicates[0].preverbs] == ["wile", "kama"],
      f"Präverbkette falsch: {v}")
check(u.clause.predicates[0].core[1].text == "sona", "Kern nach Präverben falsch")

u, v, _ = parse("mi tawa.")
check(not v and u.clause.predicates[0].core[0] == "prepositional"
      and u.clause.predicates[0].core[1][1] is None, "„mi tawa.“ falsch analysiert")

u, v, _ = parse("mi moku ala.")
check(not v and u.clause.predicates[0].isNegated
      and not u.clause.predicates[0].isPolarQuestion, "Verneinung falsch")

u, v, _ = parse("sina moku ala moku?")
check(not v and u.clause.predicates[0].isPolarQuestion and u.isQuestion,
      "Entscheidungsfrage falsch")

u, v, _ = parse("sina wile ala wile moku?")
check(not v and u.isQuestion, "Präverb-Entscheidungsfrage falsch")

u, v, _ = parse("tenpo pini la mi lon ma Tosi.")
check(not v and len(u.contexts) == 1 and u.contexts[0][0] == "phrase"
      and u.contexts[0][1].text == "tenpo pini", "Kontext vor la falsch")

u, v, _ = parse("mi wile e ni: sina kama.")
obj = u.clause.predicates[0].objects[0]
check(not v and obj.head.text == "ni" and obj.embedded is not None
      and obj.embedded.clause.subjects[0].text == "sina", "Eingebetteter Satz falsch")

u, v, _ = parse("o kama pona!")
check(not v and u.clause.kind == "imperative" and not u.clause.subjects, "Befehl falsch")

u, v, _ = parse("jan Sonja o toki!")
check(not v and u.clause.kind == "imperative"
      and u.clause.subjects[0].text == "jan sonja", "Anrede + Befehl falsch")

u, v, _ = parse("tomo tawa mi li pona.")
check(not v and u.clause.subjects[0].text == "tomo tawa mi",
      f"Präposition als Beifügung im Subjekt: {v}")

u, v, _ = parse("ona li toki e ijo lon.")
check(not v and u.clause.predicates[0].objects[0].text == "ijo lon"
      and not u.clause.predicates[0].prepositions,
      f"Präposition ohne Ergänzung: {v}")

u, v, _ = parse("ona li pona mute anu ike mute.")
check(not v and len(u.clause.predicates) == 2
      and [p.marker.text for p in u.clause.predicates] == ["li", "anu"],
      f"anu-Verkettung: {v}")

u, v, _ = parse("ona li sona ala sona e toki pona?")
check(not v and not u.clause.predicates[0].preverbs
      and u.clause.predicates[0].isPolarQuestion
      and [o.text for o in u.clause.predicates[0].objects] == ["toki pona"],
      f"X ala X am Hauptverb: {v}")

u, v, _ = parse("jan pona o!")
check(not v and u.clause.kind == "vocative", "Reine Anrede falsch")

u, v, _ = parse("soweli suli.")
check(not v and u.clause.kind == "fragment", "Nominalphrase als Fragment falsch")

results = [parse(s) for s in split_utterances("mi pona. sina seme? o kama!")]
check(len(results) == 3 and all(not r[1] for r in results), "Satztrennung falsch")
check(results[1][0].isQuestion, "seme-Frage nicht erkannt")

u, v, _ = parse("mi lanpan e kili.", PU_ONLY)
check([x["rule"] for x in v] == ["unknownWord"], f"pu-Modus: ku-suli nicht gemeldet ({v})")
check(not parse("mi lanpan e kili.")[1], "ku suli sollte im Standardmodus zulässig sein")

_, v, _ = parse("mi li moku.")
check(len(v) == 1 and v[0]["rule"] == "liAfterMiSina"
      and v[0]["correction"] == "mi moku" and v[0]["tokens"] == [1],
      f"liAfterMiSina-Meldung falsch: {v}")

_, v, _ = parse("soweli suli moku e kili.")
match = [x for x in v if x["rule"] == "missingLi"]
check(match and match[0]["correction"] == "soweli suli li moku e kili",
      f"missingLi-Vorschlag falsch: {v}")

_, v, _ = parse("mi mokuu.")
check(v and v[0]["rule"] == "unknownWord" and v[0]["correction"] == "moku",
      f"Tippfehlervorschlag falsch: {v}")

_, v, _ = parse("jan pi pona li lape.")
match = [x for x in v if x["rule"] == "piWithSingleWord"]
check(match and match[0]["tokens"] == [1, 2], f"pi-Meldung ohne Position: {v}")

tokens = tokenize("mi wile e ni: sina kama.")
check([t.text for t in tokens] == ["mi", "wile", "e", "ni", "sina", "kama"], "Tokenliste falsch")
check(tokens[3].followedByColon and not tokens[0].followedByColon, "Doppelpunkt falsch erfasst")
check([t.offset for t in tokenize("mi lukin e sina.")] == [0, 3, 9, 11], "Offsets falsch")
check(tokenize("jan Pona")[1].kind == "properName", "Großschreibung nicht als Name erkannt")
check(tokenize("jan Claude")[1].problem == ("foreignLetter", "c"), "Fremdbuchstabe nicht erkannt")
check(suggest("mokku") == "moku" and suggest("ponaa") == "pona" and suggest("xyzzyx") is None,
      "Vorschläge falsch")
check(edit_distance("moku", "toki") == 2, "Editierdistanz falsch")
check(len(split_utterances("mi pona. sina seme? o kama! mi wile e ni: sina kama.")) == 4,
      "Äußerungstrennung falsch")
check(not tokenize("") and not tokenize("   \n "), "Leereingabe falsch")

for name in ["sonja", "tosi", "ken", "kalu", "anpa", "kijetesantakalu", "olin", "mun", "aselo"]:
    check(phono_check(name) is None, f"„{name}“ sollte lautgesetzlich zulässig sein")
for name in ["ti", "ji", "wu", "wo", "tina", "wute", "sonna", "anma", "pok", "tomos", ""]:
    check(phono_check(name) is not None, f"„{name}“ sollte abgelehnt werden")

# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# Messung gegen fremdes Material: die Sätze des Kurses lipu sona pona
# --------------------------------------------------------------------------

if len(sys.argv) > 1:
    pages = Path(sys.argv[1]) / "pages" / "de"

    def artifact(sentence):
        """Schema-Platzhalter, Alternativlisten und Auslassungen sind keine Sätze."""
        return ("[" in sentence or "/" in sentence or "(" in sentence
                or sentence.endswith("la.") or sentence.rstrip(".").endswith(":"))

    seen, course = set(), []
    for path in sorted(pages.glob("*.md")):
        for raw in path.read_text().split("\n"):
            line = raw.strip()
            if not line.startswith(">"):
                continue
            line = line.lstrip("> ").lstrip("*").strip().split("--")[0].strip().strip("*_`")
            if not is_toki_pona(line):
                continue
            for utterance in split_utterances(line):
                if is_toki_pona(utterance) and utterance not in seen and not artifact(utterance):
                    seen.add(utterance)
                    course.append((path.name, utterance))

    broken = collections.defaultdict(list)
    for source, sentence in course:
        for violation in parse(sentence)[1]:
            broken[violation["rule"]].append((source, sentence))
    bad = {s for entries in broken.values() for _, s in entries}
    print(f"Kurs:    {len(course) - len(bad)}/{len(course)} Sätze fehlerfrei")
    for rule, entries in sorted(broken.items(), key=lambda kv: -len(kv[1])):
        failures.append(f"KURS {rule}: " + " | ".join(f"[{f}] {s}" for f, s in entries[:5]))

if failures:
    print(f"\n✗ {len(failures)} Abweichung(en):\n")
    for failure in failures:
        print("  " + failure)
    sys.exit(1)

print("✓ alle Prüfungen bestanden")

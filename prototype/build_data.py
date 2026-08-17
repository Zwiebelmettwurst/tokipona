#!/usr/bin/env python3
"""Erzeugt die Datendatei des Prototyps aus Lexikon, Import und Korpus.

    python3 prototype/build_data.py [pfad/zum/lipu-sona-klon]

Ausgabe: prototype/data.js — Lexikon mit deutschen Lesarten, die importierten
Kursaufgaben und die Prüfkorpora für den Node-Test des JS-Parsers.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from tokipona_check import WORDS, VARIANTS, split_utterances, is_toki_pona  # noqa: E402

LESSON_TITLES_EN = {
    1: "Simple sentences", 2: "Modifiers", 3: "Verbs and objects",
    4: "More vocabulary", 5: "This and that", 6: "Prepositions and places",
    7: "Interjections, questions, commands, names", 8: "Colours", 9: "pi and la",
    10: "Preverbs and time", 11: "Numbers", 12: "The rest of pu",
    13: "nimi ku suli",
}

LESSON_NOTES_EN = {
    1: ("After <b>mi</b> and <b>sina</b> alone there is no <b>li</b>. "
        "With every other subject there is: <i>ona li pona.</i>"),
    2: ("The modifier goes <b>after</b> the head word: "
        "<i>jan pona</i> is a good person; <i>pona jan</i> does not exist."),
    3: ("<b>e</b> announces the object: <i>mi lukin e sina.</i> "
        "Without <b>e</b> there is no object."),
    4: "More words, same building blocks. Keep an eye on <b>li</b> and <b>e</b>.",
    5: ("<b>ni</b> points at something: <i>ni li pona.</i> "
        "<b>en</b> joins two subjects: <i>mi en sina li pona.</i>"),
    6: ("Prepositions can be the predicate themselves: <i>mi lon tomo.</i> "
        "And they can modify: <i>tomo tawa mi</i> is a car."),
    7: ("<b>o</b> is address and command, <b>seme</b> asks for something, "
        "and <b>X ala X</b> is the yes-no question."),
    8: "Colour words are modifiers like any other: <i>kili loje</i>.",
    9: ("<b>pi</b> regroups modifiers of two or more words: <i>jan pi toki pona</i>. "
        "Never before a single word. <b>la</b> puts the context up front."),
    10: ("Preverbs go before the verb: <i>mi wile moku.</i> "
         "Time is expressed with <b>tenpo … la</b>, not with endings."),
    11: "<b>wan tu mute ale</b> — and <b>nanpa</b> for ordinals.",
    12: "The last words from <i>pu</i>.",
    13: "The 17 <i>nimi ku suli</i> — widespread, but not in the first book.",
}

LESSON_TITLES = {
    1: "Einfache Sätze", 2: "Beifügungen", 3: "Verben und Objekte",
    4: "Mehr Wortschatz", 5: "Dies und das", 6: "Präpositionen und Orte",
    7: "Ausrufe, Fragen, Befehle, Namen", 8: "Farben", 9: "pi und la",
    10: "Präverben und Zeit", 11: "Zahlen", 12: "Der Rest von pu",
    13: "nimi ku suli",
}

# Was die Lektion neu erklärt — eigenständig formuliert, nicht übernommen.
LESSON_NOTES = {
    1: ("Nach <b>mi</b> und <b>sina</b> allein steht kein <b>li</b>. "
        "Bei allen anderen Subjekten steht es: <i>ona li pona.</i>"),
    2: ("Die Beifügung steht <b>hinter</b> dem Kopfwort: "
        "<i>jan pona</i> ist ein guter Mensch, <i>pona jan</i> gibt es nicht."),
    3: ("<b>e</b> kündigt das Objekt an: <i>mi lukin e sina.</i> "
        "Ohne <b>e</b> gibt es kein Objekt."),
    4: "Mehr Wörter, gleiche Bausteine. Achte weiter auf <b>li</b> und <b>e</b>.",
    5: ("<b>ni</b> zeigt auf etwas: <i>ni li pona.</i> "
        "<b>en</b> verbindet zwei Subjekte: <i>mi en sina li pona.</i>"),
    6: ("Präpositionen können selbst Prädikat sein: <i>mi lon tomo.</i> "
        "Und als Beifügung: <i>tomo tawa mi</i> ist ein Auto."),
    7: ("<b>o</b> ist Anrede und Befehl, <b>seme</b> fragt nach etwas, "
        "und <b>X ala X</b> ist die Ja-Nein-Frage."),
    8: "Farbwörter sind Beifügungen wie alle anderen: <i>kili loje</i>.",
    9: ("<b>pi</b> gruppiert mehrwortige Beifügungen um: <i>jan pi toki pona</i>. "
        "Vor einem einzelnen Wort steht es nie. <b>la</b> stellt den Kontext voran."),
    10: ("Präverben stehen vor dem Verb: <i>mi wile moku.</i> "
         "Zeit wird über <b>tenpo … la</b> ausgedrückt, nicht über Endungen."),
    11: "<b>wan tu mute ale</b> — und <b>nanpa</b> für Ordnungszahlen.",
    12: "Die letzten Wörter aus <i>pu</i>.",
    13: "Die 17 <i>nimi ku suli</i> — verbreitet, aber nicht im ersten Buch.",
}


TITLES = {"de": LESSON_TITLES, "en": LESSON_TITLES_EN}
NOTES = {"de": LESSON_NOTES, "en": LESSON_NOTES_EN}


def lessons_for(lang):
    """Lektionen einer Sprache aus dem Import."""
    imported = json.loads((ROOT / f"Content/lipu-sona-import-{lang}.json").read_text())
    out = []
    for lesson in imported["lessons"]:
        number = lesson["lesson"]
        items = [i for i in imported["items"] if i["lesson"] == number]
        if not items:
            continue
        out.append({
            "number": number,
            "title": TITLES[lang].get(number, lesson["title"]),
            "note": NOTES[lang].get(number, ""),
            "words": [w["word"] for w in lesson["words"]],
            "items": [
                {"id": i["id"], "direction": i["direction"], "tp": i["tp"],
                 "also": i["alsoAccepted"], "target": i["de"]}
                for i in items
            ],
        })
    return out, imported["attribution"]


def course_glosses(course: Path, lang: str):
    """Wortbedeutungen aus den Kursseiten einer Sprache."""
    pages = course / "pages" / lang
    found = {}
    for number in range(1, 14):
        page = pages / f"{number}.md"
        if not page.is_file():
            continue
        for word, gloss in re.findall(r"^\|\s*([a-z]+(?:/[a-z]+)?)\s*\|\s*([^|]+?)\s*\|",
                                      page.read_text(), re.M):
            key = word.split("/")[0]
            if key in ("wort", "word") or key not in WORDS:
                continue
            parts = [g.strip() for g in re.split(r"[,/]", gloss) if g.strip()]
            found.setdefault(key, parts[:4])
    return found


def main():
    course = Path(sys.argv[1] if len(sys.argv) > 1 else "/workspace/pona-la/lipu-sona")

    english = course_glosses(course, "en")
    lexicon = {
        word: {
            "book": data["book"],
            "roles": sorted(data["roles"]),
            # Deutsch stammt aus dem Swift-Lexikon, Englisch aus den Kursseiten.
            "glosses": {"de": data["glosses"], "en": english.get(word, data["glosses"])},
        }
        for word, data in WORDS.items()
    }

    languages = {}
    attribution = None
    for lang in ("de", "en"):
        lessons, attribution = lessons_for(lang)
        languages[lang] = {"lessons": lessons}

    # Prüfkorpora für den Node-Test
    golden = re.findall(
        r'\.init\(stage:\s*\d+,\s*sentence:\s*"([^"]+)"',
        (ROOT / "TokiPonaKit/Tests/TokiPonaKitTests/GoldenCorpus.swift").read_text())
    invalid = re.findall(
        r'\.init\(sentence:\s*"([^"]+)",\s*rule:\s*\.(\w+),',
        (ROOT / "TokiPonaKit/Tests/TokiPonaKitTests/GoldenCorpus.swift").read_text())

    def artifact(sentence):
        return ("[" in sentence or "/" in sentence or "(" in sentence
                or sentence.endswith("la.") or sentence.rstrip(".").endswith(":"))

    seen, external = set(), []
    pages = course / "pages" / "de"
    if pages.is_dir():
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
                        external.append(utterance)

    data = {
        "lexicon": lexicon,
        "variants": VARIANTS,
        "languages": languages,
        "attribution": attribution,
        "corpus": {"valid": golden, "invalid": [list(x) for x in invalid], "external": external},
    }

    out = ROOT / "prototype/data.js"
    out.write_text(
        "// Erzeugt von prototype/build_data.py — nicht von Hand ändern.\n"
        "const TOKIPONA_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
        "if (typeof module !== 'undefined') { module.exports = TOKIPONA_DATA; }\n"
    )
    missing = [w for w in WORDS if w not in english]
    print(f"{out.relative_to(ROOT)}: {len(lexicon)} Wörter, "
          + ", ".join(f"{lang}: {len(v['lessons'])} Lektionen/"
                      f"{sum(len(l['items']) for l in v['lessons'])} Aufgaben"
                      for lang, v in languages.items())
          + f", {len(golden)}+{len(invalid)}+{len(external)} Prüfsätze")
    if missing:
        print(f"  ohne englische Bedeutung: {' '.join(missing)}")


if __name__ == "__main__":
    main()

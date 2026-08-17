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


def main():
    course = Path(sys.argv[1] if len(sys.argv) > 1 else "/workspace/pona-la/lipu-sona")
    imported = json.loads((ROOT / "Content/lipu-sona-import.json").read_text())

    glosses = {word: data["glosses"] for word, data in WORDS.items()}
    lexicon = {
        word: {
            "book": data["book"],
            "roles": sorted(data["roles"]),
            "glosses": glosses[word],
        }
        for word, data in WORDS.items()
    }

    course_words = {}
    for lesson in imported["lessons"]:
        for entry in lesson["words"]:
            course_words.setdefault(entry["word"], lesson["lesson"])

    lessons = []
    for lesson in imported["lessons"]:
        number = lesson["lesson"]
        items = [i for i in imported["items"] if i["lesson"] == number]
        if not items:
            continue
        lessons.append({
            "number": number,
            "title": LESSON_TITLES.get(number, lesson["title"]),
            "note": LESSON_NOTES.get(number, ""),
            "words": [w["word"] for w in lesson["words"]],
            "items": [
                {"id": i["id"], "direction": i["direction"], "tp": i["tp"],
                 "also": i["alsoAccepted"], "de": i["de"]}
                for i in items
            ],
        })

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
        "lessons": lessons,
        "attribution": imported["attribution"],
        "corpus": {"valid": golden, "invalid": [list(x) for x in invalid], "external": external},
    }

    out = ROOT / "prototype/data.js"
    out.write_text(
        "// Erzeugt von prototype/build_data.py — nicht von Hand ändern.\n"
        "const TOKIPONA_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
        "if (typeof module !== 'undefined') { module.exports = TOKIPONA_DATA; }\n"
    )
    print(f"{out.relative_to(ROOT)}: {len(lexicon)} Wörter, {len(lessons)} Lektionen, "
          f"{sum(len(l['items']) for l in lessons)} Aufgaben, "
          f"{len(golden)}+{len(invalid)}+{len(external)} Prüfsätze")


if __name__ == "__main__":
    main()

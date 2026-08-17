#!/usr/bin/env python3
"""Importiert Wortschatz und Übungen aus dem Kurs *lipu sona pona* in das
Inhaltsschema der App (Plan, Abschnitt 10 und 12).

Quelle: https://github.com/pona-la/lipu-sona — MIT-Lizenz,
© 2020 /dev/urandom und Mitwirkende. Der Urhebervermerk wandert in die
Ausgabedatei und muss im Lizenzbildschirm der App erscheinen.

Aufruf:  python3 tools/import_lipu_sona.py <klon-verzeichnis> [sprache] [ausgabe.json]

Der Kurs liegt in mehreren Sprachen vor; die Struktur ist überall dieselbe,
nur die Abschnittsüberschrift der Übungen unterscheidet sich.

Jede toki-pona-Seite eines Aufgabenpaars wird beim Import geparst; was nicht
fehlerfrei durchläuft, landet in `rejected` statt stillschweigend im Kurs.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tokipona_check import Lexicon, parse, is_toki_pona, split_utterances  # noqa: E402

ATTRIBUTION = {
    "source": "lipu sona pona",
    "url": "https://lipu-sona.pona.la/de/",
    "repository": "https://github.com/pona-la/lipu-sona",
    "license": "MIT",
    "copyright": "© 2020 /dev/urandom und Mitwirkende",
    "note": "Übungssätze und Übersetzungen übernommen und bearbeitet; "
            "Erklärtexte der App sind eigenständig formuliert.",
}

# Überschrift des Übungsteils je Sprache.
EXERCISE_HEADING = {"de": "## Übungen", "en": "## Exercises", "eo": "## Ekzercoj",
                    "es": "## Ejercicios", "pl": "## Ćwiczenia", "pt": "## Exercícios",
                    "ru": "## Упражнения", "zh": "## 练习"}

# Stufe des App-Curriculums je Kursseite (Plan, Abschnitt 4).
STAGE_OF_LESSON = {1: 1, 2: 2, 3: 4, 4: 4, 5: 11, 6: 6, 7: 7, 8: 2,
                   9: 9, 10: 5, 11: 12, 12: 12, 13: 12}

CONCEPTS_OF_LESSON = {
    1: ["c_mi_sina", "c_li"],
    2: ["c_modifikator"],
    3: ["c_e_objekt"],
    4: ["c_e_objekt"],
    5: ["c_ni", "c_en"],
    6: ["c_praeposition"],
    7: ["c_frage", "c_o", "c_namen"],
    8: ["c_modifikator"],
    9: ["c_pi", "c_la"],
    10: ["c_praeverb", "c_la"],
    11: ["c_zahlen"],
    12: [],
    13: [],
}


def bullet_blocks(text):
    """Aufeinanderfolgende Aufzählungspunkte zu Blöcken bündeln."""
    blocks, current = [], []
    for line in text.split("\n"):
        stripped = line.strip().lstrip(">").strip()
        if stripped.startswith("* "):
            current.append(stripped[2:].strip())
        elif current:
            blocks.append(current)
            current = []
    if current:
        blocks.append(current)
    return blocks


def clean(item):
    item = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", item)     # Links entschärfen
    item = item.replace("**", "").replace("*", "").strip()
    return item


def variants(item):
    """`a / b / c` sind gleichwertige Lösungen."""
    return [v.strip() for v in item.split(" / ") if v.strip()]


def load_lesson_exercises(pages: Path, number: int, heading: str):
    text = (pages / f"{number}.md").read_text()
    if heading not in text:
        return []
    section = text.split(heading, 1)[1]
    section = section.split("%page-nav%")[0]
    return [[clean(i) for i in block] for block in bullet_blocks(section)]


def load_answers(pages: Path, number: int):
    text = (pages / "answers.md").read_text()
    marker = f'name="p{number}"'
    if marker not in text:
        return []
    section = text.split(marker, 1)[1]
    section = re.split(r'<h1><a name="p', section)[0]
    return [[clean(i) for i in block] for block in bullet_blocks(section)]


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "/workspace/pona-la/lipu-sona")
    lang = sys.argv[2] if len(sys.argv) > 2 else "de"
    out = Path(sys.argv[3] if len(sys.argv) > 3 else f"Content/lipu-sona-import-{lang}.json")
    pages = root / "pages" / lang
    if not pages.is_dir():
        sys.exit(f"Kursseiten nicht gefunden: {pages}")
    heading = EXERCISE_HEADING.get(lang)
    if not heading:
        sys.exit(f"Übungsüberschrift für „{lang}“ unbekannt: {sorted(EXERCISE_HEADING)}")

    lessons, items, rejected, mismatches = [], [], [], []

    for number in range(1, 14):
        page = (pages / f"{number}.md").read_text()
        title = page.split("\n")[0].replace("% ", "").split(" - ", 1)[-1]
        words = []
        for entry in re.findall(r"^\|\s*([a-z]+(?:/[a-z]+)?)\s*\|\s*([^|]+?)\s*\|", page, re.M):
            word, gloss = entry
            if word in ("wort", "word"):
                continue
            key = word.split("/")[0]
            if Lexicon.get(key):
                words.append({"word": key, "courseGloss": gloss.strip()})

        prompts = load_lesson_exercises(pages, number, heading)
        answers = load_answers(pages, number)
        if len(prompts) != len(answers):
            mismatches.append({"lesson": number, "prompts": len(prompts), "answers": len(answers)})

        count = 0
        for block_index, (prompt_block, answer_block) in enumerate(zip(prompts, answers)):
            if len(prompt_block) != len(answer_block):
                mismatches.append({"lesson": number, "block": block_index,
                                   "prompts": len(prompt_block), "answers": len(answer_block)})
                continue
            for prompt, answer in zip(prompt_block, answer_block):
                prompt_is_tp = is_toki_pona(prompt)
                answer_is_tp = is_toki_pona(answer)
                if prompt_is_tp == answer_is_tp:
                    rejected.append({"lesson": number, "reason": "Richtung unklar",
                                     "prompt": prompt, "answer": answer})
                    continue

                direction = "tp_de" if prompt_is_tp else "de_tp"
                tp_side = prompt if prompt_is_tp else answer
                de_side = answer if prompt_is_tp else prompt

                solutions, broken = [], []
                for candidate in variants(tp_side):
                    # Musterlösungen bestehen mitunter aus mehreren Sätzen.
                    violations = [v for utterance in split_utterances(candidate)
                                  for v in parse(utterance)[1]]
                    if violations:
                        broken.append({"sentence": candidate,
                                       "violations": sorted({v["rule"] for v in violations})})
                    else:
                        solutions.append(candidate)
                if not solutions:
                    rejected.append({"lesson": number, "reason": "keine gültige Lösung",
                                     "tp": tp_side, "details": broken})
                    continue

                items.append({
                    "id": f"lsp{number:02d}_{count:02d}",
                    "lesson": number,
                    "stage": STAGE_OF_LESSON[number],
                    "concepts": CONCEPTS_OF_LESSON[number],
                    "direction": direction,
                    "tp": solutions[0],
                    "alsoAccepted": solutions[1:],
                    "de": variants(de_side),
                    "rejectedVariants": broken,
                })
                count += 1

        lessons.append({"lesson": number, "title": title,
                        "stage": STAGE_OF_LESSON[number],
                        "concepts": CONCEPTS_OF_LESSON[number],
                        "words": words, "exercises": count})

    payload = {"attribution": ATTRIBUTION, "language": lang, "lessons": lessons,
               "items": items, "rejected": rejected, "mismatches": mismatches}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")

    print(f"[{lang}] {len(items)} Aufgaben aus {len(lessons)} Lektionen → {out}")
    print(f"  Richtung tp→de: {sum(1 for i in items if i['direction'] == 'tp_de')}")
    print(f"  Richtung de→tp: {sum(1 for i in items if i['direction'] == 'de_tp')}")
    print(f"  Mehrfachlösungen: {sum(1 for i in items if i['alsoAccepted'])}")
    print(f"  Wörter erfasst: {sum(len(l['words']) for l in lessons)}")
    if mismatches:
        print(f"  Blöcke ohne Gegenstück: {len(mismatches)}")
    if rejected:
        print(f"  abgewiesen: {len(rejected)}")
        for entry in rejected[:8]:
            print(f"    [Seite {entry['lesson']}] {entry['reason']}: "
                  f"{entry.get('tp') or entry.get('prompt')}")


if __name__ == "__main__":
    main()

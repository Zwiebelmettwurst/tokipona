#!/usr/bin/env python3
"""Zeilennaher Port von TokiPonaKit (Tokenizer + Parser) für die Werkzeuge.

Solange keine Swift-Toolchain zur Verfügung steht, prüft dieser Port die
Grammatiklogik und die Inhalte. Lexikon und Korpus werden aus den Swift-Quellen
gelesen, damit beide Fassungen nicht auseinanderlaufen können.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "TokiPonaKit"
SRC = ROOT / "Sources/TokiPonaKit"
TESTS = ROOT / "Tests/TokiPonaKitTests"

# --------------------------------------------------------------------------
# Lexicon, extracted from Lexicon.swift
# --------------------------------------------------------------------------

ENTRY = re.compile(r'^\s*([wk])\("([a-z]+)",\s*\[([^\]]*)\],\s*(.*?)\),?\s*$', re.M)

WORDS = {}   # text -> dict(book, roles)
PU, KU = [], []

for kind, text, roles, glosses in ENTRY.findall((SRC / "Lexicon.swift").read_text()):
    roleset = {r.strip().lstrip(".") for r in roles.split(",") if r.strip()}
    book = "pu" if kind == "w" else "kuSuli"
    WORDS[text] = {"book": book, "roles": roleset,
                   "glosses": re.findall(r'"([^"]*)"', glosses)}
    (PU if kind == "w" else KU).append(text)

VARIANTS = {"ali": "ale"}
PREPOSITIONS = {"lon", "tan", "tawa", "kepeken", "sama"}
EXT_PREPOSITIONS = {"poka", "sike"}
PREVERBS = {"wile", "ken", "kama", "awen", "sona", "lukin"}
EXT_PREVERBS = {"alasa", "open", "pini"}
STRUCTURAL = {"li", "e", "la", "pi", "o", "en", "anu", "a"}
BOUNDARY = {"li", "e", "la", "o", "en", "anu"}


def lookup(text):
    return WORDS.get(VARIANTS.get(text, text))


# --------------------------------------------------------------------------
# Phonotactics
# --------------------------------------------------------------------------

VOWELS = set("aeiou")
CONSONANTS = set("jklmnpstw")
FORBIDDEN = {"ji", "ti", "wo", "wu"}


def phono_check(text):
    lower = text.lower()
    if not lower:
        return ("emptyString", "")
    for c in lower:
        if c not in VOWELS and c not in CONSONANTS:
            return ("foreignLetter", c)
    chars = list(lower)
    i, first = 0, True
    while i < len(chars):
        syllable = ""
        if chars[i] in CONSONANTS:
            syllable += chars[i]
            i += 1
        elif not first:
            return ("missingVowel", "")
        if i >= len(chars) or chars[i] not in VOWELS:
            return ("missingVowel" if not syllable else "danglingConsonant", syllable)
        syllable += chars[i]
        i += 1
        if syllable in FORBIDDEN:
            return ("forbiddenSyllable", syllable)
        if i < len(chars) and chars[i] == "n":
            nxt = chars[i + 1] if i + 1 < len(chars) else None
            if nxt and nxt in VOWELS:
                pass
            elif nxt and nxt in ("n", "m"):
                return ("forbiddenSyllable", "n" + nxt)
            else:
                syllable += "n"
                i += 1
        first = False
    return None


# --------------------------------------------------------------------------
# Tokenizer
# --------------------------------------------------------------------------

STRIPPED = set('.,;!?"\'„“»«()[]…·-–—')


class Token:
    def __init__(self, original, index, offset, colon):
        self.original = original
        self.text = original.lower()
        self.index = index
        self.offset = offset
        self.followedByColon = colon
        self.word = None
        self.kind = None          # known | properName | malformedName | unknown
        self.suggestion = None
        self.problem = None

    def is_particle(self, p):
        return self.text == p and p in STRUCTURAL and self.word is not None

    @property
    def is_phrase_boundary(self):
        return self.word is not None and self.text in BOUNDARY

    @property
    def is_proper_name(self):
        return self.kind in ("properName", "malformedName")

    @property
    def can_head_phrase(self):
        if self.kind == "known":
            return "particle" not in self.word["roles"] or "content" in self.word["roles"]
        if self.is_proper_name:
            return False
        return True

    @property
    def can_modify(self):
        if self.kind == "known":
            return "particle" not in self.word["roles"] or "content" in self.word["roles"]
        return True

    def is_preposition(self, extended):
        return self.word is not None and (
            self.text in PREPOSITIONS or (extended and self.text in EXT_PREPOSITIONS))

    def is_preverb(self, extended):
        return self.word is not None and (
            self.text in PREVERBS or (extended and self.text in EXT_PREVERBS))

    def __repr__(self):
        return f"<{self.text}>"


def edit_distance(a, b):
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i] + [0] * len(b)
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
        prev = cur
    return prev[len(b)]


ALL_SPELLINGS = sorted(list(WORDS.keys()) + list(VARIANTS.keys()))


def suggest(text):
    best = None
    for candidate in ALL_SPELLINGS:
        if abs(len(candidate) - len(text)) > 1:
            continue
        if edit_distance(text, candidate) == 1:
            if best is not None and len(best) <= len(candidate):
                continue
            best = candidate
    return best


def tokenize(text):
    tokens, raw, start = [], "", 0

    def flush():
        nonlocal raw
        if not raw:
            return
        body, colon = raw, False
        while body.endswith(":"):
            colon = True
            body = body[:-1]
        body = "".join(c for c in body if c not in STRIPPED)
        raw = ""
        if not body:
            return
        token = Token(body, len(tokens), start, colon)
        if body[0].isupper():
            problem = phono_check(token.text)
            if problem:
                token.kind, token.problem = "malformedName", problem
            else:
                token.kind = "properName"
        elif lookup(token.text):
            token.kind, token.word = "known", lookup(token.text)
        else:
            token.kind, token.suggestion = "unknown", suggest(token.text)
        tokens.append(token)

    for position, character in enumerate(text):
        if character.isspace():
            flush()
        else:
            if not raw:
                start = position
            raw += character
    flush()
    return tokens


def split_utterances(text):
    out, cur = [], ""
    for c in text:
        cur += c
        if c in ".!?":
            if cur.strip():
                out.append(cur.strip())
            cur = ""
    if cur.strip():
        out.append(cur.strip())
    return out


# --------------------------------------------------------------------------
# Parser
# --------------------------------------------------------------------------

class NounPhrase:
    def __init__(self, head, modifiers, embedded=None):
        self.head, self.modifiers, self.embedded = head, modifiers, embedded

    @property
    def tokens(self):
        out = [self.head]
        for kind, payload in self.modifiers:
            out += payload if kind == "group" else [payload]
        return out

    @property
    def text(self):
        return " ".join(t.text for t in self.tokens)


class Predicate:
    def __init__(self, marker, preverbs, core, objects, preps, negated, polar):
        self.marker, self.preverbs, self.core = marker, preverbs, core
        self.objects, self.prepositions = objects, preps
        self.isNegated, self.isPolarQuestion = negated, polar


class Clause:
    def __init__(self, kind, subjects, predicates):
        self.kind, self.subjects, self.predicates = kind, subjects, predicates


class Utterance:
    def __init__(self, contexts, clause, finals, question):
        self.contexts, self.clause = contexts, clause
        self.finalParticles, self.isQuestion = finals, question


class Engine:
    def __init__(self, tokens, options):
        self.tokens = tokens
        self.options = options
        self.pos = 0
        self.limit = len(tokens)
        self.violations = []
        self.suppress = False

    # -- reporting
    def report(self, rule, tokens, message="", correction=None):
        if self.suppress and rule in ("unknownWord", "properNameNotTokiponized"):
            return
        self.violations.append({"rule": rule, "tokens": [t.index for t in tokens],
                                "message": message, "correction": correction})

    def run(self):
        if not self.tokens:
            self.report("emptyUtterance", [])
            return None
        self.report_lexical()

        start, end = 0, len(self.tokens)
        finals = []
        question = any(t.text == "seme" and t.word for t in self.tokens)

        if end - start > 1 and self.tokens[start].text == "taso" and self.tokens[start].word:
            start += 1

        changed = True
        while changed:
            changed = False
            if (end - start >= 3
                    and self.tokens[end - 2].text == "anu" and self.tokens[end - 2].word
                    and self.tokens[end - 1].text == "seme" and self.tokens[end - 1].word):
                question = True
                finals[0:0] = [self.tokens[end - 2], self.tokens[end - 1]]
                end -= 2
                changed = True
            while (end - start > 1 and self.tokens[end - 1].word
                   and self.tokens[end - 1].text in ("a", "kin")):
                finals.insert(0, self.tokens[end - 1])
                end -= 1
                changed = True

        if start >= end:
            return Utterance([], Clause("interjection", [], []), finals, question)

        if end - start == 1:
            word = self.tokens[start].word
            if word and "interjection" in word["roles"]:
                return Utterance([], Clause("interjection", [], []), finals, question)

        contexts = []
        segment = start
        while True:
            la = self.index_of_top_level("la", segment, end)
            if la is None:
                break
            if la == segment:
                self.report("emptyContext", [self.tokens[la]])
            else:
                clause = self.parse_clause(segment, la)
                if clause:
                    if clause.kind == "fragment" and len(clause.subjects) == 1:
                        contexts.append(("phrase", clause.subjects[0]))
                    else:
                        contexts.append(("clause", clause))
            segment = la + 1

        if segment >= end:
            self.report("contextWithoutClause", [self.tokens[end - 1]])
            return Utterance(contexts, None, finals, question)

        clause = self.parse_clause(segment, end)
        if clause and any(p.isPolarQuestion for p in clause.predicates):
            question = True
        return Utterance(contexts, clause, finals, question)

    def report_lexical(self):
        for token in self.tokens:
            if token.kind == "unknown":
                self.report("unknownWord", [token], correction=token.suggestion)
            elif token.kind == "malformedName":
                self.report("properNameNotTokiponized", [token])
            elif token.kind == "known":
                if token.word["book"] == "kuSuli" and not self.options["allowKuSuli"]:
                    self.report("unknownWord", [token])

    # -- clause
    def parse_clause(self, frm, to):
        if frm >= to:
            return None

        o_index = self.index_of_top_level("o", frm, to)
        if o_index is not None:
            return self.parse_directive(frm, o_index, to)

        li_index = self.index_of_top_level("li", frm, to)

        if li_index == frm:
            self.report("missingSubject", [self.tokens[li_index]])

        if li_index == frm + 1 and self.is_bare_pronoun(self.tokens[frm]):
            self.report("liAfterMiSina", [self.tokens[li_index]],
                        correction=self.tokens[frm].text + " " +
                        " ".join(t.text for t in self.tokens[frm + 2:to]))

        subjects, predicates = [], []

        if li_index is not None:
            if li_index > frm:
                self.pos, self.limit = frm, li_index
                subjects = self.parse_subject_chain()
                self.report_leftovers(li_index)
            self.pos, self.limit = li_index, to
            predicates = self.parse_predicate_chain()
        elif self.is_bare_pronoun(self.tokens[frm]):
            self.pos, self.limit = frm, min(frm + 1, to)
            subject = self.parse_noun_phrase()
            if subject:
                subjects = [subject]
            self.pos, self.limit = frm + 1, to
            if self.pos < to:
                predicates = [self.parse_predicate(None)]
                predicates += self.parse_predicate_chain()
        else:
            self.pos, self.limit = frm, to
            subjects = self.parse_subject_chain()
            if self.pos < to:
                if self.tokens[self.pos].is_particle("e"):
                    self.report("missingLi", [self.tokens[self.pos]],
                                correction=self.correction_with_li(frm, to))
                    self.pos = to
                    return Clause("declarative", subjects, [])
                self.report_leftovers(to)
            return Clause("fragment", subjects, [])

        return Clause("declarative", subjects, predicates)

    def parse_directive(self, frm, o_index, to):
        subjects = []
        if o_index > frm:
            self.pos, self.limit = frm, o_index
            subjects = self.parse_subject_chain()
            self.report_leftovers(o_index)

        marker = self.tokens[o_index]
        self.pos, self.limit = o_index + 1, to
        predicates = []
        if self.pos < to:
            predicates.append(self.parse_predicate(marker))
            predicates += self.parse_predicate_chain()

        if not subjects and not predicates:
            self.report("vocativeWithoutContent", [marker])

        return Clause("vocative" if not predicates else "imperative", subjects, predicates)

    def parse_subject_chain(self):
        phrases = []
        first = self.parse_noun_phrase(True)
        if not first:
            return phrases
        phrases.append(first)
        while self.pos < self.limit and (self.tokens[self.pos].is_particle("en")
                                         or self.tokens[self.pos].is_particle("anu")):
            self.pos += 1
            nxt = self.parse_noun_phrase(True)
            if not nxt:
                break
            phrases.append(nxt)
        return phrases

    def parse_predicate_chain(self):
        predicates = []
        while self.pos < self.limit and (self.tokens[self.pos].is_particle("li")
                                         or self.tokens[self.pos].is_particle("anu")):
            marker = self.tokens[self.pos]
            self.pos += 1
            if self.pos < self.limit and self.tokens[self.pos].is_particle("li"):
                self.report("repeatedParticle", [self.tokens[self.pos]])
                continue
            predicates.append(self.parse_predicate(marker))
        return predicates

    # -- predicate
    def parse_predicate(self, marker):
        preverbs, negated, polar = [], False, False

        while self.pos < self.limit and self.tokens[self.pos].is_preverb(self.options["extendedPreverbs"]):
            preverb = self.tokens[self.pos]
            if self.pos + 1 >= self.limit:
                break
            nxt = self.tokens[self.pos + 1]
            if nxt.is_phrase_boundary:
                break
            if nxt.text == "ala" and nxt.word:
                if self.pos + 2 < self.limit and self.tokens[self.pos + 2].text == preverb.text:
                    if (self.pos + 3 >= self.limit
                            or self.tokens[self.pos + 3].is_phrase_boundary):
                        break
                    polar = True
                    preverbs.append((preverb, False))
                    self.pos += 3
                    continue
                if self.pos + 2 < self.limit and not self.tokens[self.pos + 2].is_phrase_boundary:
                    preverbs.append((preverb, True))
                    negated = True
                    self.pos += 2
                    continue
                break
            preverbs.append((preverb, False))
            self.pos += 1

        core = ("missing", None)
        if self.pos < self.limit and self.tokens[self.pos].is_preposition(self.options["extendedPrepositions"]):
            core = ("prepositional", self.parse_prepositional_phrase(True))
        elif self.pos < self.limit and not self.tokens[self.pos].is_phrase_boundary:
            phrase = self.parse_noun_phrase()
            if phrase:
                core = ("phrase", phrase)
        else:
            self.report("missingPredicate", [marker] if marker else [])

        if core[0] == "phrase":
            mods = core[1].modifiers
            for offset, (kind, payload) in enumerate(mods):
                if kind != "simple" or payload.text != "ala" or not payload.word:
                    continue
                if (offset + 1 < len(mods) and mods[offset + 1][0] == "simple"
                        and mods[offset + 1][1].text == core[1].head.text):
                    polar = True
                else:
                    negated = True

        objects, preps = [], []
        while self.pos < self.limit:
            token = self.tokens[self.pos]
            if token.is_particle("e"):
                self.pos += 1
                if self.pos < self.limit and self.tokens[self.pos].is_particle("e"):
                    self.report("repeatedParticle", [self.tokens[self.pos]])
                    continue
                obj = self.parse_noun_phrase()
                if obj:
                    objects.append(obj)
                    while self.pos < self.limit and self.tokens[self.pos].is_particle("en"):
                        self.pos += 1
                        further = self.parse_noun_phrase()
                        if not further:
                            break
                        objects.append(further)
                else:
                    self.report("objectWithoutNoun", [token])
            elif token.is_preposition(self.options["extendedPrepositions"]):
                phrase = self.parse_prepositional_phrase(False)
                if phrase[1] is None:
                    if objects:
                        objects[-1].modifiers.append(("simple", token))
                    elif core[0] == "phrase":
                        core[1].modifiers.append(("simple", token))
                    else:
                        preps.append(phrase)
                else:
                    preps.append(phrase)
            else:
                break

        if self.pos < self.limit and not self.chains_predicate(self.tokens[self.pos]):
            self.report("unexpectedToken", [self.tokens[self.pos]])
            while self.pos < self.limit and not self.chains_predicate(self.tokens[self.pos]):
                self.pos += 1

        return Predicate(marker, preverbs, core, objects, preps, negated, polar)

    def chains_predicate(self, token):
        return token.is_particle("li") or token.is_particle("anu")

    def parse_prepositional_phrase(self, is_core):
        preposition = self.tokens[self.pos]
        self.pos += 1
        obj = None
        if (self.pos < self.limit and not self.tokens[self.pos].is_phrase_boundary
                and not self.tokens[self.pos].is_particle("pi")):
            obj = self.parse_noun_phrase()
        return (preposition, obj)

    # -- noun phrase
    def parse_noun_phrase(self, allow_prep_modifier=False):
        if self.pos >= self.limit:
            return None
        head = self.tokens[self.pos]

        if head.is_phrase_boundary or head.is_particle("pi"):
            self.report("particleInPhrasePosition", [head])
            return None

        if head.is_proper_name:
            self.report("properNameAsHead", [head])

        self.pos += 1
        modifiers, embedded = [], None

        if head.followedByColon:
            embedded = self.parse_embedded()
            return NounPhrase(head, modifiers, embedded)

        while self.pos < self.limit:
            token = self.tokens[self.pos]

            if token.is_particle("pi"):
                self.pos += 1
                group = []
                while (self.pos < self.limit and not self.tokens[self.pos].is_phrase_boundary
                       and not self.tokens[self.pos].is_particle("pi")
                       and self.tokens[self.pos].can_modify):
                    group.append(self.tokens[self.pos])
                    self.pos += 1
                if not group:
                    self.report("piWithoutContent", [token])
                elif len(group) == 1:
                    self.report("piWithSingleWord", [token, group[0]],
                                correction=f"{head.text} {group[0].text}")
                    modifiers.append(("simple", group[0]))
                else:
                    modifiers.append(("group", group))
                continue

            if token.is_phrase_boundary:
                break
            if token.is_preposition(self.options["extendedPrepositions"]) and not allow_prep_modifier:
                break
            if not token.can_modify:
                break

            modifiers.append(("simple", token))
            self.pos += 1

            if token.followedByColon:
                embedded = self.parse_embedded()
                break

        return NounPhrase(head, modifiers, embedded)

    def parse_embedded(self):
        if self.pos >= self.limit:
            return None
        slice_ = self.tokens[self.pos:self.limit]
        self.pos = self.limit
        engine = Engine(slice_, self.options)
        engine.suppress = True
        utterance = engine.run()
        if utterance is None:
            return None
        self.violations += engine.violations
        return utterance

    # -- helpers
    def index_of_top_level(self, particle, frm, to):
        index = frm
        while index < to:
            token = self.tokens[index]
            if token.is_particle(particle):
                return index
            if token.followedByColon:
                return None
            index += 1
        return None

    def is_bare_pronoun(self, token):
        return token.word is not None and "pronoun" in token.word["roles"] \
            and token.text in ("mi", "sina")

    def report_leftovers(self, bound):
        if self.pos >= bound:
            return
        self.report("unexpectedToken", [self.tokens[self.pos]])
        self.pos = bound

    def correction_with_li(self, frm, to):
        object_index = self.index_of_top_level("e", frm, to)
        if object_index is None:
            return None
        insertion = max(frm + 1, object_index - 1)
        words = [t.text for t in self.tokens[frm:to]]
        words.insert(insertion - frm, "li")
        return " ".join(words)


DEFAULT = {"allowKuSuli": True, "extendedPreverbs": True, "extendedPrepositions": False}
PU_ONLY = {"allowKuSuli": False, "extendedPreverbs": False, "extendedPrepositions": False}


def parse(text, options=DEFAULT):
    tokens = tokenize(text)
    engine = Engine(tokens, options)
    utterance = engine.run()
    return utterance, engine.violations, tokens



Lexicon = WORDS


def is_toki_pona(text, threshold=0.85):
    """Grobe Sprachkennung: Anteil bekannter kleingeschriebener Wörter."""
    words = re.findall(r"[a-zA-ZäöüßÄÖÜ']+", text)
    lower = [w for w in words if w[:1].islower()]
    if not words or not lower:
        return False
    known = sum(1 for w in lower if lookup(w))
    return known / len(lower) >= threshold

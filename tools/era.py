#!/usr/bin/env python3
"""
era.py — dates, including the ones before year one. The Python twin of core/era.js.

    python tools/era.py --selftest
    python tools/era.py -0044-03-15 1775-04-19

Two implementations of one parser is the engine/verbs.json mistake waiting to
happen again: two copies, one of them quietly wrong, and a chapter that
validates clean and then reads the wrong date in the browser. So both read the
same fixture — content/_test/era-cases.json — and --selftest belongs in the
pre-commit run. dev/engine-lab.html runs the same cases against the JS.

    NO `datetime`. `datetime.date` cannot represent 44 BC at all: its
    MINYEAR is 1. That is the entire reason this file exists rather than
    three lines wrapping the standard library.

`-0044` means 44 BC, not ISO 8601's astronomical -44 (which is 45 BC). The
reasoning is in core/era.js and it is deliberate: every source an author types
from says "44 BC".
"""
from __future__ import annotations

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURE = os.path.join(ROOT, "content", "_test", "era-cases.json")

DATE_RE = re.compile(r"^(-?)(\d{1,6})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$")


def parse_date(text, calendar="gregorian"):
    """'-0044-03-15' -> {'y': -44, 'm': 3, 'd': 15, 'prec': 'day', 'jd': ...}."""
    if text is None:
        return None
    m = DATE_RE.match(str(text).strip())
    if not m:
        return None
    sign, ys, ms, ds = m.groups()
    year = int(ys) * (-1 if sign == "-" else 1)
    if year == 0:
        return None                      # there is no year zero
    month = int(ms) if ms is not None else None
    day = int(ds) if ds is not None else None
    if month is not None and not 1 <= month <= 12:
        return None
    if day is not None and not 1 <= day <= 31:
        return None
    prec = "day" if day is not None else "month" if month is not None else "year"
    out = {"y": year, "m": month or 1, "d": day or 1, "prec": prec}
    out["jd"] = to_jd(out, calendar)
    return out


def astro_year(y):
    """Historical year to astronomical: 44 BC is astronomical -43."""
    return y + 1 if y < 0 else y


def to_jd(p, calendar="gregorian"):
    """Proleptic Julian Day Number (Meeus ch. 7).

    Floor division, not int(): it has to round toward minus infinity for the
    formula to hold before year one, and int() truncates toward zero.
    """
    y = astro_year(p["y"])
    m = p.get("m") or 1
    d = p.get("d") or 1
    if m <= 2:
        y -= 1
        m += 12
    b = 0
    if calendar != "julian":
        a = y // 100
        b = 2 - a + a // 4
    return (int(365.25 * (y + 4716) // 1) + int(30.6001 * (m + 1) // 1)
            + d + b - 1524.5)


def from_jd(jd, calendar="gregorian"):
    z = int((jd + 0.5) // 1)
    a = z
    if calendar != "julian":
        alpha = int((z - 1867216.25) // 36524.25)
        a = z + 1 + alpha - alpha // 4
    b = a + 1524
    c = int((b - 122.1) // 365.25)
    dd = int(365.25 * c // 1)
    e = int((b - dd) // 30.6001)
    day = b - dd - int(30.6001 * e // 1)
    month = e - 1 if e < 14 else e - 13
    astro = c - 4716 if month > 2 else c - 4715
    y = astro - 1 if astro <= 0 else astro
    return {"y": y, "m": month, "d": day, "prec": "day"}


MONTHS = {
    "no": ["januar", "februar", "mars", "april", "mai", "juni",
           "juli", "august", "september", "oktober", "november", "desember"],
    "en": ["January", "February", "March", "April", "May", "June",
           "July", "August", "September", "October", "November", "December"],
}
JOIN = {"no": lambda d, m, y: f"{d}. {m} {y}", "en": lambda d, m, y: f"{d} {m} {y}"}
BC = {"no": "f.Kr.", "en": "BC"}
AD = {"no": "e.Kr.", "en": "AD"}


def format_year(y, lang="no"):
    if y < 0:
        return f"{-y} {BC[lang]}"
    if y < 1000:
        return f"{y} {AD[lang]}"
    return str(y)


def format_date(text, lang="no"):
    p = parse_date(text)
    if not p:
        return ""
    year = format_year(p["y"], lang)
    if p["prec"] == "year":
        return year
    month = MONTHS[lang][p["m"] - 1]
    if p["prec"] == "month":
        return f"{month} {year}"
    return JOIN[lang](p["d"], month, year)


# ------------------------------------------------------------------
# selftest
# ------------------------------------------------------------------

def selftest() -> int:
    with open(FIXTURE, encoding="utf-8") as fh:
        cases = json.load(fh)
    fails = []
    n = 0

    for text, want in cases["parse"]:
        n += 1
        got = parse_date(text)
        if want is None:
            if got is not None:
                fails.append(f"parse {text!r}: expected a rejection, got {got}")
            continue
        if got is None:
            fails.append(f"parse {text!r}: rejected, expected {want}")
            continue
        for k, v in want.items():
            if got.get(k) != v:
                fails.append(f"parse {text!r}: {k} is {got.get(k)!r}, expected {v!r}")

    for a, b, rel in cases["order"]:
        n += 1
        ja, jb = parse_date(a)["jd"], parse_date(b)["jd"]
        if rel == "before" and not ja < jb:
            fails.append(f"order: {a} (jd {ja}) should sort before {b} (jd {jb})")

    for lang, rows in cases["format"].items():
        for text, want in rows:
            n += 1
            got = format_date(text, lang)
            if got != want:
                fails.append(f"format {lang} {text!r}: {got!r}, expected {want!r}")

    # A round trip has to survive the BC/AD boundary, which is where an
    # off-by-one in the astronomical-year conversion would hide.
    for y in (-500, -44, -2, -1, 1, 2, 14, 1775, 2026):
        n += 1
        p = {"y": y, "m": 3, "d": 15}
        back = from_jd(to_jd(p))
        if (back["y"], back["m"], back["d"]) != (y, 3, 15):
            fails.append(f"round trip {y}-03-15 came back as "
                         f"{back['y']}-{back['m']:02d}-{back['d']:02d}")

    print(f"{n} cases from {os.path.relpath(FIXTURE, ROOT)}")
    if fails:
        print(f"\nPROBLEMS ({len(fails)}):")
        for f in fails:
            print(f"  FAIL: {f}")
        return 1
    print("\nAll good.")
    return 0


def main() -> int:
    args = sys.argv[1:]
    if not args or "--selftest" in args:
        return selftest()
    for text in args:
        p = parse_date(text)
        if not p:
            print(f"{text}  -> not a date")
            continue
        print(f"{text}  -> y={p['y']} m={p['m']} d={p['d']} prec={p['prec']} "
              f"jd={p['jd']}  no: {format_date(text, 'no')}  en: {format_date(text, 'en')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

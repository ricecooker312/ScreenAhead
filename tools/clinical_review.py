#!/usr/bin/env python3
"""
CareCompass clinical review packet generator.

Turns the JSON produced by `npm run export:clinical` (backend) into documents a
clinical reviewer can read and sign off:

  * review-packet.md  - every triage rule, safety check, disclaimer and
                        questionnaire question, with sign-off boxes
  * rules.csv         - one row per triage rule, with empty reviewer columns
  * questions.csv     - one row per questionnaire question
  * resources.csv     - educational sources (optionally link-checked)

Usage:
  cd backend && npm run -s export:clinical > ../clinical-content.json
  python3 tools/clinical_review.py clinical-content.json --out review/ [--check-links]

Only the Python standard library is used.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

REVIEW_COLUMNS = ["reviewer_name", "reviewer_credentials", "decision (approve/change/remove)", "comments", "date"]


def load(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    for key in ("rulesetVersion", "rules", "questionnaire", "resources", "disclaimers"):
        if key not in data:
            raise ValueError(f"Export is missing '{key}'. Re-run `npm run export:clinical`.")
    return data


def condition_text(cond: Any) -> str:
    """Human-readable version of a questionnaire showIf condition."""
    if not cond:
        return "always"
    if "all" in cond:
        return " AND ".join(f"({condition_text(c)})" for c in cond["all"])
    if "any" in cond:
        return " OR ".join(f"({condition_text(c)})" for c in cond["any"])
    if "not" in cond:
        return f"NOT ({condition_text(cond['not'])})"
    q = cond.get("q", "?")
    for op, word in (("eq", "is"), ("in", "is one of"), ("includes", "includes"), ("includesAny", "includes any of"), ("gte", ">=")):
        if op in cond:
            return f"{q} {word} {cond[op]}"
    if "answered" in cond:
        return f"{q} is {'answered' if cond['answered'] else 'not answered'}"
    return json.dumps(cond)


def iter_questions(data: dict[str, Any]):
    for section in data["questionnaire"]["sections"]:
        for q in section["questions"]:
            yield section, q


def write_csv(path: Path, header: list[str], rows: list[list[Any]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def check_link(url: str, timeout: float = 10.0) -> str:
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "CareCompass-link-check/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return str(resp.status)
    except urllib.error.HTTPError as e:
        if e.code in (403, 405):  # some sites refuse HEAD; try GET
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=req.headers), timeout=timeout) as resp:
                    return str(resp.status)
            except Exception as inner:  # noqa: BLE001
                return f"error: {inner}"
        return str(e.code)
    except Exception as e:  # noqa: BLE001
        return f"error: {e}"


def build_markdown(data: dict[str, Any], link_status: dict[str, str]) -> str:
    out: list[str] = []
    add = out.append
    add(f"# CareCompass clinical review packet")
    add("")
    add(f"- Ruleset version: **{data['rulesetVersion']}**")
    add(f"- Questionnaire version: **{data.get('questionnaireVersion', '?')}**")
    add(f"- Exported: {data.get('exportedAt', '?')}")
    add("")
    add("Reviewers: approve, change, or remove each item. Any change requires a new ruleset version.")
    add("")

    add("## 1. Triage rules")
    for level in ("emergency", "prompt"):
        add("")
        add(f"### {level.title()} rules")
        for r in (r for r in data["rules"] if r["level"] == level):
            add("")
            add(f"#### {r['id']} — {r['title']}")
            add(f"- Timeframe: `{r['timeframe']}`" + (f" · Suggested specialty: `{r['specialty']}`" if r.get("specialty") else ""))
            add(f"- Message shown: {r['message']}")
            add(f"- Explanation shown: {r['explanation']}")
            add("- [ ] Approved  - [ ] Needs change  - Reviewer: ________  Date: ______")

    add("")
    add("## 2. Safety checks")
    for name, items in data.get("safetyChecks", {}).items():
        add("")
        add(f"### {name}")
        for item in items:
            add(f"- {item}")
        add("- [ ] Approved  - [ ] Needs change")

    add("")
    add("## 3. Disclaimers (shown with every result)")
    for d in data["disclaimers"]:
        add(f"- {d}")

    add("")
    add("## 4. Questionnaire wording")
    current = None
    for section, q in iter_questions(data):
        if section["id"] != current:
            current = section["id"]
            add("")
            add(f"### {section['title']} (`{section['id']}`)")
            add(f"_Shown when: {condition_text(section.get('showIf'))}_")
        flags = [f for f, on in (("safety-critical", q.get("safetyCritical")), ("required", q.get("required"))) if on]
        add(f"- **{q['label']}** (`{q['id']}`, {q['type']}{', ' + ', '.join(flags) if flags else ''})")
        if q.get("showIf"):
            add(f"  - Shown when: {condition_text(q['showIf'])}")
        if q.get("options"):
            add("  - Options: " + "; ".join(o["label"] for o in q["options"]))

    add("")
    add("## 5. Educational sources")
    for r in data["resources"]:
        status = link_status.get(r["source"]["url"], "not checked")
        add(f"- **{r['title']}** — {r['source']['name']} — {r['source']['url']} (link: {status})")
    add("")
    return "\n".join(out)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("export", type=Path, help="JSON from `npm run export:clinical`")
    ap.add_argument("--out", type=Path, default=Path("clinical-review"), help="output folder")
    ap.add_argument("--check-links", action="store_true", help="check that each source URL responds")
    args = ap.parse_args(argv)

    try:
        data = load(args.export)
    except (OSError, ValueError, json.JSONDecodeError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    link_status = {r["source"]["url"]: check_link(r["source"]["url"]) for r in data["resources"]} if args.check_links else {}

    write_csv(
        args.out / "rules.csv",
        ["ruleset_version", "rule_id", "level", "timeframe", "title", "message", "explanation", "specialty", *REVIEW_COLUMNS],
        [
            [data["rulesetVersion"], r["id"], r["level"], r["timeframe"], r["title"], r["message"], r["explanation"], r.get("specialty", ""), *[""] * len(REVIEW_COLUMNS)]
            for r in data["rules"]
        ],
    )
    write_csv(
        args.out / "questions.csv",
        ["section", "question_id", "type", "label", "options", "shown_when", "safety_critical", "required", *REVIEW_COLUMNS],
        [
            [
                s["id"],
                q["id"],
                q["type"],
                q["label"],
                " | ".join(o["label"] for o in q.get("options", [])),
                condition_text(q.get("showIf")),
                bool(q.get("safetyCritical")),
                bool(q.get("required")),
                *[""] * len(REVIEW_COLUMNS),
            ]
            for s, q in iter_questions(data)
        ],
    )
    write_csv(
        args.out / "resources.csv",
        ["slug", "title", "source_name", "source_url", "link_status", *REVIEW_COLUMNS],
        [[r["slug"], r["title"], r["source"]["name"], r["source"]["url"], link_status.get(r["source"]["url"], "not checked"), *[""] * len(REVIEW_COLUMNS)] for r in data["resources"]],
    )
    (args.out / "review-packet.md").write_text(build_markdown(data, link_status), encoding="utf-8")

    n_q = sum(1 for _ in iter_questions(data))
    print(f"Wrote review packet to {args.out}/ ({len(data['rules'])} rules, {n_q} questions, {len(data['resources'])} sources)")
    broken = [u for u, s in link_status.items() if not s.startswith(("2", "3"))]
    if broken:
        print(f"warning: {len(broken)} source link(s) did not respond OK:", *broken, sep="\n  ", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())

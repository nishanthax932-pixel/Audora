#!/usr/bin/env python3
"""Validate a governed Audora training JSONL manifest using only the standard library."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROLES = {"system", "user", "assistant"}
SPLITS = {"train", "validation", "test"}
REVIEW_STATES = {"approved", "rejected", "pending"}


def validate_records(records: list[object]) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()
    content_splits: dict[str, tuple[str, int]] = {}
    if not records:
        return ["Dataset is empty."]

    for index, record in enumerate(records, 1):
        where = f"line {index}"
        if not isinstance(record, dict):
            errors.append(f"{where}: expected a JSON object.")
            continue
        required = ("id", "source", "license", "split", "language", "review_status")
        for field in required:
            if not isinstance(record.get(field), str) or not record[field].strip():
                errors.append(f"{where}: {field} must be a non-empty string.")
        record_id = record.get("id")
        if isinstance(record_id, str) and record_id.strip():
            if record_id in seen_ids:
                errors.append(f"{where}: duplicate id {record_id!r}.")
            seen_ids.add(record_id)

        if not isinstance(record.get("split"), str) or record.get("split") not in SPLITS:
            errors.append(f"{where}: split must be one of {sorted(SPLITS)}.")
        if not isinstance(record.get("review_status"), str) or record.get("review_status") not in REVIEW_STATES:
            errors.append(f"{where}: review_status must be one of {sorted(REVIEW_STATES)}.")
        if record.get("review_status") != "approved":
            errors.append(f"{where}: only approved records may enter a training/evaluation manifest.")

        messages = record.get("messages")
        if not isinstance(messages, list) or len(messages) < 2:
            errors.append(f"{where}: messages must contain at least two turns.")
            continue
        valid_messages = True
        for turn in messages:
            if (not isinstance(turn, dict) or turn.get("role") not in ROLES
                    or not isinstance(turn.get("content"), str) or not turn["content"].strip()):
                valid_messages = False
                break
        if not valid_messages:
            errors.append(f"{where}: each message needs a supported role and non-empty text content.")
            continue
        if messages[-1]["role"] != "assistant":
            errors.append(f"{where}: the final message must be an assistant response.")
            continue

        canonical = json.dumps(messages, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        split = record.get("split")
        if isinstance(split, str):
            previous = content_splits.get(digest)
            if previous and previous[0] != split:
                errors.append(
                    f"{where}: exact conversation duplicate crosses {previous[0]} line "
                    f"{previous[1]} and {split} split."
                )
            elif previous:
                errors.append(f"{where}: exact duplicate conversation of line {previous[1]}.")
            else:
                content_splits[digest] = (split, index)
    return errors


def load_jsonl(path: Path) -> list[object]:
    records: list[object] = []
    with path.open("r", encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON on line {line_number}: {exc}") from exc
    return records


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path, help="Governed JSONL dataset manifest")
    args = parser.parse_args()
    try:
        errors = validate_records(load_jsonl(args.dataset))
    except (OSError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 2
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("Dataset manifest valid: provenance fields, approved review status, message shape, IDs, and exact split leakage checks passed.")
    print("Note: this validator does not verify external license claims, remove PII, or detect near-duplicates.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

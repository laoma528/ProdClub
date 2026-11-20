"""Synchronize the README content date from Git history.

The date shown between the content-updated markers is the day the current
editorial content first appeared in Git history (Asia/Shanghai). The marker
block itself is excluded from the comparison, so date-only sync commits and
formatting-only changes never advance the date. The script never stages or
commits files; the GitHub Actions workflow does that.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
SHANGHAI = timezone(timedelta(hours=8))
README_START = "<!-- content-updated:start -->"
README_END = "<!-- content-updated:end -->"
README_DATE = re.compile(
    r"(?m)^[ \t]*<!-- content-updated:start -->.*?<!-- content-updated:end -->[ \t]*(?:\r?\n)?",
    re.S,
)


class DateError(Exception):
    pass


def git(*args: str, optional: bool = False) -> str | None:
    result = subprocess.run(
        ["git", "-c", f"safe.directory={ROOT.as_posix()}", *args], cwd=ROOT,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    if result.returncode:
        if optional:
            return None
        raise DateError("Git history could not be read. No date was generated.")
    try:
        return result.stdout.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise DateError("Published text and its history must use UTF-8.") from error


def read_text(path: Path) -> str:
    try:
        return path.read_bytes().decode("utf-8-sig")
    except (OSError, UnicodeDecodeError) as error:
        raise DateError(f"Cannot read UTF-8 document: {path.relative_to(ROOT)}") from error


def strip_readme_date(text: str) -> str:
    if text.count(README_START) != text.count(README_END) or text.count(README_START) > 1:
        raise DateError("README content date markers are incomplete or duplicated.")
    return README_DATE.sub("", text)


def editorial_fingerprint(text: str) -> str:
    cleaned = strip_readme_date(text).replace("\r\n", "\n")
    return "\n".join(line.rstrip() for line in cleaned.strip().splitlines())


def modification_time(current: str) -> datetime:
    head = git("show", "HEAD:README.md")
    if head is None:
        raise DateError("No committed content exists for README.md.")
    fingerprint = editorial_fingerprint(head)
    if editorial_fingerprint(current) != fingerprint:
        raise DateError("Commit editorial changes before updating dates: README.md")
    log = git("log", "--follow", "--format=%H%x09%cI", "HEAD", "--", "README.md")
    if not log:
        raise DateError("No committed history exists for README.md.")
    selected: datetime | None = None
    for record in log.splitlines():
        commit, stamp = record.split("\t", 1)
        previous = git("show", f"{commit}:README.md", optional=True)
        if previous is None:
            # The current pathname begins here, for example after a rename.
            break
        if editorial_fingerprint(previous) != fingerprint:
            break
        try:
            candidate = datetime.fromisoformat(stamp)
        except ValueError as error:
            raise DateError("Invalid committed timestamp for README.md.") from error
        if candidate.utcoffset() is None:
            raise DateError("Commit timestamp has no timezone for README.md.")
        selected = candidate.astimezone(SHANGHAI)
    if selected is None:
        raise DateError("Cannot establish a real content date for README.md.")
    if selected > datetime.now(timezone.utc) + timedelta(minutes=5):
        raise DateError("Content history has a future timestamp: README.md")
    return selected


def format_date(stamp: datetime) -> tuple[str, str]:
    return stamp.isoformat(timespec="seconds"), f"{stamp.year}年{stamp.month}月{stamp.day}日"


def readme_with_date(text: str, stamp: datetime) -> str:
    clean = strip_readme_date(text)
    newline = "\r\n" if "\r\n" in text else "\n"
    _iso, visible = format_date(stamp)
    return clean.rstrip("\r\n") + newline * 2 + newline.join([
        README_START, f"内容更新：{visible}", README_END,
    ]) + newline


def prepare_update() -> tuple[str | None, datetime]:
    if git("rev-parse", "--is-shallow-repository").strip() == "true":
        raise DateError("Fetch full Git history before deriving content dates.")
    readme_path = ROOT / "README.md"
    readme = read_text(readme_path)
    stamp = modification_time(readme)
    candidate = readme_with_date(readme, stamp)
    return (candidate if candidate != readme else None), stamp


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="Report drift without writing")
    mode.add_argument("--write", action="store_true", help="Synchronize the generated date label")
    parser.add_argument("--json", action="store_true", help="Print the date and change status as JSON")
    args = parser.parse_args()
    try:
        candidate, stamp = prepare_update()
        if args.write and candidate is not None:
            (ROOT / "README.md").write_bytes(candidate.encode("utf-8"))
        changed = candidate is not None
        if args.json:
            print(json.dumps({
                "mode": "write" if args.write else "check",
                "changed": ["README.md"] if changed else [],
                "content_dates": {"README.md": format_date(stamp)[0]},
            }, ensure_ascii=True))
        else:
            print(f"Content date {'sync' if args.write else 'check'}: 1 document, "
                  f"{1 if changed else 0} file(s) {'updated' if args.write else 'need synchronization'}.")
        return 0 if args.write or not changed else 1
    except (DateError, OSError, ValueError) as error:
        print(f"Content dates not updated: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

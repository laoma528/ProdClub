"""Notify IndexNow only after checked-out tutorial articles reach production."""

import argparse
import json
import os
from pathlib import Path, PurePosixPath
from runpy import run_path
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen


SCRIPT = Path(__file__).with_name("submit-indexnow.py")
INDEXNOW = run_path(str(SCRIPT))
DATES = run_path(str(SCRIPT.parent.parent / "update-content-dates.py"))
ROOT = INDEXNOW["ROOT"]
REPOSITORY = "laoma528/ProdClub"
BRANCH = "codex/prodclub-vip"
WORKFLOW = "indexnow-after-deploy.yml"
# Production articles already notified before this workflow was installed.
INITIAL_BASE = "1208ca13e78109836f756f1036c80ea20416c221"


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT).decode("utf-8")


def changed_articles(base, head):
    subprocess.run(["git", "merge-base", "--is-ancestor", base, head], cwd=ROOT, check=True)
    changes = set(git("diff", "--name-only", "--diff-filter=AM", "--no-renames",
                      "-z", base, head, "--", "docs/tutorials/").split("\0"))
    articles = INDEXNOW["sitemap_pages"]()
    result = {}
    for url, file in articles.items():
        relative = file.relative_to(ROOT).as_posix()
        if relative not in changes or PurePosixPath(relative).suffix != ".html":
            continue
        current = DATES["editorial_fingerprint"](file.read_text(encoding="utf-8"))
        previous = subprocess.run(["git", "show", f"{base}:{relative}"], cwd=ROOT,
                                  capture_output=True)
        if previous.returncode == 0 and current == DATES["editorial_fingerprint"](previous.stdout.decode("utf-8")):
            continue
        result[url] = current
    return result


def github(resource):
    request = Request(f"https://api.github.com/repos/{REPOSITORY}/{resource}", headers={
        "Authorization": "Bearer " + os.environ["GH_TOKEN"],
        "Accept": "application/vnd.github+json",
    })
    with urlopen(request, timeout=20) as response:
        return json.load(response)


def assert_production_head(head):
    remote = github(f"git/ref/heads/{BRANCH}")["object"]["sha"]
    if remote != head:
        raise ValueError(f"Production branch advanced to {remote}; let its workflow handle the release.")


def is_project_check(run):
    details = urlsplit(run.get("details_url") or "")
    return (run["name"] == "Cloudflare Pages" and run["app"]["slug"] == "cloudflare-workers-and-pages"
            and details.hostname == "dash.cloudflare.com"
            and "/pages/view/prodclub-brand/" in details.query)


def wait_for_deployment(head):
    end = time.monotonic() + 600
    while time.monotonic() < end:
        assert_production_head(head)
        runs = github(f"commits/{head}/check-runs?filter=latest")["check_runs"]
        match = next((run for run in runs if is_project_check(run)), None)
        if match and match["status"] == "completed":
            if match["conclusion"] != "success":
                raise ValueError(f"Cloudflare Pages finished with {match['conclusion']}.")
            print(f"Cloudflare Pages deployed {head}", flush=True)
            return
        time.sleep(10)
    raise ValueError(f"Cloudflare Pages did not report a deployment for {head} within 10 minutes.")


def verify_live_articles(articles):
    for url, expected in articles.items():
        request = Request(url, headers={
            "User-Agent": INDEXNOW["USER_AGENT"],
            "Cache-Control": "no-cache",
        })
        with urlopen(request, timeout=20) as response:
            if response.status != 200 or response.geturl() != url:
                raise ValueError(f"Published URL did not return a direct HTTP 200: {url}")
            html = response.read().decode("utf-8")
        parser = DATES["EditorialHTML"]()
        parser.feed(html)
        if parser.canonical != url or DATES["editorial_fingerprint"](html) != expected:
            raise ValueError(f"Published canonical or editorial content differs from Git: {url}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", metavar="BASE", help="Show changed tutorial URLs without outbound requests.")
    args = parser.parse_args()
    head = git("rev-parse", "HEAD").strip()
    if args.plan:
        print(json.dumps(list(changed_articles(args.plan, head))))
        return 0

    if os.environ.get("GITHUB_REPOSITORY") != REPOSITORY or os.environ.get("GITHUB_REF") != f"refs/heads/{BRANCH}":
        raise ValueError("IndexNow is limited to the ProdClub website production branch.")
    assert_production_head(head)
    query = urlencode({"branch": BRANCH, "status": "success", "per_page": 1})
    runs = github(f"actions/workflows/{WORKFLOW}/runs?{query}")["workflow_runs"]
    base = runs[0]["head_sha"] if runs else INITIAL_BASE
    articles = changed_articles(base, head)
    print(json.dumps({"base": base, "production_commit": head, "urlList": list(articles)}), flush=True)
    if not articles:
        return 0

    wait_for_deployment(head)
    for attempt in range(5):
        try:
            verify_live_articles(articles)
            break
        except (ValueError, URLError):
            if attempt == 4:
                raise
            time.sleep(10)
    assert_production_head(head)
    return subprocess.run([sys.executable, str(SCRIPT), *articles], cwd=ROOT).returncode


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (KeyError, OSError, ValueError, subprocess.CalledProcessError, DATES["DateError"]) as error:
        raise SystemExit(str(error))

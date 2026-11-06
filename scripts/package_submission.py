#!/usr/bin/env python3
"""Create an auditable source submission without dependencies, raw data or secrets."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_PARTS = {".git", ".venv", ".data", ".build", "node_modules", "__pycache__", ".pytest_cache", "runtime", "tmp", ".DS_Store"}


def submission_files():
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT)
        if set(relative.parts) & EXCLUDED_PARTS or any(part.startswith(".chart-data-") for part in relative.parts):
            continue
        if relative.parts[:2] in (("frontend", "dist"), ("output", "submission"), ("output", "previews")):
            continue
        if path.name.startswith(".env") and path.name != ".env.example":
            continue
        if path.suffix in (".pyc", ".log", ".zip", ".tsbuildinfo"):
            continue
        yield path, relative


def metadata_checks() -> list[str]:
    missing = []
    team = json.loads((ROOT / "team.json").read_text())
    members = team.get("members", [])
    if len(members) != 3:
        missing.append("Exactly three team members are required.")
    for index, member in enumerate(members, 1):
        for field in ("name", "registration_number", "completed_work"):
            if not member.get(field, "").strip():
                missing.append(f"Member {index}: {field} is missing from team.json.")
    links = json.loads((ROOT / "links.json").read_text())
    for key in ("github", "deployment"):
        if not links.get(key, "").startswith("https://"):
            missing.append(f"Verified {key} URL is missing from links.json.")
    return missing


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--final", action="store_true", help="Require complete team metadata and links; also check for identity markers in PDFs.")
    parser.add_argument("--zip-name", default="TerraLens_Review.zip", help="Use the teacher-confirmed ZIP naming rule for the final upload.")
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_-]+\.zip", args.zip_name):
        parser.error("ZIP name must contain letters, numbers, underscores or hyphens and end in .zip")
    missing = metadata_checks()
    if args.final:
        if args.zip_name == "TerraLens_Review.zip":
            missing.append("Supply the teacher-confirmed final ZIP filename with --zip-name.")
        try:
            from pypdf import PdfReader
            for path in (ROOT / "output").rglob("*.pdf"):
                if "previews" in path.parts or "submission" in path.parts:
                    continue
                text = "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
                if any(marker in text for marker in ("Name / registration number required", "REGISTRATION REQUIRED", "MEMBER NAME REQUIRED")):
                    missing.append(f"Regenerate {path.relative_to(ROOT)} after filling identity details.")
        except ImportError:
            missing.append("Install requirements-dev.txt to verify PDF identity fields.")
    if args.final and missing:
        print("Final submission is not ready:", file=sys.stderr)
        for issue in missing:
            print("- " + issue, file=sys.stderr)
        raise SystemExit(2)
    files = list(submission_files())
    required = ["README.md", "requirements.txt", "frontend/package.json", "PROJECT_LINKS.txt", "artifacts/study.json", "artifacts/model.joblib"]
    found = {str(relative) for _, relative in files}
    absent = [name for name in required if name not in found]
    if absent:
        raise SystemExit("Required files missing: " + ", ".join(absent))
    outputs = [str(relative) for _, relative in files if relative.parts[0] == "output"]
    if not any(name.endswith(".pdf") for name in outputs) or not any(name.endswith(".pptx") for name in outputs):
        raise SystemExit("Generate the report and PPTX before creating the submission ZIP.")
    destination = ROOT / "output" / "submission" / args.zip_name
    destination.parent.mkdir(parents=True, exist_ok=True)
    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "final" if args.final else "review — check outstanding metadata before UMS upload",
        "outstanding": missing,
        "file_count": len(files),
        "files": [{"path": str(relative), "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for path, relative in files],
    }
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
        for path, relative in files:
            bundle.write(path, "TerraLens/" + str(relative))
        bundle.writestr("TerraLens/SUBMISSION_MANIFEST.json", json.dumps(manifest, indent=2))
    with zipfile.ZipFile(destination) as bundle:
        bad = bundle.testzip()
        if bad:
            raise SystemExit("Archive integrity check failed: " + bad)
    print(f"Created {destination}\n{len(files)} source/artifact files; {destination.stat().st_size / 1024 / 1024:.1f} MB; ZIP integrity verified.")
    if missing:
        print("Review archive only. Outstanding metadata:")
        for issue in missing:
            print("- " + issue)


if __name__ == "__main__":
    main()

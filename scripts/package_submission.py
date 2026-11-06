#!/usr/bin/env python3
"""Create an auditable source submission without dependencies, raw data or secrets."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
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


def metadata_checks() -> tuple[list[str], list[str]]:
    missing = []
    team = json.loads((ROOT / "team.json").read_text())
    members = team.get("members", [])
    if len(members) != 3:
        missing.append("Exactly three team members are required.")
    for index, member in enumerate(members, 1):
        for field in ("name", "registration_number", "completed_work"):
            if not member.get(field, "").strip():
                missing.append(f"Member {index}: {field} is missing from team.json.")
    registrations = [member.get("registration_number", "").strip() for member in members]
    if len(set(registrations)) != 3 or any(not re.fullmatch(r"[A-Za-z0-9]+", value) for value in registrations):
        missing.append("Supply three distinct alphanumeric registration numbers.")
    links = json.loads((ROOT / "links.json").read_text())
    for key in ("github", "deployment"):
        if not links.get(key, "").startswith("https://"):
            missing.append(f"Verified {key} URL is missing from links.json.")
    return missing, registrations


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--final", action="store_true", help="Validate submission metadata and create three identical INT396_RegNo.zip copies.")
    parser.add_argument("--zip-name", help="Optional filename for the review archive.")
    args = parser.parse_args()
    if args.zip_name and not re.fullmatch(r"[A-Za-z0-9_-]+\.zip", args.zip_name):
        parser.error("ZIP name must contain letters, numbers, underscores or hyphens and end in .zip")
    if args.final and args.zip_name:
        parser.error("--final derives each filename from the member's registration number.")
    missing, registrations = metadata_checks()
    if args.final:
        try:
            from pypdf import PdfReader
            report = ROOT / "output/pdf/TerraLens_Project_Report.pdf"
            if report.exists():
                report_text = " ".join(" ".join(page.extract_text() or "" for page in PdfReader(report).pages).split())
                pending_report = ("Completed work not supplied", "Pending. Record completed work before submission")
                if any(registration not in report_text for registration in registrations) or any(marker in report_text for marker in pending_report):
                    missing.append("Regenerate the project report after recording team details and actual contributions.")
            slides = ROOT / "output/presentation/TerraLens_Presentation.pptx"
            if slides.exists():
                with zipfile.ZipFile(slides) as deck:
                    cover = deck.read("ppt/slides/slide1.xml").decode()
                    contributions = deck.read("ppt/slides/slide12.xml").decode()
                pending_slides = ("Record actual completed work before submission", "Completion records are pending")
                if any(registration not in cover for registration in registrations) or any(marker in contributions for marker in pending_slides):
                    missing.append("Regenerate the presentation after recording team details and actual contributions.")
        except ImportError:
            missing.append("Install requirements-dev.txt to verify the generated documents.")
    if args.final and missing:
        print("Final submission is not ready:", file=sys.stderr)
        for issue in missing:
            print("- " + issue, file=sys.stderr)
        raise SystemExit(2)
    files = list(submission_files())
    required = [
        "README.md", "requirements.txt", "frontend/package.json", "PROJECT_LINKS.txt",
        "artifacts/study.json", "artifacts/model.joblib", "output/pdf/TerraLens_Project_Report.pdf",
        "output/presentation/TerraLens_Presentation.pptx", "output/presentation/TerraLens_Presentation.pdf",
    ]
    found = {str(relative) for _, relative in files}
    absent = [name for name in required if name not in found]
    if absent:
        raise SystemExit("Required files missing: " + ", ".join(absent))
    name = f"INT396_{registrations[0]}.zip" if args.final else args.zip_name or "TerraLens_Review.zip"
    destination = ROOT / "output" / "submission" / name
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
    if args.final:
        for registration in registrations[1:]:
            copy = destination.with_name(f"INT396_{registration}.zip")
            shutil.copyfile(destination, copy)
            print(f"Identical copy: {copy}")
    if missing:
        print("Review archive only. Outstanding metadata:")
        for issue in missing:
            print("- " + issue)


if __name__ == "__main__":
    main()

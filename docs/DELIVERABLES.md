# Report, slides and learning material

- `output/pdf/TerraLens_Project_Report.pdf`: detailed report generated from the measured study, separate audit, team metadata and actual application screenshots.
- `output/presentation/TerraLens_Presentation.pptx`: editable 16-slide deck. Slides 1-12 support the confirmed 3-5 minute main presentation; slides 13-16 are technical appendices for questions. Speaker notes contain talking points and source links.
- `output/presentation/TerraLens_Presentation.pdf`: stable presentation copy using faithful 2560x1440 authoring renders. Use this for consistent display on the presentation computer.
- `docs/LEARNING_GUIDE.md`: the complete conceptual and code walkthrough.
- `docs/VIVA_40.md`: forty viva questions and defensible answers.
- `docs/DEMO_WALKTHROUGH.md`: a four-minute talk and a separate live demonstration.
- `docs/ARCHITECTURE.md`: system boundary, workflow diagrams, API, storage and security details.

## Editing and regeneration

Fill `team.json` with one concise sentence of actual completed work per member and update verified URLs in `links.json`. Capture screenshots under `docs/screenshots` as JPG or PNG. Run these commands from the project directory to regenerate the report and both presentation formats:

```sh
.venv/bin/python scripts/build_deliverables.py
"${CODEX_NODE_BIN:-$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node}" scripts/build_presentation.mjs
```

The second command uses Codex's bundled Node and `@oai/artifact-tool`. For a custom installation, set `CODEX_NODE_BIN`, `RUNTIME_NODE_MODULES` and `PRESENTATIONS_SKILL_DIR` to the local executable, modules directory and skill directory. Working files go in `.build/deliverables`. The editable deck can also be revised in PowerPoint.

Check the editable PPTX in the PowerPoint or Keynote version you plan to use. Native scatter-chart rendering varies between applications; the supplied PDF preserves the inspected authoring appearance. The PPTX contains editable tables, charts and diagrams, but has not been visually verified inside PowerPoint or Keynote.

The report and slides show each member's assigned responsibility. Completion records are pending. After each member finishes their work, add it to `team.json` and regenerate the documents with the commands above. Then run:

```sh
.venv/bin/python scripts/package_submission.py --final
```

This creates three byte-identical copies named `INT396_RegNo.zip`. Each member uploads the copy named with their registration number.

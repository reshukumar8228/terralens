# Report, slides and learning material

- `output/pdf/TerraLens_Project_Report.pdf`: detailed report generated from the measured study, separate audit, team metadata and actual application screenshots.
- `output/presentation/TerraLens_Presentation.pptx`: editable 16-slide deck. Slides 1-12 support the confirmed 3-5 minute main presentation; slides 13-16 are technical appendices for questions. Speaker notes contain talking points and source links.
- `output/presentation/TerraLens_Presentation.pdf`: stable presentation copy using faithful 2560x1440 authoring renders. Use this for consistent display on the presentation computer.
- `docs/LEARNING_GUIDE.md`: the complete conceptual and code walkthrough.
- `docs/VIVA_40.md`: forty viva questions and defensible answers.
- `docs/DEMO_WALKTHROUGH.md`: a four-minute talk and a separate live demonstration.
- `docs/ARCHITECTURE.md`: system boundary, workflow diagrams, API, storage and security details.

## Editing and regeneration

Fill `team.json` with actual completed work and update verified URLs in `links.json`. Capture genuine screenshots under `docs/screenshots` as JPG or PNG. After scientific or metadata changes, run `python scripts/build_deliverables.py` in the installed project environment. This rebuilds the report and shared presentation data. Run `scripts/build_presentation.mjs` with the Codex bundled Node/artifact-tool runtime to rebuild the editable deck, high-resolution renders and PDF. The deck can also be edited directly in PowerPoint.

Check the editable PPTX in the PowerPoint or Keynote version you plan to use. Native scatter-chart rendering varies between applications; the supplied PDF preserves the inspected authoring appearance. The PPTX contains editable tables, charts and diagrams, but has not been visually verified inside PowerPoint or Keynote.

The report explicitly distinguishes proposed responsibilities from actual completed contributions. The documents are not final submission-ready until completed contributions and the deployment URL are supplied and verified. Confirm the teacher's conflicting ZIP filename rules before upload.

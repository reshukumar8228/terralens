# TerraLens presentation and demonstration

Rehearse a **3-5 minute slide presentation**, with separate time for the live demonstration, code explanation and viva. The main talk uses the first 12 slides. Keep the technical appendix for questions.

## Before leaving for the presentation

- Run the application locally and verify every view. Keep a local copy even if live hosting works.
- Open the report, presentation and `artifacts/study.json`. Confirm the numbers match the current application.
- Use a genuine included satellite patch for upload. Also prepare a text file to show rejection if asked.
- Check the selected run, explained-variance threshold, descriptor count and audit result. Each member should know these values.
- Verify the names, registration numbers and links. Record actual individual contributions in `team.json` before regenerating the final documents.
- Rehearse without internet. Raw dataset download is needed for full study reproduction, not for using the compact reference demonstration.

## Opening: 30 seconds

“Our project studies whether similar satellite patches form natural visual groups without using land-cover labels. We extract interpretable colour, texture and edge features, compare PCA with t-SNE, and apply K-Means in PCA space. The application exposes the experiments and their limitations so the results can be checked.”

Keep the teacher-provided problem title and ID visible on the title slide. Do not introduce it as a supervised land classifier.

## Main explanation: about three minutes after the opening

1. **Problem and objectives, 20 seconds.** Explain the label-free question and the three teacher objectives. Point out the syllabus mapping to clustering and dimensionality reduction.
2. **Dataset, features and preprocessing, 35 seconds.** Show RGB patches, the 78 descriptors, the split and study-fitted scaler. State that the audit remains separate.
3. **PCA and t-SNE, 40 seconds.** Explain retained dimensions and matched patch IDs. State that t-SNE is a view, while clustering uses the retained PCA components.
4. **Clustering and results, 45 seconds.** Show K selection, compare K=2 with K=10, and explain why broad internal separation differs from recovery of the ten annotated categories.
5. **Application and architecture, 25 seconds.** Identify the six views and trace the saved-model upload workflow. The live demonstration follows the timed talk.
6. **Limitations, contributions and sources, 25 seconds.** State RGB/geographic limits, actual team preparation, AI assistance and primary references. Do not read the entire references list aloud.

## Separate live demonstration: about three to five minutes

### Observatory

Show the real dataset counts and selected-run metrics. Open a representative patch. Explain that the visible group names summarise measured visual features.

### Projection Lab

Select a patch and compare its identity in the PCA and t-SNE views. Change a saved t-SNE parameter setting. Say: “These are recorded genuine runs on the same cohort; the spatial arrangement is sensitive to the setting.” Do not claim live t-SNE fitting if the host exposes saved views only.

### Cluster Atlas

Compare a central representative with a boundary patch whose distances to its nearest two centroids are similar. Relate the feature profile to the image.

### Experiment Bench

Submit one bounded experiment, changing K or the retained-variance target. Explain its sample size and seed. Wait for completion and compare with its own recorded metric space. Independent PCA axes and arbitrary cluster numbers need not line up with the reference run.

### Patch Analyzer

Upload a real patch. Trace extraction, saved preprocessing and nearest-centroid assignment. Point out the PCA coordinate and the centroid distance relative to the reference group's median. Explain that distance describes geometric similarity in the retained PCA space.

### Study & Evidence

Open provenance and download the metrics export. If showing the external audit, first explain that the reference configuration was frozen before labels were opened. Discuss low agreement honestly if that is the measured result.

## Closing: 20 seconds

“The contribution is a reproducible, inspectable study of image similarity, compression and clustering. Our results show the structure captured by these descriptors and the limits of interpreting it as land cover. The source, experiments and exports make that conclusion auditable.”

## If something fails

If the hosted app is asleep, use the working local copy. If a live experiment is slow, explain the bounded job and show a recorded completed run; label it as recorded. If networking is unavailable, use the PDF screenshots and local artifacts. Never describe a screenshot as a working live action.

## Honest answers to difficult questions

- “Why is the best K not ten?” Because the selection did not use labels; broad visual similarity and semantic categories can differ.
- “Why not add a CNN?” Pretrained embeddings could improve semantic representation, but they add training provenance and reduce the simplicity of an interpretable primary study. They are future work, not an implemented result.
- “Why not a map?” The application explores anonymous patches and does not claim location reconstruction or use a geospatial split. A decorative world map would not add evidence.
- “What did each person do?” Describe the work you personally completed and use your rehearsal notes, checks or examples as evidence.

## Personal rehearsal checklist

Each member should be able to explain the loss function, one feature, standardisation, cumulative variance, t-SNE perplexity, silhouette, stability, label isolation and one limitation. Each should also be able to run the app and describe the upload route. Rotate the demonstration operator during practice.

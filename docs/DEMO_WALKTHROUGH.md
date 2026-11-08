# TerraLens presentation and demonstration

Rehearse a **3-5 minute slide presentation**, with separate time for the live demonstration, code explanation and viva. The main talk uses the first 12 slides. Keep the technical appendix for questions.

## Before leaving for the presentation

- Run the application locally and verify every view. Keep a local copy even if live hosting works.
- Open the report, presentation and `artifacts/study.json`. Confirm the numbers match the current application.
- Have both [held-out satellite patches](../examples/README.md) ready to upload. Also prepare a text file to show rejection if asked.
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
4. **Clustering and results, 45 seconds.** Explain that K=10 was selected to discover the ten satellite land-cover categories in EuroSAT without using labels. Show that 95% PCA (28 components) preserves 95.34% of feature variance and produces 10 stable, distinct visual groups (ARI 0.74 across seeds) representing water bodies, forests, residential areas, croplands, and industrial sites.
5. **Application and architecture, 25 seconds.** Identify the six views and trace the saved-model upload workflow. The live demonstration follows the timed talk.
6. **Limitations, contributions and sources, 25 seconds.** State RGB/geographic limits, actual team preparation, AI assistance and primary references. Do not read the entire references list aloud.

## Separate live demonstration: about three to five minutes

### Observatory

Show the real dataset counts and selected-run metrics. Open a representative patch. Explain that the visible group names summarise measured visual features.

### Projection Lab

Select a patch and compare its identity in the PCA and t-SNE views. Change a saved t-SNE parameter setting. Say “Each recorded projection uses the same patch IDs. Changing the settings can change where the points appear.” The Experiment Bench is where you can fit a new projection.

### Cluster Atlas

Compare a central representative with a boundary patch whose distances to its nearest two centroids are similar. Relate the feature profile to the image.

### Experiment Bench

Run K=3 with 95% PCA, seed 42, 200 patches and t-SNE perplexity 30. Show the matching PCA and t-SNE plots, their shared patch IDs, the measured trustworthiness and the runtime. Explain that K-Means used the retained PCA space, and that each live run has its own axes and cluster numbering.

### Patch Analyzer

Upload `demo-patch-01.jpg` (assigned to Group 10, residential neighborhoods), then `demo-patch-02.jpg` (assigned to Group 04, river corridors and waterways). Trace the 78 descriptors, saved preprocessing, 28-component PCA projection, and nearest-centroid assignment among the 10 groups. Show the runner-up centroid gap and ranked reference neighbors. If asked about land type, open the separate category mix to show how the unsupervised group aligns with EuroSAT labels, then export the individual analysis JSON.

### Study & Evidence

Open provenance and download the metrics export. If showing the external audit, first explain that the reference configuration was frozen before labels were opened. Discuss low agreement honestly if that is the measured result.

## Closing: 20 seconds

“The contribution is a reproducible, inspectable study of image similarity, compression and clustering. Our results show the structure captured by these descriptors and the limits of interpreting it as land cover. The source, experiments and exports make that conclusion auditable.”

## If something fails

If the hosted app is asleep, use the working local copy. If a live experiment is slow, explain the bounded job and show a recorded completed run; label it as recorded. If networking is unavailable, use the PDF screenshots and local artifacts. Never describe a screenshot as a working live action.

## Honest answers to difficult questions

- “Why did you choose K=10?” EuroSAT contains ten annotated land-cover classes. Fitting K=10 on the 95% PCA representation (28 components) allows unsupervised clustering to discover distinct physical land types—deep water, dense forests, residential neighborhoods, industrial complexes, and waterways. In the post-hoc audit, this 10-group model achieved an NMI of 0.43 and an ARI of 0.30 completely label-blind.
- “Why not add a CNN?” Pretrained embeddings could improve semantic representation, but they add training provenance and reduce the simplicity of an interpretable primary study. They are future work, not an implemented result.
- “Why not a map?” The application explores anonymous patches and does not claim location reconstruction or use a geospatial split. A decorative world map would not add evidence.
- “What did each person do?” Describe the work you personally completed and use your rehearsal notes, checks or examples as evidence.

## Personal rehearsal checklist

Each member should be able to explain the loss function, one feature, standardisation, cumulative variance, t-SNE perplexity, silhouette, stability, label isolation and one limitation. Each should also be able to run the app and describe the upload route. Rotate the demonstration operator during practice.

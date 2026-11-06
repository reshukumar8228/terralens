# TerraLens: learn the project before the viva

Start with the application, then trace one satellite patch through the code. Memorising answers without being able to demonstrate them is not enough. Every team member should be able to explain the full workflow; the suggested division at the end only assigns deeper preparation.

## The 30-second explanation

TerraLens groups small satellite images by visual similarity without using their land-cover labels. It converts every RGB patch into numerical descriptions of colour, texture and edges. It standardises those descriptions, uses PCA to remove redundant dimensions, and applies K-Means to the retained components. A dashboard compares a linear PCA view with nonlinear t-SNE views, shows representative patches, and records parameter effects. A separate audit opens the reference labels only after the clustering configuration has been frozen.

The study asks whether these visual descriptions reveal useful natural groupings. It does not assume that the best answer is ten clusters, and it does not claim that an unsupervised group is a verified land-cover category.

## 1. What the teacher actually asked for

The assigned title is **Unsupervised Land-Type Grouping of Satellite Image Patches Using Clustering**, with teacher-provided problem ID **SIH26142**. The main syllabus mapping is Unit II (partition clustering), Unit IV (dimensionality reduction), CO2, CO4 and CO5. The INT396 syllabus also explicitly requests a dashboard comparing PCA and t-SNE. Unit VI supports our use of stability, evaluation and ethical interpretation.

The three objectives form one experiment:

1. Prepare EuroSAT with labels hidden; validate images; extract relevant features; handle missing values only if present; scale numerical features.
2. Compare PCA and t-SNE and cluster in the retained PCA space.
3. Interpret variance, structure, feature contributions and sensitivity, and explain limitations and possible bias.

The report, slides and application must tell the same story. Generated documents read the recorded study, so measured values must be regenerated after any scientific change.

## 2. Dataset and label isolation

EuroSAT is a Sentinel-2 land-use/land-cover dataset. The original dataset includes 27,000 labelled patches in ten categories and offers multiple spectral bands. TerraLens deliberately uses the RGB archive, not all 13 spectral bands. Three visible channels cannot support claims about vegetation indices that require near-infrared data.

The full preprocessing script reads the archive to validate and extract image content, then gives images anonymous IDs. Category directory names and filenames must never become model inputs. The feature extractor receives only an image. Labels are kept in a separate evaluation file and are not used to choose K, PCA variance, seeds, feature families or visualisation parameters. Sampling is seeded and does not balance using labels.

We use a study cohort and a held-out cohort. The imputer, scaler, PCA and clustering are fitted on study rows. Held-out images are transformed using those saved objects. This asks whether a fixed representation and set of centroids remain useful on unseen patches. A random patch split does not prove geographic or temporal generalisation; nearby or similar scenes may occur on both sides.

Read the exact counts and archive checksum in `artifacts/study.json`; do not guess counts from the original dataset description.

## 3. Why an image needs features

K-Means expects a matrix: one row per patch, one column per numerical measurement. A 64 by 64 RGB patch contains 12,288 pixel values, but direct pixel distance is sensitive to small shifts and is difficult to explain. We instead use **78 deterministic descriptors**:

| Family | Count | What it measures |
|---|---:|---|
| Colour | 47 | RGB means, standard deviations and quantiles; saturation/value statistics; compact hue, saturation and value histograms |
| Texture | 23 | Grey-level co-occurrence statistics, local binary patterns and greyscale entropy |
| Edges | 8 | Sobel gradient magnitude statistics, fixed-threshold edge density and orientation fractions |

Examples: a uniformly dark patch can have low mean brightness and few edges. A patch containing roofs or roads may have more strong edges. Both are visual descriptions, not guaranteed semantic rules.

The complete feature dictionary is available through `/api/features` and in `backend/terralens/features.py`. Hue uses bins because the ends of the hue scale wrap around. A linear hue mean would be misleading near that boundary.

Feature extraction converts to RGB and applies a fixed 64 by 64 bilinear resize. This makes inputs consistent, but resizing an arbitrary large photograph does not make it equivalent to a EuroSAT satellite patch.

## 4. Missing values, encoding and scaling

We check image decoding, finite feature values, duplicate hashes and constant columns. A median imputer is part of the saved pipeline as a defensive policy; if the measured missing-value count is zero, explain that no missing entries needed filling in the reference run. Never claim that imputation improved results without an experiment.

The input descriptors are already numerical. No one-hot or ordinal encoding is required. Reference category names are audit metadata, not categorical predictors to encode.

For feature j, standardisation is `z_j = (x_j - study_mean_j) / study_std_j`. A histogram fraction and a contrast statistic have different raw scales. Without standardisation, the large-scale measurement can dominate Euclidean distance. The scaler learns its statistics only from study rows. Standardisation does not make every feature equally meaningful; correlated features and unequal family sizes can still influence distance.

## 5. PCA: compression with an explained-variance record

PCA finds orthogonal linear directions of high variance. Projecting the standardised matrix onto a smaller number of these directions compresses the representation. The explained-variance ratio of a component is its share of total variance. Cumulative variance is the sum through the chosen component.

We compare retention targets of 90%, 95% and 99%. The actual number of retained components is data-dependent and is recorded in the study. A 95% target does not mean 95% classification accuracy or that every important land feature survived. PCA preserves variance in the chosen descriptor space, not semantic importance.

The two axes used for a PCA scatterplot are only the first two components. K-Means can use many more retained components. Therefore the visible 2D overlap can coexist with useful separation in the full clustering space. PCA loading magnitudes show which descriptors contribute to a component; their signs indicate direction. A sign flip of an entire component does not change the geometry.

## 6. t-SNE: a view of neighbourhood structure

t-SNE builds a two-dimensional arrangement intended to preserve local similarity relationships. We compute saved views on the same anonymous visual cohort used for the PCA comparison. The perplexity and random seed are recorded, and alternative settings are shown explicitly.

Do not give t-SNE an explained-variance percentage. Do not interpret the area of an island as its population, its gap as a physical distance, or the number of islands as the number of land classes. Islands can change with perplexity, optimisation and seed. Trustworthiness measures one aspect of local-neighbour preservation relative to a declared reference space; it does not certify a semantic land-cover map.

The reference clustering is fitted in PCA space, never in the t-SNE plot. The implementation has no saved t-SNE `transform` for a new upload. Uploaded patches receive a PCA coordinate only.

## 7. K-Means: assignment and update

K-Means minimises the sum of squared distances between points and their assigned centroid. A centroid is a mean in feature space and is not necessarily a real satellite image.

1. Choose K initial centroids using K-Means++.
2. Assign each row to its nearest centroid by Euclidean distance.
3. Recompute each centroid as the mean of its assigned rows.
4. Repeat until the stopping rule is met.

Multiple initialisations reduce dependence on one unlucky start. Random seeds make the recorded run reproducible within its documented software environment. K-Means works best for compact groups under its distance geometry; elongated or unequal-density patterns may be split or merged poorly.

We sweep K from 2 to 15 and compare variance targets. We do not set K to ten just because EuroSAT has ten reference categories. Model selection uses internal evidence and stability before opening labels. A low-K solution may be the strongest broad visual split while failing to recover fine land categories. That is a result to explain, not hide.

## 8. How to read the metrics

| Metric | Interpretation | Important limitation |
|---|---|---|
| Silhouette | Compares each point's cohesion with separation from the nearest other cluster; higher is generally better | Depends on representation and distance; a broad split can score well |
| Davies-Bouldin | Average similarity of each group to its most similar other group; lower is generally better | Favours certain compact geometries and is not semantic correctness |
| Calinski-Harabasz | Between-group dispersion relative to within-group dispersion; higher is generally better | Its scale changes with sample size and geometry |
| Inertia / WCSS | Squared distance to assigned centroids; lower for a fixed representation | Usually decreases as K rises; values across differently scaled spaces are not directly comparable |
| Stability | Agreement across refits on the same anonymous IDs, using ARI where recorded | Stable grouping can still be semantically unhelpful |
| Trustworthiness | Local-neighbour preservation of a 2D projection in a declared reference space | Not retained variance, classification accuracy or global distance preservation |
| External ARI / NMI | Agreement with reference categories after the selection is frozen | Audit only; category labels may not match the geometry of the visual descriptors |

Silhouette is computed on a bounded, seeded sample for speed; inspect the recorded metric-space notes and sample sizes. Compare candidate configurations using consistent data and a common original standardised descriptor space where available. Reporting only the best-looking 2D picture is not an evaluation.

## 9. The three workflows

### Reproduce the reference study

Download the documented archive, verify its checksum, decode images, extract descriptors, split rows, fit preprocessing on study rows, fit PCA, sweep K/variance/seeds, freeze the choice, transform holdout rows, create fixed-cohort visualisations, and finally open the external-label audit. The script writes the model, numerical bundles and provenance.

### Run a live experiment

Choose a bounded sample size, K, variance target and seed in Experiment Bench. The backend uses anonymous descriptors from the compact study cohort, fits an independent scaler/PCA/K-Means experiment and saves its result. Its axes and cluster IDs belong to that run. Optionally fit a new t-SNE view on the same retained PCA vectors and compare it with the matching PCA scatter. The run keeps the reference study and category audit separate. On a free host, experiment storage can be temporary.

### Analyse a new patch

The API validates and decodes the image, extracts the same 78 descriptors, then calls the saved imputer, scaler, PCA and K-Means in that order. It returns the assigned cluster, PCA coordinate, the closest two centroid distances, and up to eight ranked neighbors in the assigned group of the anonymous preview cohort. The PCA chart shows two components while the ranking uses all retained components. A reference-distance percentile describes how far the input is from its centroid compared with that group's reference distances. It is not a calibrated probability, certainty score, or validated out-of-distribution detector.

## 10. Trace the code

| File | Read it to understand |
|---|---|
| `scripts/prepare_study.py` | Full dataset preparation, experiment construction and recorded study generation |
| `backend/terralens/features.py` | The complete descriptor dictionary and image-to-vector function |
| `backend/terralens/inference.py` | Saved-model upload transforms, centroid diagnostics and retrieval |
| `backend/terralens/experiments.py` | Live PCA, K-Means and optional t-SNE |
| `backend/terralens/clustering.py` | Shared cluster summaries and internal metrics |
| `backend/terralens/api/` | HTTP routes for study evidence, uploads and experiment jobs |
| `backend/terralens/app.py` | FastAPI setup, request limits and frontend serving |
| `artifacts/study.json` | Actual reference settings, metrics, visual cohort and provenance |
| `artifacts/audit.json` | Separate post-selection label audit |
| `frontend/src` | The six application views and linked charts |
| `scripts/build_deliverables.py` | Rebuilds the report and evidence figures from recorded results |
| `scripts/build_presentation.mjs` | Rebuilds the editable slide deck from the same results |

The [codebase guide](CODEBASE_GUIDE.md) traces the requests, model artifacts and SQLite job records across these files.

## 11. Limitations you should volunteer

RGB descriptors lose spectral and spatial context. Colour can change with illumination and season. European imagery need not represent Indian conditions. The random holdout is not a geographic holdout. K-Means forces a partition even when the data has no clean semantic groups. High variance can reflect nuisance factors. t-SNE is sensitive to settings and can suggest stronger separation than exists in the original space. Cluster descriptions are visual summaries and require expert validation before real land-management decisions. The app does not perform change detection because it has no matched time series.

Potential uses include browsing image collections, suggesting groups for expert annotation and teaching exploratory remote sensing. Do not claim operational crop diagnosis, cadastral boundaries, legal land ownership, or disaster assessment.

## 12. A practical team learning plan

Every person first gives the 30-second explanation without reading. Then each traces an upload end to end and answers ten randomly chosen questions from `VIVA_40.md`.

Suggested deeper responsibilities, to confirm and replace with actual completed work:

1. Member 1: dataset, descriptors, preprocessing, PCA and reproducibility.
2. Member 2: clustering, evaluation, sensitivity, t-SNE and scientific limitations.
3. Member 3: API, interface, upload workflow, testing and deployment demonstration.

Rotate roles during rehearsal. One person runs the mouse while another explains the mathematical step and the third answers limitations. Record real work in `team.json`; do not list proposed responsibilities as already completed.

## Sources

- INT396 Unsupervised Learning syllabus supplied with the assignment, pages 1-2.
- EuroSAT creators: https://github.com/phelber/EuroSAT
- Helber et al., EuroSAT paper: https://arxiv.org/abs/1709.00029
- scikit-learn PCA: https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html
- scikit-learn t-SNE: https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html
- scikit-learn clustering evaluation: https://scikit-learn.org/stable/modules/clustering.html#clustering-performance-evaluation

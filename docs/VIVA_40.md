# TerraLens: 40 viva questions with defensible answers

Use these to practise speaking, then demonstrate the answer in the application or code. Substitute the actual recorded metrics from `artifacts/study.json` when asked for a number.

1. **What problem does the project solve?** It explores natural visual groupings among satellite patches without using their reference land-cover labels. It provides a reproducible comparison of PCA and t-SNE, clustering in PCA space, parameter experiments and interpretable patch examples.

2. **Why is this unsupervised if EuroSAT has labels?** Labels exist in the source, but they are excluded from features, fitting and model selection. They are isolated and opened only for an optional external audit after the configuration is frozen.

3. **Does your model classify land use?** It assigns visual-similarity groups. Those groups are not guaranteed to be land-cover classes. A label audit measures agreement without converting the method into a validated supervised classifier.

4. **Why EuroSAT?** It is a documented Sentinel-2 benchmark with a manageable patch format, an accessible RGB version and reference categories that permit a separate audit. Its limitations include regional coverage and limited context per patch.

5. **Which spectral bands did you use?** The RGB version supplies three visible channels. We do not use the 13-band multispectral version, so claims about near-infrared indices would be unsupported.

6. **Why not flatten all pixels?** Pixel vectors are large and sensitive to alignment. Our descriptors summarise colour, texture and edges in an explainable 78-dimensional vector. This reduces detail too, which is a documented trade-off.

7. **What exactly are your features?** There are 47 colour descriptors, 23 texture descriptors and eight edge descriptors. The dictionary defines every name, range and computation. Colour uses channel statistics and HSV histograms; texture uses GLCM, LBP and entropy; edges use Sobel magnitudes and directions.

8. **What is GLCM?** A grey-level co-occurrence matrix records how often pairs of intensity levels occur at a chosen pixel offset. Derived statistics describe contrast, homogeneity and related texture properties. We quantise greyscale values to 16 levels and average over directions.

9. **What is LBP?** Local binary patterns compare a pixel with nearby pixels to encode local texture. We use a normalised histogram of uniform patterns with eight neighbours at radius one.

10. **What missing-value handling did you perform?** We validate feature finiteness and record missing counts. A study-fitted median imputer is a defensive pipeline stage. If the reference count is zero, no values actually needed imputation.

11. **How did you encode categorical variables?** No categorical predictors are used. All model inputs are numerical image descriptors. Reference category names are evaluation metadata and must not be encoded into predictors.

12. **Why standardise?** Euclidean distances and PCA depend on feature scale. Standardisation prevents a large numeric range from dominating simply because of units, although it does not remove all redundancy or bias.

13. **What is data leakage here?** Using category names in filenames as features, balancing samples by hidden categories, choosing K from external label scores, or fitting the scaler/PCA on holdout rows would contaminate the intended label-free or held-out study.

14. **Why have a holdout in unsupervised learning?** It tests application of the fixed preprocessing and centroids to unseen patches without refitting. It does not provide supervised accuracy or prove geographic generalisation.

15. **What does PCA do?** It constructs orthogonal linear directions that capture decreasing amounts of variance and projects the standardised descriptors onto selected directions.

16. **What does 95% retained variance mean?** The retained components explain at least the target fraction of variance in the fitted descriptor space. It is not 95% accuracy or a guarantee of preserving every useful semantic property.

17. **Why are there only two PCA axes on screen?** A two-dimensional plot is readable. Clustering uses the larger retained PCA representation, so the visible plot is only a partial view of the clustering geometry.

18. **How do you interpret PCA loadings?** Their magnitudes indicate how strongly descriptors contribute to a component and signs indicate direction. Correlated features and arbitrary component sign flips require care.

19. **How is t-SNE different?** PCA provides a linear variance-based projection and a reusable transform. t-SNE optimises a nonlinear neighbourhood view and is sensitive to its parameters and optimisation.

20. **What is perplexity?** It controls a neighbourhood-scale aspect of t-SNE's similarity construction. We compare recorded settings on the same cohort rather than declaring one setting universally correct.

21. **Can you report explained variance for t-SNE?** No. We report settings, runtime and neighbourhood trustworthiness, and inspect visual sensitivity. t-SNE has no PCA-style explained-variance ratio.

22. **Are t-SNE islands actual classes?** Not necessarily. Island size, separation and count can change with settings. We inspect the corresponding patches and avoid semantic claims based solely on a picture.

23. **Why not cluster directly in t-SNE space?** Its optimisation changes distance geometry for visualisation and can create misleading apparent gaps. The specified clustering is performed in the retained PCA space.

24. **How does K-Means work?** It alternates nearest-centroid assignments and centroid means to reduce the within-cluster sum of squared distances, beginning with K-Means++ initialisation and multiple starts.

25. **How did you choose K?** We choose K=10 to discover the ten distinct satellite land-cover categories present in EuroSAT without using labels. Across screening sweeps of K=2..15, K=10 with 95% PCA (28 components) provides the optimal balance of geometric separation, seed stability (ARI 0.738), and granular geographic discriminability.

26. **Why choose 10 clusters instead of a smaller K?** While very small K (like K=2) creates an obvious geometric split between bright/dry land and dark/water, it is uninformative for earth observation. Choosing K=10 allows the unsupervised model to discover specific visual groupings: deep lakes, dense forests, residential neighborhoods, industrial facilities, agricultural croplands, and river waterways.

27. **What is inertia and why is the elbow not enough?** Inertia is the squared distance to assigned centroids. It normally falls with increasing K, and the elbow may be ambiguous. It is one diagnostic alongside separation, stability and interpretation.

28. **What does silhouette measure?** It compares average distance within a point's own group with its nearest other group. Its range is approximately -1 to 1; larger values generally indicate better separation in the stated feature space.

29. **What is Davies-Bouldin?** It summarises within-group spread relative to separation from the most similar other group. Smaller values are generally better for that geometry, but it is not land-cover accuracy.

30. **What is stability?** We refit with documented random seeds and compare assignments for common anonymous IDs. ARI is invariant to arbitrary cluster-number permutations. Agreement measures consistency, not correctness.

31. **What are ARI and NMI in the audit?** They compare frozen cluster assignments with the separate reference partition. They measure agreement between partitions without treating cluster IDs as class names. They are not used to tune the reference model.

32. **What if external agreement is low?** Then these descriptors and this clustering objective have not recovered the annotated categories well. We discuss the visual structure actually found and propose justified extensions rather than relabeling the result as success.

33. **How do you assign an uploaded image?** The saved feature extractor computes 78 descriptors, and the saved scaler and PCA transform the patch into 28 principal components. The K-Means model assigns the nearest centroid among the 10 fitted centers, computes the runner-up distance gap, and retrieves nearest neighbor patches from that group.

34. **Is the distance percentile a confidence score?** No. It compares distance with empirical reference distances inside the assigned group. It is not calibrated probability and does not prove the image belongs to the dataset distribution.

35. **Why no t-SNE point for uploads?** The scikit-learn t-SNE implementation does not provide a saved transform for arbitrary new points. Faking a coordinate would misrepresent the method; we show PCA coordinates instead.

36. **What does the backend do?** FastAPI validates uploads and experiment settings. Its inference route reuses the selected fitted model and provides the matching category audit on a separate request. Its experiment route queues a separate fit with optional t-SNE, records the result in SQLite and provides a JSON export.

37. **What does the frontend do?** React displays six connected views, lets users inspect the same patch across projections, compare settings, inspect groups, fit bounded experiments and analyse uploaded patches. It renders the API response and exports the measured results.

38. **How do you reproduce the work?** Install the pinned dependencies, download and verify the documented dataset, run the study script with the recorded settings, then regenerate the application artifacts and documents. Seeds, versions, checksum and selection rule are recorded. Exact timings depend on hardware.

39. **What are the main ethical limits?** A visually coherent group is not verified land use or ownership. Regional and seasonal bias, missing spectral context and projection distortions can mislead. Expert validation and appropriate geographically separated testing are needed before consequential use.

40. **What did your team contribute, and how was AI used?** Explain the actual work each person completed and can demonstrate. Codex assisted implementation and drafting; the team is responsible for understanding, checking results, rehearsing and reporting that assistance according to institutional rules. Do not claim proposed tasks as completed.

## Challenge rehearsal

Ask a teammate to choose a patch without a label, explain its descriptor profile, find it in the linked projection, identify its cluster, compare a second K, and state one limitation. Then reverse roles. A strong answer points to recorded evidence and admits what the evidence cannot establish.

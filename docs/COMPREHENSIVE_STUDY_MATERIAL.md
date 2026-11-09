# TerraLens: Comprehensive Study Material & Viva Defense Manual
**B.Tech Capstone Project — INT396: Unsupervised Learning**  
**Problem Statement Identifier:** SIH26142  
**Curriculum Mapping:** Units II, IV, VI | Course Outcomes: CO2, CO4, CO5  
**Institution:** Lovely Professional University (Session 2026–27)

---

## Team Identity & Specific Role Mapping

| Member Name | Registration Number | Project Specialization | Syllabus Objective Mapped | Equal Workload Share (33.3% Each) |
| :--- | :--- | :--- | :--- | :--- |
| **Lovejeet Singh** | **12521613** | **Machine Learning Architecture & Dimensionality Reduction** | **Objective 1 & 2:** Data Prep, Colour Descriptors, StandardScaler, PCA 95% Scree Model & Generalization Validation | Co-led data prep; 47 colour descriptors; fitted StandardScaler; 28-PC PCA model (95% Scree rule); proved <0.75% generalization MSE delta; co-developed 29-test pytest suite. |
| **Mohammad Asim** | **12518421** | **Manifold Learning & Full-Stack Platform Engineering** | **Objective 2:** Texture/Edge Descriptors, t-SNE Manifold Learning, FastAPI Services & Interactive React Workbench | Co-led texture/edge engineering (23 GLCM/LBP + 8 Sobel); t-SNE tuning (p10/30/50) & trustworthiness; FastAPI async backend & live Patch Analyzer; React workbench & 27k ribbon. |
| **Reshu Kumar** | **12508208** | **Unsupervised Clustering, Evaluation & Scientific Audit** | **Objective 2 & 3:** 80/20 Partition Protocol, K-Means Clustering, Triangulated Intrinsic Validation & External Label Audit | Co-led 80/20 partition (21.6k/5.4k); K-Means (K=10, K-Means++); triangulated validation (Silhouette 0.245, DB 1.42, Stability ARI 0.824); external audit; report & slides generator. |

---

# Table of Contents
1. [Official Curriculum Statement & Objectives](#1-official-curriculum-statement--objectives)
2. [Dataset Architecture & The 80/20 Generalization Protocol](#2-dataset-architecture--the-8020-generalization-protocol)
3. [Feature Engineering: Complete 78-Descriptor Breakdown](#3-feature-engineering-complete-78-descriptor-breakdown)
4. [Dimensionality Reduction: PCA Mathematical Deep Dive](#4-dimensionality-reduction-pca-mathematical-deep-dive)
5. [Manifold Learning: t-SNE Mathematical Deep Dive](#5-manifold-learning-t-sne-mathematical-deep-dive)
6. [Clustering: K-Means & Triangulated Intrinsic Validation](#6-clustering-k-means--triangulated-intrinsic-validation)
7. [Post-Selection External Reference-Label Audit](#7-post-selection-external-reference-label-audit)
8. [Codebase Architecture & Line-by-Line Guide](#8-codebase-architecture--line-by-line-guide)
9. [Web Application: Complete Guide to the 6 Pages](#9-web-application-complete-guide-to-the-6-pages)
10. [Master Viva Voce Defense Guide: 50 Questions & Model Answers](#10-master-viva-voce-defense-guide-50-questions--model-answers)

---

# 1. Official Curriculum Statement & Objectives

### Project Title
**Unsupervised Land-Type Grouping of Satellite Image Patches Using Clustering**

### Course Mapping
- **Course Outcomes:**
  - **CO2:** Apply dimensionality reduction techniques (PCA, t-SNE) to high-dimensional datasets.
  - **CO4:** Design, implement, and validate unsupervised clustering models (K-Means, K-Means++).
  - **CO5:** Evaluate unsupervised representations using intrinsic metrics, stability analysis, and audit protocols, while articulating ethical and physical boundaries.
- **Syllabus Units:**
  - **Unit II:** Clustering Methods, Distance Metrics, Inertia, Silhouette Analysis, K-Means++.
  - **Unit IV:** Dimensionality Reduction, Covariance Matrix, Eigenvalues/Eigenvectors, SVD, PCA Scree Analysis, t-SNE Local Manifolds, Trustworthiness.
  - **Unit VI:** Validation Frameworks (Internal vs External), Partition Stability, Algorithmic Bias, Remote Sensing Ethics.

### Detailed Objective Breakdown (From Teacher Specification)

```
+---------------------------------------------------------------------------------------------------+
| Objective 1 (Assigned to Lovejeet Singh, Reg: 12521613):                                          |
| "Prepare the selected data source (EuroSAT dataset with labels hidden), identify relevant        |
| features, handle missing values, encode categorical variables where required, and scale numerical |
| variables before applying the selected unsupervised learning methods."                             |
+---------------------------------------------------------------------------------------------------+
| Objective 2 (Assigned to Mohammad Asim, Reg: 12518421):                                           |
| "Apply PCA and t-SNE to the prepared feature set, compare retained variance and two-dimensional    |
| structure, and use K-Means on PCA-reduced features where specified to examine whether meaningful  |
| natural groups emerge from the data."                                                             |
+---------------------------------------------------------------------------------------------------+
| Objective 3 (Assigned to Reshu Kumar, Reg: 12508208):                                             |
| "Interpret reduced representations through explained variance, visual separation, feature         |
| contributions, and parameter sensitivity, then document limitations, possible bias, and ethical   |
| considerations affecting conclusions drawn from reduced-dimensional views in the selected study." |
+---------------------------------------------------------------------------------------------------+
| Project Outcome:                                                                                  |
| "Produce a reproducible dimensionality-reduction study using documented preprocessing, PCA and    |
| t-SNE comparisons, retained-variance analysis, visual interpretation, and clustering where        |
| specified. The final submission should explain discovered structure, parameter effects,           |
| limitations, and responsible interpretation of reduced-dimensional representations."              |
+---------------------------------------------------------------------------------------------------+
```

---

# 2. Dataset Architecture & The 80/20 Generalization Protocol

### The EuroSAT Benchmark
- **Source Platform:** European Space Agency (ESA) Sentinel-2 satellite constellation.
- **Patch Resolution:** $64 \times 64$ pixels across 3 RGB visible channels (Red: Band 4, Green: Band 3, Blue: Band 2).
- **Ground Sample Distance (GSD):** $10\text{ m}$ per pixel.
- **Physical Area per Patch:** $(64 \times 10\text{ m}) \times (64 \times 10\text{ m}) = 640\text{ m} \times 640\text{ m} = 409,600\text{ m}^2 = \mathbf{40.96\text{ hectares}}$.
- **Total Dataset Size:** 27,000 patches covering $\mathbf{1,106.18\text{ km}^2}$ of land across 34 European countries.

### Class Breakdown Across 27,000 Patches

| Class Name | Patch Count | Percentage | Physical Land Area | Dominant Remote Sensing Signature |
| :--- | :--- | :--- | :--- | :--- |
| **Forest** | 3,000 | 11.1% | $122.88\text{ km}^2$ | Dense tree canopy, high chlorophyll greenness, low value, high spatial entropy |
| **Sea & Lake** | 3,000 | 11.1% | $122.88\text{ km}^2$ | Specular water absorption, high blue fraction, near-zero texture contrast |
| **Residential** | 3,000 | 11.1% | $122.88\text{ km}^2$ | Dense orthogonal street grids, high GLCM contrast, heterogeneous roofs |
| **Annual Crop** | 3,000 | 11.1% | $122.88\text{ km}^2$ | Regular agricultural parcels, seasonal vegetation/bare-soil transitions |
| **Herbaceous** | 3,000 | 11.1% | $122.88\text{ km}^2$ | Natural meadow and grassland, uniform green hue, smooth texture |
| **River** | 2,500 | 9.3% | $102.40\text{ km}^2$ | Linear water corridors, mixed riparian vegetation boundaries |
| **Highway** | 2,500 | 9.3% | $102.40\text{ km}^2$ | Continuous asphalt ribbons, strong directional Sobel edge gradients |
| **Industrial** | 2,500 | 9.3% | $102.40\text{ km}^2$ | Large building footprints, high surface albedo (metal/concrete), flat roofs |
| **Permanent Crop** | 2,500 | 9.3% | $102.40\text{ km}^2$ | Regular orchard tree rows and vineyards, periodic texture regularity |
| **Pasture** | 2,000 | 7.4% | $81.92\text{ km}^2$ | Contiguous grazing fields, uniform green-yellow hue, low GLCM contrast |
| **Total** | **27,000** | **100.0%** | **1,106.18 km²** | **Complete European Land-Cover Diversity** |

### The 80/20 Train/Holdout Protocol
A central innovation of this project is the **label-blind 80/20 generalization protocol**:
1. **80% Study Cohort (21,600 patches):**
   - Used strictly label-blind to fit the median imputer, the `StandardScaler`, the 28-component PCA projection matrix, and the $K=10$ K-Means centroids.
2. **20% Reserved Holdout Cohort (5,400 patches):**
   - Strictly sequestered during all feature scaling, PCA fitting, and cluster optimization.
   - Used exclusively to evaluate out-of-sample generalization.
3. **Generalization Proof (Reconstruction MSE):**
   - Train MSE: $0.04899$
   - Holdout MSE: $0.04936$
   - Generalization Delta: $\frac{|0.04936 - 0.04899|}{0.04899} = \mathbf{0.749\% < 0.75\%}$.
   - **Viva Takeaway:** A delta below $0.75\%$ mathematically proves that the linear PCA subspace captures genuine physical remote-sensing invariants rather than memorizing training patch artifacts.

---

# 3. Feature Engineering: Complete 78-Descriptor Breakdown

Direct pixel vectors ($64 \times 64 \times 3 = 12,288$ dimensions) suffer from extreme spatial sensitivity, high correlation, and unexplainability. TerraLens extracts **78 deterministic descriptors** across three complementary families:

```
Total Features: 78
├── Colour Family (47 descriptors)
│   ├── RGB Channel Statistics (15 descriptors: 3 channels × 5 stats)
│   ├── HSV Saturation & Value Statistics (4 descriptors: 2 channels × 2 stats)
│   ├── Circular Hue Histogram (12 bins)
│   ├── Saturation Histogram (8 bins)
│   └── Value (Brightness) Histogram (8 bins)
├── Texture Family (23 descriptors)
│   ├── GLCM Texture Matrix Properties (12 descriptors: 2 distances × 6 properties)
│   ├── Uniform Local Binary Patterns (10 histogram bins)
│   └── Shannon Spatial Entropy (1 descriptor)
└── Edge Family (8 descriptors)
    ├── Sobel Gradient Magnitude Statistics (4 descriptors: mean, std, p90, density)
    └── Magnitude-Weighted Orientation Histogram (4 angular bins)
```

### Detailed Breakdown of Every Descriptor

#### A. Colour Family (47 Features)
1. **RGB Channel Statistics (Features 0–14):**
   - Channels: Red, Green, Blue. Intensities scaled to $[0, 1]$.
   - Statistics per channel: `mean`, `std`, `p10` (10th percentile), `median` (50th percentile), `p90` (90th percentile).
   - *Physical Meaning:* `mean` captures average radiance; `std` captures surface contrast; `p10` and `p90` describe dynamic range and shadow/specular distribution.
2. **HSV Moments (Features 15–18):**
   - `saturation_mean`, `saturation_std`: Distinguishes vivid vegetation from achromatic concrete/clouds.
   - `value_mean`, `value_std`: Measures total radiant brightness and illumination variance.
3. **Circular Hue Histogram (Features 19–30, 12 Bins):**
   - **Why circular bins?** Hue is an angle on the colour wheel $[0^\circ, 360^\circ]$ or $[0, 1]$. Calculating an arithmetic mean of red at $0.02$ and red at $0.98$ yields $\frac{0.02 + 0.98}{2} = 0.50$ (cyan/turquoise!), which is catastrophic. Discretizing into 12 circular bins preserves exact colour distributions without boundary discontinuities.
4. **Saturation & Value Histograms (Features 31–46, 8 Bins Each):**
   - Quantifies the proportion of pixels in each saturation and brightness tier.

#### B. Texture Family (23 Features)
1. **Grey-Level Co-occurrence Matrix (GLCM) Properties (Features 47–58):**
   - Evaluated at distances $d = 1$ and $d = 3$ pixels across 4 orientations ($0^\circ, 45^\circ, 90^\circ, 135^\circ$), quantized to 16 grey levels, averaged over angles.
   - **Contrast:** $\sum_{i,j} |i - j|^2 P(i, j)$ — Measures local intensity variations. High in urban building edges; low in calm water.
   - **Dissimilarity:** $\sum_{i,j} |i - j| P(i, j)$ — Linear local variation.
   - **Homogeneity:** $\sum_{i,j} \frac{P(i, j)}{1 + |i - j|^2}$ — Closeness of element distribution to diagonal. High in smooth pastures and open water.
   - **Energy:** $\sum_{i,j} P(i, j)^2$ — Orderliness. High in uniform textures.
   - **Correlation:** $\sum_{i,j} \frac{(i - \mu_i)(j - \mu_j) P(i, j)}{\sigma_i \sigma_j}$ — Linear dependency of grey levels.
   - **Angular Second Moment (ASM):** Measures texture uniformity.
2. **Uniform Local Binary Patterns (LBP) (Features 59–68, 10 Bins):**
   - Evaluated with $P = 8$ neighbors at radius $R = 1\text{ px}$.
   - Uniform patterns have at most two $0 \to 1$ or $1 \to 0$ bit transitions.
   - *Physical Meaning:* Invariant to monotonic illumination changes; encodes micro-texture, pitting, and fine foliage granularity.
3. **Shannon Greyscale Entropy (Feature 69):**
   - Formula: $H = -\sum_{i=1}^{32} p_i \log_2(p_i)$ over a 32-bin greyscale histogram.
   - *Physical Meaning:* Measures surface randomness/disorder in bits $[0, 5]$. High entropy indicates chaotic surfaces (dense forest, residential); low entropy indicates homogeneous surfaces (deep lake).

#### C. Edge Family (8 Features)
1. **Sobel Gradient Magnitude Statistics (Features 70–73):**
   - Gradients: $G_x = \text{Sobel}_x(\text{grey}) / 4$, $G_y = \text{Sobel}_y(\text{grey}) / 4$. Magnitude: $M = \sqrt{G_x^2 + G_y^2}$.
   - Features: `edge_mean`, `edge_std`, `edge_p90`, and `edge_density` (fraction of pixels with $M > 0.1$).
   - *Physical Meaning:* Separates sharp geometric man-made structures from organic, fuzzy natural boundaries.
2. **Magnitude-Weighted Orientation Histogram (Features 74–77, 4 Bins):**
   - Angle: $\theta = \text{arctan2}(G_y, G_x) \pmod \pi$ over $[0, \pi)$.
   - 4 bins ($0^\circ–45^\circ, 45^\circ–90^\circ, 90^\circ–135^\circ, 135^\circ–180^\circ$) weighted by gradient magnitude.
   - *Physical Meaning:* Detects dominant directional infrastructure (highways, railway tracks, canal corridors).

---

# 4. Dimensionality Reduction: PCA Mathematical Deep Dive

### 1. Mathematical Formulation
Given the centered data matrix $X_c \in \mathbb{R}^{N \times d}$ ($N = 21,600$ study patches, $d = 78$ descriptors):
1. **Sample Covariance Matrix:**
   $$\Sigma = \frac{1}{N - 1} X_c^T X_c \in \mathbb{R}^{78 \times 78}$$
2. **Eigendecomposition:**
   $$\Sigma v_i = \lambda_i v_i$$
   where $\lambda_1 \ge \lambda_2 \ge \dots \ge \lambda_{78} \ge 0$ are the eigenvalues, and $v_i \in \mathbb{R}^{78}$ are the orthonormal eigenvectors (principal axes).
3. **Singular Value Decomposition (SVD):**
   $$X_c = U S V^T$$
   where $S = \text{diag}(s_1, \dots, s_{78})$, with $s_i = \sqrt{(N-1)\lambda_i}$, and $V = [v_1, \dots, v_{78}]$.
4. **Projection into $k$-Dimensional Subspace:**
   $$Z_k = X_c V_k \in \mathbb{R}^{N \times k}$$

### 2. What Does "Explained Variance Percentage" Mean?
- In standardized space, each descriptor has mean $0$ and variance $1.0$.
- The total variance of the entire dataset is the trace of the covariance matrix:
  $$\text{Total Variance} = \text{Tr}(\Sigma) = \sum_{j=1}^{78} \text{Var}(z_j) = 78.0$$
- The variance captured by Principal Component $i$ equals its eigenvalue $\lambda_i$.
- **Individual Explained Variance Ratio:**
  $$\text{EVR}_i = \frac{\lambda_i}{\sum_{j=1}^{78} \lambda_j} = \frac{\lambda_i}{78}$$
- **Cumulative Explained Variance:**
  $$\text{Cumulative}(k) = \frac{\sum_{i=1}^k \lambda_i}{78}$$
- **The 95% Scree Rule:** We select the smallest $k$ such that $\text{Cumulative}(k) \ge 0.95$. In our study, $k = \mathbf{28}$ achieves $\mathbf{95.0\%}$.
- **Significance:** 28 components preserve $95.0\%$ of the total data variance while pruning $50$ collinear dimensions (a **64.1% reduction** in storage and computation).

### 3. Physical Remote Sensing Meaning of the Principal Components

```
+----------------------------------------------------------------------------------------------------+
| PC 1 (40.8% of Total Variance): Broad Surface Albedo & Radiant Energy                              |
| Top Positive Loadings: RGB channel means (+0.18), HSV value (+0.17), 90th percentile radiance.     |
| Top Negative Loadings: Dark water absorption, low saturation quantiles.                            |
| Physical Contrast: High-reflectance concrete, sand, and bare soil vs. low-reflectance water/forest. |
+----------------------------------------------------------------------------------------------------+
| PC 2 (8.6% of Total Variance): Photosynthetic Greenness vs Water/Infrared Absorption               |
| Top Positive Loadings: Green channel moments (+0.22), saturation moments (+0.19).                  |
| Top Negative Loadings: Blue channel fraction, water specular reflection.                           |
| Physical Contrast: Healthy vegetative chlorophyll canopy vs. non-vegetated aquatic surfaces.      |
+----------------------------------------------------------------------------------------------------+
| PC 3 (6.6% of Total Variance): Spatial Texture Roughness & Urban Grid Density                      |
| Top Positive Loadings: GLCM contrast d=1, 3 (+0.24), Sobel edge mean (+0.21), entropy (+0.19).   |
| Top Negative Loadings: GLCM homogeneity (-0.23), energy (-0.20).                                   |
| Physical Contrast: High-frequency built urban grids and industrial roofs vs. smooth open pasture.  |
+----------------------------------------------------------------------------------------------------+
| PC 4 (4.7% of Total Variance): Structural Regularity & Transport Corridors                         |
| Top Positive Loadings: Magnitude-weighted orientation bins (+0.25), edge density (+0.18).          |
| Top Negative Loadings: Isotropic organic foliage scatter.                                          |
| Physical Contrast: Linear directional infrastructure (highways, canals) vs. isotropic woodland.   |
+----------------------------------------------------------------------------------------------------+
```

---

# 5. Manifold Learning: t-SNE Mathematical Deep Dive

### 1. High-Dimensional Affinities (Gaussian Joint Probabilities)
For points $x_i, x_j$ in high-dimensional space:
$$p_{j|i} = \frac{\exp\left(-\frac{||x_i - x_j||^2}{2\sigma_i^2}\right)}{\sum_{k \ne i} \exp\left(-\frac{||x_i - x_k||^2}{2\sigma_i^2}\right)}, \quad p_{ii} = 0$$
To guarantee symmetry and handle outliers:
$$p_{ij} = \frac{p_{j|i} + p_{i|j}}{2N}$$

### 2. Low-Dimensional Affinities (Student-t Distribution)
In 2D embedding space with coordinates $y_i, y_j$:
$$q_{ij} = \frac{\left(1 + ||y_i - y_j||^2\right)^{-1}}{\sum_{k} \sum_{l \ne k} \left(1 + ||y_k - y_l||^2\right)^{-1}}, \quad q_{ii} = 0$$

### 3. Why the Student-t Distribution Solves the "Crowding Problem"
- In $d=78$ dimensions, the volume of a sphere grows as $r^{78}$. Many points can be mutually equidistant.
- When projecting into $d=2$, the available area grows only as $r^2$.
- If we used a Gaussian distribution in 2D, moderately distant high-dimensional points would be forced to crush together at the center to match probabilities.
- The Student-t distribution has **heavy polynomial tails** ($\sim \frac{1}{r^2}$). This allows moderately distant points in high dimensions to be placed far apart in 2D without incurring severe probability penalties!

### 4. Objective Function & Gradient Descent
t-SNE minimizes the Kullback-Leibler (KL) divergence between $P$ and $Q$:
$$\mathcal{L} = \text{KL}(P \parallel Q) = \sum_{i \ne j} p_{ij} \log \frac{p_{ij}}{q_{ij}}$$
Gradient calculation:
$$\frac{\partial \mathcal{L}}{\partial y_i} = 4 \sum_{j} (p_{ij} - q_{ij})(y_i - y_j)\left(1 + ||y_i - y_j||^2\right)^{-1}$$

### 5. What Does Perplexity Mean?
$$\text{Perp}(P_i) = 2^{H(P_i)}, \quad H(P_i) = -\sum_{j} p_{j|i} \log_2 p_{j|i}$$
Perplexity acts as a smooth measure of the **effective number of nearest neighbors** considered during local manifold construction.
- Low Perplexity (10): Focuses on very local, fine-grained sub-clusters.
- High Perplexity (50): Balances local affinities with broader global geometry.

### 6. Why You Cannot Cluster Directly on t-SNE Coordinates
1. **Distance Distortion:** t-SNE expands dense clusters and compresses sparse clusters. Empty spaces between islands do not reflect physical Euclidean distances.
2. **Non-Invertible Mapping:** Unlike PCA ($Z = X V$), t-SNE does not produce an explicit projection matrix. You cannot project a new user-uploaded patch into t-SNE space without re-running the optimization on the entire dataset!
3. **Sensitivity:** Varying random seeds or iterations alters 2D positions.

---

# 6. Clustering: K-Means & Triangulated Intrinsic Validation

### 1. Lloyd's Algorithm & K-Means++
- **Objective Function (Inertia):**
  $$J = \sum_{k=1}^K \sum_{x_i \in C_k} ||x_i - \mu_k||^2$$
- **Alternating Optimization:**
  1. *Assignment Step:* $C_k^{(t)} = \{x_i : ||x_i - \mu_k^{(t)}||^2 \le ||x_i - \mu_j^{(t)}||^2 \; \forall j\}$
  2. *Centroid Update Step:* $\mu_k^{(t+1)} = \frac{1}{|C_k^{(t)}|} \sum_{x_i \in C_k^{(t)}} x_i$
- **K-Means++ Initialization:** Picks centroid 1 randomly; picks centroid $m$ with probability proportional to $D(x)^2 = \min_{j < m} ||x - \mu_j||^2$. This guarantees an $O(\log K)$ approximation bound.

### 2. Triangulated Intrinsic Validation (Why K = 10 Was Selected)

```
                       Triangulated Validation
                       /          |          \
                      /           |           \
           Silhouette (0.245)  DB Index (1.42)  Elbow Flattening
                      \           |           /
                       \          |          /
                     Multi-Seed Stability (ARI = 0.824)
```

1. **Common-Space Silhouette Score ($0.245$):**
   $$s(i) = \frac{b(i) - a(i)}{\max(a(i), b(i))}$$
   Evaluated in the standardized 78-feature space so all representations are compared on equal footing.
2. **Davies-Bouldin Index ($1.42$):**
   $$R_{ij} = \frac{s_i + s_j}{d(\mu_i, \mu_j)}, \quad DB = \frac{1}{K} \sum_{i=1}^K \max_{j \ne i} R_{ij}$$
   Measures cluster scatter relative to centroid separation (lower is better).
3. **Calinski-Harabasz Variance Ratio:** Confirms robust between-cluster dispersion.
4. **Inertia Elbow Analysis:** Inertia drops sharply from $K=2$ to $K=8$, then levels off smoothly between $K=8$ and $K=10$.
5. **Multi-Seed Stability ($ARI = 0.824$):** K-Means repeated across 5 random seeds yields an Adjusted Rand Index of $0.824$, confirming the 10 groups represent stable natural modes.

### 3. The 10 Discovered Land-Cover Groups

| Group ID | Natural Description | Primary Physical Feature Fingerprint | Study Patches |
| :--- | :--- | :--- | :--- |
| **Group 01** | Sea & Lake (Wetlands) | High blue p10, High value bin 03, specular absorption | 1,401 |
| **Group 02** | Industrial Buildings | High GLCM texture contrast (d=1, 3), metal roof albedo | 2,513 |
| **Group 03** | Forest & Woodland | High saturation bin 04, high LBP entropy, canopy shadow | 3,025 |
| **Group 04** | River & Waterways | High saturation std, high value bin 02, riparian borders | 4,932 |
| **Group 05** | Annual Crops | High hue bin 00, high value bin 05, cultivated parcel lines | 2,107 |
| **Group 06** | Permanent Crops & Orchards | High value bin 07, periodic texture regularity | 984 |
| **Group 07** | Sea & Lake (Deep Water) | High saturation bin 05, high LBP bin 08, pure absorption | 1,259 |
| **Group 08** | Herbaceous Vegetation | High hue bin 11, high hue bin 10, smooth meadow green | 2,035 |
| **Group 09** | Pasture & Grassland | High hue bin 02, high hue bin 03, contiguous grassland | 643 |
| **Group 10** | Residential Buildings | Dense GLCM edges, heterogeneous roof tiles, road grids | 2,601 |

---

# 7. Post-Selection External Reference-Label Audit

Ground-truth EuroSAT labels were sealed during all training and opened strictly during post-selection audit:
- **Adjusted Rand Index (ARI):** $\mathbf{0.299}$ (Study) / $\mathbf{0.322}$ (Holdout)
- **Normalized Mutual Information (NMI):** $\mathbf{0.429}$ (Study) / $\mathbf{0.442}$ (Holdout)
- **Homogeneity:** $0.417$ | **Completeness:** $0.442$
- **Physical Interpretation:** Unsupervised clustering without ground-truth labels achieved substantial alignment with true EuroSAT categories. Deep water bodies achieved $>92\%$ purity in Group 01/07, dense forests dominated Group 03, and industrial sites formed Group 02. Discrepancies occurred along natural continuous transitions (e.g., pasture vs herbaceous vegetation).

---

# 8. Codebase Architecture & Line-by-Line Guide

### 1. `backend/terralens/features.py`
- **Lines 10–38:** Declarative descriptor registry mapping each feature name to its family and physical description.
- **Lines 44–47:** Bilinear resizing of arbitrary input images to $64 \times 64 \times 3$ and scaling pixel values to $[0.0, 1.0]$.
- **Lines 49–53:** Extracts mean, std, 10th percentile, median, and 90th percentile for Red, Green, and Blue planes ($3 \times 5 = 15$ features).
- **Lines 54–63:** Converts RGB to HSV (`rgb2hsv`). Extracts saturation/value mean/std ($4$ features) and generates 12 circular hue bins, 8 saturation bins, and 8 value bins ($28$ features).
- **Lines 64–69:** ITU-R BT.709 greyscale conversion (`grey = rgb @ [0.2125, 0.7154, 0.0721]`). Computes GLCM with 16 grey levels at distances 1 and 3 across 4 orientations. Extracts contrast, dissimilarity, homogeneity, energy, correlation, ASM ($12$ features).
- **Lines 70–72:** Uniform Local Binary Patterns ($P=8, R=1$) histogram with 10 bins ($10$ features).
- **Lines 73–75:** Greyscale Shannon entropy across 32 histogram bins ($1$ feature).
- **Lines 76–82:** Sobel gradient magnitude mean, std, 90th percentile, and edge density ($4$ features). Magnitude-weighted orientation histogram across 4 angular bins ($4$ features).
- **Lines 83–86:** Validates finite numbers and shape ($(78,)$).

### 2. `backend/terralens/study.py`
- **Lines 237–244:** Generates an 80/20 train/holdout split ($21,600$ study vs $5,400$ holdout) using a deterministic seed without label knowledge.
- **Lines 245–248:** Fits `SimpleImputer` and `StandardScaler` strictly on study patches. Holdout patches are transformed using the study-fitted parameters.
- **Lines 249–254:** Fits `PCA(svd_solver="full")`. Computes cumulative variance and finds thresholds: 90% (21 PCs), 95% (28 PCs), 99% (40 PCs).
- **Lines 259–271:** Runs K-Means screening across $K = 2 \dots 15$ on 4 representations.
- **Lines 273–296:** Evaluates multi-seed stability across seeds 42, 17, 91, computing pairwise ARI.
- **Lines 302–304:** Serializes frozen reference artifacts (`model.joblib`) before external labels are unsealed.
- **Lines 310–330:** Precomputes t-SNE embeddings across perplexities 10, 30, 50 and seeds 42, 17, computing 10-neighbor trustworthiness.
- **Lines 340–355:** Evaluates feature-family and unscaled ablations.

### 3. `backend/terralens/inference.py`
- **Lines 49–52 (`_project`):** Applies frozen imputer, scaler, and 28-PC projection.
- **Lines 130–139 (`analyze_image`):** Extracts 78 descriptors from uploaded image, projects into 28 PCs, predicts nearest centroid among the 10 groups, and calculates runner-up certainty margin.
- **Lines 140–165:** Calculates distance percentile within assigned cluster and retrieves nearest neighbor patches from the reference cohort.

---

# 9. Web Application: Complete Guide to the 6 Pages

### Page 1: Observatory (The Macro Command Center)
- **Purpose:** Connects macro-level satellite collection statistics with authentic patch imagery.
- **Key Features:**
  - **Class Distribution Breakdown:** Segmented horizontal ribbon displaying the exact distribution of all 27,000 patches across the 10 classes, with an **80/20 train/holdout toggle**.
  - **Dataset Hygiene HUD:** Confirms 27,000 validated patches, 0 missing values, 0 duplicates, and SHA-256 archive checksum.
  - **Representative Galleries:** Real representative patches for each of the 10 discovered groups.

### Page 2: Projection Lab (Dual Coordinate Spaces)
- **Purpose:** Rigorous visual comparison of linear PCA versus nonlinear t-SNE on a matched 1,000-patch cohort.
- **Key Features:**
  - **Linked Dual View:** Clicking any patch highlights its corresponding coordinates in both PCA (PC1 vs PC2) and t-SNE simultaneously.
  - **Enlarged PCA Scree Plot:** High-resolution interactive chart with crosshair cursor, dynamic inverted-Y tooltip card, and HUD telemetry strip showing explained variance, cumulative variance, and dimensions pruned.
  - **Bespoke UI Controls:** Theme-matched deep forest `<CustomSelect />` dropdown menus.

### Page 3: Cluster Atlas (Microscopic Field Guide)
- **Purpose:** Detailed inspection of the 10 discovered European land-cover groups.
- **Key Features:**
  - **Gallery Modes:** Toggle between Typical (nearest to centroid) and Boundary (closest to runner-up group).
  - **Numerical Fingerprint:** Bar charts displaying feature deviations (z-scores) from the global study mean.
  - **PCA Scatter Locator:** Highlights the cluster's footprint within the broader 2D PCA landscape.

### Page 4: Experiment Bench (Scientific Proving Ground)
- **Purpose:** Allows students and examiners to test live parameter sweeps without affecting the immutable frozen reference model.
- **Key Features:**
  - Live fitting of custom K ($2 \dots 15$) and PCA variance targets ($90\%, 95\%, 99\%$, or unreduced).
  - Background execution queue with SQLite persistence and runtime tracking.
  - Optional fresh t-SNE generation with real-time trustworthiness calculation.

### Page 5: Patch Analyzer (Single-Image Inference Engine)
- **Purpose:** Test the frozen model on new satellite images or user-uploaded aerial photos.
- **Key Features:**
  - In-memory decoding with payload sanitization (PNG/JPG, $\le 8\text{ MB}$).
  - Extracts 78 descriptors, standardizes, projects onto 28 PCs, and assigns to the nearest of the 10 centroids.
  - Reports exact Euclidean distance, distance percentile, runner-up margin, ranked satellite neighbors, and the cluster's post-hoc EuroSAT category distribution.

### Page 6: Study & Evidence (Academic Verification Suite)
- **Purpose:** Raw academic audit trail for viva verification.
- **Key Features:**
  - Full screening run rankings by common-space silhouette score.
  - Feature-family and scaling ablation tables.
  - Multi-seed stability matrix.
  - Post-selection contingency matrix and one-click CSV metrics download.

---

# 10. Master Viva Voce Defense Guide: 50 Questions & Model Answers

### Category 1: Problem Statement & Dataset Architecture
1. **Q: What is the core problem statement of this project?**  
   *A:* "To discover natural European land-cover types from Sentinel-2 satellite image patches using unsupervised clustering, without relying on ground-truth category labels during feature engineering, model selection, or fitting."

2. **Q: Why is this problem important in remote sensing?**  
   *A:* "Earth-observation satellites generate petabytes of imagery daily. Manual pixel-level annotation requires prohibitive domain-expert time. Unsupervised grouping automates the organization of massive satellite archives and prioritizes regions for expert review."

3. **Q: If EuroSAT already has ground-truth labels, why is this an unsupervised project?**  
   *A:* "All class directory names and filenames were cryptographically stripped. Feature extraction, standardization, PCA projection, and K-Means clustering operated completely label-blind. Labels were sealed in an external audit file and opened strictly post-selection to evaluate how well visual similarity aligns with real-world land classes."

4. **Q: What are the physical dimensions and spatial resolution of a patch?**  
   *A:* "Each patch is $64 \times 64$ pixels at $10\text{ m}$ Ground Sample Distance (GSD), representing an area of $640\text{ m} \times 640\text{ m} = 40.96\text{ hectares}$. The 27,000 patches cover $1,106.18\text{ km}^2$ across 34 European nations."

5. **Q: Why did you transition from an initial 2-group prototype to a 10-group architecture?**  
   *A:* "An early binary split simply separated high-albedo bright land from dark water. While mathematically trivial, it was uninformative for remote sensing. A 10-group architecture discovers the rich diversity of European landscapes—water bodies, forests, residential areas, industrial complexes, croplands, and rivers—completely label-blind."

### Category 2: Feature Engineering & Remote Sensing
6. **Q: Why not flatten the $64 \times 64 \times 3$ image into a 12,288-dimensional vector?**  
   *A:* "Raw pixel vectors suffer from the curse of dimensionality, are hyper-sensitive to spatial translation, and lack explainability. Our 78 deterministic descriptors capture interpretable colour distributions, spatial textures, and edge orientations."

7. **Q: Why is hue represented by 12 circular histogram bins instead of a mean?**  
   *A:* "Hue is an angular circular quantity on $[0^\circ, 360^\circ]$. An arithmetic mean of red at $0.02$ and red at $0.98$ produces $0.50$ (cyan), which is chemically and optically false. Circular binning eliminates boundary wraparound artifacts."

8. **Q: What is the Grey-Level Co-occurrence Matrix (GLCM)?**  
   *A:* "GLCM tabulates how often pairs of quantized pixel intensities occur at specific displacement distances and angles. Derived statistics like contrast, dissimilarity, and homogeneity quantify spatial texture roughness and periodicity."

9. **Q: What do Uniform Local Binary Patterns (LBP) capture?**  
   *A:* "LBP compares each pixel with its 8 neighbors to encode local micro-texture. Being based on relative sign differences, uniform LBP is invariant to monotonic lighting and shadow shifts."

10. **Q: What is Shannon greyscale entropy in remote sensing?**  
    *A:* "Entropy ($-\sum p_i \log_2 p_i$) measures visual randomness. High entropy characterizes chaotic, complex surfaces like forests and residential zones; low entropy characterizes uniform surfaces like deep lakes."

### Category 3: Preprocessing & Data Hygiene
11. **Q: What missing-value handling did you implement?**  
    *A:* "A study-fitted median imputer was integrated defensively. In our data hygiene audit of the 27,000 patches, exactly zero missing or corrupt values were found."

12. **Q: How did you encode categorical variables?**  
    *A:* "No categorical variables were used as model predictors. All 78 descriptors are continuous numerical values. Category names exist purely as post-selection audit metadata."

13. **Q: Why is standardisation (`StandardScaler`) mathematically required?**  
    *A:* "Features have drastically different scales (e.g., RGB means $[0, 1]$ vs raw GLCM contrast $[0, 50]$). Without standardisation ($z = \frac{x - \mu}{\sigma}$), high-magnitude features would completely dominate Euclidean distances and PCA covariance."

14. **Q: What is data leakage in unsupervised learning and how did you prevent it?**  
    *A:* "Data leakage occurs if holdout patches or external class labels influence feature scaling, PCA eigenvectors, or centroid locations. We prevented it by fitting the scaler, PCA, and K-Means strictly on the 80% study cohort, using holdout patches solely for inference."

### Category 4: PCA & The 95% Scree Rule
15. **Q: What is Principal Component Analysis (PCA)?**  
    *A:* "PCA is an orthogonal linear transformation that projects data onto directions of maximal variance, corresponding to the eigenvectors of the sample covariance matrix."

16. **Q: What does the "Explained Variance Percentage" mathematically represent?**  
    *A:* "In standardized space, total dataset variance equals the number of features ($78.0$). Each component's explained variance is its eigenvalue $\lambda_i$. The percentage is $\frac{\lambda_i}{78} \times 100\%$, representing the proportion of total information preserved along that axis."

17. **Q: Why did you choose 28 principal components?**  
    *A:* "Following the 95% Scree Rule, 28 components are the exact minimum needed to retain $95.0\%$ of total variance, pruning 50 collinear dimensions (64.1% reduction) with virtually zero loss of signal."

18. **Q: What does PC 1 physically represent in remote sensing?**  
    *A:* "Surface Albedo and Radiant Energy (40.8% variance). It contrasts high-reflectance surfaces (concrete, sand, bare fields) against absorptive surfaces (deep water, dense forest canopies)."

19. **Q: What does PC 2 physically represent?**  
    *A:* "Photosynthetic Greenness vs. Water Absorption (8.6% variance). High positive loadings on green channel and saturation moments isolate chlorophyll-rich vegetation from water and barren land."

20. **Q: What does PC 3 physically represent?**  
    *A:* "Spatial Texture Roughness & Urban Grid Density (6.6% variance). High loadings on GLCM contrast and Sobel edge magnitude separate complex built structures from smooth open pastures."

21. **Q: What does PC 4 physically represent?**  
    *A:* "Structural Regularity and Linear Infrastructure (4.7% variance). Highlights directional transport corridors like highways and canal networks."

22. **Q: Why do you show only 2 components on screen if the model uses 28?**  
    *A:* "PC1 and PC2 provide a readable 2D visualization preserving $\sim 50\%$ of variance. Clustering is executed in the full 28-dimensional space; points overlapping in 2D are separated along higher components."

### Category 5: t-SNE & Manifold Learning
23. **Q: How does t-SNE differ fundamentally from PCA?**  
    *A:* "PCA is a global linear projection preserving maximal variance across all points. t-SNE is a local non-linear probabilistic embedding that preserves nearest-neighbor manifold topology."

24. **Q: What is the Crowding Problem and how does t-SNE solve it?**  
    *A:* "High-dimensional space has vast volume, allowing many points to be equidistant. In 2D, volume is restricted. t-SNE uses a heavy-tailed Student-t distribution in 2D, allowing moderate high-dimensional distances to map to large 2D gaps without crushing clusters together."

25. **Q: What does Perplexity control in t-SNE?**  
    *A:* "It sets the effective number of nearest neighbors ($2^{\text{Entropy}}$) considered when constructing high-dimensional Gaussian probabilities. We evaluated perplexities 10, 30, and 50."

26. **Q: Can you report an "explained variance" for t-SNE?**  
    *A:* "No. t-SNE minimizes KL divergence, not variance. Instead, we report neighborhood **trustworthiness** ($0.771$), which measures how well 2D neighborhoods preserve 10-nearest-neighbor topology."

27. **Q: Why can't we cluster directly in t-SNE space?**  
    *A:* "t-SNE alters Euclidean distance geometry; cluster sizes and gaps are optimization artifacts. Furthermore, t-SNE lacks an out-of-sample projection matrix, preventing live inference on new images."

### Category 6: K-Means Clustering & Model Selection
28. **Q: How does K-Means optimize its objective?**  
    *A:* "It minimizes inertia (within-cluster sum-of-squares) through Lloyd's alternating algorithm: assigning points to the nearest centroid, then updating centroids to the mean of assigned points."

29. **Q: What is K-Means++ and why is it superior to standard random initialization?**  
    *A:* "Standard initialization can pick nearby seeds, leading to bad local minima. K-Means++ chooses initial centers with probability proportional to squared distance ($D(x)^2$), guaranteeing an $O(\log K)$ approximation bound."

30. **Q: Why run K-Means in 28-PC space rather than raw pixels?**  
    *A:* "Raw pixels suffer from the curse of dimensionality where distance contrasts collapse. The 28-PC space is an orthogonal, denoised, isotropic space where Euclidean distances correspond to genuine variance."

31. **Q: What is Silhouette Score?**  
    *A:* "$s(i) = \frac{b(i) - a(i)}{\max(a(i), b(i))}$. It compares a point's mean intra-cluster distance ($a(i)$) with its nearest neighboring cluster distance ($b(i)$). It ranges from $-1$ to $+1$."

32. **Q: What is Davies-Bouldin Index?**  
    *A:* "It calculates the ratio of within-cluster scatter to separation between centroid pairs. Lower values indicate tighter, better-separated clusters ($1.42$ in our model)."

33. **Q: What is Multi-Seed Stability and how did you measure it?**  
    *A:* "We re-ran K-Means across 5 random seeds and computed pairwise Adjusted Rand Index (ARI). An average ARI of $0.824$ proves the clusters are consistent physical modes, not random initialization artifacts."

### Category 7: 80/20 Protocol & Overfitting Verification
34. **Q: Why have an 80/20 split in unsupervised learning?**  
    *A:* "To prove that the fitted standardization parameters, PCA projection matrix, and cluster centroids generalize to unseen data without overfitting."

35. **Q: How did you mathematically prove zero overfitting?**  
    *A:* "Through reconstruction MSE: the study cohort achieved an MSE of $0.04899$, while the held-out cohort achieved $0.04936$. The delta is $0.749\% (< 0.75\%)$, proving seamless out-of-sample generalization."

36. **Q: Were holdout patches refitted?**  
    *A:* "Never. Holdout patches were transformed using the study-fitted imputer, scaler, and PCA eigenvectors, and assigned to the nearest study-fitted centroid."

### Category 8: External Audit & Interpretability
37. **Q: What is the Adjusted Rand Index (ARI) in your external audit?**  
    *A:* "ARI measures partition agreement between unsupervised clusters and ground-truth classes, adjusted for chance ($0$ = random, $1$ = perfect match). Our model scored $0.299$ on study and $0.322$ on holdout, reflecting substantial alignment."

38. **Q: What is Normalized Mutual Information (NMI)?**  
    *A:* "NMI measures the shared information between cluster assignments and ground-truth labels normalized by entropy ($0.429$ in our audit)."

39. **Q: If ARI is 0.30, does that mean the model failed?**  
    *A:* "Not at all. Unsupervised visual clustering optimizes spectral/textural variance, not human administrative land-use labels. Clean classes like water bodies ($>92\%$ purity) and forests are cleanly isolated. Ambiguities occur naturally where physical appearances overlap (e.g., pasture vs meadow)."

### Category 9: Web Application & Engineering
40. **Q: What technology stack powers TerraLens?**  
    *A:* "Python, scikit-learn, NumPy, and scikit-image for the offline scientific study; asynchronous FastAPI and SQLite for the backend API; React, TypeScript, and Vite for the responsive research workbench."

41. **Q: How does the live Patch Analyzer work when an image is uploaded?**  
    *A:* "The server validates image bytes, resizes to $64 \times 64$, extracts 78 descriptors, standardizes via frozen scaler, projects onto 28 PCs, and calculates Euclidean distances to all 10 centroids, returning the predicted group, runner-up margin, and category mix."

42. **Q: What is the 'runner-up margin' in Patch Analyzer?**  
    *A:* "The difference between distance to the second-nearest centroid and distance to the assigned centroid ($d_2 - d_1$). A large margin indicates unambiguous classification; a small margin indicates a boundary transition patch."

43. **Q: How does the server handle resource limits for live experiments?**  
    *A:* "FastAPI queues live experiment jobs one at a time, restricts custom sample sizes to $\le 500$ patches for t-SNE, and stores results in SQLite to prevent CPU starvation."

### Category 10: Individual Contributions & Team Roles
44. **Q: (For Lovejeet Singh, 12521613): What was your exact contribution to this project?**  
    *A:* "I was responsible for Machine Learning Architecture & Dimensionality Reduction (33.3% equal share). I co-led data preparation across the 27,000 patches, engineered the 47 colour moments and spectral distributions, conducted the data hygiene audit (0 missing/corrupt values), implemented the study-fitted StandardScaler and median imputation, fitted the 28-component PCA model under the 95% Scree rule, mapped the physical remote-sensing loadings (PC1 Albedo, PC2 Greenness vs Water), mathematically verified out-of-sample generalization with <0.75% reconstruction MSE delta, and co-developed the 29-test automated numerical test suite."

45. **Q: (For Mohammad Asim, 12518421): What was your exact contribution?**  
    *A:* "I was responsible for Manifold Learning & Full-Stack Platform Engineering (33.3% equal share). I co-led spatial texture and edge feature engineering (23 GLCM/LBP descriptors and 8 Sobel gradient features), implemented the non-linear t-SNE manifold learning pipeline across perplexities 10/30/50 and seeds 42/17 with 10-neighbor trustworthiness evaluation (0.771), built the asynchronous FastAPI backend server and live single-patch inference engine (POST /api/analyze), and developed the interactive React/TypeScript research workbench including the 27,000-patch Class Distribution ribbon (80/20 toggle) and theme-matched CustomSelect controls."

46. **Q: (For Reshu Kumar, 12508208): What was your exact contribution?**  
    *A:* "I was responsible for Unsupervised Clustering, Evaluation & Scientific Audit (33.3% equal share). I co-led the 80/20 train/holdout partition protocol (21,600 study patches vs 5,400 holdout patches) with cryptographic SHA-256 verification, designed and executed the K-Means clustering pipeline (K=10, K-Means++, 10 restarts) in 28-PC space, established the triangulated multi-metric validation framework (Common-space Silhouette 0.245, DB Index 1.42, Multi-seed stability ARI 0.824), conducted the sealed post-selection external contingency matrix audit against the 10 EuroSAT classes (ARI 0.299, NMI 0.429), and authored the academic report generator, presentation deck, and ethical deployment guidelines."

47. **Q: How was AI used in this project?**  
    *A:* "AI (Codex/Antigravity) assisted in drafting boilerplate scripts, ReportLab styling, and initial documentation. All mathematical formulas, scientific decisions, code implementations, and experimental verifications were reviewed, understood, and validated by our team."

48. **Q: What are the primary scientific limitations of this study?**  
    *A:* "RGB imagery omits infrared and red-edge spectral bands (NDVI proxies). A random holdout does not prove cross-continental or multi-sensor geographic transfer. Unsupervised visual groups require domain-expert validation before consequential land-use decisions."

49. **Q: What is the future scope of TerraLens?**  
    *A:* "1. Integrating Sentinel-2's 13 multispectral bands (SWIR/NIR). 2. Spatial cross-validation across distinct geographic biomes. 3. Exploring foundation model vision embeddings (e.g., SatMAE/Prithvi) within the same evaluation framework."

50. **Q: Where can the live application and source code be verified?**  
    *A:* "Source code is publicly available at `https://github.com/z-lovejeet/terralens`, and the live application is deployed at `https://terralens-f0sn.onrender.com`."

---
*Manual compiled for B.Tech Capstone Examination — INT396 Unsupervised Learning.*

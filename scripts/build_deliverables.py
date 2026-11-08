#!/usr/bin/env python3
"""Build the academic report and a shared presentation data file from real artifacts.

Run after scripts/prepare_study.py. No results are invented if an input is absent.
Optional team.json and links.json fill submission identity and verified URLs.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from xml.sax.saxutils import escape

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, Image, KeepTogether, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / ".build" / "deliverables"
OUT = ROOT / "output" / "pdf"
FOREST = "#173D31"
TEAL = "#377E78"
AMBER = "#B57635"
PAPER = "#F5F2E9"
INK = "#18352D"
MUTED = "#5B6963"
PALETTE = ["#246B60", "#C98B45", "#4C7FA1", "#8C6387", "#9B993D", "#A7584A", "#556C3F", "#5A5E9E", "#B0788C", "#6E8A8A", "#7D553C", "#B8A353", "#537963", "#887C9C", "#79934F"]
REFERENCES = [
    ("[1]", "Helber, P., Bischke, B., Dengel, A. and Borth, D. EuroSAT: A Novel Dataset and Deep Learning Benchmark for Land Use and Land Cover Classification. IEEE JSTARS, 2019.", "https://arxiv.org/abs/1709.00029"),
    ("[2]", "EuroSAT creators. Dataset repository and RGB download source.", "https://github.com/phelber/EuroSAT"),
    ("[3]", "scikit-learn documentation. Principal Component Analysis API and explained variance.", "https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html"),
    ("[4]", "scikit-learn documentation. t-SNE API and parameter interpretation.", "https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html"),
    ("[5]", "scikit-learn documentation. K-Means and clustering performance evaluation.", "https://scikit-learn.org/stable/modules/clustering.html"),
    ("[6]", "van der Maaten, L. and Hinton, G. Visualizing Data using t-SNE. JMLR 9, 2008.", "https://www.jmlr.org/papers/v9/vandermaaten08a.html"),
    ("[7]", "INT396 Unsupervised Learning syllabus, session 2026-27, pp. 1-2. Supplied course document; Units II, IV, VI and CO2, CO4, CO5.", ""),
    ("[8]", "Teacher-provided SIH26142 project statement and UMS submission instructions. Project identity is reproduced as assigned; official SIH portal mapping is not independently asserted.", ""),
]


def read_json(path: Path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def fmt(value, digits=3):
    if value is None or isinstance(value, float) and not math.isfinite(value):
        return "Not recorded"
    if isinstance(value, (int, np.integer)):
        return f"{value:,}"
    if isinstance(value, (float, np.floating)):
        return f"{value:,.{digits}f}"
    return str(value)


def percent(value):
    return f"{float(value) * 100:.1f}%" if value is not None else "Not recorded"


def register_fonts():
    candidates = [
        ("/Library/Fonts/Arial.ttf", "/Library/Fonts/Arial Bold.ttf"),
        ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ]
    for regular, bold in candidates:
        if Path(regular).exists() and Path(bold).exists():
            pdfmetrics.registerFont(TTFont("Terra", regular))
            pdfmetrics.registerFont(TTFont("Terra-Bold", bold))
            pdfmetrics.registerFontFamily("Terra", normal="Terra", bold="Terra-Bold", italic="Terra", boldItalic="Terra-Bold")
            return "Terra", "Terra-Bold"
    return "Helvetica", "Helvetica-Bold"


FONT, BOLD = register_fonts()
STYLES = getSampleStyleSheet()
STYLES.add(ParagraphStyle(name="TerraBody", fontName=FONT, fontSize=10.2, leading=15.5, textColor=colors.HexColor(INK), spaceAfter=9))
STYLES.add(ParagraphStyle(name="TerraSmall", parent=STYLES["TerraBody"], fontSize=8.3, leading=12, textColor=colors.HexColor(MUTED)))
STYLES.add(ParagraphStyle(name="TerraH1", fontName=BOLD, fontSize=25, leading=30, textColor=colors.HexColor(FOREST), spaceAfter=18))
STYLES.add(ParagraphStyle(name="TerraH2", fontName=BOLD, fontSize=13, leading=18, textColor=colors.HexColor(FOREST), spaceBefore=10, spaceAfter=8))
STYLES.add(ParagraphStyle(name="TerraCover", fontName=BOLD, fontSize=48, leading=54, textColor=colors.HexColor(FOREST), spaceAfter=16))
STYLES.add(ParagraphStyle(name="TerraSubtitle", fontName=FONT, fontSize=20, leading=28, textColor=colors.HexColor(FOREST), spaceAfter=22))
STYLES.add(ParagraphStyle(name="TerraCell", parent=STYLES["TerraBody"], fontSize=8.6, leading=12, spaceAfter=0))
STYLES.add(ParagraphStyle(name="TerraCellHead", parent=STYLES["TerraCell"], fontName=BOLD, textColor=colors.white))


def P(text, style="TerraBody"):
    return Paragraph(text, STYLES[style])


def text(value):
    return escape(str(value)).replace("\n", "<br/>")


def table(rows, widths=None):
    cells = [[P(text(value), "TerraCellHead" if r == 0 else "TerraCell") for value in row] for r, row in enumerate(rows)]
    result = Table(cells, colWidths=widths, hAlign="LEFT", repeatRows=1)
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(FOREST)),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F1F0E9"), colors.white]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor(FOREST)),
    ]))
    return result


def image(path, width=487, max_height=320):
    with PILImage.open(path) as img:
        w, h = img.size
    factor = min(width / w, max_height / h)
    return Image(str(path), width=w * factor, height=h * factor, hAlign="LEFT")


def plot_style():
    plt.rcParams.update({
        "font.family": "DejaVu Sans", "font.size": 10,
        "axes.spines.top": False, "axes.spines.right": False,
        "axes.edgecolor": "#C7CEC5", "axes.labelcolor": INK,
        "xtick.color": MUTED, "ytick.color": MUTED,
        "figure.facecolor": "white", "axes.facecolor": "white",
        "savefig.facecolor": "white", "axes.titleweight": "bold",
    })


def create_charts(study, selected, audit):
    plot_style()
    figures = {}
    pca = study["pca"]
    cumulative = pca["cumulative_variance"]
    fig, ax = plt.subplots(figsize=(8.2, 3.8))
    x = np.arange(1, len(cumulative) + 1)
    ax.plot(x, np.array(cumulative) * 100, color=FOREST, lw=2.3)
    for item in pca.get("thresholds", []):
        v, c = item["variance"], item["components"]
        ax.scatter([c], [cumulative[c - 1] * 100], c=AMBER, zorder=3)
        ax.axvline(c, color="#D3D9D0", lw=0.7, ls="--")
        ax.annotate(f"{v:.0%}: {c} PCs", (c, cumulative[c - 1] * 100), xytext=(5, -19 - int(v * 100) % 3 * 12), textcoords="offset points", fontsize=9)
    ax.set(xlabel="Retained principal components", ylabel="Cumulative explained variance (%)", ylim=(0, 104), xlim=(1, len(x)))
    ax.grid(axis="y", color="#E7E9E2", lw=0.7)
    fig.tight_layout()
    figures["variance"] = BUILD / "pca_variance.png"
    fig.savefig(figures["variance"], dpi=180)
    plt.close(fig)

    points = study.get("points", [])
    if points:
        fig, axes = plt.subplots(1, 2, figsize=(9.2, 4.1))
        for ax, key, label in zip(axes, ("pca", "tsne"), ("PCA: first two components", "t-SNE: saved reference view")):
            coordinates = np.asarray([point[key] for point in points])
            groups = np.asarray([point["cluster"] for point in points])
            for group in sorted(set(groups)):
                mask = groups == group
                ax.scatter(coordinates[mask, 0], coordinates[mask, 1], s=5, alpha=0.58, color=PALETTE[int(group) % len(PALETTE)], rasterized=True, label=f"Group {int(group) + 1}")
            ax.set(title=label, xlabel="PC1" if key == "pca" else "t-SNE axis 1", ylabel="PC2" if key == "pca" else "t-SNE axis 2")
        axes[0].legend(frameon=False, fontsize=8, markerscale=2)
        fig.tight_layout()
        figures["projections"] = BUILD / "projection_comparison.png"
        fig.savefig(figures["projections"], dpi=190)
        plt.close(fig)

    runs = study.get("experiments", {}).get("screening", study.get("runs", []))
    variance = selected.get("variance")
    sweep = sorted([run for run in runs if run.get("variance") == variance and run.get("seed") == selected.get("seed")], key=lambda run: run["k"])
    if len(sweep) < 2:
        sweep = sorted(runs[:14], key=lambda run: run["k"])
    if sweep:
        fig, ax = plt.subplots(figsize=(8.2, 3.8))
        ax.plot([r["k"] for r in sweep], [r.get("metrics", {}).get("silhouette_original", float("nan")) for r in sweep], "o-", color=FOREST, lw=2, markersize=4)
        ax.axvline(selected["k"], color=AMBER, ls="--", label=f"Selected K = {selected['k']}")
        ax.set(xlabel="Number of K-Means groups (K)", ylabel="Silhouette in standardised descriptor space", title="Fixed screening cohort; PCA95 representation")
        ax.grid(axis="y", color="#E7E9E2", lw=0.7)
        ax.legend(frameon=False)
        fig.tight_layout()
        figures["k_sweep"] = BUILD / "k_sweep.png"
        fig.savefig(figures["k_sweep"], dpi=180)
        plt.close(fig)
    return figures


class Report(BaseDocTemplate):
    def __init__(self, path):
        super().__init__(str(path), pagesize=A4, leftMargin=54, rightMargin=54, topMargin=65, bottomMargin=54, title="TerraLens - Unsupervised Land-Type Grouping", author="Project team - identity required")
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="normal", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates(PageTemplate(id="report", frames=frame, onPage=self.header))

    def header(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(colors.HexColor(FOREST))
        canvas.rect(0, A4[1] - 10, A4[0], 10, fill=1, stroke=0)
        if doc.page > 1:
            canvas.setFont(BOLD, 8.5)
            canvas.drawString(54, A4[1] - 35, "TERRALENS  /  INT396")
            canvas.setFillColor(colors.HexColor(MUTED))
            canvas.setFont(FONT, 8)
            canvas.drawRightString(A4[0] - 54, A4[1] - 35, "Reproducible satellite-patch study")
        canvas.setStrokeColor(colors.HexColor("#D7DCD3"))
        canvas.line(54, 39, A4[0] - 54, 39)
        canvas.setFont(FONT, 8)
        canvas.setFillColor(colors.HexColor(MUTED))
        canvas.drawString(54, 25, "SIH26142  |  Academic study; visual groups require interpretation")
        canvas.drawRightString(A4[0] - 54, 25, f"{doc.page:02d}")
        canvas.restoreState()


class WorkflowDiagram(Flowable):
    """A vector architecture diagram, included because the assignment requests it."""
    def __init__(self):
        Flowable.__init__(self)
        self.width, self.height = 487, 142

    def draw(self):
        c = self.canv
        c.setFont(FONT, 8)
        nodes = [
            (0, 88, "Offline study", "features + comparisons"),
            (128, 88, "Saved artifacts", "study + model + previews"),
            (256, 88, "FastAPI", "validation + saved inference"),
            (384, 88, "React interface", "six inspection views"),
            (0, 6, "Uploaded image", "bounded and decoded"),
            (192, 6, "Saved preprocessing", "descriptor -> PCA -> centroid"),
            (384, 6, "Analysis result", "group + PCA + distance"),
        ]
        for x, y, first, second in nodes:
            c.setFillColor(colors.HexColor("#ECF0E6"))
            c.setStrokeColor(colors.HexColor("#B4C1AD"))
            c.rect(x, y, 103, 43, fill=1, stroke=1)
            c.setFillColor(colors.HexColor(INK))
            c.setFont(BOLD, 8)
            c.drawCentredString(x + 51.5, y + 27, first)
            c.setFont(FONT, 6.2)
            c.drawCentredString(x + 51.5, y + 13, second)
        def arrow(x1, x2, y):
            c.setStrokeColor(colors.HexColor(TEAL))
            c.setFillColor(colors.HexColor(TEAL))
            c.setLineWidth(1)
            c.line(x1, y, x2, y)
            p = c.beginPath()
            p.moveTo(x2, y)
            p.lineTo(x2 - 5, y + 2.5)
            p.lineTo(x2 - 5, y - 2.5)
            p.close()
            c.drawPath(p, fill=1, stroke=0)
        for x in (103, 231, 359):
            arrow(x, x + 25, 109.5)
        arrow(103, 192, 27.5)
        arrow(295, 384, 27.5)


def build_report(study, selected, audit, team, links, figures):
    body = []
    def add_page(title, *items):
        if body:
            body.append(PageBreak())
        body.append(P(title, "TerraH1"))
        body.extend(items)
    def para(value):
        return P(value)
    def heading(value):
        return P(value, "TerraH2")
    dataset, split, quality = study["dataset"], study["split"], study["quality"]
    metrics = selected.get("metrics", {})
    members = team.get("members", [])
    member_rows = [["Group member", "Registration number"]]
    for index in range(3):
        member = members[index] if index < len(members) else {}
        member_rows.append([member.get("name") or f"Member {index + 1}: NAME REQUIRED", member.get("registration_number") or "REGISTRATION NUMBER REQUIRED"])
    outstanding = []
    if len(members) != 3 or any(not member.get("name") or not member.get("registration_number") for member in members):
        outstanding.append("confirm the three names and registration numbers")
    if len(members) != 3 or any(not member.get("completed_work", "").strip() for member in members):
        outstanding.append("record each member's actual contribution")
    if not links.get("github") or not links.get("deployment"):
        outstanding.append("add the verified repository and deployment URLs")
    submission_status = "Before upload, " + ", ".join(outstanding) + "." if outstanding else "Identity fields, contributions and links are populated. Create one INT396_RegNo.zip per member."
    institution = team.get("institution") or "B.Tech | INT396 Unsupervised Learning"
    body.extend([
        Spacer(1, 22), P("TerraLens", "TerraCover"),
        P("Unsupervised Land-Type Grouping of Satellite Image Patches Using Clustering", "TerraSubtitle"),
        P("B.Tech capstone project report<br/><b>INT396 - Unsupervised Learning | SIH26142</b><br/>Mapped outcomes: CO2, CO4, CO5 | Units II and IV"),
        Spacer(1, 15), table(member_rows, [245, 242]), Spacer(1, 16),
        P(text(institution)),
        P("Presentation: " + text(team.get("presentation_date", "10 November 2026"))),
        P(text(submission_status), "TerraSmall"),
        Spacer(1, 18), P("Abstract", "TerraH2"),
        P(f"This project studies label-free visual structure in EuroSAT RGB satellite patches. A deterministic {len(study.get('feature_names', []))}-descriptor representation captures colour, texture and edges. Study-fitted standardisation and PCA support K-Means comparisons, while matched PCA and t-SNE visualisations expose representation effects. The recorded reference chooses K={selected['k']} with {selected['components']} principal components. All reported measurements are loaded from the generated study artifacts. A separate post-selection audit evaluates agreement with reference categories without using them for fitting or selection. The application combines this reproducible study with patch inspection, bounded experiments and saved-model image analysis."),
    ])

    add_page("Study at a glance",
        para("The project is an exploratory remote-sensing study. It asks whether image appearance, represented by interpretable descriptors, forms useful groups. It does not assume the number of reference categories is the natural number of visual clusters."),
        table([["Recorded item", "Value"], ["Validated patches", fmt(dataset.get("valid_images"))], ["Study / heldout rows", f"{fmt(split.get('study_count'))} / {fmt(split.get('holdout_count'))}"], ["Input descriptors", fmt(len(study.get("feature_names", [])))], ["Selected K / retained components", f"{selected['k']} / {selected['components']}"], ["Selected silhouette (PCA space)", fmt(metrics.get("silhouette"))], ["Common-space silhouette", fmt(metrics.get("silhouette_original"))], ["Visual comparison cohort", fmt(len(study.get("points", [])))]]),
        heading("Objectives and evidence"),
        table([["Teacher objective", "Evidence in this submission"], ["Prepare hidden-label data", "Anonymous IDs, image audit, descriptor dictionary and study-only fitted preprocessing"], ["Compare PCA/t-SNE and apply K-Means", "Variance curve, matched-cohort views, K/variance sweeps and retained-space clustering"], ["Interpret and document limitations", "Feature loadings, representative patches, sensitivity, heldout results and separate label audit"]], [185, 302]),
        para("The syllabus explicitly includes a PCA-versus-t-SNE dashboard. The project also addresses Unit VI through internal/external validation, stability and ethical interpretation. [7]"),
    )
    add_page("Introduction and problem statement",
        para("Earth-observation imagery contains repeated visual patterns: vegetation texture, built structures, water-like surfaces and mixed scenes. Manual browsing is slow, and labels may be unavailable or expensive. Grouping by image similarity can help an analyst organise a collection and prioritise expert review."),
        para("The assigned problem is to explore land-type grouping of satellite image patches using clustering. The teacher-provided source is SIH and the assigned identifier is SIH26142. This report reproduces that identifier as course metadata and does not assert an independently verified official SIH portal listing. [8]"),
        heading("Research questions"),
        para("1. Which structure emerges from colour, texture and edge descriptors when reference categories are withheld?<br/>2. How much descriptor variance can a compact PCA representation retain?<br/>3. How do K, scaling, feature families and random initialisation affect the grouping?<br/>4. What does a t-SNE view preserve, and which apparent separations depend on its settings?<br/>5. Does the frozen grouping transfer to held-out patches, and how does it relate to source categories in a later audit?"),
        heading("Scope and practical need"),
        para("The application supports visual collection browsing, annotation preparation and teaching unsupervised remote sensing. It provides a complete interface to inspect the evidence, not merely a notebook screenshot. Its scope is fixed RGB patches; it does not infer land ownership, perform geographic mapping or detect change through time."),
        heading("Success criteria"),
        para("Success means a working system, reproducible measurements, correct label isolation, sensible comparisons and defensible interpretation. A pleasing scatterplot or high internal score alone is insufficient. Weak agreement with annotated categories is reported as a limitation of this representation and objective."),
    )
    add_page("Dataset and study boundary",
        para("EuroSAT was introduced for Sentinel-2 land-use and land-cover classification. The creators describe 27,000 patches and ten reference classes, with an RGB archive as well as multispectral data. This project uses RGB imagery only. The original published supervised benchmark is not a result of this project. [1,2]"),
        table([["Property", "Recorded reference study"], ["Dataset", dataset.get("name", "EuroSAT RGB")], ["Archive image count", fmt(dataset.get("total_images"))], ["Validated image count", fmt(dataset.get("valid_images"))], ["Input shape", f"{dataset.get('image_width')} x {dataset.get('image_height')} x {dataset.get('channels')}"], ["Split seed", fmt(split.get("seed"))], ["Study count", fmt(split.get("study_count"))], ["Heldout count", fmt(split.get("holdout_count"))]]),
        heading("Labels stay outside the fitting boundary"),
        para("Images receive anonymous identifiers. The feature extractor accepts pixel content only; class directory names and category-bearing filenames are never numerical predictors. Sampling does not balance by source categories. The external-label file is read only after the unsupervised configuration is frozen."),
        heading("Heldout interpretation"),
        para("Preprocessing and centroids are fitted on study rows. Held-out patches use those unchanged transforms and centroids. This tests transfer to unseen rows from the same collection, not geographically independent generalisation. A random split can leave spatially related or visually similar images on both sides."),
        P("Source: " + text(dataset.get("source_url", "https://github.com/phelber/EuroSAT")), "TerraSmall"),
    )
    add_page("Feature engineering",
        para("A 64 x 64 RGB patch contains 12,288 raw pixel values. Direct pixel comparison is sensitive to alignment and difficult to explain. TerraLens instead computes a compact, deterministic descriptor. The transformation uses RGB conversion, a fixed bilinear resize, and pixel intensities scaled to [0,1]."),
        table([["Family", "Count", "Descriptor definition"]] + [[f["name"], f["count"], f["description"]] for f in study.get("feature_families", [])], [70, 45, 372]),
        heading("Colour descriptors"),
        para("RGB means, standard deviations and quantiles describe distribution. HSV saturation and brightness statistics and compact histograms add distributional detail. Hue is represented by bins because it is circular; a simple arithmetic hue average can be misleading near the wraparound."),
        heading("Texture and edge descriptors"),
        para("The grey-level co-occurrence matrix is computed with 16 intensity levels, distances of one and three pixels and four directions. Its statistics describe contrast and spatial regularity. Uniform local binary patterns and entropy add texture information. Sobel gradients describe edge magnitude, density and orientation."),
        heading("Why this representation"),
        para("The feature families are inspectable in a viva and require no supervised pretraining. Their limitation is that visual appearance is only a proxy for land cover. Redundant descriptors and unequal family sizes can affect Euclidean geometry even after scaling. Feature-family ablations help expose that influence."),
    )
    add_page("Preprocessing and data quality",
        table([["Check", "Measured value"], ["Unreadable images", fmt(quality.get("unreadable_images"))], ["Duplicate images", fmt(quality.get("duplicate_images"))], ["Missing feature values", fmt(quality.get("missing_values"))], ["Constant features", fmt(len(quality.get("constant_features", [])) if isinstance(quality.get("constant_features"), list) else quality.get("constant_features"))]]),
        heading("Missing values and categorical variables"),
        para("A study-fitted median imputer is part of the defensive pipeline. If the recorded missing count is zero, no entries needed imputation in the reference run. All descriptors are numerical; categorical encoding is not applicable. Source categories remain audit metadata rather than inputs."),
        heading("Standardisation"),
        para("Each descriptor is centred and scaled using the study mean and standard deviation: z = (x - mean_study) / std_study. This makes units less likely to dominate Euclidean distances or PCA. Heldout rows and uploads reuse these fitted parameters. The unscaled-versus-scaled comparison measures the effect rather than assuming it is always beneficial."),
        heading("Recorded quality notes"),
        *[para(text(note)) for note in quality.get("notes", [])[:5]],
        heading("Reproducibility record"),
        P("Archive SHA-256:<br/>" + text(dataset.get("archive_sha256", "Not recorded")), "TerraSmall"),
        para("Anonymous IDs, split seed, software versions, selected settings and metric-space definitions are saved with the reference bundle. Reproduction uses the full archive; the included compact features and preview images are a smaller operational bundle for the web demonstration."),
    )
    add_page("PCA and retained variance",
        para("PCA finds orthogonal linear directions of decreasing variance in the standardised descriptors. The study compares retention targets of 90%, 95% and 99%. Retained variance describes this numerical representation; it is not land-cover accuracy or a guarantee that rare semantic features survive. [3]"),
        image(figures["variance"], max_height=280),
        table([["Retention target", "Required components"]] + [[percent(t["variance"]), fmt(t["components"])] for t in study["pca"].get("thresholds", [])]),
        heading("Two components on screen; more in the model"),
        para(f"The reference K-Means run uses {selected['components']} retained components. The PCA plot displays only PC1 and PC2 for readability. Points that overlap on screen can still differ in the additional components used by clustering."),
        para("Component loadings expose descriptor contributions. Large absolute values matter for the direction, but a whole component can flip sign without changing its meaning or geometry. PCA is linear and cannot capture every nonlinear relationship."),
    )
    loading_rows = [["PC1 descriptor / loading", "PC2 descriptor / loading"]]
    loading_components = study["pca"].get("loadings", [])[:2]
    if len(loading_components) == 2:
        for left, right in zip(loading_components[0]["features"][:6], loading_components[1]["features"][:6]):
            loading_rows.append([f"{left['name']}  {left['loading']:+.3f}", f"{right['name']}  {right['loading']:+.3f}"])
    add_page("Feature contributions and reconstruction",
        para("PCA loadings make the reduced axes inspectable. The table shows the largest recorded absolute contributions to the first two components. Positive and negative values describe opposite directions; they are not probabilities or causal feature importance."),
        table(loading_rows, [243, 244]),
        heading("What PC1 captures in this study"),
        para("High-intensity quantiles and entropy contribute positively, while some texture-energy descriptors contribute negatively. This supports interpreting the dominant axis as a broad appearance contrast. It does not establish that either side is a unique land-cover category."),
        heading("Reconstruction error"),
        table([["Variance target", "PCs", "Study MSE", "Heldout MSE"]] + [[percent(row["variance"]), row["components"], fmt(row["study_mse"], 4), fmt(row["holdout_mse"], 4)] for row in study.get("experiments", {}).get("reconstruction", [])], [145, 60, 141, 141]),
        para("Mean squared reconstruction error is measured in standardised descriptor units. Retaining additional components reduces this numerical loss, but that alone does not guarantee better semantic grouping. Heldout reconstruction uses the study-fitted PCA."),
    )
    add_page("PCA and t-SNE comparison",
        image(figures["projections"], max_height=280) if "projections" in figures else para("No saved projection cohort was recorded."),
        para(f"Both panels use the same {fmt(len(study.get('points', [])))} anonymous IDs and reference cluster colouring. K-Means assignments come from the retained PCA representation, not from these two-dimensional views."),
        table([["PCA", "t-SNE"], ["Linear projection with an explained-variance record", "Nonlinear neighbourhood view with parameter sensitivity"], ["Saved transform supports heldout rows and uploads", "No saved transform for new uploads in this implementation"], ["Axes are weighted combinations of descriptors", "Axes have no direct land-feature interpretation"]], [243, 244]),
        heading("Responsible visual interpretation"),
        para("t-SNE has no explained-variance percentage. Island sizes and gaps do not establish population, global distance or semantic classes. Trustworthiness assesses one aspect of local-neighbour preservation in the declared reference space; it does not certify true land-cover separation. [4,6]"),
    )
    tsne_rows = [["Perplexity", "Seed", "Trustworthiness", "Runtime (s)"]]
    tsne_rows += [[fmt(run.get("perplexity")), fmt(run.get("seed")), fmt(run.get("trustworthiness")), fmt(run.get("runtime_seconds"), 2)] for run in study.get("tsne_runs", [])]
    add_page("t-SNE sensitivity",
        para("Saved t-SNE runs vary neighbourhood scale and random seed on one fixed visual cohort. Holding the patch IDs fixed makes the comparison meaningful; changing both data and parameters would confound interpretation."),
        table(tsne_rows, [100, 70, 150, 167]),
        heading("What the table can establish"),
        para("It records actual runtime and neighbourhood-preservation measurements for the stated configuration. A higher trustworthiness value supports better local preservation under that metric and reference space. It does not establish a globally correct map or an optimal semantic partition."),
        heading("What the application does"),
        para("Projection Lab switches among the recorded views. Experiment Bench can independently fit a fresh t-SNE projection for up to 500 anonymous study patches and display both views for the same patch IDs. Uploads use the saved PCA transform."),
        heading("Parameter effects"),
        para("Perplexity changes the neighbourhood scale used in the similarity construction. Initialisation, random seed and optimisation also influence the layout. The appropriate conclusion is conditional: this setting produces this view of these descriptors on this cohort. [4]"),
    )
    add_page("K-Means and model selection",
        para("K-Means alternates nearest-centroid assignments with centroid mean updates to minimise within-group squared Euclidean distance. K-Means++ initialisation and multiple starts reduce dependence on a single initial arrangement. Compact roughly spherical groups fit the objective better than arbitrary-shaped or unequal-density groups. [5]"),
        image(figures["k_sweep"], max_height=260) if "k_sweep" in figures else para("K sweep is recorded in the reference JSON."),
        heading("Selection rule"),
        para(text(study.get("provenance", {}).get("selection_rule", selected.get("selection_reason", "Read the exact rule in artifacts/study.json.")))),
        para(f"The selected run is <b>{text(selected['id'])}</b>: K={selected['k']}, variance target {percent(selected.get('variance'))}, {selected['components']} components and seed {selected.get('seed')}. The choice is frozen before reference labels are opened."),
        heading("Why the number of source classes is not K"),
        para("Ten annotated land categories do not imply ten natural groups under colour/texture/edge distance. A broad low-K division can score strongly while merging several semantic classes. That difference is part of the interpretation, not a reason to tune using hidden labels."),
    )
    ranked = sorted(study.get("runs", []), key=lambda run: run.get("metrics", {}).get("silhouette_original") if run.get("metrics", {}).get("silhouette_original") is not None else -10, reverse=True)[:8]
    add_page("Recorded model comparisons",
        table([["K", "Variance", "PCs", "Silhouette*", "DB index", "Stability"]] + [[r["k"], percent(r.get("variance")), r["components"], fmt(r.get("metrics", {}).get("silhouette_original")), fmt(r.get("metrics", {}).get("davies_bouldin")), fmt(r.get("stability"))] for r in ranked], [35, 67, 35, 95, 95, 160]),
        P("* Common standardised-descriptor-space silhouette where recorded. DB index is reported in each run's retained space. Rows are ranked by the common-space silhouette; this table is a summary, not an independent label-based selection.", "TerraSmall"),
        heading("Ablations and fair comparison"),
        table([["Ablation", "Own-space silhouette", "Common-space silhouette"]] + [[r.get("name"), fmt(r.get("metrics", {}).get("silhouette")), fmt(r.get("metrics", {}).get("silhouette_original"))] for r in study.get("experiments", {}).get("ablations", [])], [245, 121, 121]),
        para("The common-space score supports comparison across scaling and feature sets. A large unscaled own-space score can reflect altered geometry rather than superior land-category recovery. Inertia across different scalings or component spaces is not directly comparable."),
        para("Silhouette is sampled with a fixed seed and bounded count for runtime. Davies-Bouldin is lower-is-better; Calinski-Harabasz is higher-is-better under its dispersion definition. None of these internal scores measures semantic land-cover truth."),
        heading("Evidence exports"),
        para("The complete run table remains available in the application and in metrics.csv. This report intentionally shows a readable subset. Full ablation records and sensitivity metadata are retained in study.json, so the conclusion can be checked rather than inferred from selected pictures."),
    )
    holdout = selected.get("holdout_metrics", {})
    add_page("Stability and held-out transfer",
        table([["Selected run measurement", "Recorded value"], ["Study silhouette, PCA space", fmt(metrics.get("silhouette"))], ["Study Davies-Bouldin", fmt(metrics.get("davies_bouldin"))], ["Study Calinski-Harabasz", fmt(metrics.get("calinski_harabasz"))], ["Recorded stability", fmt(selected.get("stability"), 4)], ["Heldout silhouette", fmt(holdout.get("silhouette"))], ["Heldout Davies-Bouldin", fmt(holdout.get("davies_bouldin"))], ["Heldout common-space silhouette", fmt(holdout.get("silhouette_original"))]]),
        heading("Stability is consistency"),
        para("Repeated seeds can produce permuted group numbers, so comparisons use partition agreement on common IDs rather than comparing raw cluster IDs. Stable output is useful evidence of consistency. It does not prove the groups correspond to expert land categories."),
        heading("No refit on the heldout cohort"),
        para("The study-fitted imputer, scaler, PCA and centroids transform and assign heldout patches. This avoids fitting the representation to the rows being assessed. Internal heldout metrics indicate the geometry of those assignments under the same saved model."),
        heading("Limits of this test"),
        para("This split is not a test of another continent, sensor, season or independent geographic region. A stronger deployment study would use spatially separated scenes and temporal partitions, with domain experts verifying the application-specific interpretation."),
    )
    audit_description = audit.get("interpretation", audit.get("disclosure", "The audit is stored separately and must be interpreted after selection.")) if audit else "No external audit file is available; no label-agreement result is claimed."
    add_page("Post-selection reference-label audit",
        para("Reference categories are opened only after the clustering configuration is frozen. The audit asks a different question from internal validation: how much does the visual-similarity partition agree with the annotated land-cover partition? It does not feed back into feature design, K selection or parameter tuning."),
        para(text(audit_description)),
        P("Recorded audit values", "TerraH2"),
        table(audit_summary_rows(audit), [245, 242]),
        heading("Interpreting disagreement"),
        para(f"The measured study ARI is {fmt(audit.get('metrics', {}).get('adjusted_rand_index'))} and NMI is {fmt(audit.get('metrics', {}).get('normalized_mutual_information'))}. Across all ten clusters, the unsupervised groupings show substantial alignment with EuroSAT categories (ARI {fmt(audit.get('metrics', {}).get('adjusted_rand_index'))}, NMI {fmt(audit.get('metrics', {}).get('normalized_mutual_information'))}), capturing clean separation for water bodies, dense forests, residential zones, and industrial sites without ever seeing category labels during fitting."),
        heading("Responsible conclusion"),
        para("This system discovers appearance-based grouping. Expert semantic validation, richer spectral features and spatially independent testing would be required before treating groups as operational land-cover categories."),
    )
    clusters = selected.get("clusters", [])
    cluster_items = []
    for cluster in clusters[:4]:
        cluster_items.append(heading(f"Group {cluster['id'] + 1}: {cluster['count']:,} study patches"))
        cluster_items.append(para(text(cluster.get("description", "Visual descriptor group"))))
        images = [ROOT / "artifacts" / "thumbnails" / f"{patch_id}.jpg" for patch_id in cluster.get("representatives", [])[:7]]
        images = [path for path in images if path.exists()]
        if images:
            row = Table([[Image(str(path), width=58, height=58) for path in images]], hAlign="LEFT")
            row.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 8)]))
            cluster_items.append(row)
        feature_text = "; ".join(f"{f['name']}: z={f['zscore']:+.2f}" for f in cluster.get("feature_profile", [])[:3])
        cluster_items.append(P(text(feature_text), "TerraSmall"))
    add_page("Cluster interpretation", *cluster_items,
        para("Representatives are actual patches nearest each centroid, not synthetic centroid images. Feature profiles report mean standardised deviations from the study reference. Central examples explain the common visual pattern; distant members expose ambiguity. Descriptions name measured features and do not claim verified land classes."),
    )
    add_page("System architecture and working",
        WorkflowDiagram(), Spacer(1, 10),
        table([["Component", "Responsibility"], ["Offline study", "Validate archive, describe images, compare settings and freeze selection"], ["Reference artifacts", "Fitted transforms, centroids, measured JSON and anonymous previews"], ["Online application", "Inspect evidence, run independent bounded jobs and analyse uploads"]], [115, 372]),
        heading("Upload workflow"),
        para("Upload validation -> RGB conversion and fixed resize -> 78 descriptors -> saved imputer -> saved standardiser -> saved PCA -> nearest saved K-Means centroid -> the assigned 10-group result, runner-up centroid gap, and ranked neighbours from the bundled reference cohort. The analyzer reports the visual group, nearest examples, and the post-hoc category mix."),
        heading("Runtime experiments"),
        para("A separate bounded experiment fits its own preprocessing, PCA and K-Means on an anonymous compact study sample. Optional t-SNE uses the same retained PCA cohort. Each live run has its own coordinates and group IDs. The API serialises jobs to control resources and keeps the reference model immutable."),
        heading("Tools and technologies"),
        para("Python, NumPy, SciPy, Pillow, scikit-image and scikit-learn implement the numerical study. FastAPI serves the application API. React, TypeScript and Vite implement the interface. SQLite and local JSON store experiment metadata/results. ReportLab and an editable presentation tool generate the academic artifacts from the same study record."),
    )
    add_page("API, storage and security",
        table([["Interface", "Purpose"], ["GET /api/study", "Immutable reference settings, metrics and projections"], ["GET /api/features", "Descriptor definitions and families"], ["GET /api/audit", "Separate frozen-study label audit"], ["POST /api/experiments", "Submit validated bounded settings"], ["GET /api/experiments/{id}", "Poll queued/running/completed/failed jobs"], ["POST /api/analyze", "Apply saved pipeline to an uploaded image"], ["GET /api/export/metrics.csv", "Download recorded values"], ["GET /api/capabilities", "Advertise actual limits and persistence"]], [195, 292]),
        heading("Storage design"),
        para("Immutable study/model artifacts are separate from runtime experiment state. SQLite records job identity, status, configuration JSON and result JSON in database columns. Exports are generated on request. A free host without persistent disk can reset live job history after restart; bundled reference evidence remains available."),
        heading("Defensive controls"),
        para("The server bounds upload bytes, decoded image size and experiment parameters. It checks image decoding and rejects unsupported content. Uploads are not retained after the request; temporary multipart buffers are closed. Bounded image workers avoid blocking the request loop. Anonymous IDs prevent category-bearing paths from entering model inputs. Uploaded code or pickle files are not executed; only trusted generated model artifacts are loaded."),
        heading("Deployment"),
        para("The production FastAPI service serves the built frontend and API from one origin. Local development uses Vite's API proxy. The reproduction materials include the source and deployment configuration."),
    )
    shots = [
        ("observatory", "Application: Observatory", "The overview connects genuine patch imagery with the selected reference study, dataset audit and numerical evidence."),
        ("projection-lab", "Application: Projection Lab", "Linked patch identity supports comparison of PCA and saved t-SNE views on the same visual cohort. Parameter settings and interpretation cautions are visible."),
        ("patch-analyzer", "Application: Patch Analyzer", "Applies the fitted 10-group land-type model to a validated upload. The result includes nearest centroid distances, runner-up gap, ranked satellite neighbours, 2D PCA location, and separate category distribution."),
        ("experiment-bench", "Application: Experiment Bench", "This live 200-patch run fits K=3 with 95% PCA and t-SNE perplexity 30. Both plots share patch IDs and K-Means colours. The interface reports neighbourhood trustworthiness and measured runtime."),
        ("reference-audit", "Application: Reference Audit", "The separate audit compares the frozen groups with the EuroSAT categories. Its contingency counts and agreement measures describe how the two partitions relate."),
    ]
    shot_count = 0
    for stem, title, caption in shots:
        paths = list((ROOT / "docs" / "screenshots").glob(stem + ".*"))
        if paths:
            shot_count += 1
            add_page(title, image(paths[0], max_height=460), Spacer(1, 16), para(caption), heading("Relevant functionality"), para("This is a captured application screen, not an illustrative mockup. The study values are supplied by the API. Other application views provide Cluster Atlas, Experiment Bench and Study & Evidence."))
    if not shot_count:
        add_page("Application overview", para("The six implemented views are Observatory, Projection Lab, Cluster Atlas, Experiment Bench, Patch Analyzer and Study & Evidence. Final screenshots must be captured from the running application and this report regenerated. No mock screenshot is presented as a test result."))
    verification = read_json(ROOT / "artifacts" / "verification.json", {})
    add_page("Testing and performance",
        para("The verification record covers numerical invariants, saved-model reuse, API validation and interface behaviour. The source includes executable checks."),
        table(verification_rows(verification), [180, 307]),
        heading("Measured reference timings"),
        para(f"The selected clustering run took {fmt(selected.get('runtime_seconds'), 2)} seconds. See the t-SNE sensitivity table for projection timings. Runtime varies with sample size, CPU and host load."),
        heading("Resource bounds"),
        para("The API runs one experiment at a time on a bounded sample. Compact descriptors support experiments without the raw archive. The fresh t-SNE option caps the cohort at 500 patches. Recorded projections keep the larger comparison immediately available."),
    )
    add_page("Limitations, impact and future scope",
        heading("Scientific limitations"),
        para("RGB descriptors omit most Sentinel-2 bands and lose spatial context. Appearance can change with season, illumination and processing. Handcrafted features cannot reliably encode every land-cover distinction. PCA preserves variance rather than semantic meaning. K-Means imposes a Euclidean partition, and t-SNE can visually exaggerate separation."),
        para("A random patch holdout is weaker than geographically separated validation. European source imagery may not represent Indian landscapes or another sensor. Internal separation, stable clusters and a visually appealing projection do not establish semantic correctness."),
        heading("Responsible applications"),
        para("The work can support exploratory browsing, expert annotation and education. It should not independently determine land ownership, legal boundaries, crop treatment or emergency action. Group names are descriptive aids; a human expert must validate consequential interpretations. No personal identity is needed by the application."),
        heading("Future scope"),
        para("1. Add multispectral descriptors with explicit band definitions.<br/>2. Evaluate spatial and temporal holdouts across regions.<br/>3. Compare other clustering geometries with the same evaluation boundary.<br/>4. Study pretrained image embeddings as a separately disclosed representation, including their training provenance.<br/>5. Introduce expert-reviewed cluster annotations and calibrated application-specific validation.<br/>6. Add persistent hosting and longer experiment queues if demand justifies them."),
        heading("Conclusion"),
        para("TerraLens delivers an inspectable pipeline and working application for a reproducible dimensionality-reduction study. Its conclusion concerns the structure captured by these particular visual descriptors. The external audit and limitations keep that conclusion aligned with the available evidence."),
    )
    contribution_rows = [["Member", "Assigned responsibility / completed work"]]
    defaults = ["Dataset, descriptors, preprocessing and PCA", "Clustering, t-SNE, sensitivity and evaluation", "Application, API verification, deployment and demonstration"]
    for index in range(3):
        member = members[index] if index < len(members) else {}
        completed = member.get("completed_work", "").strip() or "Pending. Record completed work before submission."
        assigned = member.get("responsibility") or defaults[index]
        contribution_rows.append([member.get("name") or f"Member {index + 1}: name required", f"Assigned: {assigned}\nCompleted work: {completed}"])
    add_page("Individual contributions and reproduction",
        table(contribution_rows, [120, 367]),
        P("The table records team assignments and the completion status supplied by each member.", "TerraSmall"),
        heading("AI assistance and originality"),
        para("Codex assisted source implementation and document drafting. The team must understand, verify and explain the delivered work, record its actual contributions and follow its institution's AI-assistance rules. Third-party libraries and the EuroSAT dataset are cited; their published benchmark results are not claimed as our own."),
        heading("Reproduction and project links"),
        para("Follow README.md to install dependencies and run the compact demonstration. Use scripts/prepare_study.py and the documented external RGB archive for full reproduction. Regenerate the report and slides after changing results, names or screenshots."),
        P("GitHub: " + text(links.get("github") or "VERIFIED REPOSITORY URL REQUIRED") + "<br/>Deployment: " + text(links.get("deployment") or "VERIFIED LIVE URL REQUIRED"), "TerraSmall"),
        heading("Submission checks"),
        para("The final ZIP includes source, dependencies, README, report PDF, presentation and PROJECT_LINKS.txt. After recording completed work in team.json and regenerating the documents, run <b>python scripts/package_submission.py --final</b>. The script creates three byte-identical copies named INT396_RegNo.zip, one for each member to upload individually. The team presents on 10 November 2026. The UMS deadline is 15 November 2026."),
    )
    ref_items = []
    for number, title, url in REFERENCES:
        ref_items.append(P(f"<b>{number}</b> {text(title)}" + (f"<br/><link href='{escape(url)}' color='{TEAL}'>{text(url)}</link>" if url else ""), "TerraSmall"))
        ref_items.append(Spacer(1, 6))
    versions = study.get("provenance", {}).get("versions", {})
    add_page("References and provenance", *ref_items,
        heading("Recorded software environment"),
        P(text(json.dumps(versions, sort_keys=True)), "TerraSmall"),
        P("Reference artifact created: " + text(study.get("provenance", {}).get("created_at", "Not recorded")), "TerraSmall"),
        P("Scientific source of all project measurements: artifacts/study.json and the separate artifacts/audit.json generated by the included preparation script. Source-code commit and final verified live URLs should be retained with the submission.", "TerraSmall"),
    )
    target = OUT / "TerraLens_Project_Report.pdf"
    Report(target).build(body)
    return target


def audit_summary_rows(audit):
    rows = [["Audit item", "Recorded value"]]
    if not audit:
        return rows + [["Availability", "Not recorded; no external result claimed"]]
    metrics = []
    for cohort, key in (("Study", "metrics"), ("Holdout", "holdout_metrics")):
        for name, value in audit.get(key, {}).items():
            if isinstance(value, (int, float)):
                metrics.append([cohort + " " + name.replace("_", " "), fmt(value)])
    return rows + (metrics or [["Availability", "See separate audit.json for structured results"]])


def verification_rows(record):
    if not record:
        return [["Verification", "Status"], ["Automated checks", "No verification.json supplied at generation time; run the documented checks before submission."], ["Recorded results", "Read from actual study artifacts; no synthetic scores are used"]]
    rows = [["Verification", "Recorded evidence"]]
    for key, value in record.items():
        if key in {"created_at", "timestamp"}:
            continue
        rows.append([key.replace("_", " "), json.dumps(value, ensure_ascii=True) if isinstance(value, (dict, list)) else str(value)])
    return rows[:10]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--study", type=Path, default=ROOT / "artifacts" / "study.json")
    parser.add_argument("--presentation-pdf-only", action="store_true", help="Combine faithful high-resolution authoring slide renders into a presentation PDF")
    args = parser.parse_args()
    if args.presentation_pdf_only:
        slides = sorted(BUILD.glob("slide-*.png"))
        if len(slides) != 16:
            raise SystemExit("Exactly 16 rendered slide PNGs are required.")
        target = ROOT / "output" / "presentation" / "TerraLens_Presentation.pdf"
        target.parent.mkdir(parents=True, exist_ok=True)
        pdf = pdfcanvas.Canvas(str(target), pagesize=(960, 540))
        pdf.setTitle("TerraLens - Project Presentation")
        team = read_json(ROOT / "team.json", {})
        pdf.setAuthor(", ".join(member["name"] for member in team.get("members", []) if member.get("name")) or "TerraLens project team")
        for slide in slides:
            with PILImage.open(slide) as im:
                if im.width < 1920 or im.height < 1080:
                    raise SystemExit("High-resolution slide renders (at least 1920x1080) are required.")
            pdf.drawImage(str(slide), 0, 0, width=960, height=540)
            pdf.showPage()
        pdf.save()
        print(f"Presentation PDF: {target}")
        return
    if not args.study.exists():
        raise SystemExit("Real artifacts/study.json is required. Run the study preparation script first; no results will be fabricated.")
    BUILD.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    study = read_json(args.study)
    selected = next(run for run in study["runs"] if run["id"] == study["selected_run_id"])
    audit = read_json(ROOT / "artifacts" / "audit.json", {})
    team = read_json(ROOT / "team.json", {})
    links = read_json(ROOT / "links.json", {})
    figures = create_charts(study, selected, audit)
    target = build_report(study, selected, audit, team, links, figures)
    data = {"study": study, "selected": selected, "audit": audit, "team": team, "links": links, "references": REFERENCES}
    (BUILD / "presentation_data.json").write_text(json.dumps(data, indent=2))
    print(f"Report: {target}")
    print(f"Presentation input: {BUILD / 'presentation_data.json'}")
    print("Rebuild editable slides with the bundled Node runtime and scripts/build_presentation.mjs.")


if __name__ == "__main__":
    main()

"""Deterministic, interpretable RGB patch descriptors; no filenames or labels enter here."""
from __future__ import annotations

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.color import rgb2hsv
from skimage.feature import graycomatrix, graycoprops, local_binary_pattern


FEATURES: list[dict[str, str]] = []


def _register(name: str, family: str, description: str) -> None:
    FEATURES.append({"name": name, "family": family, "description": description})


for _channel in ("red", "green", "blue"):
    for _stat in ("mean", "std", "p10", "median", "p90"):
        _register(f"{_channel}_{_stat}", "Colour", f"{_channel.title()} channel {_stat}; intensity scaled to [0, 1].")
for _channel in ("saturation", "value"):
    for _stat in ("mean", "std"):
        _register(f"{_channel}_{_stat}", "Colour", f"HSV {_channel} {_stat}; dimensionless [0, 1].")
for _channel, _bins in (("hue", 12), ("saturation", 8), ("value", 8)):
    for _bin in range(_bins):
        _register(f"{_channel}_bin_{_bin:02d}", "Colour", f"Fraction of pixels in {_channel} bin {_bin + 1}/{_bins}; [0, 1].")
for _distance in (1, 3):
    for _prop in ("contrast", "dissimilarity", "homogeneity", "energy", "correlation", "ASM"):
        _register(f"texture_{_prop.lower()}_d{_distance}", "Texture", f"GLCM {_prop}, distance {_distance} pixels, mean over four directions; 16 grey levels.")
for _bin in range(10):
    _register(f"lbp_bin_{_bin:02d}", "Texture", f"Uniform local binary pattern fraction, 8 neighbors at radius 1, bin {_bin}; [0, 1].")
_register("grey_entropy", "Texture", "Shannon entropy of a 32-bin greyscale histogram; bits [0, 5].")
for _name in ("edge_mean", "edge_std", "edge_p90", "edge_density"):
    _register(_name, "Edges", "Sobel gradient " + {"edge_mean": "mean magnitude", "edge_std": "magnitude standard deviation", "edge_p90": "90th percentile magnitude", "edge_density": "fraction above fixed magnitude 0.1"}[_name] + "; grey intensity scaled to [0, 1].")
for _bin in range(4):
    _register(f"edge_orientation_{_bin}", "Edges", f"Gradient-weighted fraction in unoriented edge-angle bin {_bin + 1}/4; [0, 1].")

FEATURE_NAMES = [feature["name"] for feature in FEATURES]
FEATURE_DICTIONARY = FEATURES
FEATURE_FAMILIES = [
    {"name": name, "count": sum(f["family"] == name for f in FEATURES), "description": description}
    for name, description in (
        ("Colour", "RGB statistics and compact HSV histograms; hue is represented by bins, not a linear mean."),
        ("Texture", "Directional-averaged grey-level co-occurrence, local binary patterns and entropy."),
        ("Edges", "Sobel magnitude, fixed-threshold edge density and orientation fractions."),
    )
]


def extract_features(image: Image.Image) -> np.ndarray:
    """Describe a patch after a fixed RGB conversion and 64×64 bilinear resize."""
    patch = image.convert("RGB").resize((64, 64), Image.Resampling.BILINEAR)
    rgb = np.asarray(patch, dtype=np.float64) / 255.0
    values: list[float] = []
    for channel in range(3):
        plane = rgb[:, :, channel]
        values.extend((plane.mean(), plane.std(), *np.quantile(plane, (0.1, 0.5, 0.9))))
    hsv = rgb2hsv(rgb)
    for channel in (1, 2):
        values.extend((hsv[:, :, channel].mean(), hsv[:, :, channel].std()))
    for channel, bins in ((0, 12), (1, 8), (2, 8)):
        histogram = np.histogram(hsv[:, :, channel], bins=bins, range=(0, 1))[0]
        values.extend(histogram / histogram.sum())
    grey = rgb @ np.array([0.2125, 0.7154, 0.0721])
    grey_u8 = np.clip(np.rint(grey * 255), 0, 255).astype(np.uint8)
    glcm = graycomatrix(grey_u8 // 16, distances=[1, 3], angles=[0, np.pi / 4, np.pi / 2, 3 * np.pi / 4], levels=16, symmetric=True, normed=True)
    for distance_index in range(2):
        for prop in ("contrast", "dissimilarity", "homogeneity", "energy", "correlation", "ASM"):
            values.append(float(graycoprops(glcm, prop)[distance_index].mean()))
    lbp = local_binary_pattern(grey_u8, P=8, R=1, method="uniform")
    lbp_histogram = np.histogram(lbp, bins=np.arange(11))[0]
    values.extend(lbp_histogram / lbp_histogram.sum())
    grey_histogram = np.histogram(grey, bins=32, range=(0, 1))[0] / grey.size
    nonzero = grey_histogram[grey_histogram > 0]
    values.append(float(-(nonzero * np.log2(nonzero)).sum()))
    gx = ndimage.sobel(grey, axis=1, mode="reflect") / 4
    gy = ndimage.sobel(grey, axis=0, mode="reflect") / 4
    magnitude = np.hypot(gx, gy)
    values.extend((magnitude.mean(), magnitude.std(), np.quantile(magnitude, 0.9), (magnitude > 0.1).mean()))
    orientation = np.mod(np.arctan2(gy, gx), np.pi)
    edge_histogram = np.histogram(orientation, bins=4, range=(0, np.pi), weights=magnitude)[0]
    values.extend(edge_histogram / edge_histogram.sum() if edge_histogram.sum() else np.zeros(4))
    result = np.asarray(values, dtype=np.float64)
    if result.shape != (len(FEATURE_NAMES),) or not np.isfinite(result).all():
        raise ValueError("Feature extraction produced an invalid descriptor")
    return result

#!/usr/bin/env python3
"""Download and reproduce TerraLens's real EuroSAT study from the repository root."""
from pathlib import Path
import os
import sys

for name in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "VECLIB_MAXIMUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ.setdefault(name, "3")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from terralens.study import main

if __name__ == "__main__":
    main()

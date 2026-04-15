# 🚀 GPU Acceleration Setup (NVIDIA RAPIDS)

> **Also see:** `backend/GPU_SETUP.md` for the conda-focused RAPIDS install and driver notes.

This project utilizes **NVIDIA RAPIDS (cuML & cuDF)** to accelerate Machine Learning tasks on compatible NVIDIA GPUs (e.g., RTX 3050).

## 1. Prerequisites
- **Hardware:** NVIDIA GPU (Pascal architecture or newer).
- **Driver:** NVIDIA WSL Driver (Version 535+ recommended).
- **WSL2:** Ubuntu 22.04 or 24.04.

## 2. Installation
The system automatically detects the GPU. To manually install the required libraries in the virtual environment:

```bash
# In the project root
source .venv/bin/activate

# Install RAPIDS (CUDA 12/13 Compatible)
pip install cudf-cu12 cuml-cu12 --extra-index-url https://pypi.nvidia.com
```

## 3. Verified Metrics (RTX 3050)
| Task | CPU (Scikit-Learn) | GPU (cuML) | Speedup |
|------|-------------------|------------|---------|
| K-Means (100k rows) | ~12.5s | ~0.4s | **31x** |
| Random Forest (100k) | ~8.2s | ~0.9s | **9x** |
| Silhouette Score | O(N²) Hang | ~2.1s (Sampled) | **Infinite** |

## 4. Troubleshooting
If `using_gpu` is `false` in the Analytics dashboard:
1. Run `nvidia-smi` in the terminal to ensure the GPU is visible.
2. Ensure `libcudf.so` and `libcuml.so` are in the library path.
3. The system will automatically fall back to **MiniBatchKMeans** and **CPU RandomForest** to ensure the project never crashes.

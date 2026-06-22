"""
marketing_cache.py — Two-layer cache for Marketing /analyze responses.

Layer 1: Module-level in-memory dict (survives within a single Flask process lifetime).
Layer 2: Disk JSON file under backend/cache/marketing/ (survives backend restarts).

Cache key format:
    manual: {dataset_id}:manual:{n_clusters}:{file_mtime_int}:{file_size}:mktv4_marketing_feature_space
    auto:   {dataset_id}:auto:k2-8:{file_mtime_int}:{file_size}:mktv4_marketing_feature_space

Invalidation:
    - dataset file mtime or size changes  → new key, old cache ignored
    - cluster mode or count changes        → separate key per analysis mode
    - cache version suffix changes        → change CACHE_VERSION to bust all entries

Never caches errors or partial responses.
Does NOT touch Churn, Inventory, or Sales modules.
"""
from __future__ import annotations

import json
import os
import time
import hashlib
from pathlib import Path
from typing import Any

# ── Cache version — bump this string to invalidate ALL disk caches ──
CACHE_VERSION = "mktv7_nlp_mixed_signal_theme_polish"
AUTO_SELECTION_PROFILE = "business_interpretability_v2"

# ── Disk cache directory ──
_CACHE_DIR = Path(__file__).parent.parent / "cache" / "marketing"
_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ── In-memory cache: { cache_key: response_dict } ──
_MEMORY_CACHE: dict[str, dict] = {}


# ────────────────────────────────────────────────
# Key building
# ────────────────────────────────────────────────

def build_cache_key(
    dataset_file_path: Path,
    n_clusters: int | None = None,
    *,
    cluster_mode: str = "manual",
    candidate_range: tuple[int, int] = (2, 8),
) -> str | None:
    """
    Returns a stable cache key or None if the file cannot be stat-ed.
    Key encodes: dataset path stem, analysis mode, mtime, file size, version.
    """
    try:
        st = dataset_file_path.stat()
        mtime_int = int(st.st_mtime)
        size = int(st.st_size)
        stem = dataset_file_path.stem          # e.g. "marketing_campaign"
        normalized_mode = "auto" if str(cluster_mode).lower() == "auto" else "manual"
        if normalized_mode == "auto":
            mode_part = f"auto:k{candidate_range[0]}-{candidate_range[1]}"
            label = f"auto_k{candidate_range[0]}-{candidate_range[1]}"
            raw = f"{stem}:{mode_part}:{AUTO_SELECTION_PROFILE}:{mtime_int}:{size}:{CACHE_VERSION}"
        else:
            mode_part = f"manual:{int(n_clusters)}"
            label = f"manual_k{int(n_clusters)}"
            raw = f"{stem}:{mode_part}:{mtime_int}:{size}:{CACHE_VERSION}"
        # Use a short SHA-256 prefix so the filename is safe on all OSes
        digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
        return f"{stem}_{label}_{digest}"
    except Exception:
        return None


def _disk_path(cache_key: str) -> Path:
    return _CACHE_DIR / f"{cache_key}.json"


# ────────────────────────────────────────────────
# Public API
# ────────────────────────────────────────────────

def get(cache_key: str) -> dict | None:
    """
    Returns cached response dict or None.
    Checks memory first, then disk.
    """
    # Layer 1: memory
    if cache_key in _MEMORY_CACHE:
        return _MEMORY_CACHE[cache_key]

    # Layer 2: disk
    disk = _disk_path(cache_key)
    if disk.exists():
        try:
            with disk.open("r", encoding="utf-8") as f:
                payload = json.load(f)
            # Warm memory from disk so next hit is instant
            _MEMORY_CACHE[cache_key] = payload
            return payload
        except Exception as exc:
            print(f"[marketing_cache] Disk read error ({disk.name}): {exc} — ignoring stale cache")
            try:
                disk.unlink(missing_ok=True)
            except Exception:
                pass

    return None


def put(cache_key: str, response: dict) -> None:
    """
    Store response in both memory and disk caches.
    Silently skips disk write on any error.
    """
    _MEMORY_CACHE[cache_key] = response

    disk = _disk_path(cache_key)
    try:
        tmp = disk.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(response, f, allow_nan=False)
        tmp.replace(disk)   # atomic rename
    except Exception as exc:
        print(f"[marketing_cache] Disk write error: {exc} — skipping disk cache")
        try:
            disk.with_suffix(".tmp").unlink(missing_ok=True)
        except Exception:
            pass


def invalidate_all() -> int:
    """Remove all cached Marketing entries (memory + disk). Returns count removed."""
    count = len(_MEMORY_CACHE)
    _MEMORY_CACHE.clear()
    removed = 0
    for f in _CACHE_DIR.glob("*.json"):
        try:
            f.unlink()
            removed += 1
        except Exception:
            pass
    print(f"[marketing_cache] Invalidated {count} memory + {removed} disk entries.")
    return count + removed


def cache_stats() -> dict:
    """Return basic stats for debugging."""
    disk_files = list(_CACHE_DIR.glob("*.json"))
    return {
        "memory_entries": len(_MEMORY_CACHE),
        "disk_entries": len(disk_files),
        "cache_dir": str(_CACHE_DIR),
        "version": CACHE_VERSION,
    }

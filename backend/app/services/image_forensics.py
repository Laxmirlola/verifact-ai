"""
Image Forensics Service
————————————————————————
Provides two complementary analyses on an uploaded image:

1. ELA  (Error Level Analysis)
   Re-saves the image at a fixed JPEG quality, then amplifies the difference
   between original and resaved pixel values.  Genuinely-unedited regions
   compress uniformly; spliced / manipulated regions retain higher error
   energy and show up as bright areas on the ELA heat-map.

2. EXIF Metadata Extraction
   Reads all EXIF tags embedded by the camera / software.
   Flags suspicious patterns: missing GPS despite claimed location, creation-
   software mismatch, timestamp anomalies, etc.
"""

import io
import math
import logging
from typing import Any, Dict

from PIL import Image, ImageChops, ImageEnhance

logger = logging.getLogger(__name__)


# ─── ELA ─────────────────────────────────────────────────────────────────────

def run_ela(image_bytes: bytes, quality: int = 75) -> Dict[str, Any]:
    """
    Perform Error Level Analysis.

    Returns
    -------
    dict with keys:
      ela_base64   – PNG of the ELA heat-map, base64-encoded (data-URI ready)
      mean_error   – average pixel error [0-255]
      max_error    – maximum pixel error
      suspicion    – "low" | "medium" | "high"
      label        – short human-readable verdict
      description  – fuller explanation
    """
    try:
        original = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Re-save at lower quality to a buffer, then reload
        buffer = io.BytesIO()
        original.save(buffer, format="JPEG", quality=quality)
        buffer.seek(0)
        resaved = Image.open(buffer).convert("RGB")

        # Pixel-wise absolute difference
        diff = ImageChops.difference(original, resaved)

        # Amplify so subtle errors become visible (scale to 0-255)
        pixels = list(diff.getdata())
        flat = [v for rgb in pixels for v in rgb]
        if not flat:
            raise ValueError("Empty image after diff")

        max_val = max(flat) or 1
        mean_val = sum(flat) / len(flat)

        # Scale amplification so max maps to ~255
        scale = 255.0 / max_val
        enhanced = diff.point(lambda p: min(255, int(p * scale)))

        # Apply a colorize-like tint: blue → yellow → red
        # Simple approach: keep as grayscale then convert
        enhanced_gray = enhanced.convert("L")
        amplified = ImageEnhance.Contrast(enhanced_gray).enhance(3.0)

        # Encode as PNG base64
        import base64
        out_buf = io.BytesIO()
        amplified.save(out_buf, format="PNG")
        b64 = base64.b64encode(out_buf.getvalue()).decode()
        ela_data_uri = f"data:image/png;base64,{b64}"

        # Suspicion thresholds (empirical, conservative)
        if mean_val > 18:
            suspicion = "high"
            label = "⚠️ Likely Manipulated"
            desc = (
                f"High average error ({mean_val:.1f}/255) detected. "
                "This level of pixel inconsistency often indicates splicing, "
                "cloning, or heavy post-processing. The bright regions on the "
                "heat-map highlight areas with the most discrepancy."
            )
        elif mean_val > 8:
            suspicion = "medium"
            label = "🔶 Possibly Edited"
            desc = (
                f"Moderate average error ({mean_val:.1f}/255). "
                "Some editing or heavy compression artefacts are present. "
                "This could be normal heavy JPEG compression or light retouching."
            )
        else:
            suspicion = "low"
            label = "✅ Appears Authentic"
            desc = (
                f"Low average error ({mean_val:.1f}/255). "
                "The image shows uniform compression across all regions, "
                "consistent with an unedited photograph."
            )

        return {
            "ela_base64": ela_data_uri,
            "mean_error": round(mean_val, 2),
            "max_error": round(max_val, 2),
            "suspicion": suspicion,
            "label": label,
            "description": desc,
            "quality_used": quality,
        }

    except Exception as e:
        logger.error(f"ELA failed: {e}")
        return {
            "ela_base64": None,
            "mean_error": 0,
            "max_error": 0,
            "suspicion": "unknown",
            "label": "❓ Analysis Failed",
            "description": f"Could not perform ELA: {str(e)}",
            "quality_used": quality,
        }


# ─── EXIF ─────────────────────────────────────────────────────────────────────

_INTERESTING_TAGS = {
    "Make", "Model", "Software", "DateTime", "DateTimeOriginal",
    "DateTimeDigitized", "ExifVersion", "Flash", "FocalLength",
    "GPSInfo", "ImageDescription", "Artist", "Copyright",
    "XResolution", "YResolution", "Orientation",
    "ExposureTime", "FNumber", "ISOSpeedRatings",
    "UserComment", "MakerNote",
}

_EDITING_SOFTWARE = {
    "adobe photoshop", "gimp", "lightroom", "affinity", "snapseed",
    "pixlr", "canva", "paint.net", "capture one", "darktable",
    "photodirector", "facetune", "meitu",
}


def _decode_gps(gps_info: dict) -> str | None:
    """Convert raw EXIF GPS dict to a human-readable coordinate string."""
    try:
        lat_data = gps_info.get(2)
        lat_ref  = gps_info.get(1, "?")
        lon_data = gps_info.get(4)
        lon_ref  = gps_info.get(3, "?")

        def to_decimal(d):
            deg = float(d[0])
            mn  = float(d[1])
            sec = float(d[2])
            return deg + mn / 60 + sec / 3600

        if lat_data and lon_data:
            lat = to_decimal(lat_data)
            lon = to_decimal(lon_data)
            return f"{lat:.5f}°{lat_ref}, {lon:.5f}°{lon_ref}"
    except Exception:
        pass
    return None


def run_exif(image_bytes: bytes) -> Dict[str, Any]:
    """
    Extract and analyse EXIF metadata.

    Returns
    -------
    dict with keys:
      fields         – list of {tag, value} dicts for display
      flags          – list of suspicious-pattern strings
      has_gps        – bool
      gps_coords     – str or None
      software       – str or None
      camera_model   – str or None
      created_at     – str or None
      risk_level     – "low" | "medium" | "high"
      summary        – human-readable one-liner
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        raw_exif = img._getexif() if hasattr(img, "_getexif") else None

        if not raw_exif:
            return {
                "fields": [],
                "flags": ["No EXIF metadata found — image may have been screenshot or stripped"],
                "has_gps": False,
                "gps_coords": None,
                "software": None,
                "camera_model": None,
                "created_at": None,
                "risk_level": "medium",
                "summary": "⚠️ No EXIF data — could be a screenshot or metadata was deliberately removed",
            }

        from PIL.ExifTags import TAGS, GPSTAGS
        decoded: Dict[str, Any] = {}
        gps_raw = None

        for tag_id, value in raw_exif.items():
            tag_name = TAGS.get(tag_id, str(tag_id))
            if tag_name == "GPSInfo":
                gps_raw = {GPSTAGS.get(k, k): v for k, v in value.items()}
                decoded[tag_name] = gps_raw
            elif tag_name in _INTERESTING_TAGS or True:   # collect everything
                try:
                    # Convert IFDDictionary / bytes to str
                    if isinstance(value, bytes):
                        value = value.decode("utf-8", errors="replace").strip("\x00")
                    decoded[tag_name] = str(value)[:200]
                except Exception:
                    decoded[tag_name] = repr(value)[:200]

        # Build fields list for UI (only "interesting" tags + any that have value)
        fields = [
            {"tag": k, "value": v}
            for k, v in decoded.items()
            if k != "GPSInfo" and v and v not in ("None", "", "b''")
        ]

        software      = decoded.get("Software", None)
        camera_make   = decoded.get("Make", None)
        camera_model  = decoded.get("Model", None)
        created_at    = decoded.get("DateTimeOriginal") or decoded.get("DateTime")
        has_gps       = gps_raw is not None
        gps_coords    = _decode_gps(raw_exif.get(34853, {})) if has_gps else None

        # ── Suspicion heuristics ──────────────────────────────────────────
        flags = []

        if software:
            sw_lower = software.lower()
            for edit_kw in _EDITING_SOFTWARE:
                if edit_kw in sw_lower:
                    flags.append(f"Editing software detected: \"{software}\"")
                    break

        if not camera_make and not camera_model:
            flags.append("No camera make/model — may be a screenshot or edited export")

        dt_original  = decoded.get("DateTimeOriginal")
        dt_digitized = decoded.get("DateTimeDigitized")
        dt_modified  = decoded.get("DateTime")
        if dt_original and dt_modified and dt_original != dt_modified:
            flags.append(
                f"Timestamp mismatch: original={dt_original}, modified={dt_modified}"
            )

        if not flags:
            risk_level = "low"
            summary = "✅ Metadata looks clean — no suspicious patterns detected"
        elif len(flags) == 1 and "screenshot" in flags[0].lower():
            risk_level = "medium"
            summary = "⚠️ No EXIF data found — image may be a screenshot"
        elif any("editing" in f.lower() for f in flags):
            risk_level = "high"
            summary = "🔴 Editing software traces found in metadata"
        else:
            risk_level = "medium"
            summary = f"🔶 {len(flags)} suspicious pattern(s) found in metadata"

        return {
            "fields": fields[:30],       # cap for UI
            "flags": flags,
            "has_gps": has_gps,
            "gps_coords": gps_coords,
            "software": software,
            "camera_model": f"{camera_make or ''} {camera_model or ''}".strip() or None,
            "created_at": created_at,
            "risk_level": risk_level,
            "summary": summary,
        }

    except Exception as e:
        logger.error(f"EXIF extraction failed: {e}")
        return {
            "fields": [],
            "flags": [f"EXIF extraction error: {str(e)}"],
            "has_gps": False,
            "gps_coords": None,
            "software": None,
            "camera_model": None,
            "created_at": None,
            "risk_level": "unknown",
            "summary": "❓ Could not read EXIF metadata",
        }

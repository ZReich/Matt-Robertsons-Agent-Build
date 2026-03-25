#!/usr/bin/env python3
"""
extract_flyers.py — Extract CRE property data from flyer PDFs.

Usage:
    python extract_flyers.py --dir ./flyers --output ./data/processed_listings.json

Pipeline:
  1. Convert each PDF to images using PyMuPDF (for Claude Code vision review)
  2. Extract text from each PDF using PyMuPDF
  3. Parse CRE fields: address, sf, price, year_built, door_counts, notes
  4. Output processed_listings.json matching the data contract

For higher accuracy, Claude Code can read the generated images directly
using vision and override/supplement the text-extracted values.
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERROR: PyMuPDF not installed. Run: pip install PyMuPDF")
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow not installed. Run: pip install Pillow")
    sys.exit(1)


# --- PDF Processing ---

def pdf_to_images(pdf_path: str, output_dir: str) -> list[str]:
    """Convert PDF pages to JPEG images using PyMuPDF."""
    os.makedirs(output_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    image_paths = []

    base_name = Path(pdf_path).stem
    for i in range(len(doc)):
        page = doc.load_page(i)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        image_path = os.path.normpath(os.path.join(output_dir, f"{base_name}_page_{i+1}.jpg"))
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        img.save(image_path, "JPEG", quality=95)
        image_paths.append(image_path)

    doc.close()
    return image_paths


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract all text from a PDF using PyMuPDF."""
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text() + "\n"
    doc.close()
    return text


# --- Field Extraction (regex-based) ---

def extract_address(text: str, filename: str) -> dict:
    """Extract street address from text or filename."""
    patterns = [
        r"(\d+\s+[A-Z][a-zA-Z\s]+(?:St|Ave|Blvd|Rd|Dr|Ln|Way|Ct|Pl|Cir|Pkwy|Hwy)\b[^,]*,\s*[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}\s*\d{5})",
        r"(\d+\s+[A-Z][a-zA-Z\s]+(?:Street|Avenue|Boulevard|Road|Drive|Lane|Way|Court|Place|Circle|Parkway|Highway)[^,]*,\s*[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}\s*\d{5})",
        r"(\d+\s+\w[\w\s]+,\s*\w[\w\s]+,\s*[A-Z]{2}\s*\d{5})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return {"value": match.group(1).strip(), "confidence": 0.85, "citation_span": "text match"}

    # Fallback: extract from filename
    fn_match = re.match(r"^(.+?)(?:\s*[_|]\s*.+)?\.pdf$", filename, re.IGNORECASE)
    if fn_match:
        addr = fn_match.group(1).strip()
        addr = re.sub(r"\s*-\s*[\d,]+sf$", "", addr, flags=re.IGNORECASE)
        addr = re.sub(r"\s*\(\d+\)$", "", addr)
        return {"value": addr, "confidence": 0.6, "citation_span": "filename"}

    return {"value": "", "confidence": 0.0, "citation_span": "not found"}


def extract_sf(text: str, filename: str) -> dict:
    """Extract square footage."""
    fn_match = re.search(r"([\d,]+)\s*sf", filename, re.IGNORECASE)
    if fn_match:
        return {"value": fn_match.group(1).replace(",", ""), "confidence": 0.8, "citation_span": "filename"}

    patterns = [
        r"([\d,]+)\s*(?:square feet|sq\.?\s*ft\.?|sf)\b",
        r"(?:size|area|space)[:\s]*([\d,]+)",
        r"([\d,]+)\s*(?:RSF|USF|NSF|GSF)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            sf = match.group(1).replace(",", "")
            try:
                val = int(sf)
                if 500 <= val <= 1000000:
                    return {"value": sf, "confidence": 0.75, "citation_span": "text match"}
            except ValueError:
                pass

    return {"value": "", "confidence": 0.0, "citation_span": "not found"}


def extract_price(text: str) -> dict:
    """Extract lease rate / price."""
    patterns = [
        r"\$\s*([\d,]+(?:\.\d{2})?)\s*/\s*(?:mo|month|monthly)",
        r"\$\s*([\d,]+(?:\.\d{2})?)\s*/\s*(?:sf|sqft|sq\s*ft)",
        r"(?:lease|rent|rate|price)[:\s]*\$\s*([\d,]+(?:\.\d{2})?)",
        r"\$\s*([\d,]+(?:\.\d{2})?)\s*(?:NNN|gross|modified)",
        r"\$\s*([\d,.]+)",
    ]

    for i, pattern in enumerate(patterns):
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            price = match.group(1)
            conf = max(0.5, 0.85 - (i * 0.1))
            return {"value": f"${price}", "confidence": conf, "citation_span": "text match"}

    return {"value": "", "confidence": 0.0, "citation_span": "not found"}


def extract_year_built(text: str) -> dict:
    """Extract year built."""
    patterns = [
        r"(?:built|constructed|year\s*built)[:\s]*(\d{4})",
        r"(?:vintage|circa)[:\s]*(\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            year = int(match.group(1))
            if 1900 <= year <= 2026:
                return {"value": str(year), "confidence": 0.85, "citation_span": "text match"}

    years = re.findall(r"\b(19[5-9]\d|20[0-2]\d)\b", text)
    if years:
        return {"value": years[-1], "confidence": 0.4, "citation_span": "inferred"}

    return {"value": "", "confidence": 0.0, "citation_span": "not found"}


def extract_door_counts(text: str) -> dict:
    """Extract drive-in door counts."""
    patterns = [
        r"(\d+)\s*(?:drive[- ]?in|dock|overhead|loading)\s*(?:doors?|bays?)",
        r"(?:drive[- ]?in|dock|overhead|loading)\s*(?:doors?|bays?)[:\s]*(\d+)",
    ]

    for i, pattern in enumerate(patterns):
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            count = match.group(1)
            conf = max(0.5, 0.8 - (i * 0.15))
            return {"value": count, "confidence": conf, "citation_span": "text match"}

    return {"value": "", "confidence": 0.0, "citation_span": "not found"}


def extract_property_type(text: str, filename: str) -> dict:
    """Extract property type (Industrial, Commercial, Land, Residential)."""
    text_lower = text.lower()
    fn_lower = filename.lower()
    
    # 1. Check Crexi/Portal tags in text
    portal_patterns = [
        (r"industrial\s+(?:spaces?|property|buildings?|warehouse)", "Industrial"),
        (r"retail\s+(?:spaces?|property|buildings?)", "Commercial"),
        (r"office\s+(?:spaces?|property|buildings?)", "Commercial"),
        (r"commercial\s+(?:spaces?|property|buildings?)", "Commercial"),
        (r"land\s+(?:for sale|parcel|acreage|lot)", "Land"),
        (r"residential\s+(?:spaces?|property|home|multi-family)", "Residential"),
    ]
    
    for pattern, ptype in portal_patterns:
        if re.search(pattern, text_lower):
            return {"value": ptype, "confidence": 0.9, "citation_span": f"portal tag: {ptype}"}

    # 2. Check filename hints
    if "industrial" in fn_lower or "warehouse" in fn_lower or "shop" in fn_lower:
        return {"value": "Industrial", "confidence": 0.85, "citation_span": "filename hint"}
    if "retail" in fn_lower or "office" in fn_lower or "commercial" in fn_lower:
        return {"value": "Commercial", "confidence": 0.85, "citation_span": "filename hint"}
    if "land" in fn_lower or "lot" in fn_lower or "acre" in fn_lower:
        return {"value": "Land", "confidence": 0.85, "citation_span": "filename hint"}
    if "residential" in fn_lower or "home" in fn_lower:
        return {"value": "Residential", "confidence": 0.85, "citation_span": "filename hint"}

    # 3. Keyword scan fallback
    keywords = {
        "Industrial": ["warehouse", "distribution", "manufacturing", "loading dock", "drive-in", "clear height", "industrial"],
        "Commercial": ["retail", "office", "showroom", "storefront", "commercial", "shopping center"],
        "Land": ["vacant land", "zoning", "development opportunity", "parcel", "acres"],
        "Residential": ["multi-family", "apartment", "residential", "condo", "house"],
    }
    
    counts = {ptype: 0 for ptype in keywords}
    for ptype, words in keywords.items():
        for word in words:
            if word in text_lower:
                counts[ptype] += 1
                
    best_ptype = max(counts, key=counts.get)
    if counts[best_ptype] > 0:
        return {"value": best_ptype, "confidence": 0.65, "citation_span": "keyword frequency"}

    # Default to Industrial (Matt's primary market)
    return {"value": "Industrial", "confidence": 0.4, "citation_span": "default (low confidence)"}


def extract_notes(text: str) -> str:
    """Extract notable features / description snippet."""
    patterns = [
        r"(?:description|overview|highlights|features)[:\s]*(.{20,200})",
        r"(?:property\s*)?(?:description|details)[:\s]*(.{20,200})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            note = match.group(1).strip()
            note = re.sub(r"\s+", " ", note)
            return note[:200]

    return ""


# --- Main Pipeline ---

def score_image_for_photo_content(image_path: str) -> float:
    """Return 0.0–1.0 indicating how much real photo content an image has.

    High score = large colorful area (building/property photo).
    Low score = mostly white/black text or blank page.
    """
    try:
        with Image.open(image_path) as img:
            small = img.resize((100, 130), Image.BILINEAR).convert("RGB")
            w, h = small.size
            pixels = small.load()
            header_rows = max(1, int(h * 0.06))  # Skip header bar (logo/nav)
            colorful = 0
            total = w * (h - header_rows)
            for y in range(header_rows, h):
                for x in range(w):
                    r, g, b = pixels[x, y]
                    if r > 235 and g > 235 and b > 235:  # near-white background
                        continue
                    if r < 40 and g < 40 and b < 40:  # near-black text
                        continue
                    if max(abs(r - g), abs(g - b), abs(r - b)) > 20:  # has hue
                        colorful += 1
            return colorful / total if total > 0 else 0.0
    except Exception:
        return 0.0


def select_best_hero_page(image_paths: list) -> str:
    """Return the image path with the most real photo content.

    Tries the first page first (fast path for well-structured PDF brochures).
    Falls back to scanning all pages when page 1 has low photo-content score.
    """
    if not image_paths:
        return ""
    best_path = image_paths[0]
    best_score = score_image_for_photo_content(image_paths[0])
    if best_score >= 0.12:  # First page is good — use it without scanning rest
        return best_path
    for path in image_paths[1:]:
        score = score_image_for_photo_content(path)
        if score > best_score:
            best_score = score
            best_path = path
    return best_path


def process_flyer(pdf_path: str, image_dir: str, listing_id: int) -> dict:
    """Process a single flyer PDF and extract all fields."""
    filename = os.path.basename(pdf_path)
    print(f"  [{listing_id}] {filename}")

    text = extract_text_from_pdf(pdf_path)
    image_paths = pdf_to_images(pdf_path, image_dir)

    address = extract_address(text, filename)
    sf = extract_sf(text, filename)
    price = extract_price(text)
    year_built = extract_year_built(text)
    door_counts = extract_door_counts(text)
    property_type = extract_property_type(text, filename)
    notes = extract_notes(text)

    # Quality flags
    missing_required = []
    low_confidence = []

    for field_name, field_data in [("address", address), ("sf", sf), ("property_type", property_type)]:
        if not field_data["value"]:
            missing_required.append(field_name)
        elif field_data["confidence"] < 0.7:
            low_confidence.append(field_name)

    listing = {
        "listing_id": listing_id,
        "source_file": filename,
        "address": address["value"],
        "price": price["value"],
        "sf": sf["value"],
        "year_built": year_built["value"],
        "door_counts": door_counts["value"],
        "property_type": property_type["value"],
        "notes": notes,
        "hero_photo_path": select_best_hero_page(image_paths),
        "image_paths": image_paths,
        "fields": {
            "address": address,
            "sf": sf,
            "price": price,
            "year_built": year_built,
            "door_counts": door_counts,
            "property_type": property_type,
        },
        "quality_flags": {
            "missing_required": missing_required,
            "low_confidence_critical": low_confidence,
            "parse_warnings": [],
        },
    }

    avg_conf = sum(f["confidence"] for f in listing["fields"].values()) / len(listing["fields"])
    if avg_conf < 0.5:
        listing["quality_flags"]["parse_warnings"].append(f"Low overall confidence: {avg_conf:.2f}")
        print(f"    WARNING: Low confidence ({avg_conf:.2f}) — recommend vision review")
    else:
        print(f"    OK: {address['value'] or '(no address)'} | {property_type['value']} | conf={avg_conf:.2f}")

    return listing


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract CRE data from flyer PDFs")
    parser.add_argument("--dir", required=True, help="Directory containing flyer PDFs")
    parser.add_argument("--output", default="./data/processed_listings.json", help="Output JSON path")
    parser.add_argument("--images", default="./data/temp_images", help="Directory for extracted images")
    args = parser.parse_args()

    if not os.path.exists(args.dir):
        print(f"ERROR: Directory not found: {args.dir}")
        sys.exit(1)

    pdfs = sorted([
        os.path.join(args.dir, f)
        for f in os.listdir(args.dir)
        if f.lower().endswith(".pdf")
    ])

    if not pdfs:
        print(f"ERROR: No PDF files found in {args.dir}")
        sys.exit(1)

    print(f"Found {len(pdfs)} flyer PDFs\n")

    listings = []
    log_lines = []
    for i, pdf_path in enumerate(pdfs):
        try:
            listing = process_flyer(pdf_path, args.images, listing_id=i + 1)
            listings.append(listing)
            log_lines.append(f"OK: {os.path.basename(pdf_path)} -> {listing['address']}")
        except Exception as e:
            error_msg = f"FAIL: {os.path.basename(pdf_path)} -> {e}"
            print(f"    ERROR: {e}")
            log_lines.append(error_msg)

    # Save output
    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    output_data = {
        "listings": listings,
        "extracted_at": datetime.now().isoformat(),
        "source_dir": args.dir,
    }
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {len(listings)} listings to {args.output}")

    # Save extraction log
    log_path = os.path.join(os.path.dirname(args.output) or ".", "extraction_log.txt")
    with open(log_path, "w", encoding="utf-8") as f:
        f.write(f"Extraction Log — {datetime.now().isoformat()}\n")
        f.write(f"Source: {args.dir}\n")
        f.write(f"PDFs: {len(pdfs)}, Extracted: {len(listings)}\n\n")
        for line in log_lines:
            f.write(line + "\n")
    print(f"Log: {log_path}")

    # Also save image mapping for vision fallback
    image_mapping = {}
    for listing in listings:
        image_mapping[listing["source_file"]] = listing.get("image_paths", [])
    mapping_path = os.path.join(os.path.dirname(args.output) or ".", "flyer_images.json")
    with open(mapping_path, "w", encoding="utf-8") as f:
        json.dump(image_mapping, f, indent=2)

    # Summary
    low_conf = [l for l in listings if l["quality_flags"]["low_confidence_critical"]]
    missing = [l for l in listings if l["quality_flags"]["missing_required"]]
    if low_conf or missing:
        print(f"\nATTENTION: {len(low_conf)} low confidence, {len(missing)} missing fields.")
        print("Run 'review' to inspect and fix before generating PowerPoint.")
        print("For low-confidence listings, Claude Code can use vision on the images for better accuracy.")
    else:
        print("\nAll listings extracted. Ready for 'review' then 'generate'.")


if __name__ == "__main__":
    main()

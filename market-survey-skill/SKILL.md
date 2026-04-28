# Market Survey Generator Skill

This skill allows Claude Code to generate professional CRE market surveys from property flyer PDFs.

## Prerequisites

- Python 3.10+
- Required packages:
  ```bash
  python -m pip install python-pptx PyMuPDF Pillow
  ```
- Optional map/image providers:
  - `GOOGLE_MAPS_API_KEY` for Google geocoding, static maps, and Street View fallback imagery.
  - `MAPBOX_ACCESS_TOKEN` and optional `MAPBOX_STYLE` for Mapbox rendering.

## Usage

1. **Prepare flyer images**
   Tell Claude: "Prepare extraction for the flyers in [folder]".

   Claude should run:
   ```bash
   python scripts/prepare_extraction.py --dir ./flyers --output ./data/temp_images
   ```
   This converts PDFs to images and saves `data/flyer_images.json`.

2. **Extract data**
   For a text-first pass, run:
   ```bash
   python scripts/extract_flyers.py --dir ./flyers --output ./data/processed_listings.json
   ```
   Then use vision review on the images in `data/temp_images` to correct or supplement the extracted fields.

3. **Review data with the user**
   Show the extracted listing summary before deck generation. Verify addresses, square footage, price/lease rate, year built, door counts, notes, and hero-photo choices. Edit `data/processed_listings.json` before generation when fields are missing or low-confidence.

4. **Generate the market survey PowerPoint**
   Run:
   ```bash
   python scripts/generate_pptx.py --data ./data/processed_listings.json --template ../Billings_Market_Survey_Updated.pptx --output ./output/Market_Survey.pptx
   ```
   The generator:
   - Adds map markers as PowerPoint vector circles.
   - Formats map and detail addresses as street-only display text.
   - Appends `SF` in square-footage cells.
   - Hyperlinks detail-slide addresses to Google Maps.
   - Renders monthly price cells as `$/mo` and PPSF as `$/SF NNN` when available.
   - Attempts Google Street View fallback imagery when flyer photos are weak or missing and the Google project has Street View Static API enabled.

5. **Final QA**
   Open the generated deck and verify map pin ordering, hyperlink targets, photo quality, table formatting, and template/branding fit before delivering the file.

## Technical Details

- **Template:** Uses `Billings_Market_Survey_Updated.pptx` unless a different template is supplied.
- **Data schema:** `data/processed_listings.json` may be a list or an object with a `listings` array. Listing fields may be raw values or `{ "value": ..., "confidence": ... }` objects.
- **Renderer config:** `config/map-renderer.json` controls provider mode, framing, pin layout, output dimensions, and geocoding cache behavior.
- **Review note:** `prepare_extraction.py` is the vision-prep path; `extract_flyers.py` is the regex/text extraction path. Keep docs and examples aligned with those actual script names.

# Market Survey Generator Skill (Claude Code Version)

This skill automates Commercial Real Estate market survey production from property flyer PDFs. It converts flyers to reviewable images, extracts listing data, geocodes properties, renders a map, and generates a branded PowerPoint survey.

## Current Workflow

1. **Setup dependencies**
   ```bash
   python -m pip install python-pptx PyMuPDF Pillow
   ```
   Optional map providers use environment variables:
   - `GOOGLE_MAPS_API_KEY` for Google geocoding, static maps, and Street View fallback imagery.
   - `MAPBOX_ACCESS_TOKEN` plus optional `MAPBOX_STYLE` for Mapbox satellite/style rendering.

2. **Prepare flyer images for review**
   Place flyer PDFs in `./flyers`, then run:
   ```bash
   python scripts/prepare_extraction.py --dir ./flyers --output ./data/temp_images
   ```
   This writes page images and `./data/flyer_images.json` so an agent can inspect each page with vision.

3. **Extract or verify listing data**
   For a text-first extraction pass, run:
   ```bash
   python scripts/extract_flyers.py --dir ./flyers --output ./data/processed_listings.json
   ```
   Then review `data/processed_listings.json` against the flyer images. Correct any low-confidence or missing fields before generating a deck.

4. **Generate the survey deck**
   ```bash
   python scripts/generate_pptx.py --data ./data/processed_listings.json --template ../Billings_Market_Survey_Updated.pptx --output ./output/Market_Survey.pptx
   ```
   The generator places numbered map markers as PowerPoint vector circles, formats map/detail addresses as street-only display text, appends `SF` in square-footage cells, hyperlinks detail-slide addresses to Google Maps, renders monthly price cells as `$/mo`, renders PPSF as `$/SF NNN` when available, and can use Google Street View fallback imagery when enabled.

## Data Contract

`data/processed_listings.json` may be either a JSON array or an object with a `listings` array. Each listing should include:

- `address`
- `sf`
- `price`
- `year_built`
- `door_counts`
- `notes`
- `hero_photo_path`

Fields may be plain values or `{ "value": ..., "confidence": ... }` objects; the generator supports both shapes.

## Review Checklist

Before sending a generated survey to Matt or Fran:

- Confirm every listing has the correct street address, city/state context, square footage, price/lease rate, year built, and door count.
- Verify low-confidence regex extractions against the flyer page images in `data/temp_images`.
- Open the generated PowerPoint and check that map pins match the detail-slide order.
- Click at least one address hyperlink to confirm it opens the intended Google Maps search.
- Inspect photo crops and Street View fallbacks for relevance and branding fit.
- Re-run generation after any JSON correction so the deck, map, and hyperlinks stay in sync.

## Directory Structure

- `scripts/`: Flyer preparation, extraction, map rendering, and PowerPoint generation scripts.
- `flyers/`: Input folder for property flyer PDFs.
- `data/`: Extracted listing JSON, geocode cache, flyer image mapping, and temporary page images.
- `output/`: Generated PowerPoint and exported deliverables.
- `config/map-renderer.json`: Provider, framing, pin, output, and geocoding settings.

## Map Renderer Configuration

- The generalized renderer reads settings from `config/map-renderer.json`.
- Default mode is `style-native-preferred`, which uses a custom Mapbox style when configured and otherwise falls back to the legacy OSM-overlay look.
- Geocode results are cached in `data/geocode_cache.json` to keep reruns stable and faster.
- Override `MAP_RENDER_MODE` and `MAPBOX_STYLE` via environment variables for testing.

## Code Review Notes

- `scripts/prepare_extraction.py` and `scripts/extract_flyers.py` overlap on PDF-to-image conversion. Keep both documented until they are intentionally consolidated; `prepare_extraction.py` is the vision-prep path, while `extract_flyers.py` is the text-extraction path.
- Map rendering has provider fallbacks. When changing map code, test with and without API keys so offline fallback behavior remains usable.
- Generated artifacts and caches under `data/` and `output/` are operational outputs; avoid committing new customer-specific artifacts unless they are intentional examples.

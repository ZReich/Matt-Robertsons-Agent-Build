# Market Survey Generator Skill (Claude Code Version)

This skill automates the creation of Commercial Real Estate Market Surveys from property flyers.

## Workflow for Claude Code

1. **Setup:** Ensure Python is installed and install dependencies:
   ```bash
   pip install python-pptx pdf2image Pillow google-maps-services-python
   ```

2. **Ingest Flyers:** Place flyer PDFs in the `./flyers` directory and run the ingest script:
   ```bash
   python scripts/ingest_flyers.py --dir ./flyers
   ```
   *This will generate a `summary.md` file.*

3. **Verify Data:** Show Matt the contents of `summary.md`. If edits are needed, Matt can tell Claude to edit the JSON data in `./data/processed_listings.json`.

4. **Generate Survey:** Once data is verified, run the generator script:
   ```bash
   python scripts/generate_pptx.py --template ../Billings_Market_Survey_Updated.pptx --output final_survey.pptx
   ```
   The generator now places map markers as PowerPoint vector circles on top of the map image, which produces a cleaner, template-matched look for future surveys.
   It also formats addresses as street-only display text, appends `SF` in square-footage cells, hyperlinks address text to Google Maps, and can use Google Street View fallback imagery when that API is enabled for the project key.

## Directory Structure
- `scripts/`: Python scripts for ingestion, extraction, and generation.
- `flyers/`: Input folder for property flyer PDFs.
- `data/`: Temporary storage for extracted JSON data.
- `output/`: Final PowerPoint and PDF files.


## Map Renderer Configuration
- The generalized renderer now reads settings from `config/map-renderer.json`.
- Default mode is `style-native-preferred`, which uses a custom Mapbox style when configured and otherwise falls back to the legacy OSM-overlay look.
- Geocode results are cached in `data/geocode_cache.json` to keep reruns stable and faster.
- You can override `MAP_RENDER_MODE` and `MAPBOX_STYLE` via environment variables for testing.

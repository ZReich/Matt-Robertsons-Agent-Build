# Market Survey Generator Skill

This skill allows Claude Code to generate professional CRE Market Surveys from property flyer PDFs.

## Prerequisites
- Python 3.10+
- `pip install python-pptx PyMuPDF Pillow PyPDF2`

## Usage

1. **Ingest Flyers:**
   Tell Claude: "Prepare extraction for the flyers in [folder]"
   *Claude will run `scripts/prepare_extraction.py` to convert PDFs to images and save the mapping to `data/flyer_images.json`.*

2. **Extract Data (Vision):**
   Tell Claude: "Read the images in `data/temp_images` and extract CRE data for each property to `data/processed_listings.json`"
   *Claude (using its vision capabilities) will analyze each property's images and extract:*
   - `address`, `sf`, `price`, `year_built`, `door_counts`, `notes`, `hero_photo_path`
   - It will save the results as a JSON array in `data/processed_listings.json`.

3. **Review & Generate:**
   Tell Claude: "Generate the market survey PowerPoint"
   *Claude will run `scripts/generate_pptx.py` which will:*
   - Show you a preview table.
   - Generate the final `.pptx` in the `output/` folder.
   - Render the map slide using a base map image plus PowerPoint vector pin overlays so the markers stay clean and template-consistent in future surveys.
   - Format map/detail addresses as street-only display text, append `SF` in square-footage cells, hyperlink detail-slide address text to Google Maps, render Price/Monthly as `$/mo`, and render PPSF as `$/SF NNN` when available.
   - Attempt Google Street View fallback imagery when flyer photos are weak or missing, if the Google project has Street View Static API enabled.

## Technical Details
- **Template:** Uses `Billings_Market_Survey_Updated.pptx`.
- **Data Schema:** `data/processed_listings.json` must be a list of property objects.

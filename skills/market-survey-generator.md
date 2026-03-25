# Skill: Market Survey Generator

## Objective
Automate the creation of commercial real estate Market Surveys by scrubbing Crexi/LoopNet, extracting data from property flyers, and generating a branded PowerPoint presentation matching Matt Robertson's specific template.

## Technical Stack
- **Web Scraping:** Playwright (Python/Node) for Crexi and LoopNet.
- **Data Extraction:** Document AI / Vision models (Two-pass: OCR for text + Vision for images/layout).
- **File Parsing:** `PyPDF2` or `pdfplumber` for PDF text extraction.
- **Presentation Logic:** `python-pptx` for programmatically building slides.
- **Template Source:** `Billings_Market_Survey_Updated.pptx` (stored in project root).

## Workflow (Standalone)

### Step 1: Search & Ingest
- **Input:** Search parameters (City, Property Type, Price Range, SF Range).
- **Action:** Scrape search results from Crexi/LoopNet.
- **Output:** List of listing URLs and metadata (Address, Price, SF, Flyer URL).

### Step 2: Document Processing
- **Action:** Download PDF flyers for each listing.
- **Extraction Schema:**
    - Address, City, State, Zip
    - Price / Lease Rate
    - Available SF / Total SF
    - Year Built
    - Lot Size (Acres)
    - Door Count (Dock/Drive-in)
    - Property Photo (Hero image from flyer)
- **Validation:** Compare extracted data against listing metadata for accuracy.

### Step 3: Slide Generation
- **Template:** Open `Billings_Market_Survey_Updated.pptx`.
- **Slide 1 (Title):** Update with current date and specific market name.
- **Slide 2 (Map):** Insert placeholders for Map pins (Manual intervention may be needed for precise mapping in v1).
- **Slide 3+ (Details):** Populate tables with extracted data. Insert hero photo for each property.
- **Slide 5 (Closing):** Ensure branding matches NAI Business Properties.

### Step 4: Review & Finalize
- **Human-in-the-loop:** Display a summary of extracted data for Matt/Fran to verify before PPTX generation.
- **Output:** Save finished `.pptx` and export to `.pdf`.

## Skill Commands (Agent Usage)
- `generate_market_survey(city, asset_type, filters)`: Triggers the full pipeline.
- `extract_flyer_data(pdf_path)`: Runs the extraction logic on a single file for manual entry.
- `update_survey_template(pptx_path)`: Scans a new PPTX to update the program's layout logic.

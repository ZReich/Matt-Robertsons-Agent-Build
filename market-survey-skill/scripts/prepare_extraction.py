import os
import json
import argparse
import fitz  # PyMuPDF
from PIL import Image

def pdf_to_images(pdf_path, output_dir):
    """Converts PDF pages to JPEG images using PyMuPDF."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    doc = fitz.open(pdf_path)
    image_paths = []
    
    base_name = os.path.splitext(os.path.basename(pdf_path))[0]
    for i in range(len(doc)):
        page = doc.load_page(i)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # Increase resolution
        image_path = os.path.join(output_dir, f"{base_name}_page_{i+1}.jpg")
        
        # Save as JPEG
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        img.save(image_path, 'JPEG', quality=95)
        image_paths.append(image_path)
        
    doc.close()
    return image_paths

def main():
    parser = argparse.ArgumentParser(description="Convert flyer PDFs to images for extraction.")
    parser.add_argument("--dir", required=True, help="Directory containing flyer PDFs")
    parser.add_argument("--output", default="./data/temp_images", help="Output directory for images")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.dir):
        print(f"Error: Input directory {args.dir} not found.")
        return

    flyers = [f for f in os.listdir(args.dir) if f.endswith('.pdf')]
    all_image_data = {}
    
    # Ensure data directory exists
    os.makedirs("./data", exist_ok=True)
    
    for flyer in flyers:
        pdf_path = os.path.join(args.dir, flyer)
        print(f"Processing {flyer}...")
        try:
            image_paths = pdf_to_images(pdf_path, args.output)
            all_image_data[flyer] = image_paths
        except Exception as e:
            print(f"Error processing {flyer}: {e}")
            
    # Save the mapping of PDFs to images
    with open("./data/flyer_images.json", "w") as f:
        json.dump(all_image_data, f, indent=4)
        
    print(f"Done. Images saved to {args.output}")

if __name__ == "__main__":
    main()

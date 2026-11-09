import pypdf
import sys

try:
    reader = pypdf.PdfReader(r"c:\xampp\htdocs\livrcart\demoark\mailer.pdf")
    print(f"Total pages: {len(reader.pages)}")
    for i, page in enumerate(reader.pages):
        print(f"--- PAGE {i+1} ---")
        print(page.extract_text())
except Exception as e:
    print("PyPDF Error:", e)

from pathlib import Path

from pypdf import PdfReader


def extract_pages(path: Path) -> list[dict]:
    reader = PdfReader(str(path))
    if reader.is_encrypted:
        decrypted = reader.decrypt("")
        if decrypted == 0:
            raise ValueError("PDF is encrypted and cannot be read")

    pages: list[dict] = []
    for index, page in enumerate(reader.pages, start=1):
        pages.append({"page": index, "text": page.extract_text() or ""})
    return pages

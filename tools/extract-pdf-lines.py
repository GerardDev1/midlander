#!/usr/bin/env python3
"""
Developer tool: extract text lines (position, font) from a screenplay PDF as JSON,
so tools/compare-layout.ts can check Midlander's layout against a reference PDF
(e.g. one exported from Fade In).

Usage: python3 tools/extract-pdf-lines.py input.pdf > lines.json
Requires: pdfplumber (pip install pdfplumber)
"""
import json
import sys

import pdfplumber


def main(path: str) -> None:
    out = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            words = page.extract_words(extra_attrs=["fontname", "size"], keep_blank_chars=True, x_tolerance=1.5)
            rows: dict[float, list] = {}
            for w in words:
                rows.setdefault(round(w["top"], 1), []).append(w)
            lines = []
            for top in sorted(rows):
                ws = sorted(rows[top], key=lambda w: w["x0"])
                lines.append(
                    {
                        "top": top,
                        "x0": round(ws[0]["x0"], 2),
                        "x1": round(ws[-1]["x1"], 2),
                        "text": " ".join(w["text"] for w in ws),
                        "font": ws[0]["fontname"].split("+")[-1],
                        "size": round(ws[0]["size"], 2),
                    }
                )
            out.append({"width": float(page.width), "height": float(page.height), "lines": lines})
    json.dump({"pages": out}, sys.stdout, indent=1)


if __name__ == "__main__":
    main(sys.argv[1])

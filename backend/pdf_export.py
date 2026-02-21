"""
Generate full report PDF. Person 4 (Glue).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

# WeasyPrint or ReportLab — Person 4 chooses and adds to requirements.txt


def generate_pdf(session_id: str, report: dict[str, Any]) -> bytes:
    """
    Build PDF from report (all phases) and return as bytes.
    """
    # TODO: Person 4 — render Crisis Brief, Precedents, Strategies, Drafts, Value Report
    return b""

"""
Jina Reader client — fetches URL and returns clean Markdown.

Uses https://r.jina.ai/{url} to extract main article content, removing
HTML, scripts, sidebars, ads. Fallback when Tavily content is noisy.
"""
import requests


def get_markdown_content(url: str, timeout: int = 10) -> str | None:
    """
    Fetches URL via Jina Reader, returns clean Markdown or None on failure.

    Jina extracts main article content, removing navigation, comments,
    related articles. Useful when Tavily returns noisy full-page dumps.
    """
    if not url or not url.strip():
        return None
    jina_url = f"https://r.jina.ai/{url}"
    try:
        response = requests.get(jina_url, timeout=timeout)
        if response.status_code == 200 and response.text.strip():
            return response.text.strip()
        return None
    except Exception:
        return None

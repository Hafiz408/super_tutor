import logging

from app.extraction.trafilatura_extractor import fetch_via_trafilatura

logger = logging.getLogger("super_tutor.extraction")


class ExtractionError(Exception):
    def __init__(self, kind: str, message: str = ""):
        self.kind = kind
        self.message = message
        super().__init__(message or kind)


PAYWALL_DOMAINS = ["nytimes.com", "wsj.com", "ft.com", "bloomberg.com", "economist.com"]


def _classify_failure(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        return "invalid_url"
    if any(d in url for d in PAYWALL_DOMAINS):
        return "paywall"
    return "empty"


async def extract_content(url: str) -> str:
    text = fetch_via_trafilatura(url)
    if text:
        logger.info("Extraction success — layer=trafilatura url=%s chars=%d", url, len(text))
        return text
    logger.warning("Extraction failed — url=%s kind=%s", url, _classify_failure(url))
    raise ExtractionError(
        kind=_classify_failure(url),
        message="Could not extract readable content from this URL",
    )

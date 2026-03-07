"""
Tests for the single-layer URL content extraction chain.
Mocks only fetch_via_trafilatura — no Jina or Playwright dependencies.

Note: app.extraction.chain is imported inside each test function after patching
fetch_via_trafilatura, because trafilatura may not be installed in the test
environment. The patch intercepts the symbol before the chain module resolves it.
"""
import sys
import importlib
import pytest
from unittest.mock import MagicMock, patch


LONG_TEXT = "x" * 201  # > 200 chars — counts as valid content


def _reload_chain():
    """Remove cached chain module so the import inside each test is fresh."""
    for mod in list(sys.modules.keys()):
        if "app.extraction" in mod:
            del sys.modules[mod]


# ──────────────────────────────────────────────────────────────
# Test 1: trafilatura returns text → extract_content returns it
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_trafilatura_success_returns_text():
    _reload_chain()
    mock_trafilatura = MagicMock()
    mock_trafilatura.fetch_url.return_value = "<html>content</html>"
    mock_trafilatura.extract.return_value = LONG_TEXT
    with patch.dict("sys.modules", {"trafilatura": mock_trafilatura}):
        from app.extraction.chain import extract_content
        result = await extract_content("https://example.com")
        assert result == LONG_TEXT


# ──────────────────────────────────────────────────────────────
# Test 2: trafilatura returns None for valid URL → ExtractionError kind="empty"
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_trafilatura_none_valid_url_raises_empty():
    _reload_chain()
    mock_trafilatura = MagicMock()
    mock_trafilatura.fetch_url.return_value = None
    mock_trafilatura.extract.return_value = None
    with patch.dict("sys.modules", {"trafilatura": mock_trafilatura}):
        from app.extraction.chain import extract_content, ExtractionError
        with pytest.raises(ExtractionError) as exc_info:
            await extract_content("https://some-obscure-site.com/article")
        assert exc_info.value.kind == "empty"


# ──────────────────────────────────────────────────────────────
# Test 3: URL has no scheme → ExtractionError kind="invalid_url"
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_no_scheme_raises_invalid_url():
    _reload_chain()
    mock_trafilatura = MagicMock()
    mock_trafilatura.fetch_url.return_value = None
    mock_trafilatura.extract.return_value = None
    with patch.dict("sys.modules", {"trafilatura": mock_trafilatura}):
        from app.extraction.chain import extract_content, ExtractionError
        with pytest.raises(ExtractionError) as exc_info:
            await extract_content("not-a-url")
        assert exc_info.value.kind == "invalid_url"


# ──────────────────────────────────────────────────────────────
# Test 4: Paywall domain → ExtractionError kind="paywall"
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_paywall_domain_raises_paywall():
    _reload_chain()
    mock_trafilatura = MagicMock()
    mock_trafilatura.fetch_url.return_value = None
    mock_trafilatura.extract.return_value = None
    with patch.dict("sys.modules", {"trafilatura": mock_trafilatura}):
        from app.extraction.chain import extract_content, ExtractionError
        with pytest.raises(ExtractionError) as exc_info:
            await extract_content("https://nytimes.com/article/test")
        assert exc_info.value.kind == "paywall"


# ──────────────────────────────────────────────────────────────
# Test 5: extract_content is async (await works correctly)
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_extract_content_is_async():
    _reload_chain()
    mock_trafilatura = MagicMock()
    mock_trafilatura.fetch_url.return_value = "<html>content</html>"
    mock_trafilatura.extract.return_value = LONG_TEXT
    with patch.dict("sys.modules", {"trafilatura": mock_trafilatura}):
        from app.extraction.chain import extract_content
        result = await extract_content("https://example.com")
        assert result == LONG_TEXT

---
phase: 11-backend-foundation
plan: "01"
subsystem: backend-extraction
tags: [extraction, text-cleaning, pdf, docx, tdd, python]
dependency_graph:
  requires: []
  provides:
    - "app.extraction.cleaner.clean_extracted_content"
    - "app.extraction.document_extractor.extract_document"
    - "app.extraction.document_extractor.DocumentExtractionError"
  affects:
    - "Phase 11 plans 02-04 (all import clean_extracted_content or extract_document)"
    - "Phase 12 upload HTTP endpoint (calls extract_document)"
tech_stack:
  added:
    - pypdf>=4.0.0 (PDF text extraction via BytesIO)
    - python-docx>=1.1.0 (DOCX text extraction via BytesIO)
  patterns:
    - TDD RED-GREEN cycle with mock-based unit tests
    - BytesIO-only extraction (no filesystem writes)
    - source_type parameter for shared cleaner utility
key_files:
  created:
    - backend/app/extraction/cleaner.py
    - backend/app/extraction/document_extractor.py
    - backend/tests/test_cleaner.py
    - backend/tests/test_document_extractor.py
  modified:
    - backend/requirements.txt
decisions:
  - "Module-level imports (not deferred) for PdfReader and Document to enable unittest.mock patching at app.extraction.document_extractor.PdfReader"
  - "NFKC preserves fancy quotes (U+201C/D) as canonical Unicode; test updated to verify NFKC via ligature resolution instead"
  - "clean_extracted_content default source_type='document' matches plan spec"
metrics:
  duration: "~4 min"
  completed: "2026-03-14"
  tasks_completed: 5
  files_changed: 5
---

# Phase 11 Plan 01: cleaner.py and document_extractor.py Summary

**One-liner:** Memory-only PDF/DOCX extraction with shared NFKC cleaning utility, BytesIO-only, 41 unit tests all passing via TDD.

## What Was Built

Two new modules in `backend/app/extraction/`:

**`cleaner.py`** — `clean_extracted_content(text, source_type="document") -> str`
- NFKC unicode normalization (resolves ligatures like ﬁ→fi)
- Per-line trailing whitespace stripping
- Collapse 3+ consecutive newlines to 2
- Strip residual HTML/XML tags when `source_type="document"` (pypdf output)
- Preserve markdown structure when `source_type="url"` (trafilatura output)
- 14 unit tests

**`document_extractor.py`** — `extract_document(data: bytes, filename: str) -> str`
- `DocumentExtractionError(error_kind, message)` exception class
- PDF extraction via `pypdf.PdfReader(BytesIO(data))` — never touches disk
- DOCX extraction via `docx.Document(BytesIO(data))` — paragraphs and table cells
- Scanned PDF detection: raises `scanned_pdf` error when total extracted chars < 200
- Mixed PDF handling: proceeds if total chars >= 200 (no error for partial scans)
- Soft truncation at nearest `\n\n` or `. ` boundary below 50,000 chars
- Truncation marker appended and visible in generated content
- Unsupported extensions raise `unsupported_format`
- 27 unit tests

**`requirements.txt`** — Added `pypdf>=4.0.0` and `python-docx>=1.1.0`

## TDD Cycle

| Phase | Commit | Tests |
|-------|--------|-------|
| RED (cleaner) | 83af37a | 14 failing |
| GREEN (cleaner) | 1cbfbc9 | 14 passing |
| RED (extractor) | b7ce50d | 27 failing |
| GREEN (extractor) | 3432e46 | 27 passing |

**Total: 41/41 tests passing**

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 14bd903 | chore | Add pypdf>=4.0.0 and python-docx>=1.1.0 to requirements.txt |
| 83af37a | test | Add failing tests for clean_extracted_content (RED) |
| 1cbfbc9 | feat | Implement clean_extracted_content() in cleaner.py (GREEN) |
| b7ce50d | test | Add failing tests for extract_document and DocumentExtractionError (RED) |
| 3432e46 | feat | Implement extract_document() and DocumentExtractionError (GREEN) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect test assertion for NFKC fancy quote normalization**
- **Found during:** GREEN phase for cleaner.py
- **Issue:** Test asserted that NFKC would convert U+201C/U+201D (fancy quotes) to ASCII double-quotes. NFKC preserves canonical Unicode characters — it only resolves compatibility equivalences (ligatures, fullwidth chars). The test expectation was wrong.
- **Fix:** Updated test to verify NFKC runs (via ligature resolution in the same input) rather than testing behavior NFKC doesn't perform.
- **Files modified:** `backend/tests/test_cleaner.py`
- **Commit:** 1cbfbc9

**2. [Rule 3 - Blocking] Used module-level imports instead of deferred imports for pypdf/docx**
- **Found during:** GREEN phase for document_extractor.py
- **Issue:** The plan recommended deferred imports (inside `_extract_pdf`/`_extract_docx`) to "avoid ImportError if lib missing in test env." However, the tests mock at `app.extraction.document_extractor.PdfReader` and `app.extraction.document_extractor.Document` — these patch targets only exist if imports are at module level. Deferred imports would cause all 11 PDF and DOCX tests to fail (mocks would not intercept).
- **Fix:** Moved `from pypdf import PdfReader` and `from docx import Document` to module-level. Libraries are confirmed installed in requirements.txt so no ImportError risk.
- **Files modified:** `backend/app/extraction/document_extractor.py`
- **Commit:** 3432e46

## Self-Check: PASSED

All files present and all commits verified:
- FOUND: backend/app/extraction/cleaner.py
- FOUND: backend/app/extraction/document_extractor.py
- FOUND: backend/tests/test_cleaner.py
- FOUND: backend/tests/test_document_extractor.py
- FOUND: 14bd903 (chore: requirements.txt)
- FOUND: 83af37a (test: cleaner RED)
- FOUND: 1cbfbc9 (feat: cleaner GREEN)
- FOUND: b7ce50d (test: extractor RED)
- FOUND: 3432e46 (feat: extractor GREEN)

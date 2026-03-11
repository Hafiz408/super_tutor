"""
retry.py: Error classification helpers.

Retries are handled at two levels:
  - SDK level: OpenAIChat(max_retries=N) — retries inside each agent.run() call
  - Step level: Step(max_retries=N) — retries the whole step on any failure
"""

# Keywords that indicate a retryable transient error
_RETRYABLE_KEYWORDS = [
    "429",
    "rate limit",
    "rate_limit",
    "temporarily",
    "503",
    "502",
    "provider returned error",
    "overloaded",
]

# Keywords that indicate a non-retryable error — checked first
_NON_RETRYABLE_KEYWORDS = ["401", "403", "400", "invalid api key", "bad request"]


def is_retryable(exc: BaseException) -> bool:
    """Return True if the exception represents a transient provider error worth retrying."""
    msg = str(exc).lower()
    if any(k in msg for k in _NON_RETRYABLE_KEYWORDS):
        return False
    return any(k in msg for k in _RETRYABLE_KEYWORDS)

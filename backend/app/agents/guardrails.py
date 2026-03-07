"""
Shared agno guardrail definitions for all Super Tutor agents.

pre_hooks  — run before the LLM sees the input
post_hooks — run after the LLM produces output

Usage in any agent builder:
    from app.agents.guardrails import PROMPT_INJECTION_GUARDRAIL, validate_substantive_output
    Agent(
        ...
        pre_hooks=[PROMPT_INJECTION_GUARDRAIL],
        post_hooks=[validate_substantive_output],
    )
"""

import logging

from agno.exceptions import CheckTrigger, OutputCheckError
from agno.guardrails import PromptInjectionGuardrail
from agno.run.agent import RunOutput

logger = logging.getLogger("super_tutor.guardrails")

# Singleton — PromptInjectionGuardrail is stateless, safe to share across agents.
# Raises agno.exceptions.InputCheckError when injection is detected.
PROMPT_INJECTION_GUARDRAIL = PromptInjectionGuardrail()


def validate_substantive_output(run_output: RunOutput) -> None:
    """
    Post-hook: reject empty or suspiciously short agent responses.

    Threshold is 20 characters — intentionally low to catch blank/error strings
    without false-positiving on short-but-valid outputs (e.g., a 2-word title).
    Raises OutputCheckError which agno surfaces as a runtime failure.
    """
    content = (run_output.content or "").strip()
    if len(content) < 20:
        logger.warning(
            "Output guardrail triggered — content too short (len=%d): %r",
            len(content),
            content[:80],
        )
        raise OutputCheckError(
            "Agent output is too short or empty to be useful. Please try again.",
            check_trigger=CheckTrigger.OUTPUT_NOT_ALLOWED,
        )

from pydantic import BaseModel, Field
from typing import Literal


class TutorStreamRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    tutoring_type: Literal["micro_learning", "teaching_a_kid", "advanced"]
    session_id: str  # required; router loads source_content + notes from SQLite using this ID

    # Note: No chat_reset_id field — the tutor team uses a fixed namespace `tutor:{session_id}`
    # and does not support mid-session resets in this phase.

    model_config = {"str_strip_whitespace": True}

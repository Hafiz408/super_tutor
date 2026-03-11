from pydantic import BaseModel
from typing import Literal


class ChatStreamRequest(BaseModel):
    message: str
    tutoring_type: Literal["micro_learning", "teaching_a_kid", "advanced"]
    session_id: str  # required; router loads notes from SQLite using this ID

    model_config = {"str_strip_whitespace": True}

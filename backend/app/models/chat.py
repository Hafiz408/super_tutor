from pydantic import BaseModel
from typing import Literal


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatStreamRequest(BaseModel):
    message: str
    notes: str
    tutoring_type: Literal["micro_learning", "teaching_a_kid", "advanced"]
    history: list[ChatMessage] = []
    session_id: str = ""  # TRAC-04: passed from frontend to tag chat traces per session

    model_config = {"str_strip_whitespace": True}

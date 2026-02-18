from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Literal


TutoringType = Literal["micro_learning", "teaching_a_kid", "advanced"]


class SessionRequest(BaseModel):
    url: Optional[HttpUrl] = None
    paste_text: Optional[str] = None
    tutoring_type: TutoringType
    focus_prompt: Optional[str] = None

    model_config = {"str_strip_whitespace": True}


class Flashcard(BaseModel):
    front: str
    back: str


class QuizQuestion(BaseModel):
    question: str
    options: List[str]      # exactly 4 options
    answer_index: int        # 0-3, index into options


class SessionResult(BaseModel):
    session_id: str
    source_title: str
    tutoring_type: TutoringType
    notes: str               # markdown string
    flashcards: List[Flashcard]
    quiz: List[QuizQuestion]

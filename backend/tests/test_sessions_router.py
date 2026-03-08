"""
Basic router tests for sessions endpoints (Task 9).

These tests exercise the HTTP layer without hitting real AI agents or databases.
They use the sessions router directly (not main.app which wraps AgentOS).
"""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import sessions as sessions_router


# ---------------------------------------------------------------------------
# Test app fixture — mounts only the sessions router (no AgentOS wrapping)
# ---------------------------------------------------------------------------

@pytest.fixture()
def client():
    app = FastAPI()
    app.include_router(sessions_router.router, prefix="/sessions")
    # Clear PENDING_STORE between tests to avoid state bleed
    sessions_router.PENDING_STORE.clear()
    return TestClient(app)


# ---------------------------------------------------------------------------
# POST /sessions — create_session
# ---------------------------------------------------------------------------

def test_create_session_returns_session_id(client):
    """POST /sessions with a valid topic request must return a session_id."""
    response = client.post(
        "/sessions",
        json={
            "topic_description": "Introduction to machine learning algorithms",
            "tutoring_type": "advanced",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "session_id" in body
    assert isinstance(body["session_id"], str)
    assert len(body["session_id"]) > 0


def test_create_session_stores_params(client):
    """POST /sessions must store session params in PENDING_STORE keyed by session_id."""
    sessions_router.PENDING_STORE.clear()
    response = client.post(
        "/sessions",
        json={
            "paste_text": "Some study material here for testing purposes.",
            "tutoring_type": "micro_learning",
            "generate_flashcards": True,
        },
    )
    assert response.status_code == 200
    session_id = response.json()["session_id"]
    assert session_id in sessions_router.PENDING_STORE
    stored = sessions_router.PENDING_STORE[session_id]
    assert stored["tutoring_type"] == "micro_learning"
    assert stored["generate_flashcards"] is True


def test_create_session_url_input(client):
    """POST /sessions with a URL must succeed and return a session_id."""
    response = client.post(
        "/sessions",
        json={
            "url": "https://example.com/article",
            "tutoring_type": "teaching_a_kid",
        },
    )
    assert response.status_code == 200
    assert "session_id" in response.json()


def test_create_session_with_both_flashcards_and_quiz_flags(client):
    """POST /sessions must correctly store both opt-in flags."""
    sessions_router.PENDING_STORE.clear()
    response = client.post(
        "/sessions",
        json={
            "paste_text": "Study text for a test session covering basic concepts.",
            "tutoring_type": "advanced",
            "generate_flashcards": True,
            "generate_quiz": True,
        },
    )
    assert response.status_code == 200
    session_id = response.json()["session_id"]
    stored = sessions_router.PENDING_STORE[session_id]
    assert stored["generate_flashcards"] is True
    assert stored["generate_quiz"] is True


# ---------------------------------------------------------------------------
# GET /sessions/{id}/stream — stream_session
# ---------------------------------------------------------------------------

def test_stream_session_not_found(client):
    """GET /sessions/{id}/stream for an unknown session_id must return 404."""
    response = client.get("/sessions/nonexistent-session-id/stream")
    assert response.status_code == 404


def test_stream_session_not_found_after_pop(client):
    """A session_id can only be streamed once — second call returns 404."""
    # We need to patch run_session_workflow so the stream doesn't actually run AI
    from app.workflows.session_workflow import RunResponse

    async def _fake_workflow(**kwargs):
        yield RunResponse(content="Crafting your notes...")
        yield RunResponse(
            event="workflow_completed",
            content={
                "source_title": "Test",
                "tutoring_type": "advanced",
                "session_type": "paste",
                "sources": [],
                "notes": "## Notes\n- point one",
                "flashcards": [],
                "quiz": [],
                "chat_intro": "",
                "errors": None,
            },
        )

    with patch("app.routers.sessions.run_session_workflow", side_effect=_fake_workflow):
        # First: create a session
        create_resp = client.post(
            "/sessions",
            json={
                "paste_text": "Some study material for the stream test.",
                "tutoring_type": "advanced",
            },
        )
        assert create_resp.status_code == 200
        session_id = create_resp.json()["session_id"]

        # First stream call pops from PENDING_STORE
        client.get(f"/sessions/{session_id}/stream")

        # Second call — session_id no longer in PENDING_STORE
        second_resp = client.get(f"/sessions/{session_id}/stream")
        assert second_resp.status_code == 404


def test_stream_session_topic_too_short(client):
    """A topic shorter than 10 characters must return an SSE error event, not 200 data."""
    # Create the session first
    create_resp = client.post(
        "/sessions",
        json={
            "topic_description": "ML",
            "tutoring_type": "advanced",
        },
    )
    assert create_resp.status_code == 200
    session_id = create_resp.json()["session_id"]

    # Stream — expect error event in the SSE body
    stream_resp = client.get(f"/sessions/{session_id}/stream")
    # SSE returns 200 at transport level; the error is in the event data
    assert stream_resp.status_code == 200
    body = stream_resp.text
    assert "error" in body
    assert "too short" in body.lower() or "invalid_url" in body


# ---------------------------------------------------------------------------
# POST /sessions/{id}/regenerate/{section}
# ---------------------------------------------------------------------------

def test_regenerate_unknown_section_returns_400(client):
    """POST /sessions/{id}/regenerate/invalid_section must return 400."""
    response = client.post(
        "/sessions/any-session-id/regenerate/invalid_section",
        json={"notes": "some notes", "tutoring_type": "advanced"},
    )
    assert response.status_code == 400


def test_regenerate_unknown_session_returns_404(client):
    """POST /sessions/{id}/regenerate/flashcards for unknown session must return 404."""
    with patch("app.routers.sessions._guard_session", side_effect=__import__("fastapi").HTTPException(status_code=404, detail="not found")):
        response = client.post(
            "/sessions/nonexistent/regenerate/flashcards",
            json={"notes": "some notes", "tutoring_type": "advanced"},
        )
    assert response.status_code == 404

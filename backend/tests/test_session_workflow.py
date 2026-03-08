"""
Unit tests for build_session_workflow (Task 8).

Tests verify the conditional step-list logic without running agents or touching SQLite.
"""
from unittest.mock import MagicMock, patch

import pytest


def _make_mock_db():
    return MagicMock()


@patch("app.workflows.session_workflow.Workflow", autospec=False)
def test_build_workflow_topic_includes_research_step(MockWorkflow):
    """Topic session must include research_step as the first step."""
    from app.workflows.session_workflow import build_session_workflow
    build_session_workflow(
        session_id="s1",
        session_db=_make_mock_db(),
        session_type="topic",
        generate_flashcards=False,
        generate_quiz=False,
    )
    call_kwargs = MockWorkflow.call_args.kwargs
    step_names = [s.name for s in call_kwargs["steps"]]
    assert step_names[0] == "research", f"Expected first step to be 'research', got {step_names}"


@patch("app.workflows.session_workflow.Workflow", autospec=False)
def test_build_workflow_url_excludes_research_step(MockWorkflow):
    """URL session must NOT include research_step."""
    from app.workflows.session_workflow import build_session_workflow
    build_session_workflow(
        session_id="s2",
        session_db=_make_mock_db(),
        session_type="url",
        generate_flashcards=False,
        generate_quiz=False,
    )
    call_kwargs = MockWorkflow.call_args.kwargs
    step_names = [s.name for s in call_kwargs["steps"]]
    assert "research" not in step_names


@patch("app.workflows.session_workflow.Workflow", autospec=False)
def test_build_workflow_with_flashcards_flag(MockWorkflow):
    """generate_flashcards=True must add flashcards step."""
    from app.workflows.session_workflow import build_session_workflow
    build_session_workflow(
        session_id="s3",
        session_db=_make_mock_db(),
        session_type="url",
        generate_flashcards=True,
        generate_quiz=False,
    )
    call_kwargs = MockWorkflow.call_args.kwargs
    step_names = [s.name for s in call_kwargs["steps"]]
    assert "flashcards" in step_names


@patch("app.workflows.session_workflow.Workflow", autospec=False)
def test_build_workflow_without_flashcards_flag(MockWorkflow):
    """generate_flashcards=False must NOT add flashcards step."""
    from app.workflows.session_workflow import build_session_workflow
    build_session_workflow(
        session_id="s4",
        session_db=_make_mock_db(),
        session_type="url",
        generate_flashcards=False,
        generate_quiz=False,
    )
    call_kwargs = MockWorkflow.call_args.kwargs
    step_names = [s.name for s in call_kwargs["steps"]]
    assert "flashcards" not in step_names


@patch("app.workflows.session_workflow.Workflow", autospec=False)
def test_build_workflow_with_quiz_flag(MockWorkflow):
    """generate_quiz=True must add quiz step."""
    from app.workflows.session_workflow import build_session_workflow
    build_session_workflow(
        session_id="s5",
        session_db=_make_mock_db(),
        session_type="url",
        generate_flashcards=False,
        generate_quiz=True,
    )
    call_kwargs = MockWorkflow.call_args.kwargs
    step_names = [s.name for s in call_kwargs["steps"]]
    assert "quiz" in step_names


@patch("app.workflows.session_workflow.Workflow", autospec=False)
def test_build_workflow_always_includes_notes_and_title(MockWorkflow):
    """Every workflow must include notes and title steps."""
    from app.workflows.session_workflow import build_session_workflow
    for session_type in ("url", "paste", "topic"):
        MockWorkflow.reset_mock()
        build_session_workflow(
            session_id="s6",
            session_db=_make_mock_db(),
            session_type=session_type,
            generate_flashcards=False,
            generate_quiz=False,
        )
        call_kwargs = MockWorkflow.call_args.kwargs
        step_names = [s.name for s in call_kwargs["steps"]]
        assert "notes" in step_names, f"Missing notes for session_type={session_type}"
        assert "title" in step_names, f"Missing title for session_type={session_type}"


@patch("app.workflows.session_workflow.Workflow", autospec=False)
def test_build_workflow_title_is_last_step(MockWorkflow):
    """title_step must always be the last step."""
    from app.workflows.session_workflow import build_session_workflow
    build_session_workflow(
        session_id="s7",
        session_db=_make_mock_db(),
        session_type="topic",
        generate_flashcards=True,
        generate_quiz=True,
    )
    call_kwargs = MockWorkflow.call_args.kwargs
    step_names = [s.name for s in call_kwargs["steps"]]
    assert step_names[-1] == "title", f"Expected last step to be 'title', got {step_names[-1]}"


@patch("app.workflows.session_workflow.Workflow", autospec=False)
def test_build_workflow_backward_compat_minimal_call(MockWorkflow):
    """build_session_workflow with only session_id + session_db still works (used by _guard_session)."""
    from app.workflows.session_workflow import build_session_workflow
    build_session_workflow(session_id="s8", session_db=_make_mock_db())
    assert MockWorkflow.called

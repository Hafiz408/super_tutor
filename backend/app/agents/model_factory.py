from app.config import get_settings


def get_model():
    settings = get_settings()
    provider = settings.agent_provider.lower()
    model_id = settings.agent_model

    if provider == "anthropic":
        from agno.models.anthropic import Claude
        return Claude(id=model_id)
    elif provider == "groq":
        from agno.models.groq import Groq
        return Groq(id=model_id)
    else:
        # Default: OpenAI
        from agno.models.openai import OpenAIChat
        return OpenAIChat(id=model_id)

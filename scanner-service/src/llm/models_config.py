"""
LLM Models Configuration
Central configuration for all supported LLM providers and their models
"""

from typing import Dict, List, TypedDict


class ModelInfo(TypedDict):
    id: str
    name: str
    description: str
    context_window: int
    max_output: int
    is_default: bool


class ProviderConfig(TypedDict):
    name: str
    display_name: str
    models: List[ModelInfo]


# OpenAI Models Configuration
OPENAI_MODELS: List[ModelInfo] = [
    {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "description": "Most capable model, best for complex security analysis",
        "context_window": 128000,
        "max_output": 16384,
        "is_default": True,
    },
    {
        "id": "gpt-4o-mini",
        "name": "GPT-4o Mini",
        "description": "Fast and efficient, good for simpler fixes",
        "context_window": 128000,
        "max_output": 16384,
        "is_default": False,
    },
    {
        "id": "gpt-4-turbo",
        "name": "GPT-4 Turbo",
        "description": "Previous generation, still very capable",
        "context_window": 128000,
        "max_output": 4096,
        "is_default": False,
    },
    {
        "id": "o1",
        "name": "o1",
        "description": "Advanced reasoning model for complex problems",
        "context_window": 200000,
        "max_output": 100000,
        "is_default": False,
    },
    {
        "id": "o1-mini",
        "name": "o1 Mini",
        "description": "Faster reasoning model, cost-effective",
        "context_window": 128000,
        "max_output": 65536,
        "is_default": False,
    },
    {
        "id": "o3-mini",
        "name": "o3 Mini",
        "description": "Latest reasoning model, highly efficient",
        "context_window": 200000,
        "max_output": 100000,
        "is_default": False,
    },
]

# Anthropic Models Configuration
ANTHROPIC_MODELS: List[ModelInfo] = [
    {
        "id": "claude-sonnet-4-5-20250514",
        "name": "Claude 4.5 Sonnet",
        "description": "Latest and most capable Claude model",
        "context_window": 200000,
        "max_output": 64000,
        "is_default": True,
    },
    {
        "id": "claude-opus-4-5-20250514",
        "name": "Claude 4.5 Opus",
        "description": "Most powerful Claude model for complex tasks",
        "context_window": 200000,
        "max_output": 32000,
        "is_default": False,
    },
    {
        "id": "claude-3-5-sonnet-20241022",
        "name": "Claude 3.5 Sonnet",
        "description": "Excellent balance of speed and capability",
        "context_window": 200000,
        "max_output": 8192,
        "is_default": False,
    },
    {
        "id": "claude-3-5-haiku-20241022",
        "name": "Claude 3.5 Haiku",
        "description": "Fast and efficient for quick fixes",
        "context_window": 200000,
        "max_output": 8192,
        "is_default": False,
    },
    {
        "id": "claude-3-opus-20240229",
        "name": "Claude 3 Opus",
        "description": "Previous generation, still very capable",
        "context_window": 200000,
        "max_output": 4096,
        "is_default": False,
    },
]

# Google Gemini Models Configuration
GOOGLE_MODELS: List[ModelInfo] = [
    # Gemini 3 Series (Latest)
    {
        "id": "gemini-3-pro-preview",
        "name": "Gemini 3 Pro",
        "description": "Most intelligent model with advanced reasoning and agentic capabilities",
        "context_window": 1048576,
        "max_output": 65536,
        "is_default": False,
    },
    {
        "id": "gemini-3-flash",
        "name": "Gemini 3 Flash",
        "description": "Pro-level intelligence at Flash speed and pricing",
        "context_window": 1048576,
        "max_output": 65536,
        "is_default": True,
    },
    # Gemini 2.5 Series (Production-Ready)
    {
        "id": "gemini-2.5-pro-preview-05-06",
        "name": "Gemini 2.5 Pro",
        "description": "Production-ready with enhanced reasoning",
        "context_window": 1048576,
        "max_output": 65536,
        "is_default": False,
    },
    {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "description": "Stable model for production apps",
        "context_window": 1048576,
        "max_output": 65536,
        "is_default": False,
    },
    # Gemini 2.0 Series
    {
        "id": "gemini-2.0-flash",
        "name": "Gemini 2.0 Flash",
        "description": "Fast multimodal model (retiring March 2026)",
        "context_window": 1048576,
        "max_output": 8192,
        "is_default": False,
    },
    {
        "id": "gemini-2.0-flash-lite",
        "name": "Gemini 2.0 Flash Lite",
        "description": "Lightweight version for simple tasks",
        "context_window": 1048576,
        "max_output": 8192,
        "is_default": False,
    },
]

# All providers configuration
PROVIDERS_CONFIG: Dict[str, ProviderConfig] = {
    "OPENAI": {
        "name": "OPENAI",
        "display_name": "OpenAI",
        "models": OPENAI_MODELS,
    },
    "ANTHROPIC": {
        "name": "ANTHROPIC",
        "display_name": "Anthropic",
        "models": ANTHROPIC_MODELS,
    },
    "GOOGLE": {
        "name": "GOOGLE",
        "display_name": "Google Gemini",
        "models": GOOGLE_MODELS,
    },
}


def get_provider_models(provider: str) -> List[ModelInfo]:
    """Get all models for a provider"""
    config = PROVIDERS_CONFIG.get(provider.upper())
    if config:
        return config["models"]
    return []


def get_default_model(provider: str) -> str:
    """Get the default model ID for a provider"""
    models = get_provider_models(provider)
    for model in models:
        if model["is_default"]:
            return model["id"]
    return models[0]["id"] if models else ""


def get_all_providers() -> Dict[str, ProviderConfig]:
    """Get all providers configuration"""
    return PROVIDERS_CONFIG


def is_valid_model(provider: str, model_id: str) -> bool:
    """Check if a model ID is valid for a provider"""
    models = get_provider_models(provider)
    return any(m["id"] == model_id for m in models)

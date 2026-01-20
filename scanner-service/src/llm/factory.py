"""
LLM Factory - Creates LLM provider instances
"""

from typing import Optional, Union
import structlog

from ..config import Config
from .base import LLMProviderType
from .openai_provider import OpenAIProvider, OpenAIProviderSync
from .anthropic_provider import AnthropicProvider, AnthropicProviderSync
from .google_provider import GoogleProvider, GoogleProviderSync

logger = structlog.get_logger()


class LLMFactory:
    """Factory for creating LLM provider instances"""

    @staticmethod
    def create(
        provider_type: Union[LLMProviderType, str],
        api_key: Optional[str] = None,
        async_mode: bool = False
    ):
        """
        Create an LLM provider instance

        Args:
            provider_type: The type of provider to create
            api_key: Optional API key (will use config if not provided)
            async_mode: Whether to create async or sync provider

        Returns:
            An LLM provider instance
        """

        # Convert string to enum if necessary
        if isinstance(provider_type, str):
            provider_type = LLMProviderType(provider_type.upper())

        # Get API key from config if not provided
        if api_key is None:
            api_key = LLMFactory._get_api_key_from_config(provider_type)

        if not api_key:
            raise ValueError(f"No API key found for provider: {provider_type.value}")

        logger.info(
            "Creating LLM provider",
            provider=provider_type.value,
            async_mode=async_mode
        )

        if provider_type == LLMProviderType.OPENAI:
            return OpenAIProvider(api_key) if async_mode else OpenAIProviderSync(api_key)

        elif provider_type == LLMProviderType.ANTHROPIC:
            return AnthropicProvider(api_key) if async_mode else AnthropicProviderSync(api_key)

        elif provider_type == LLMProviderType.GOOGLE:
            return GoogleProvider(api_key) if async_mode else GoogleProviderSync(api_key)

        else:
            raise ValueError(f"Unknown provider type: {provider_type}")

    @staticmethod
    def _get_api_key_from_config(provider_type: LLMProviderType) -> Optional[str]:
        """Get API key from config based on provider type"""

        key_mapping = {
            LLMProviderType.OPENAI: Config.OPENAI_API_KEY,
            LLMProviderType.ANTHROPIC: Config.ANTHROPIC_API_KEY,
            LLMProviderType.GOOGLE: Config.GOOGLE_AI_API_KEY,
        }

        return key_mapping.get(provider_type)

    @staticmethod
    def get_available_providers() -> list:
        """Get list of providers with valid API keys configured"""

        available = []

        if Config.OPENAI_API_KEY:
            available.append({
                'provider': 'OPENAI',
                'models': ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo']
            })

        if Config.ANTHROPIC_API_KEY:
            available.append({
                'provider': 'ANTHROPIC',
                'models': ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
            })

        if Config.GOOGLE_AI_API_KEY:
            available.append({
                'provider': 'GOOGLE',
                'models': ['gemini-pro', 'gemini-pro-vision']
            })

        return available


def get_llm_provider(
    provider: Union[LLMProviderType, str],
    api_key: Optional[str] = None,
    async_mode: bool = False
):
    """
    Convenience function to get an LLM provider

    Args:
        provider: Provider type (string or enum)
        api_key: Optional API key
        async_mode: Whether to use async provider

    Returns:
        LLM provider instance
    """
    return LLMFactory.create(provider, api_key, async_mode)

"""
OpenAI LLM Provider
"""

import structlog
from typing import Optional
from openai import AsyncOpenAI

from .base import BaseLLMProvider, FixRequest, FixResponse

logger = structlog.get_logger()


class OpenAIProvider(BaseLLMProvider):
    """OpenAI API provider for generating security fixes"""

    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = AsyncOpenAI(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "OPENAI"

    @property
    def default_model(self) -> str:
        return "gpt-4o"

    async def generate_fix(
        self,
        request: FixRequest,
        model: Optional[str] = None
    ) -> FixResponse:
        """Generate a security fix using OpenAI's API"""

        model = model or self.default_model

        logger.info(
            "Generating fix with OpenAI",
            model=model,
            vulnerability=request.vulnerability_title
        )

        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": self._build_system_prompt()
                    },
                    {
                        "role": "user",
                        "content": self._build_user_prompt(request)
                    }
                ],
                temperature=0.2,  # Lower temperature for more consistent code
                max_tokens=2000,
                response_format={"type": "json_object"}
            )

            response_text = response.choices[0].message.content or ""
            tokens_used = response.usage.total_tokens if response.usage else 0

            fix_response = self._parse_response(response_text, model)
            fix_response.tokens_used = tokens_used

            logger.info(
                "Fix generated successfully",
                provider="OPENAI",
                model=model,
                tokens=tokens_used,
                confidence=fix_response.confidence
            )

            return fix_response

        except Exception as e:
            logger.error("OpenAI API error", error=str(e))
            raise


class OpenAIProviderSync:
    """Synchronous wrapper for OpenAI provider"""

    def __init__(self, api_key: str):
        from openai import OpenAI
        self.api_key = api_key
        self.client = OpenAI(api_key=api_key)
        self.provider_name = "OPENAI"
        self.default_model = "gpt-4o"

    def generate_fix(
        self,
        request: FixRequest,
        model: Optional[str] = None
    ) -> FixResponse:
        """Generate a security fix using OpenAI's API (sync version)"""
        import json

        model = model or self.default_model

        logger.info(
            "Generating fix with OpenAI (sync)",
            model=model,
            vulnerability=request.vulnerability_title
        )

        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": self._build_system_prompt()
                    },
                    {
                        "role": "user",
                        "content": self._build_user_prompt(request)
                    }
                ],
                temperature=0.2,
                max_tokens=2000,
                response_format={"type": "json_object"}
            )

            response_text = response.choices[0].message.content or ""
            tokens_used = response.usage.total_tokens if response.usage else 0

            # Parse response
            try:
                data = json.loads(response_text)
                fix_response = FixResponse(
                    fixed_code=data.get('fixed_code', ''),
                    explanation=data.get('explanation', ''),
                    confidence=float(data.get('confidence', 0.8)),
                    provider=self.provider_name,
                    model=model,
                    tokens_used=tokens_used
                )
            except json.JSONDecodeError:
                fix_response = FixResponse(
                    fixed_code=response_text,
                    explanation="Unable to parse structured response",
                    confidence=0.6,
                    provider=self.provider_name,
                    model=model,
                    tokens_used=tokens_used
                )

            logger.info(
                "Fix generated successfully",
                provider="OPENAI",
                model=model,
                tokens=tokens_used
            )

            return fix_response

        except Exception as e:
            logger.error("OpenAI API error", error=str(e))
            raise

    def _build_system_prompt(self) -> str:
        return BaseLLMProvider._build_system_prompt(None)

    def _build_user_prompt(self, request: FixRequest) -> str:
        return BaseLLMProvider._build_user_prompt(None, request)

"""
Anthropic (Claude) LLM Provider
"""

import json
import re
import structlog
from typing import Optional
from anthropic import AsyncAnthropic, Anthropic

from .base import BaseLLMProvider, FixRequest, FixResponse

logger = structlog.get_logger()


class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude API provider for generating security fixes"""

    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = AsyncAnthropic(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "ANTHROPIC"

    @property
    def default_model(self) -> str:
        return "claude-sonnet-4-5-20250514"

    async def generate_fix(
        self,
        request: FixRequest,
        model: Optional[str] = None
    ) -> FixResponse:
        """Generate a security fix using Anthropic's Claude API"""

        model = model or self.default_model

        logger.info(
            "Generating fix with Anthropic Claude",
            model=model,
            vulnerability=request.vulnerability_title
        )

        try:
            response = await self.client.messages.create(
                model=model,
                max_tokens=2000,
                system=self._build_system_prompt(),
                messages=[
                    {
                        "role": "user",
                        "content": self._build_user_prompt(request)
                    }
                ],
                temperature=0.2
            )

            response_text = ""
            for block in response.content:
                if hasattr(block, 'text'):
                    response_text += block.text

            tokens_used = (
                response.usage.input_tokens + response.usage.output_tokens
                if response.usage else 0
            )

            fix_response = self._parse_response(response_text, model)
            fix_response.tokens_used = tokens_used

            logger.info(
                "Fix generated successfully",
                provider="ANTHROPIC",
                model=model,
                tokens=tokens_used,
                confidence=fix_response.confidence
            )

            return fix_response

        except Exception as e:
            logger.error("Anthropic API error", error=str(e))
            raise


class AnthropicProviderSync:
    """Synchronous wrapper for Anthropic provider"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = Anthropic(api_key=api_key)
        self.provider_name = "ANTHROPIC"
        self.default_model = "claude-sonnet-4-5-20250514"

    def generate_fix(
        self,
        request: FixRequest,
        model: Optional[str] = None
    ) -> FixResponse:
        """Generate a security fix using Anthropic's Claude API (sync version)"""

        model = model or self.default_model

        logger.info(
            "Generating fix with Anthropic Claude (sync)",
            model=model,
            vulnerability=request.vulnerability_title
        )

        try:
            response = self.client.messages.create(
                model=model,
                max_tokens=2000,
                system=self._build_system_prompt(),
                messages=[
                    {
                        "role": "user",
                        "content": self._build_user_prompt(request)
                    }
                ],
                temperature=0.2
            )

            response_text = ""
            for block in response.content:
                if hasattr(block, 'text'):
                    response_text += block.text

            tokens_used = (
                response.usage.input_tokens + response.usage.output_tokens
                if response.usage else 0
            )

            # Parse response
            fix_response = self._parse_response(response_text, model)
            fix_response.tokens_used = tokens_used

            logger.info(
                "Fix generated successfully",
                provider="ANTHROPIC",
                model=model,
                tokens=tokens_used
            )

            return fix_response

        except Exception as e:
            logger.error("Anthropic API error", error=str(e))
            raise

    def _build_system_prompt(self) -> str:
        return BaseLLMProvider._build_system_prompt(None)

    def _build_user_prompt(self, request: FixRequest) -> str:
        return BaseLLMProvider._build_user_prompt(None, request)

    def _parse_response(self, response_text: str, model: str) -> FixResponse:
        """Parse Claude response into FixResponse"""

        # Try to extract JSON from the response
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL)
        if json_match:
            response_text = json_match.group(1)

        # Try to find raw JSON
        json_match = re.search(r'\{[^{}]*"fixed_code"[^{}]*\}', response_text, re.DOTALL)
        if json_match:
            response_text = json_match.group(0)

        try:
            data = json.loads(response_text)
            return FixResponse(
                fixed_code=data.get('fixed_code', ''),
                explanation=data.get('explanation', ''),
                confidence=float(data.get('confidence', 0.8)),
                provider=self.provider_name,
                model=model,
            )
        except json.JSONDecodeError:
            # Fallback: try to extract code and explanation manually
            code_match = re.search(r'```\w*\n(.*?)```', response_text, re.DOTALL)
            fixed_code = code_match.group(1) if code_match else response_text

            return FixResponse(
                fixed_code=fixed_code.strip(),
                explanation="Fix generated (unable to parse structured response)",
                confidence=0.6,
                provider=self.provider_name,
                model=model,
            )

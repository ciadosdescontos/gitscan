"""
Google (Gemini) LLM Provider
"""

import json
import re
import structlog
from typing import Optional
import google.generativeai as genai

from .base import BaseLLMProvider, FixRequest, FixResponse

logger = structlog.get_logger()


class GoogleProvider(BaseLLMProvider):
    """Google Gemini API provider for generating security fixes"""

    def __init__(self, api_key: str):
        super().__init__(api_key)
        genai.configure(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "GOOGLE"

    @property
    def default_model(self) -> str:
        return "gemini-2.0-flash"

    async def generate_fix(
        self,
        request: FixRequest,
        model: Optional[str] = None
    ) -> FixResponse:
        """Generate a security fix using Google's Gemini API"""
        # Gemini doesn't have native async, so we use sync version
        return self._generate_fix_sync(request, model)

    def _generate_fix_sync(
        self,
        request: FixRequest,
        model: Optional[str] = None
    ) -> FixResponse:
        """Synchronous implementation for Gemini"""

        model_name = model or self.default_model

        logger.info(
            "Generating fix with Google Gemini",
            model=model_name,
            vulnerability=request.vulnerability_title
        )

        try:
            gemini_model = genai.GenerativeModel(
                model_name,
                generation_config=genai.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=2000,
                )
            )

            # Combine system and user prompts for Gemini
            full_prompt = f"""{self._build_system_prompt()}

---

{self._build_user_prompt(request)}"""

            response = gemini_model.generate_content(full_prompt)

            response_text = response.text if response.text else ""

            # Gemini doesn't provide token count directly in the same way
            tokens_used = 0

            fix_response = self._parse_response(response_text, model_name)
            fix_response.tokens_used = tokens_used

            logger.info(
                "Fix generated successfully",
                provider="GOOGLE",
                model=model_name,
                confidence=fix_response.confidence
            )

            return fix_response

        except Exception as e:
            logger.error("Google Gemini API error", error=str(e))
            raise


class GoogleProviderSync:
    """Synchronous wrapper for Google Gemini provider"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        genai.configure(api_key=api_key)
        self.provider_name = "GOOGLE"
        self.default_model = "gemini-2.0-flash"

    def generate_fix(
        self,
        request: FixRequest,
        model: Optional[str] = None
    ) -> FixResponse:
        """Generate a security fix using Google's Gemini API (sync version)"""

        model_name = model or self.default_model

        logger.info(
            "Generating fix with Google Gemini (sync)",
            model=model_name,
            vulnerability=request.vulnerability_title
        )

        try:
            gemini_model = genai.GenerativeModel(
                model_name,
                generation_config=genai.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=2000,
                )
            )

            # Combine system and user prompts for Gemini
            full_prompt = f"""{self._build_system_prompt()}

---

{self._build_user_prompt(request)}"""

            response = gemini_model.generate_content(full_prompt)

            response_text = response.text if response.text else ""

            # Parse response
            fix_response = self._parse_response(response_text, model_name)

            logger.info(
                "Fix generated successfully",
                provider="GOOGLE",
                model=model_name
            )

            return fix_response

        except Exception as e:
            logger.error("Google Gemini API error", error=str(e))
            raise

    def _build_system_prompt(self) -> str:
        return BaseLLMProvider._build_system_prompt(None)

    def _build_user_prompt(self, request: FixRequest) -> str:
        return BaseLLMProvider._build_user_prompt(None, request)

    def _parse_response(self, response_text: str, model: str) -> FixResponse:
        """Parse Gemini response into FixResponse"""

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

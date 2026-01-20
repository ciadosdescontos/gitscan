"""
Base LLM Provider - Abstract interface for all LLM providers
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
from enum import Enum


class LLMProviderType(Enum):
    """Supported LLM providers"""
    OPENAI = 'OPENAI'
    ANTHROPIC = 'ANTHROPIC'
    GOOGLE = 'GOOGLE'


@dataclass
class FixRequest:
    """Request for generating a security fix"""
    vulnerability_title: str
    vulnerability_description: str
    vulnerability_category: str
    file_path: str
    code_snippet: str
    language: str
    cwe_id: Optional[str] = None
    suggested_fix: Optional[str] = None
    context: Optional[str] = None


@dataclass
class FixResponse:
    """Response from LLM with generated fix"""
    fixed_code: str
    explanation: str
    confidence: float  # 0.0 to 1.0
    provider: str
    model: str
    tokens_used: int = 0


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers"""

    def __init__(self, api_key: str):
        self.api_key = api_key

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider"""
        pass

    @property
    @abstractmethod
    def default_model(self) -> str:
        """Default model to use"""
        pass

    @abstractmethod
    async def generate_fix(
        self,
        request: FixRequest,
        model: Optional[str] = None
    ) -> FixResponse:
        """
        Generate a fix for the given vulnerability

        Args:
            request: The fix request containing vulnerability details
            model: Optional specific model to use

        Returns:
            FixResponse with the generated fix
        """
        pass

    def _build_system_prompt(self) -> str:
        """Build the system prompt for security fix generation"""
        return """You are an expert security engineer specializing in identifying and fixing security vulnerabilities in code.

Your task is to:
1. Analyze the provided vulnerable code snippet
2. Understand the security vulnerability described
3. Generate a secure fix that eliminates the vulnerability
4. Explain your fix clearly and concisely

Guidelines:
- Maintain the original code's functionality while fixing the security issue
- Follow security best practices for the given programming language
- Provide clean, production-ready code
- Include any necessary imports or dependencies in your fix
- Be concise but thorough in your explanation

IMPORTANT: Your response must be in the following JSON format:
{
    "fixed_code": "the complete fixed code snippet",
    "explanation": "brief explanation of the fix and why it resolves the vulnerability",
    "confidence": 0.95
}

The confidence should be a number between 0 and 1 indicating how confident you are in the fix."""

    def _build_user_prompt(self, request: FixRequest) -> str:
        """Build the user prompt for a fix request"""
        prompt = f"""Please fix the following security vulnerability:

## Vulnerability Information
- **Title**: {request.vulnerability_title}
- **Category**: {request.vulnerability_category}
- **Description**: {request.vulnerability_description}
{f'- **CWE**: {request.cwe_id}' if request.cwe_id else ''}

## File Information
- **File**: {request.file_path}
- **Language**: {request.language}

## Vulnerable Code
```{request.language}
{request.code_snippet}
```
"""

        if request.suggested_fix:
            prompt += f"""
## Initial Suggestion
{request.suggested_fix}
"""

        if request.context:
            prompt += f"""
## Additional Context
{request.context}
"""

        prompt += """
Please provide the fixed code and explanation in the JSON format specified."""

        return prompt

    def _parse_response(self, response_text: str, model: str) -> FixResponse:
        """Parse LLM response into FixResponse"""
        import json
        import re

        # Try to extract JSON from the response
        # First, try to find JSON block in markdown code block
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

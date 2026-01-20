"""
LLM API Routes for generating security fixes
"""

from flask import Blueprint, jsonify, request
import structlog

from .llm import LLMFactory, get_llm_provider, FixRequest, FixResponse

logger = structlog.get_logger()

llm_bp = Blueprint('llm', __name__)


@llm_bp.route('/providers', methods=['GET'])
def list_providers():
    """List available LLM providers"""
    try:
        providers = LLMFactory.get_available_providers()
        return jsonify({
            'success': True,
            'data': providers
        })
    except Exception as e:
        logger.error("Error listing providers", error=str(e))
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@llm_bp.route('/generate-fix', methods=['POST'])
def generate_fix():
    """
    Generate a security fix using LLM

    Expected payload:
    {
        "provider": "OPENAI" | "ANTHROPIC" | "GOOGLE",
        "model": "gpt-4" (optional),
        "api_key": "user's api key" (optional, uses server config if not provided),
        "vulnerability": {
            "title": "XSS Vulnerability",
            "description": "...",
            "category": "XSS",
            "file_path": "src/app.js",
            "code_snippet": "...",
            "language": "javascript",
            "cwe_id": "CWE-79",
            "suggested_fix": "..." (optional)
        }
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Extract parameters
        provider = data.get('provider', 'OPENAI')
        model = data.get('model')
        api_key = data.get('api_key')  # User can provide their own key
        vuln = data.get('vulnerability', {})

        # Validate required fields
        required_fields = ['title', 'description', 'category', 'file_path', 'code_snippet', 'language']
        missing = [f for f in required_fields if not vuln.get(f)]
        if missing:
            return jsonify({
                'error': f'Missing required vulnerability fields: {", ".join(missing)}'
            }), 400

        # Create fix request
        fix_request = FixRequest(
            vulnerability_title=vuln['title'],
            vulnerability_description=vuln['description'],
            vulnerability_category=vuln['category'],
            file_path=vuln['file_path'],
            code_snippet=vuln['code_snippet'],
            language=vuln['language'],
            cwe_id=vuln.get('cwe_id'),
            suggested_fix=vuln.get('suggested_fix'),
            context=vuln.get('context')
        )

        logger.info(
            "Generating fix",
            provider=provider,
            model=model,
            vulnerability=vuln['title']
        )

        # Get provider and generate fix
        llm = get_llm_provider(provider, api_key, async_mode=False)
        fix_response = llm.generate_fix(fix_request, model)

        return jsonify({
            'success': True,
            'data': {
                'fixed_code': fix_response.fixed_code,
                'explanation': fix_response.explanation,
                'confidence': fix_response.confidence,
                'provider': fix_response.provider,
                'model': fix_response.model,
                'tokens_used': fix_response.tokens_used
            }
        })

    except ValueError as e:
        logger.error("Validation error", error=str(e))
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error("Error generating fix", error=str(e))
        return jsonify({'error': f'Failed to generate fix: {str(e)}'}), 500


@llm_bp.route('/analyze', methods=['POST'])
def analyze_code():
    """
    Analyze code for security issues using LLM

    Expected payload:
    {
        "provider": "OPENAI" | "ANTHROPIC" | "GOOGLE",
        "code": "...",
        "language": "javascript",
        "context": "..." (optional)
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        provider = data.get('provider', 'OPENAI')
        code = data.get('code')
        language = data.get('language', 'javascript')
        context = data.get('context', '')
        api_key = data.get('api_key')

        if not code:
            return jsonify({'error': 'Code is required'}), 400

        # Create a special prompt for analysis
        analysis_prompt = f"""Analyze the following {language} code for security vulnerabilities.

```{language}
{code}
```

{f'Context: {context}' if context else ''}

Provide your analysis in the following JSON format:
{{
    "vulnerabilities": [
        {{
            "title": "Brief title",
            "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
            "category": "XSS" | "SQL_INJECTION" | "etc",
            "description": "Detailed description",
            "line_numbers": [1, 2],
            "suggested_fix": "How to fix it"
        }}
    ],
    "summary": "Overall security assessment",
    "risk_score": 0-100
}}"""

        # Use the LLM for analysis
        llm = get_llm_provider(provider, api_key, async_mode=False)

        # Create a minimal fix request to use the infrastructure
        import json

        if provider == 'OPENAI':
            from openai import OpenAI
            client = OpenAI(api_key=api_key or llm.api_key)
            response = client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": "You are a security expert analyzing code for vulnerabilities."},
                    {"role": "user", "content": analysis_prompt}
                ],
                temperature=0.2,
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)

        elif provider == 'ANTHROPIC':
            from anthropic import Anthropic
            client = Anthropic(api_key=api_key or llm.api_key)
            response = client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=2000,
                messages=[{"role": "user", "content": analysis_prompt}]
            )
            text = response.content[0].text
            # Try to parse JSON from response
            import re
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            result = json.loads(json_match.group()) if json_match else {"error": "Could not parse response"}

        else:  # GOOGLE
            import google.generativeai as genai
            genai.configure(api_key=api_key or llm.api_key)
            model = genai.GenerativeModel('gemini-pro')
            response = model.generate_content(analysis_prompt)
            import re
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            result = json.loads(json_match.group()) if json_match else {"error": "Could not parse response"}

        return jsonify({
            'success': True,
            'data': result
        })

    except Exception as e:
        logger.error("Error analyzing code", error=str(e))
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500

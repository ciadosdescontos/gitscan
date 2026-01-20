"""
Secrets Scanner
Detects hardcoded secrets, API keys, and sensitive credentials
"""

import re
from typing import List

from ..models import Vulnerability, Severity, VulnerabilityCategory
from .base_scanner import BaseScanner


class SecretsScanner(BaseScanner):
    """Scanner for exposed secrets and credentials"""

    @property
    def name(self) -> str:
        return "Secrets Scanner"

    # Patterns for detecting secrets
    PATTERNS = [
        # AWS
        {
            'pattern': r'(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}',
            'title': 'AWS Access Key ID',
            'description': 'AWS Access Key ID detected in code',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-798',
        },
        {
            'pattern': r'(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*["\']?[A-Za-z0-9/+=]{40}["\']?',
            'title': 'AWS Secret Access Key',
            'description': 'AWS Secret Access Key detected in code',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-798',
        },
        # GitHub
        {
            'pattern': r'gh[pousr]_[A-Za-z0-9_]{36,}',
            'title': 'GitHub Token',
            'description': 'GitHub personal access token or OAuth token detected',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-798',
        },
        # Generic API Keys
        {
            'pattern': r'(?:api[_-]?key|apikey)\s*[=:]\s*["\'][A-Za-z0-9_\-]{20,}["\']',
            'title': 'API Key Detected',
            'description': 'Hardcoded API key detected in code',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-798',
        },
        # Private Keys
        {
            'pattern': r'-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----',
            'title': 'Private Key Detected',
            'description': 'Private key found in code - this should never be committed',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-321',
        },
        # JWT Secrets
        {
            'pattern': r'(?:jwt[_-]?secret|JWT_SECRET)\s*[=:]\s*["\'][^"\']{10,}["\']',
            'title': 'JWT Secret',
            'description': 'Hardcoded JWT secret detected',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-798',
        },
        # Database Connection Strings
        {
            'pattern': r'(?:mongodb|postgresql|mysql|redis):\/\/[^:]+:[^@]+@[^\s]+',
            'title': 'Database Connection String with Credentials',
            'description': 'Database connection string with embedded credentials detected',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-798',
        },
        # Passwords
        {
            'pattern': r'(?:password|passwd|pwd)\s*[=:]\s*["\'][^"\']{6,}["\']',
            'title': 'Hardcoded Password',
            'description': 'Hardcoded password detected in code',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-798',
        },
        # Slack Tokens
        {
            'pattern': r'xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*',
            'title': 'Slack Token',
            'description': 'Slack bot or user token detected',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-798',
        },
        # Stripe
        {
            'pattern': r'sk_live_[0-9a-zA-Z]{24,}',
            'title': 'Stripe Live Secret Key',
            'description': 'Stripe live secret key detected - immediate action required',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-798',
        },
        # Google
        {
            'pattern': r'AIza[0-9A-Za-z_-]{35}',
            'title': 'Google API Key',
            'description': 'Google API key detected in code',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-798',
        },
        # SendGrid
        {
            'pattern': r'SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}',
            'title': 'SendGrid API Key',
            'description': 'SendGrid API key detected',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-798',
        },
        # Twilio
        {
            'pattern': r'SK[a-f0-9]{32}',
            'title': 'Twilio API Key',
            'description': 'Twilio API key detected',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-798',
        },
    ]

    # Files that commonly contain secrets (for context)
    SENSITIVE_FILES = {
        '.env', '.env.local', '.env.production',
        'config.json', 'secrets.json', 'credentials.json',
        '.npmrc', '.pypirc', '.netrc',
    }

    def scan(self, content: str, file_path: str) -> List[Vulnerability]:
        """Scan content for exposed secrets"""
        vulnerabilities = []

        # Check if this is a known sensitive file
        file_name = file_path.split('/')[-1]
        is_sensitive_file = file_name in self.SENSITIVE_FILES

        for pattern_info in self.PATTERNS:
            pattern = pattern_info['pattern']
            matches = re.finditer(pattern, content, re.IGNORECASE)

            for match in matches:
                # Skip if in comments (basic check)
                line_start = content.rfind('\n', 0, match.start()) + 1
                line = content[line_start:match.end()]
                if line.lstrip().startswith(('#', '//', '/*', '*', '<!--')):
                    continue

                start_line = self._get_line_number(content, match.start())
                end_line = self._get_line_number(content, match.end())

                # Mask the secret in the code snippet
                snippet = self._get_code_snippet(content, start_line, end_line)
                masked_snippet = self._mask_secret(snippet, match.group())

                vuln = Vulnerability(
                    title=pattern_info['title'],
                    description=pattern_info['description'] +
                                (' (in sensitive file)' if is_sensitive_file else ''),
                    severity=pattern_info['severity'],
                    category=VulnerabilityCategory.SECRETS_EXPOSURE,
                    file_path=file_path,
                    start_line=start_line,
                    end_line=end_line,
                    code_snippet=masked_snippet,
                    cwe_id=pattern_info.get('cwe_id'),
                    suggested_fix='Move secrets to environment variables or a secure secrets manager',
                    rule_id=f'secrets-{hash(pattern) % 10000:04d}'
                )
                vulnerabilities.append(vuln)

        return vulnerabilities

    def _mask_secret(self, snippet: str, secret: str) -> str:
        """Mask the secret in the code snippet for safe display"""
        if len(secret) <= 8:
            masked = '*' * len(secret)
        else:
            masked = secret[:4] + '*' * (len(secret) - 8) + secret[-4:]
        return snippet.replace(secret, masked)

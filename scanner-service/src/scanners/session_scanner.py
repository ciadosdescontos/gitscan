"""
Session Security Scanner
Detects session management vulnerabilities and insecure configurations
"""

import re
import os
from typing import List

from ..models import Vulnerability, Severity, VulnerabilityCategory
from .base_scanner import BaseScanner


class SessionScanner(BaseScanner):
    """Scanner for session security vulnerabilities"""

    @property
    def name(self) -> str:
        return "Session Scanner"

    LANGUAGE_MAP = {
        '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
        '.py': 'python', '.php': 'php', '.java': 'java', '.go': 'go',
        '.rb': 'ruby', '.cs': 'csharp'
    }

    PATTERNS = [
        # Insecure cookie - missing HttpOnly
        {
            'pattern': r'(?:res\.cookie|setCookie|Set-Cookie|document\.cookie)\s*[=(][^;]*(?!httpOnly|HttpOnly|http_only)',
            'title': 'Cookie without HttpOnly flag',
            'description': 'Session cookie is set without HttpOnly flag, making it accessible to JavaScript',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-1004',
            'fix_suggestion': 'Add HttpOnly flag to prevent XSS attacks from stealing cookies',
            'languages': ['javascript', 'typescript', 'python', 'php'],
            'confidence': 0.7
        },
        # Insecure cookie - missing Secure flag
        {
            'pattern': r'(?:res\.cookie|setCookie|Set-Cookie)[^;]*(?!secure\s*:\s*true|Secure)',
            'title': 'Cookie without Secure flag',
            'description': 'Cookie is set without Secure flag, allowing transmission over HTTP',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-614',
            'fix_suggestion': 'Add Secure flag to ensure cookie is only sent over HTTPS',
            'languages': ['javascript', 'typescript', 'python', 'php'],
            'confidence': 0.7
        },
        # Session ID in URL
        {
            'pattern': r'(?:session_?id|sessionId|JSESSIONID|PHPSESSID)\s*=\s*[^&]*(?:req\.query|req\.params|\$_GET|getParameter)',
            'title': 'Session ID passed in URL',
            'description': 'Session ID is retrieved from URL parameters, exposing it in logs and referrer headers',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-598',
            'fix_suggestion': 'Use cookies for session management instead of URL parameters',
            'languages': ['javascript', 'typescript', 'python', 'php', 'java'],
            'confidence': 0.85
        },
        # Hardcoded session secret
        {
            'pattern': r'(?:session|cookie)(?:Secret|Key)\s*[=:]\s*[\'"][^\'"]{8,}[\'"]',
            'title': 'Hardcoded session secret',
            'description': 'Session secret is hardcoded in source code',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-798',
            'fix_suggestion': 'Use environment variables for session secrets',
            'languages': ['javascript', 'typescript', 'python', 'php', 'java', 'ruby'],
            'confidence': 0.85
        },
        # Session fixation - no regeneration
        {
            'pattern': r'(?:login|authenticate|signin)[^}]*\{(?:(?!regenerate|destroy|invalidate|reset).)*\}',
            'title': 'Potential session fixation vulnerability',
            'description': 'Login function does not appear to regenerate session ID',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-384',
            'fix_suggestion': 'Regenerate session ID after successful authentication',
            'languages': ['javascript', 'typescript', 'python', 'php', 'java'],
            'confidence': 0.6
        },
        # Weak session configuration - Express
        {
            'pattern': r'session\(\s*\{[^}]*resave\s*:\s*true',
            'title': 'Express session with resave enabled',
            'description': 'Session resave is enabled which can cause race conditions',
            'severity': Severity.LOW,
            'cwe_id': 'CWE-613',
            'fix_suggestion': 'Set resave: false to prevent unnecessary session saves',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.8
        },
        # PHP session without strict mode
        {
            'pattern': r'session\.use_strict_mode\s*=\s*(?:0|false|off)',
            'title': 'PHP session strict mode disabled',
            'description': 'Session strict mode is disabled, allowing uninitialized session IDs',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-384',
            'fix_suggestion': 'Enable session.use_strict_mode in php.ini',
            'languages': ['php'],
            'confidence': 0.9
        },
        # Long session timeout
        {
            'pattern': r'(?:maxAge|max_age|expir(?:es|y)|timeout)\s*[=:]\s*(?:\d{8,}|[\'"]?\d+\s*\*\s*\d+\s*\*\s*\d+\s*\*\s*\d+)',
            'title': 'Excessively long session timeout',
            'description': 'Session timeout is set to a very long duration, increasing risk of session hijacking',
            'severity': Severity.LOW,
            'cwe_id': 'CWE-613',
            'fix_suggestion': 'Use shorter session timeouts (e.g., 30 minutes for sensitive applications)',
            'languages': ['javascript', 'typescript', 'python', 'php', 'java'],
            'confidence': 0.7
        },
        # JWT without expiration
        {
            'pattern': r'jwt\.sign\s*\([^)]*\)(?!.*expiresIn)',
            'title': 'JWT token without expiration',
            'description': 'JWT token is signed without an expiration time',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-613',
            'fix_suggestion': 'Add expiresIn option: jwt.sign(payload, secret, { expiresIn: "1h" })',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.8
        },
        # JWT secret too short
        {
            'pattern': r'jwt\.sign\s*\([^,]+,\s*[\'"][^\'"]{1,15}[\'"]',
            'title': 'JWT secret too short',
            'description': 'JWT secret appears to be too short (less than 16 characters)',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-326',
            'fix_suggestion': 'Use a strong secret with at least 32 characters',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.8
        },
        # LocalStorage for sensitive data
        {
            'pattern': r'localStorage\.setItem\s*\(\s*[\'"](?:token|session|auth|jwt|password|secret)',
            'title': 'Sensitive data stored in localStorage',
            'description': 'Storing sensitive data in localStorage exposes it to XSS attacks',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-922',
            'fix_suggestion': 'Use HttpOnly cookies for sensitive tokens instead of localStorage',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.85
        },
    ]

    def scan(self, content: str, file_path: str) -> List[Vulnerability]:
        """Scan content for session security vulnerabilities"""
        vulnerabilities = []

        ext = os.path.splitext(file_path)[1].lower()
        language = self.LANGUAGE_MAP.get(ext)

        if self._is_test_file(file_path):
            return vulnerabilities

        for pattern_info in self.PATTERNS:
            if language and 'languages' in pattern_info:
                if language not in pattern_info['languages']:
                    continue

            pattern = pattern_info['pattern']
            matches = re.finditer(pattern, content, re.MULTILINE | re.IGNORECASE | re.DOTALL)

            for match in matches:
                if self._is_in_comment(content, match.start()):
                    continue

                start_line = self._get_line_number(content, match.start())
                end_line = self._get_line_number(content, match.end())

                vuln = Vulnerability(
                    title=pattern_info['title'],
                    description=pattern_info['description'],
                    severity=pattern_info['severity'],
                    category=VulnerabilityCategory.SECURITY_MISCONFIGURATION,
                    file_path=file_path,
                    start_line=start_line,
                    end_line=end_line,
                    code_snippet=self._get_code_snippet(content, start_line, end_line),
                    cwe_id=pattern_info.get('cwe_id'),
                    suggested_fix=pattern_info.get('fix_suggestion'),
                    fix_confidence=pattern_info.get('confidence', 0.75),
                    rule_id=f'session-{hash(pattern) % 10000:04d}'
                )
                vulnerabilities.append(vuln)

        return vulnerabilities

    def _is_test_file(self, file_path: str) -> bool:
        path_lower = file_path.lower()
        test_indicators = ['test', 'spec', '__tests__', 'mock', 'fixture']
        return any(indicator in path_lower for indicator in test_indicators)

    def _is_in_comment(self, content: str, position: int) -> bool:
        line_start = content.rfind('\n', 0, position) + 1
        line_end = content.find('\n', position)
        if line_end == -1:
            line_end = len(content)
        line = content[line_start:line_end]
        stripped = line.lstrip()
        return stripped.startswith('//') or stripped.startswith('#') or stripped.startswith('*')

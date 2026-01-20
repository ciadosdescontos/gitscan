"""
CSRF (Cross-Site Request Forgery) Scanner
Detects missing CSRF protections and insecure configurations
"""

import re
import os
from typing import List

from ..models import Vulnerability, Severity, VulnerabilityCategory
from .base_scanner import BaseScanner


class CSRFScanner(BaseScanner):
    """Scanner for CSRF vulnerabilities"""

    @property
    def name(self) -> str:
        return "CSRF Scanner"

    LANGUAGE_MAP = {
        '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
        '.py': 'python', '.php': 'php', '.java': 'java', '.go': 'go',
        '.rb': 'ruby', '.cs': 'csharp'
    }

    PATTERNS = [
        # Express.js without CSRF protection
        {
            'pattern': r'app\.(?:post|put|delete|patch)\s*\([^)]+,\s*(?:async\s*)?\(?[^)]*\)?\s*=>\s*\{(?:(?!csrf|_csrf|csrfToken).)*\}',
            'title': 'Express route without CSRF token validation',
            'description': 'POST/PUT/DELETE route does not appear to validate CSRF tokens',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-352',
            'fix_suggestion': 'Use csurf middleware: app.use(csrf({ cookie: true }))',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.7
        },
        # Django CSRF exempt decorator
        {
            'pattern': r'@csrf_exempt',
            'title': 'Django CSRF protection disabled',
            'description': 'csrf_exempt decorator disables CSRF protection for this view',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-352',
            'fix_suggestion': 'Remove @csrf_exempt and ensure CSRF tokens are included in forms',
            'languages': ['python'],
            'confidence': 0.95
        },
        # Flask-WTF CSRF disabled
        {
            'pattern': r'WTF_CSRF_ENABLED\s*=\s*False',
            'title': 'Flask-WTF CSRF protection disabled',
            'description': 'CSRF protection is explicitly disabled in Flask configuration',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-352',
            'fix_suggestion': 'Set WTF_CSRF_ENABLED = True and use CSRFProtect(app)',
            'languages': ['python'],
            'confidence': 0.95
        },
        # Spring Security CSRF disabled
        {
            'pattern': r'\.csrf\(\)\s*\.disable\(\)',
            'title': 'Spring Security CSRF protection disabled',
            'description': 'CSRF protection is disabled in Spring Security configuration',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-352',
            'fix_suggestion': 'Remove .csrf().disable() to enable CSRF protection',
            'languages': ['java'],
            'confidence': 0.95
        },
        # Rails CSRF skip
        {
            'pattern': r'skip_before_action\s*:verify_authenticity_token',
            'title': 'Rails CSRF verification skipped',
            'description': 'CSRF authenticity token verification is being skipped',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-352',
            'fix_suggestion': 'Remove skip_before_action for verify_authenticity_token',
            'languages': ['ruby'],
            'confidence': 0.95
        },
        # Laravel CSRF middleware excluded
        {
            'pattern': r'\$except\s*=\s*\[[^\]]*[\'"][^\'"/]+[\'"]',
            'title': 'Laravel CSRF middleware exceptions',
            'description': 'Routes are excluded from CSRF verification in VerifyCsrfToken middleware',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-352',
            'fix_suggestion': 'Minimize CSRF exceptions and use API tokens for legitimate API routes',
            'languages': ['php'],
            'confidence': 0.8
        },
        # ASP.NET ValidateAntiForgeryToken missing
        {
            'pattern': r'\[Http(?:Post|Put|Delete)\][^[]*(?!\[ValidateAntiForgeryToken\])\s*public',
            'title': 'ASP.NET missing ValidateAntiForgeryToken',
            'description': 'HTTP POST/PUT/DELETE action without ValidateAntiForgeryToken attribute',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-352',
            'fix_suggestion': 'Add [ValidateAntiForgeryToken] attribute to the action',
            'languages': ['csharp'],
            'confidence': 0.75
        },
        # SameSite cookie not set
        {
            'pattern': r'(?:Set-Cookie|cookie)[^;]*(?!SameSite)',
            'title': 'Cookie without SameSite attribute',
            'description': 'Cookie is set without SameSite attribute, making it vulnerable to CSRF',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-352',
            'fix_suggestion': 'Add SameSite=Strict or SameSite=Lax to cookie settings',
            'languages': ['javascript', 'typescript', 'python', 'php', 'java'],
            'confidence': 0.7
        },
    ]

    def scan(self, content: str, file_path: str) -> List[Vulnerability]:
        """Scan content for CSRF vulnerabilities"""
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
                    rule_id=f'csrf-{hash(pattern) % 10000:04d}'
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

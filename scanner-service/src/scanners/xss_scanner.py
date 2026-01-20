"""
XSS (Cross-Site Scripting) Scanner
Detects potential XSS vulnerabilities in code
With context-aware filtering to reduce false positives
"""

import re
import os
from typing import List, Optional

from ..models import Vulnerability, Severity, VulnerabilityCategory
from .base_scanner import BaseScanner


class XSSScanner(BaseScanner):
    """Scanner for XSS vulnerabilities with context-aware filtering"""

    @property
    def name(self) -> str:
        return "XSS Scanner"

    # File extensions to language mapping
    LANGUAGE_MAP = {
        '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
        '.py': 'python', '.php': 'php', '.java': 'java', '.go': 'go',
        '.html': 'html', '.htm': 'html'
    }

    # Patterns for potential XSS vulnerabilities with language hints
    PATTERNS = [
        # JavaScript innerHTML - only report if there's actual user input indication
        {
            'pattern': r'\.innerHTML\s*=\s*(?![\'"<])[^;]*(?:user|input|param|query|req\.|request|data\[)',
            'title': 'Potential XSS via innerHTML with user input',
            'description': 'Direct assignment to innerHTML with user input can lead to XSS',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-79',
            'fix_suggestion': 'Use textContent for plain text, or sanitize HTML input with DOMPurify',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.85
        },
        # React dangerouslySetInnerHTML - check for unsanitized input
        {
            'pattern': r'dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?!DOMPurify|sanitize|escape)[^}]+\}\s*\}',
            'title': 'React dangerouslySetInnerHTML without sanitization',
            'description': 'dangerouslySetInnerHTML used without visible sanitization',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-79',
            'fix_suggestion': 'Sanitize HTML content with DOMPurify before using dangerouslySetInnerHTML',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.75
        },
        # document.write with user input
        {
            'pattern': r'document\.write\s*\([^)]*(?:user|input|param|query|location|document\.URL)',
            'title': 'document.write with user-controlled data',
            'description': 'document.write with user-controlled data leads to XSS',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-79',
            'fix_suggestion': 'Use DOM manipulation methods like createElement and appendChild',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.9
        },
        # eval with user input concatenation
        {
            'pattern': r'eval\s*\(\s*(?:[^)]*\+\s*(?:user|input|param|req|request)|[`].*\$\{)',
            'title': 'Eval with user-controlled input',
            'description': 'Using eval with user input allows code injection',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-95',
            'fix_suggestion': 'Avoid eval entirely. Use JSON.parse for data or safer alternatives',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.9
        },
        # jQuery html() with user input
        {
            'pattern': r'\$\([^)]+\)\.html\s*\(\s*(?:user|input|data|response|ajax)',
            'title': 'jQuery html() with dynamic user content',
            'description': 'Using jQuery html() with user-controlled content leads to XSS',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-79',
            'fix_suggestion': 'Use .text() for plain text or sanitize input before .html()',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.85
        },
        # Python render_template_string with user input
        {
            'pattern': r'render_template_string\s*\([^)]*(?:request\.|user_input|%s|\.format\()',
            'title': 'Flask render_template_string with user input',
            'description': 'Using user input in render_template_string leads to SSTI/XSS',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-79',
            'fix_suggestion': 'Use render_template with separate files and pass variables safely',
            'languages': ['python'],
            'confidence': 0.95
        },
        # PHP echo with direct user input
        {
            'pattern': r'echo\s+\$_(GET|POST|REQUEST|COOKIE)\s*\[\s*[\'"][^\'"]+[\'"]\s*\](?!\s*;?\s*(?://|/\*|#))',
            'title': 'PHP echo with unsanitized user input',
            'description': 'Directly echoing user input without encoding leads to XSS',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-79',
            'fix_suggestion': 'Use htmlspecialchars($_GET["param"], ENT_QUOTES, "UTF-8")',
            'languages': ['php'],
            'confidence': 0.95
        },
        # Python Jinja2 with |safe filter on user input
        {
            'pattern': r'\{\{\s*(?:user|input|request|data)[^}]*\|\s*safe\s*\}\}',
            'title': 'Jinja2 |safe filter on user input',
            'description': 'Using |safe filter on user input bypasses auto-escaping',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-79',
            'fix_suggestion': 'Remove |safe filter or sanitize the content first',
            'languages': ['python', 'html'],
            'confidence': 0.9
        },
    ]

    # Patterns that indicate this is test/example code (false positive indicators)
    FALSE_POSITIVE_INDICATORS = [
        r'test[_\s]',        # test files/functions
        r'spec[_\s\.]',      # spec files
        r'mock',             # mock data
        r'example',          # example code
        r'sample',           # sample code
        r'demo',             # demo code
        r'TODO:',            # commented out
        r'FIXME:',           # marked for fixing
        r'//\s*(?:eslint|prettier|istanbul)',  # linter comments
    ]

    def scan(self, content: str, file_path: str) -> List[Vulnerability]:
        """Scan content for XSS vulnerabilities with context-aware filtering"""
        vulnerabilities = []

        # Get file extension and language
        ext = os.path.splitext(file_path)[1].lower()
        language = self.LANGUAGE_MAP.get(ext)

        # Skip if file is likely test/example code
        if self._is_test_or_example(file_path, content):
            return vulnerabilities

        for pattern_info in self.PATTERNS:
            # Skip patterns not applicable to this language
            if language and 'languages' in pattern_info:
                if language not in pattern_info['languages']:
                    continue

            pattern = pattern_info['pattern']
            matches = re.finditer(pattern, content, re.MULTILINE | re.IGNORECASE)

            for match in matches:
                # Skip if match is in a comment
                if self._is_in_comment(content, match.start()):
                    continue

                # Skip if match appears to be false positive
                if self._is_false_positive(content, match.start()):
                    continue

                start_line = self._get_line_number(content, match.start())
                end_line = self._get_line_number(content, match.end())
                code_snippet = self._get_code_snippet(content, start_line, end_line)

                # Double-check: skip if sanitization is visible nearby
                if self._has_nearby_sanitization(content, match.start()):
                    continue

                vuln = Vulnerability(
                    title=pattern_info['title'],
                    description=pattern_info['description'],
                    severity=pattern_info['severity'],
                    category=VulnerabilityCategory.XSS,
                    file_path=file_path,
                    start_line=start_line,
                    end_line=end_line,
                    code_snippet=code_snippet,
                    cwe_id=pattern_info.get('cwe_id'),
                    suggested_fix=pattern_info.get('fix_suggestion'),
                    fix_confidence=pattern_info.get('confidence', 0.7),
                    rule_id=f'xss-{hash(pattern) % 10000:04d}'
                )
                vulnerabilities.append(vuln)

        return vulnerabilities

    def _is_test_or_example(self, file_path: str, content: str) -> bool:
        """Check if file is test or example code"""
        path_lower = file_path.lower()
        test_indicators = ['test', 'spec', '__tests__', 'example', 'sample', 'demo', 'mock', 'fixture']
        return any(indicator in path_lower for indicator in test_indicators)

    def _is_in_comment(self, content: str, position: int) -> bool:
        """Check if position is inside a comment"""
        # Get line containing the match
        line_start = content.rfind('\n', 0, position) + 1
        line_end = content.find('\n', position)
        if line_end == -1:
            line_end = len(content)
        line = content[line_start:line_end]

        # Check for single-line comments
        comment_indicators = ['//', '#', '/*', '*', '<!--']
        stripped = line.lstrip()
        return any(stripped.startswith(c) for c in comment_indicators)

    def _is_false_positive(self, content: str, position: int) -> bool:
        """Check for false positive indicators near the match"""
        # Get surrounding context (100 chars before and after)
        start = max(0, position - 100)
        end = min(len(content), position + 100)
        context = content[start:end].lower()

        for indicator in self.FALSE_POSITIVE_INDICATORS:
            if re.search(indicator, context, re.IGNORECASE):
                return True

        return False

    def _has_nearby_sanitization(self, content: str, position: int) -> bool:
        """Check if there's sanitization visible near the match"""
        # Get surrounding context (200 chars before)
        start = max(0, position - 200)
        context = content[start:position + 50].lower()

        sanitization_functions = [
            'dompurify', 'sanitize', 'escape', 'encode',
            'htmlspecialchars', 'htmlentities', 'strip_tags',
            'bleach.clean', 'markupsafe', 'xss', 'purify'
        ]
        return any(func in context for func in sanitization_functions)

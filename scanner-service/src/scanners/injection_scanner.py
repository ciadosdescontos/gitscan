"""
Injection Scanner
Detects SQL injection, command injection, and other injection vulnerabilities
With context-aware filtering to reduce false positives
"""

import re
import os
from typing import List

from ..models import Vulnerability, Severity, VulnerabilityCategory
from .base_scanner import BaseScanner


class InjectionScanner(BaseScanner):
    """Scanner for injection vulnerabilities with context-aware filtering"""

    @property
    def name(self) -> str:
        return "Injection Scanner"

    # File extensions to language mapping
    LANGUAGE_MAP = {
        '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
        '.py': 'python', '.php': 'php', '.java': 'java', '.go': 'go',
    }

    # SQL Injection patterns - more specific to reduce false positives
    SQL_PATTERNS = [
        {
            'pattern': r'(?:execute|query|run)\s*\(\s*["\'](?:SELECT|INSERT|UPDATE|DELETE)\s+[^"\']*["\']\s*\+\s*(?:user|input|param|req|request|data)',
            'title': 'SQL Injection via string concatenation with user input',
            'description': 'SQL query built with string concatenation using user input is vulnerable',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-89',
            'fix_suggestion': 'Use parameterized queries or prepared statements',
            'languages': ['python', 'javascript', 'typescript', 'java'],
            'confidence': 0.9
        },
        {
            'pattern': r'cursor\.execute\s*\(\s*f["\'](?:SELECT|INSERT|UPDATE|DELETE)',
            'title': 'Python SQL Injection via f-string',
            'description': 'Using f-strings in SQL queries allows SQL injection',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-89',
            'fix_suggestion': 'Use parameterized queries: cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))',
            'languages': ['python'],
            'confidence': 0.95
        },
        {
            'pattern': r'\.(?:query|execute)\s*\(\s*`[^`]*(?:SELECT|INSERT|UPDATE|DELETE)[^`]*\$\{(?:req|user|input|param)',
            'title': 'JavaScript SQL Injection via template literal with user input',
            'description': 'Using template literals with user input in SQL queries allows SQL injection',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-89',
            'fix_suggestion': 'Use parameterized queries with placeholders: query("SELECT * FROM users WHERE id = $1", [userId])',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.9
        },
        {
            'pattern': r'(?:mysql_query|mysqli_query|pg_query)\s*\([^)]*\$_(GET|POST|REQUEST)\s*\[',
            'title': 'PHP SQL Injection with user input',
            'description': 'User input from $_GET/$_POST directly used in SQL query',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-89',
            'fix_suggestion': 'Use prepared statements with PDO: $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");',
            'languages': ['php'],
            'confidence': 0.95
        },
        {
            'pattern': r'(?:executeQuery|createQuery|nativeQuery)\s*\(\s*["\'][^"\']*["\']\s*\+\s*(?:user|input|request)',
            'title': 'Java SQL Injection via concatenation',
            'description': 'SQL query built with string concatenation is vulnerable',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-89',
            'fix_suggestion': 'Use PreparedStatement with parameterized queries',
            'languages': ['java'],
            'confidence': 0.9
        },
    ]

    # Command Injection patterns - more specific
    COMMAND_PATTERNS = [
        {
            'pattern': r'os\.system\s*\([^)]*(?:\+|\.format\(|%s)[^)]*(?:user|input|param|request|data)',
            'title': 'Command Injection via os.system with user input',
            'description': 'Using os.system with user-controlled input allows command injection',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-78',
            'fix_suggestion': 'Use subprocess.run with a list of arguments: subprocess.run(["cmd", arg1, arg2])',
            'languages': ['python'],
            'confidence': 0.9
        },
        {
            'pattern': r'subprocess\.(?:call|run|Popen)\s*\([^)]*shell\s*=\s*True[^)]*(?:user|input|param|request|f["\'])',
            'title': 'Subprocess with shell=True and dynamic input',
            'description': 'Using shell=True with user-controlled input leads to command injection',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-78',
            'fix_suggestion': 'Use shell=False and pass command as a list of arguments',
            'languages': ['python'],
            'confidence': 0.9
        },
        {
            'pattern': r'child_process\.exec\s*\([^)]*(?:\+|`[^`]*\$\{)[^)]*(?:user|input|req|param)',
            'title': 'Node.js Command Injection via exec',
            'description': 'Using child_process.exec with user input allows command injection',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-78',
            'fix_suggestion': 'Use child_process.execFile or spawn with an array of arguments',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.9
        },
        {
            'pattern': r'Runtime\.getRuntime\(\)\.exec\s*\([^)]*\+[^)]*(?:user|input|request|param)',
            'title': 'Java Command Injection via Runtime.exec',
            'description': 'Runtime.exec with user-controlled input allows command injection',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-78',
            'fix_suggestion': 'Use ProcessBuilder with a list of arguments',
            'languages': ['java'],
            'confidence': 0.9
        },
        {
            'pattern': r'(?:system|passthru|exec|shell_exec)\s*\([^)]*\$_(GET|POST|REQUEST)',
            'title': 'PHP Command Injection',
            'description': 'PHP command execution with direct user input',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-78',
            'fix_suggestion': 'Avoid shell commands with user input. Use escapeshellarg() if necessary',
            'languages': ['php'],
            'confidence': 0.95
        },
    ]

    # Path Traversal patterns - more specific
    PATH_PATTERNS = [
        {
            'pattern': r'(?:open|read|write|readFile|readFileSync)\s*\([^)]*(?:\+|\.format\(|f["\']|`[^`]*\$\{)[^)]*(?:user|input|param|req|request|filename|path)',
            'title': 'Path Traversal via user-controlled file path',
            'description': 'File path built with user input may allow path traversal',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-22',
            'fix_suggestion': 'Validate file paths with os.path.basename() or path.resolve() and ensure they stay within allowed directories',
            'languages': ['python', 'javascript', 'typescript'],
            'confidence': 0.85
        },
        {
            'pattern': r'send_file\s*\([^)]*(?:\+|\.format\(|f["\'])[^)]*(?:user|filename|request)',
            'title': 'Flask send_file with user-controlled path',
            'description': 'Using user input in send_file allows arbitrary file access',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-22',
            'fix_suggestion': 'Validate file path and use secure_filename() from werkzeug.utils',
            'languages': ['python'],
            'confidence': 0.9
        },
        {
            'pattern': r'res\.sendFile\s*\([^)]*(?:\+|`[^`]*\$\{)[^)]*(?:user|req|param)',
            'title': 'Express sendFile with user-controlled path',
            'description': 'Using user input in sendFile allows arbitrary file access',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-22',
            'fix_suggestion': 'Validate file path with path.resolve() and ensure it stays within allowed directory',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.9
        },
    ]

    def scan(self, content: str, file_path: str) -> List[Vulnerability]:
        """Scan content for injection vulnerabilities with context-aware filtering"""
        vulnerabilities = []

        # Get file extension and language
        ext = os.path.splitext(file_path)[1].lower()
        language = self.LANGUAGE_MAP.get(ext)

        # Skip test/mock files
        if self._is_test_file(file_path):
            return vulnerabilities

        all_patterns = [
            (self.SQL_PATTERNS, VulnerabilityCategory.SQL_INJECTION),
            (self.COMMAND_PATTERNS, VulnerabilityCategory.COMMAND_INJECTION),
            (self.PATH_PATTERNS, VulnerabilityCategory.PATH_TRAVERSAL),
        ]

        for patterns, category in all_patterns:
            for pattern_info in patterns:
                # Skip patterns not applicable to this language
                if language and 'languages' in pattern_info:
                    if language not in pattern_info['languages']:
                        continue

                pattern = pattern_info['pattern']
                matches = re.finditer(pattern, content, re.MULTILINE | re.IGNORECASE)

                for match in matches:
                    # Skip if in comment
                    if self._is_in_comment(content, match.start()):
                        continue

                    # Skip if has nearby validation/sanitization
                    if self._has_nearby_validation(content, match.start(), category):
                        continue

                    start_line = self._get_line_number(content, match.start())
                    end_line = self._get_line_number(content, match.end())

                    vuln = Vulnerability(
                        title=pattern_info['title'],
                        description=pattern_info['description'],
                        severity=pattern_info['severity'],
                        category=category,
                        file_path=file_path,
                        start_line=start_line,
                        end_line=end_line,
                        code_snippet=self._get_code_snippet(content, start_line, end_line),
                        cwe_id=pattern_info.get('cwe_id'),
                        suggested_fix=pattern_info.get('fix_suggestion'),
                        fix_confidence=pattern_info.get('confidence', 0.75),
                        rule_id=f'injection-{hash(pattern) % 10000:04d}'
                    )
                    vulnerabilities.append(vuln)

        return vulnerabilities

    def _is_test_file(self, file_path: str) -> bool:
        """Check if file is a test file"""
        path_lower = file_path.lower()
        test_indicators = ['test', 'spec', '__tests__', 'mock', 'fixture', 'fake', 'stub']
        return any(indicator in path_lower for indicator in test_indicators)

    def _is_in_comment(self, content: str, position: int) -> bool:
        """Check if position is inside a comment"""
        line_start = content.rfind('\n', 0, position) + 1
        line_end = content.find('\n', position)
        if line_end == -1:
            line_end = len(content)
        line = content[line_start:line_end]

        # Check for single-line comments
        stripped = line.lstrip()
        if stripped.startswith('//') or stripped.startswith('#') or stripped.startswith('*'):
            return True

        # Check if we're after a // or # on the same line
        comment_pos = line.find('//')
        if comment_pos == -1:
            comment_pos = line.find('#')
        if comment_pos != -1 and (position - line_start) > comment_pos:
            return True

        return False

    def _has_nearby_validation(self, content: str, position: int, category: VulnerabilityCategory) -> bool:
        """Check if there's validation/sanitization visible near the match"""
        # Get context (300 chars before)
        start = max(0, position - 300)
        context = content[start:position + 100].lower()

        if category == VulnerabilityCategory.SQL_INJECTION:
            # Check for parameterized query indicators
            safe_patterns = [
                'prepare', 'parameterized', 'binding', 'placeholder',
                'sqlalchemy', 'orm', 'sanitize', 'escape'
            ]
            return any(p in context for p in safe_patterns)

        elif category == VulnerabilityCategory.COMMAND_INJECTION:
            # Check for command validation
            safe_patterns = [
                'whitelist', 'allowed', 'validate', 'sanitize',
                'escape', 'shlex.quote', 'escapeshellarg'
            ]
            return any(p in context for p in safe_patterns)

        elif category == VulnerabilityCategory.PATH_TRAVERSAL:
            # Check for path validation
            safe_patterns = [
                'basename', 'secure_filename', 'resolve', 'normalize',
                'realpath', 'abspath', 'validate', 'whitelist', 'allowed'
            ]
            return any(p in context for p in safe_patterns)

        return False

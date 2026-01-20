"""
Security Misconfiguration Scanner
Detects common security misconfigurations and insecure defaults
"""

import re
import os
from typing import List

from ..models import Vulnerability, Severity, VulnerabilityCategory
from .base_scanner import BaseScanner


class MisconfigScanner(BaseScanner):
    """Scanner for security misconfigurations"""

    @property
    def name(self) -> str:
        return "Security Misconfiguration Scanner"

    LANGUAGE_MAP = {
        '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
        '.py': 'python', '.php': 'php', '.java': 'java', '.go': 'go',
        '.rb': 'ruby', '.cs': 'csharp', '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
        '.xml': 'xml', '.config': 'config'
    }

    PATTERNS = [
        # Debug mode enabled
        {
            'pattern': r'(?:DEBUG|debug)\s*[=:]\s*(?:true|True|1|on)',
            'title': 'Debug mode enabled',
            'description': 'Debug mode is enabled which may expose sensitive information',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-489',
            'fix_suggestion': 'Disable debug mode in production environments',
            'languages': ['python', 'javascript', 'typescript', 'php', 'json', 'yaml'],
            'confidence': 0.85
        },
        # CORS allow all origins
        {
            'pattern': r'(?:Access-Control-Allow-Origin|cors)[^}]*[\'"]?\*[\'"]?',
            'title': 'CORS allows all origins',
            'description': 'CORS is configured to allow all origins which may enable CSRF attacks',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-942',
            'fix_suggestion': 'Restrict CORS to specific trusted origins',
            'languages': ['javascript', 'typescript', 'python', 'php', 'java', 'go'],
            'confidence': 0.8
        },
        # SSL/TLS verification disabled
        {
            'pattern': r'(?:verify|ssl|tls|certificate)[_\s]*(?:=|:)\s*(?:false|False|0|none|None)',
            'title': 'SSL/TLS verification disabled',
            'description': 'SSL certificate verification is disabled, enabling man-in-the-middle attacks',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-295',
            'fix_suggestion': 'Enable SSL certificate verification',
            'languages': ['python', 'javascript', 'typescript', 'java', 'go', 'ruby'],
            'confidence': 0.9
        },
        # Insecure deserialization
        {
            'pattern': r'(?:pickle\.loads?|yaml\.(?:load|unsafe_load)|unserialize|ObjectInputStream)\s*\(',
            'title': 'Potentially insecure deserialization',
            'description': 'Deserialization of untrusted data can lead to remote code execution',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-502',
            'fix_suggestion': 'Use safe deserialization methods or validate input before deserializing',
            'languages': ['python', 'php', 'java'],
            'confidence': 0.8
        },
        # Weak cryptographic algorithm
        {
            'pattern': r'(?:md5|sha1|des|rc4|rc2)\s*\(',
            'title': 'Weak cryptographic algorithm',
            'description': 'Using weak or deprecated cryptographic algorithm',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-327',
            'fix_suggestion': 'Use strong algorithms like SHA-256, AES-256, or bcrypt for passwords',
            'languages': ['python', 'javascript', 'typescript', 'php', 'java', 'go'],
            'confidence': 0.85
        },
        # HTTP instead of HTTPS
        {
            'pattern': r'[\'"]http://(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[^\'"]+[\'"]',
            'title': 'Hardcoded HTTP URL',
            'description': 'Using HTTP instead of HTTPS for external URLs',
            'severity': Severity.LOW,
            'cwe_id': 'CWE-319',
            'fix_suggestion': 'Use HTTPS for all external communications',
            'languages': ['python', 'javascript', 'typescript', 'php', 'java', 'go', 'json', 'yaml'],
            'confidence': 0.7
        },
        # Missing security headers - Helmet
        {
            'pattern': r'express\(\)(?:(?!helmet).)*listen',
            'title': 'Missing security headers (Helmet)',
            'description': 'Express app may be missing security headers (Helmet middleware)',
            'severity': Severity.LOW,
            'cwe_id': 'CWE-693',
            'fix_suggestion': 'Add helmet middleware: app.use(helmet())',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.6
        },
        # Exposed error messages
        {
            'pattern': r'(?:res\.send|response\.send|print|echo)\s*\(\s*(?:err|error|exception|e)(?:\.message|\.stack)?',
            'title': 'Exposed error message',
            'description': 'Error details are sent to the client, potentially exposing sensitive information',
            'severity': Severity.LOW,
            'cwe_id': 'CWE-209',
            'fix_suggestion': 'Log errors server-side and send generic error messages to clients',
            'languages': ['javascript', 'typescript', 'python', 'php'],
            'confidence': 0.7
        },
        # Default credentials
        {
            'pattern': r'(?:password|passwd|pwd|secret)\s*[=:]\s*[\'"](?:admin|password|123456|root|default|test)[\'"]',
            'title': 'Default or weak credentials',
            'description': 'Default or commonly-used credentials found in code',
            'severity': Severity.CRITICAL,
            'cwe_id': 'CWE-798',
            'fix_suggestion': 'Remove hardcoded credentials and use environment variables',
            'languages': ['python', 'javascript', 'typescript', 'php', 'java', 'go', 'ruby', 'json', 'yaml'],
            'confidence': 0.9
        },
        # SQL injection via string formatting
        {
            'pattern': r'(?:execute|query)\s*\(\s*f[\'"]|(?:execute|query)\s*\([^)]*%[sd]',
            'title': 'SQL query with string formatting',
            'description': 'SQL query uses string formatting which may lead to SQL injection',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-89',
            'fix_suggestion': 'Use parameterized queries instead of string formatting',
            'languages': ['python'],
            'confidence': 0.85
        },
        # Mass assignment vulnerability
        {
            'pattern': r'(?:\.create|\.update|\.updateOne|\.findOneAndUpdate)\s*\(\s*(?:req\.body|request\.body|params)',
            'title': 'Potential mass assignment vulnerability',
            'description': 'User input is directly passed to database operation',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-915',
            'fix_suggestion': 'Whitelist allowed fields instead of passing all user input',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.75
        },
        # Open redirect
        {
            'pattern': r'(?:redirect|location\.href|window\.location)\s*[=(]\s*(?:req\.|request\.|params\.|query\.)',
            'title': 'Potential open redirect',
            'description': 'Redirect destination is controlled by user input',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-601',
            'fix_suggestion': 'Validate redirect URLs against a whitelist of allowed destinations',
            'languages': ['javascript', 'typescript', 'python', 'php'],
            'confidence': 0.8
        },
        # Rate limiting missing
        {
            'pattern': r'(?:login|signin|authenticate|password)[^}]*(?!rateLimit|rate_limit|throttle)',
            'title': 'Login endpoint may lack rate limiting',
            'description': 'Authentication endpoint may be vulnerable to brute force attacks',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-307',
            'fix_suggestion': 'Implement rate limiting on authentication endpoints',
            'languages': ['javascript', 'typescript', 'python'],
            'confidence': 0.5
        },
        # XXE vulnerability
        {
            'pattern': r'(?:XMLParser|etree\.parse|DocumentBuilder)(?:(?!disallow|disable|external).)*\(',
            'title': 'Potential XXE vulnerability',
            'description': 'XML parser may be vulnerable to XML External Entity attacks',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-611',
            'fix_suggestion': 'Disable external entity processing in XML parser',
            'languages': ['python', 'java'],
            'confidence': 0.7
        },
        # Insecure random
        {
            'pattern': r'(?:Math\.random|random\.random|rand\(\))\s*(?:\*|\.)',
            'title': 'Insecure random number generation',
            'description': 'Using non-cryptographic random for potentially security-sensitive operation',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-338',
            'fix_suggestion': 'Use crypto.randomBytes or secrets module for security-sensitive operations',
            'languages': ['javascript', 'typescript', 'python', 'php'],
            'confidence': 0.6
        },
    ]

    def scan(self, content: str, file_path: str) -> List[Vulnerability]:
        """Scan content for security misconfigurations"""
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
                    category=VulnerabilityCategory.CONFIGURATION,
                    file_path=file_path,
                    start_line=start_line,
                    end_line=end_line,
                    code_snippet=self._get_code_snippet(content, start_line, end_line),
                    cwe_id=pattern_info.get('cwe_id'),
                    suggested_fix=pattern_info.get('fix_suggestion'),
                    fix_confidence=pattern_info.get('confidence', 0.7),
                    rule_id=f'misconfig-{hash(pattern) % 10000:04d}'
                )
                vulnerabilities.append(vuln)

        return vulnerabilities

    def _is_test_file(self, file_path: str) -> bool:
        path_lower = file_path.lower()
        test_indicators = ['test', 'spec', '__tests__', 'mock', 'fixture', 'example']
        return any(indicator in path_lower for indicator in test_indicators)

    def _is_in_comment(self, content: str, position: int) -> bool:
        line_start = content.rfind('\n', 0, position) + 1
        line_end = content.find('\n', position)
        if line_end == -1:
            line_end = len(content)
        line = content[line_start:line_end]
        stripped = line.lstrip()
        return stripped.startswith('//') or stripped.startswith('#') or stripped.startswith('*')

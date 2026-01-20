"""
IDOR (Insecure Direct Object Reference) Scanner
Detects potential IDOR vulnerabilities where user input directly accesses objects
"""

import re
import os
from typing import List

from ..models import Vulnerability, Severity, VulnerabilityCategory
from .base_scanner import BaseScanner


class IDORScanner(BaseScanner):
    """Scanner for IDOR vulnerabilities"""

    @property
    def name(self) -> str:
        return "IDOR Scanner"

    LANGUAGE_MAP = {
        '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
        '.py': 'python', '.php': 'php', '.java': 'java', '.go': 'go',
        '.rb': 'ruby', '.cs': 'csharp'
    }

    PATTERNS = [
        # Direct database query with user ID from request
        {
            'pattern': r'(?:findById|findOne|findByPk|get)\s*\(\s*(?:req\.params|req\.query|req\.body|request\.get|params\[)[^)]*(?:id|Id|ID)',
            'title': 'Potential IDOR - Direct object access by ID',
            'description': 'Object is fetched directly using ID from user input without ownership verification',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-639',
            'fix_suggestion': 'Verify that the current user owns or has permission to access the requested object',
            'languages': ['javascript', 'typescript', 'python'],
            'confidence': 0.7
        },
        # File access with user input
        {
            'pattern': r'(?:readFile|writeFile|unlink|delete|remove)\s*\([^)]*(?:req\.|request\.|params\.|query\.)',
            'title': 'Potential IDOR - File operation with user input',
            'description': 'File operation uses user-provided path or identifier',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-639',
            'fix_suggestion': 'Validate file paths and ensure user has permission to access the file',
            'languages': ['javascript', 'typescript', 'python'],
            'confidence': 0.8
        },
        # PHP direct database query
        {
            'pattern': r'\$_(?:GET|POST|REQUEST)\s*\[[\'"]id[\'"]\].*(?:SELECT|UPDATE|DELETE)',
            'title': 'Potential IDOR - Direct SQL with user ID',
            'description': 'Database query uses ID directly from user input without authorization check',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-639',
            'fix_suggestion': 'Verify user ownership before performing database operations',
            'languages': ['php'],
            'confidence': 0.8
        },
        # API endpoint with ID parameter without auth check
        {
            'pattern': r'(?:router|app)\.(?:get|post|put|delete|patch)\s*\(\s*[\'"][^\'"]*/:\w*[iI]d[^\']*[\'"](?:(?!auth|verify|check|permission|owner).)*\)',
            'title': 'API endpoint with ID parameter - verify authorization',
            'description': 'API endpoint accepts ID parameter but may lack authorization checks',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-639',
            'fix_suggestion': 'Add middleware to verify the user has permission to access this resource',
            'languages': ['javascript', 'typescript'],
            'confidence': 0.6
        },
        # Django/Flask direct query
        {
            'pattern': r'(?:\.objects\.get|\.query\.get|\.filter_by)\s*\(\s*(?:id|pk)\s*=\s*(?:request\.|kwargs)',
            'title': 'Potential IDOR - Direct object query',
            'description': 'Object is retrieved using ID from request without ownership check',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-639',
            'fix_suggestion': 'Filter by both ID and current user: Model.objects.get(id=id, user=request.user)',
            'languages': ['python'],
            'confidence': 0.7
        },
        # Java direct repository access
        {
            'pattern': r'repository\.findById\s*\(\s*(?:request|param)',
            'title': 'Potential IDOR - Direct repository access',
            'description': 'Repository findById called with user-provided ID without authorization',
            'severity': Severity.MEDIUM,
            'cwe_id': 'CWE-639',
            'fix_suggestion': 'Verify user has permission to access this entity before returning',
            'languages': ['java'],
            'confidence': 0.7
        },
        # Sequential/Predictable IDs
        {
            'pattern': r'(?:auto_increment|SERIAL|nextval|IDENTITY)',
            'title': 'Sequential IDs may enable enumeration',
            'description': 'Using sequential IDs makes it easier to enumerate resources',
            'severity': Severity.LOW,
            'cwe_id': 'CWE-639',
            'fix_suggestion': 'Consider using UUIDs for public-facing identifiers',
            'languages': ['python', 'javascript', 'typescript', 'php', 'java'],
            'confidence': 0.5
        },
        # Download/Export with ID
        {
            'pattern': r'(?:download|export|attachment)\s*[=(][^)]*(?:req\.|request\.|params\.)',
            'title': 'Potential IDOR - Download/Export with user ID',
            'description': 'File download or export uses user-provided identifier',
            'severity': Severity.HIGH,
            'cwe_id': 'CWE-639',
            'fix_suggestion': 'Verify user has permission to download the requested file',
            'languages': ['javascript', 'typescript', 'python', 'php', 'java'],
            'confidence': 0.75
        },
    ]

    def scan(self, content: str, file_path: str) -> List[Vulnerability]:
        """Scan content for IDOR vulnerabilities"""
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

                # Check for nearby authorization patterns
                if self._has_auth_check(content, match.start()):
                    continue

                start_line = self._get_line_number(content, match.start())
                end_line = self._get_line_number(content, match.end())

                vuln = Vulnerability(
                    title=pattern_info['title'],
                    description=pattern_info['description'],
                    severity=pattern_info['severity'],
                    category=VulnerabilityCategory.IDOR,
                    file_path=file_path,
                    start_line=start_line,
                    end_line=end_line,
                    code_snippet=self._get_code_snippet(content, start_line, end_line),
                    cwe_id=pattern_info.get('cwe_id'),
                    suggested_fix=pattern_info.get('fix_suggestion'),
                    fix_confidence=pattern_info.get('confidence', 0.7),
                    rule_id=f'idor-{hash(pattern) % 10000:04d}'
                )
                vulnerabilities.append(vuln)

        return vulnerabilities

    def _has_auth_check(self, content: str, position: int) -> bool:
        """Check if there's an authorization check near the match"""
        # Look in surrounding context (500 chars before and after)
        start = max(0, position - 500)
        end = min(len(content), position + 500)
        context = content[start:end].lower()

        auth_patterns = [
            'authorize', 'permission', 'owner', 'belongs_to', 'can_access',
            'has_permission', 'check_permission', 'verify_owner', 'user_id',
            'req.user', 'request.user', 'current_user', 'auth.user',
            'ownership', 'access_control', 'acl'
        ]
        return any(p in context for p in auth_patterns)

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

"""
Semgrep Scanner - Uses Semgrep for accurate static analysis
Significantly reduces false positives compared to regex-based scanning
"""

import json
import subprocess
import tempfile
import os
from typing import List, Optional
import structlog

from ..models import Vulnerability, Severity, VulnerabilityCategory
from .base_scanner import BaseScanner

logger = structlog.get_logger()


class SemgrepScanner(BaseScanner):
    """Scanner using Semgrep for accurate static analysis"""

    @property
    def name(self) -> str:
        return "Semgrep Scanner"

    # Map Semgrep severity to our severity
    SEVERITY_MAP = {
        'ERROR': Severity.CRITICAL,
        'WARNING': Severity.HIGH,
        'INFO': Severity.MEDIUM,
    }

    # Map Semgrep categories to our categories
    CATEGORY_MAP = {
        'security': VulnerabilityCategory.OTHER,
        'correctness': VulnerabilityCategory.CODE_QUALITY,
        'best-practice': VulnerabilityCategory.CODE_QUALITY,
        'xss': VulnerabilityCategory.XSS,
        'sqli': VulnerabilityCategory.SQL_INJECTION,
        'injection': VulnerabilityCategory.COMMAND_INJECTION,
        'path-traversal': VulnerabilityCategory.PATH_TRAVERSAL,
        'ssrf': VulnerabilityCategory.SSRF,
        'xxe': VulnerabilityCategory.XXE,
        'deserialization': VulnerabilityCategory.DESERIALIZATION,
        'crypto': VulnerabilityCategory.CRYPTOGRAPHY,
        'secrets': VulnerabilityCategory.SECRETS_EXPOSURE,
        'auth': VulnerabilityCategory.AUTHENTICATION,
    }

    def __init__(self):
        super().__init__()
        self._check_semgrep_available()

    def _check_semgrep_available(self):
        """Check if semgrep is available"""
        try:
            result = subprocess.run(
                ['semgrep', '--version'],
                capture_output=True,
                text=True,
                timeout=10
            )
            self.semgrep_available = result.returncode == 0
            if self.semgrep_available:
                logger.info('Semgrep available', version=result.stdout.strip())
        except Exception as e:
            logger.warning('Semgrep not available', error=str(e))
            self.semgrep_available = False

    def scan(self, content: str, file_path: str) -> List[Vulnerability]:
        """Scan content using Semgrep - this is called per-file but we batch later"""
        # For per-file scanning, we'll store content and scan in batch
        # This method is kept for compatibility but actual scanning happens in scan_directory
        return []

    def scan_directory(self, directory: str) -> List[Vulnerability]:
        """Scan entire directory with Semgrep for better accuracy"""
        if not self.semgrep_available:
            logger.warning('Semgrep not available, skipping scan')
            return []

        vulnerabilities = []

        try:
            # Run semgrep with security-focused rules
            result = subprocess.run(
                [
                    'semgrep',
                    '--config', 'p/security-audit',  # Security audit rules
                    '--config', 'p/secrets',         # Secrets detection
                    '--config', 'p/owasp-top-ten',   # OWASP Top 10
                    '--json',
                    '--quiet',
                    '--no-git-ignore',               # Scan all files
                    '--timeout', '30',
                    directory
                ],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout for large repos
            )

            if result.stdout:
                findings = json.loads(result.stdout)
                vulnerabilities = self._parse_semgrep_results(findings, directory)

            logger.info('Semgrep scan completed',
                       findings_count=len(vulnerabilities))

        except subprocess.TimeoutExpired:
            logger.error('Semgrep scan timed out')
        except json.JSONDecodeError as e:
            logger.error('Failed to parse Semgrep output', error=str(e))
        except Exception as e:
            logger.error('Semgrep scan failed', error=str(e))

        return vulnerabilities

    def _parse_semgrep_results(self, findings: dict, base_dir: str) -> List[Vulnerability]:
        """Parse Semgrep JSON output into vulnerabilities"""
        vulnerabilities = []

        results = findings.get('results', [])
        for result in results:
            try:
                # Get file path relative to base directory
                abs_path = result.get('path', '')
                if base_dir and abs_path.startswith(base_dir):
                    file_path = os.path.relpath(abs_path, base_dir)
                else:
                    file_path = abs_path

                # Get severity
                severity_str = result.get('extra', {}).get('severity', 'WARNING')
                severity = self.SEVERITY_MAP.get(severity_str.upper(), Severity.MEDIUM)

                # Get category from rule metadata
                rule_id = result.get('check_id', '')
                category = self._get_category_from_rule(rule_id, result.get('extra', {}))

                # Get line information
                start = result.get('start', {})
                end = result.get('end', {})
                start_line = start.get('line', 1)
                end_line = end.get('line', start_line)

                # Get code snippet
                code_snippet = result.get('extra', {}).get('lines', '')

                # Get message and metadata
                message = result.get('extra', {}).get('message', '')
                metadata = result.get('extra', {}).get('metadata', {})

                # Get CWE if available
                cwe_ids = metadata.get('cwe', [])
                cwe_id = cwe_ids[0] if cwe_ids else None

                # Create vulnerability
                vuln = Vulnerability(
                    title=self._format_title(rule_id),
                    description=message,
                    severity=severity,
                    category=category,
                    file_path=file_path,
                    start_line=start_line,
                    end_line=end_line,
                    code_snippet=code_snippet,
                    cwe_id=cwe_id,
                    suggested_fix=metadata.get('fix', None),
                    fix_confidence=0.9,  # Semgrep has high confidence
                    rule_id=rule_id
                )
                vulnerabilities.append(vuln)

            except Exception as e:
                logger.warning('Failed to parse Semgrep result', error=str(e))

        return vulnerabilities

    def _format_title(self, rule_id: str) -> str:
        """Format rule ID into readable title"""
        # Remove common prefixes
        for prefix in ['python.', 'javascript.', 'generic.', 'java.', 'go.']:
            if rule_id.startswith(prefix):
                rule_id = rule_id[len(prefix):]
                break

        # Convert to title case with spaces
        title = rule_id.replace('-', ' ').replace('_', ' ').replace('.', ' - ')
        return title.title()

    def _get_category_from_rule(self, rule_id: str, extra: dict) -> VulnerabilityCategory:
        """Determine vulnerability category from rule ID and metadata"""
        rule_lower = rule_id.lower()
        metadata = extra.get('metadata', {})

        # Check metadata category
        meta_category = metadata.get('category', '').lower()
        if meta_category in self.CATEGORY_MAP:
            return self.CATEGORY_MAP[meta_category]

        # Check rule ID patterns
        if 'xss' in rule_lower or 'cross-site' in rule_lower:
            return VulnerabilityCategory.XSS
        elif 'sql' in rule_lower or 'sqli' in rule_lower:
            return VulnerabilityCategory.SQL_INJECTION
        elif 'command' in rule_lower or 'shell' in rule_lower or 'exec' in rule_lower:
            return VulnerabilityCategory.COMMAND_INJECTION
        elif 'path' in rule_lower or 'traversal' in rule_lower or 'directory' in rule_lower:
            return VulnerabilityCategory.PATH_TRAVERSAL
        elif 'ssrf' in rule_lower:
            return VulnerabilityCategory.SSRF
        elif 'xxe' in rule_lower or 'xml' in rule_lower:
            return VulnerabilityCategory.XXE
        elif 'deserial' in rule_lower or 'pickle' in rule_lower:
            return VulnerabilityCategory.DESERIALIZATION
        elif 'secret' in rule_lower or 'password' in rule_lower or 'credential' in rule_lower or 'api-key' in rule_lower:
            return VulnerabilityCategory.SECRETS_EXPOSURE
        elif 'crypto' in rule_lower or 'cipher' in rule_lower or 'hash' in rule_lower:
            return VulnerabilityCategory.CRYPTOGRAPHY
        elif 'auth' in rule_lower:
            return VulnerabilityCategory.AUTHENTICATION

        return VulnerabilityCategory.OTHER

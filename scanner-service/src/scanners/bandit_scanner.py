"""
Bandit Scanner - Python-specific security scanner
Uses Bandit for accurate Python security analysis
"""

import json
import subprocess
import os
from typing import List
import structlog

from ..models import Vulnerability, Severity, VulnerabilityCategory
from .base_scanner import BaseScanner

logger = structlog.get_logger()


class BanditScanner(BaseScanner):
    """Scanner using Bandit for Python security analysis"""

    @property
    def name(self) -> str:
        return "Bandit Scanner"

    # Map Bandit severity to our severity
    SEVERITY_MAP = {
        'HIGH': Severity.CRITICAL,
        'MEDIUM': Severity.HIGH,
        'LOW': Severity.MEDIUM,
    }

    # Map Bandit test IDs to categories
    CATEGORY_MAP = {
        # Injection
        'B102': VulnerabilityCategory.COMMAND_INJECTION,  # exec_used
        'B103': VulnerabilityCategory.CONFIGURATION,      # set_bad_file_permissions
        'B104': VulnerabilityCategory.CONFIGURATION,      # hardcoded_bind_all_interfaces
        'B105': VulnerabilityCategory.SECRETS_EXPOSURE,   # hardcoded_password_string
        'B106': VulnerabilityCategory.SECRETS_EXPOSURE,   # hardcoded_password_funcarg
        'B107': VulnerabilityCategory.SECRETS_EXPOSURE,   # hardcoded_password_default
        'B108': VulnerabilityCategory.PATH_TRAVERSAL,     # hardcoded_tmp_directory
        # SQL
        'B608': VulnerabilityCategory.SQL_INJECTION,      # hardcoded_sql_expressions
        'B609': VulnerabilityCategory.COMMAND_INJECTION,  # linux_commands_wildcard_injection
        'B610': VulnerabilityCategory.SQL_INJECTION,      # django_extra_used
        'B611': VulnerabilityCategory.SQL_INJECTION,      # django_rawsql_used
        # Shell
        'B601': VulnerabilityCategory.COMMAND_INJECTION,  # paramiko_calls
        'B602': VulnerabilityCategory.COMMAND_INJECTION,  # subprocess_popen_with_shell_equals_true
        'B603': VulnerabilityCategory.COMMAND_INJECTION,  # subprocess_without_shell_equals_true
        'B604': VulnerabilityCategory.COMMAND_INJECTION,  # any_other_function_with_shell_equals_true
        'B605': VulnerabilityCategory.COMMAND_INJECTION,  # start_process_with_a_shell
        'B606': VulnerabilityCategory.COMMAND_INJECTION,  # start_process_with_no_shell
        'B607': VulnerabilityCategory.COMMAND_INJECTION,  # start_process_with_partial_path
        # Crypto
        'B303': VulnerabilityCategory.CRYPTOGRAPHY,       # md5
        'B304': VulnerabilityCategory.CRYPTOGRAPHY,       # des
        'B305': VulnerabilityCategory.CRYPTOGRAPHY,       # cipher_modes
        'B306': VulnerabilityCategory.CRYPTOGRAPHY,       # mktemp_q
        'B307': VulnerabilityCategory.COMMAND_INJECTION,  # eval
        'B308': VulnerabilityCategory.XSS,                # mark_safe
        'B309': VulnerabilityCategory.CRYPTOGRAPHY,       # httpsconnection
        'B310': VulnerabilityCategory.SSRF,               # urllib_urlopen
        'B311': VulnerabilityCategory.CRYPTOGRAPHY,       # random
        'B312': VulnerabilityCategory.CRYPTOGRAPHY,       # telnetlib
        'B313': VulnerabilityCategory.XXE,                # xml_bad_cElementTree
        'B314': VulnerabilityCategory.XXE,                # xml_bad_ElementTree
        'B315': VulnerabilityCategory.XXE,                # xml_bad_expatreader
        'B316': VulnerabilityCategory.XXE,                # xml_bad_expatbuilder
        'B317': VulnerabilityCategory.XXE,                # xml_bad_sax
        'B318': VulnerabilityCategory.XXE,                # xml_bad_minidom
        'B319': VulnerabilityCategory.XXE,                # xml_bad_pulldom
        'B320': VulnerabilityCategory.XXE,                # xml_bad_etree
        # Deserialization
        'B301': VulnerabilityCategory.DESERIALIZATION,    # pickle
        'B302': VulnerabilityCategory.DESERIALIZATION,    # marshal
        'B403': VulnerabilityCategory.DESERIALIZATION,    # import_pickle
        'B404': VulnerabilityCategory.COMMAND_INJECTION,  # import_subprocess
        'B405': VulnerabilityCategory.XXE,                # import_xml_etree
        'B406': VulnerabilityCategory.XXE,                # import_xml_sax
        'B407': VulnerabilityCategory.XXE,                # import_xml_expat
        'B408': VulnerabilityCategory.XXE,                # import_xml_minidom
        'B409': VulnerabilityCategory.XXE,                # import_xml_pulldom
        'B410': VulnerabilityCategory.XXE,                # import_lxml
        'B411': VulnerabilityCategory.XXE,                # import_xmlrpclib
        'B412': VulnerabilityCategory.CRYPTOGRAPHY,       # import_httpoxy
        'B413': VulnerabilityCategory.CRYPTOGRAPHY,       # import_pycrypto
        # YAML
        'B506': VulnerabilityCategory.DESERIALIZATION,    # yaml_load
        # Flask/Django
        'B201': VulnerabilityCategory.COMMAND_INJECTION,  # flask_debug_true
        'B501': VulnerabilityCategory.CRYPTOGRAPHY,       # request_with_no_cert_validation
        'B502': VulnerabilityCategory.CRYPTOGRAPHY,       # ssl_with_bad_version
        'B503': VulnerabilityCategory.CRYPTOGRAPHY,       # ssl_with_bad_defaults
        'B504': VulnerabilityCategory.CRYPTOGRAPHY,       # ssl_with_no_version
        'B505': VulnerabilityCategory.CRYPTOGRAPHY,       # weak_cryptographic_key
        'B507': VulnerabilityCategory.CRYPTOGRAPHY,       # ssh_no_host_key_verification
        'B508': VulnerabilityCategory.CONFIGURATION,      # snmp_insecure_version
        'B509': VulnerabilityCategory.CONFIGURATION,      # snmp_weak_cryptography
        # Jinja2
        'B701': VulnerabilityCategory.XSS,                # jinja2_autoescape_false
        'B702': VulnerabilityCategory.XSS,                # use_of_mako_templates
        'B703': VulnerabilityCategory.XSS,                # django_mark_safe
    }

    def __init__(self):
        super().__init__()
        self._check_bandit_available()

    def _check_bandit_available(self):
        """Check if bandit is available"""
        try:
            result = subprocess.run(
                ['bandit', '--version'],
                capture_output=True,
                text=True,
                timeout=10
            )
            self.bandit_available = result.returncode == 0
            if self.bandit_available:
                logger.info('Bandit available', version=result.stdout.strip())
        except Exception as e:
            logger.warning('Bandit not available', error=str(e))
            self.bandit_available = False

    def scan(self, content: str, file_path: str) -> List[Vulnerability]:
        """Scan is done at directory level"""
        return []

    def scan_directory(self, directory: str) -> List[Vulnerability]:
        """Scan directory for Python security issues using Bandit"""
        if not self.bandit_available:
            logger.warning('Bandit not available, skipping scan')
            return []

        vulnerabilities = []

        try:
            # Run bandit on all Python files
            result = subprocess.run(
                [
                    'bandit',
                    '-r',                    # Recursive
                    '-f', 'json',            # JSON output
                    '-ll',                   # Report medium and higher
                    '--exclude', '.venv,venv,env,node_modules,__pycache__',
                    directory
                ],
                capture_output=True,
                text=True,
                timeout=180  # 3 minute timeout
            )

            # Bandit returns non-zero if it finds issues, so check stdout
            if result.stdout:
                findings = json.loads(result.stdout)
                vulnerabilities = self._parse_bandit_results(findings, directory)

            logger.info('Bandit scan completed',
                       findings_count=len(vulnerabilities))

        except subprocess.TimeoutExpired:
            logger.error('Bandit scan timed out')
        except json.JSONDecodeError as e:
            logger.error('Failed to parse Bandit output', error=str(e))
        except Exception as e:
            logger.error('Bandit scan failed', error=str(e))

        return vulnerabilities

    def _parse_bandit_results(self, findings: dict, base_dir: str) -> List[Vulnerability]:
        """Parse Bandit JSON output into vulnerabilities"""
        vulnerabilities = []

        results = findings.get('results', [])
        for result in results:
            try:
                # Skip low confidence findings to reduce false positives
                confidence = result.get('issue_confidence', 'LOW')
                if confidence == 'LOW':
                    continue

                # Get file path relative to base directory
                abs_path = result.get('filename', '')
                if base_dir and abs_path.startswith(base_dir):
                    file_path = os.path.relpath(abs_path, base_dir)
                else:
                    file_path = abs_path

                # Get severity
                severity_str = result.get('issue_severity', 'MEDIUM')
                severity = self.SEVERITY_MAP.get(severity_str.upper(), Severity.MEDIUM)

                # Adjust severity based on confidence
                if confidence == 'MEDIUM' and severity == Severity.CRITICAL:
                    severity = Severity.HIGH

                # Get category from test ID
                test_id = result.get('test_id', '')
                category = self.CATEGORY_MAP.get(test_id, VulnerabilityCategory.OTHER)

                # Get line information
                line_number = result.get('line_number', 1)
                line_range = result.get('line_range', [line_number])
                start_line = min(line_range) if line_range else line_number
                end_line = max(line_range) if line_range else line_number

                # Get code snippet
                code_snippet = result.get('code', '')

                # Get CWE if available
                cwe_id = result.get('issue_cwe', {}).get('id')
                if cwe_id:
                    cwe_id = f'CWE-{cwe_id}'

                # Create vulnerability
                vuln = Vulnerability(
                    title=result.get('test_name', 'Security Issue'),
                    description=result.get('issue_text', ''),
                    severity=severity,
                    category=category,
                    file_path=file_path,
                    start_line=start_line,
                    end_line=end_line,
                    code_snippet=code_snippet,
                    cwe_id=cwe_id,
                    suggested_fix=result.get('more_info', None),
                    fix_confidence=0.85 if confidence == 'HIGH' else 0.7,
                    rule_id=test_id
                )
                vulnerabilities.append(vuln)

            except Exception as e:
                logger.warning('Failed to parse Bandit result', error=str(e))

        return vulnerabilities

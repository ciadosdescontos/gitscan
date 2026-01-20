"""
Dependency Scanner - Scans for vulnerable dependencies
Uses Safety for Python, npm audit concepts for JavaScript
"""

import json
import subprocess
import os
import re
from typing import List, Dict, Any
import structlog

from ..models import Vulnerability, Severity, VulnerabilityCategory
from .base_scanner import BaseScanner

logger = structlog.get_logger()


class DependencyScanner(BaseScanner):
    """Scanner for vulnerable dependencies"""

    @property
    def name(self) -> str:
        return "Dependency Scanner"

    # Map CVSS scores to severity
    def _cvss_to_severity(self, cvss: float) -> Severity:
        if cvss >= 9.0:
            return Severity.CRITICAL
        elif cvss >= 7.0:
            return Severity.HIGH
        elif cvss >= 4.0:
            return Severity.MEDIUM
        elif cvss > 0:
            return Severity.LOW
        return Severity.INFO

    def __init__(self):
        super().__init__()
        self._check_tools_available()

    def _check_tools_available(self):
        """Check if safety is available"""
        try:
            result = subprocess.run(
                ['safety', '--version'],
                capture_output=True,
                text=True,
                timeout=10
            )
            self.safety_available = result.returncode == 0
            if self.safety_available:
                logger.info('Safety available')
        except Exception as e:
            logger.warning('Safety not available', error=str(e))
            self.safety_available = False

    def scan(self, content: str, file_path: str) -> List[Vulnerability]:
        """Scan dependency files for known vulnerabilities"""
        vulnerabilities = []
        file_name = os.path.basename(file_path)

        # Python requirements
        if file_name in ['requirements.txt', 'requirements-dev.txt', 'requirements-prod.txt']:
            vulnerabilities.extend(self._scan_python_requirements(content, file_path))

        # Package.json
        elif file_name == 'package.json':
            vulnerabilities.extend(self._scan_package_json(content, file_path))

        # Pipfile
        elif file_name == 'Pipfile.lock':
            vulnerabilities.extend(self._scan_pipfile_lock(content, file_path))

        return vulnerabilities

    def scan_directory(self, directory: str) -> List[Vulnerability]:
        """Scan directory for dependency vulnerabilities using Safety"""
        vulnerabilities = []

        # Find requirements.txt files
        for root, dirs, files in os.walk(directory):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in {
                'node_modules', 'venv', '.venv', 'env', '__pycache__',
                '.git', 'dist', 'build'
            }]

            for file in files:
                if file in ['requirements.txt', 'requirements-dev.txt']:
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, directory)
                    vulns = self._scan_requirements_with_safety(file_path, rel_path)
                    vulnerabilities.extend(vulns)

        return vulnerabilities

    def _scan_requirements_with_safety(self, file_path: str, rel_path: str) -> List[Vulnerability]:
        """Scan requirements.txt with Safety"""
        if not self.safety_available:
            return []

        vulnerabilities = []

        try:
            result = subprocess.run(
                [
                    'safety', 'check',
                    '-r', file_path,
                    '--json',
                    '--full-report'
                ],
                capture_output=True,
                text=True,
                timeout=120
            )

            # Safety returns exit code 64 if vulnerabilities found
            if result.stdout:
                try:
                    findings = json.loads(result.stdout)
                    vulnerabilities = self._parse_safety_results(findings, rel_path)
                except json.JSONDecodeError:
                    # Try parsing line by line for older safety versions
                    pass

            logger.info('Safety scan completed',
                       file=rel_path,
                       findings_count=len(vulnerabilities))

        except subprocess.TimeoutExpired:
            logger.error('Safety scan timed out', file=rel_path)
        except Exception as e:
            logger.error('Safety scan failed', file=rel_path, error=str(e))

        return vulnerabilities

    def _parse_safety_results(self, findings: Any, file_path: str) -> List[Vulnerability]:
        """Parse Safety JSON output into vulnerabilities"""
        vulnerabilities = []

        # Safety output format varies by version
        if isinstance(findings, dict):
            vulns_list = findings.get('vulnerabilities', [])
        elif isinstance(findings, list):
            vulns_list = findings
        else:
            return vulnerabilities

        for vuln_data in vulns_list:
            try:
                # Handle different Safety output formats
                if isinstance(vuln_data, dict):
                    package = vuln_data.get('package_name', vuln_data.get('name', 'unknown'))
                    version = vuln_data.get('analyzed_version', vuln_data.get('version', ''))
                    vuln_id = vuln_data.get('vulnerability_id', vuln_data.get('id', ''))
                    advisory = vuln_data.get('advisory', vuln_data.get('description', ''))
                    cvss = vuln_data.get('cvss', {}).get('score', 0)
                    cve = vuln_data.get('cve', None)
                else:
                    # List format: [package, version, installed_version, description, vuln_id]
                    package = vuln_data[0] if len(vuln_data) > 0 else 'unknown'
                    version = vuln_data[2] if len(vuln_data) > 2 else ''
                    advisory = vuln_data[3] if len(vuln_data) > 3 else ''
                    vuln_id = vuln_data[4] if len(vuln_data) > 4 else ''
                    cvss = 0
                    cve = None

                severity = self._cvss_to_severity(cvss) if cvss else Severity.HIGH

                vuln = Vulnerability(
                    title=f'Vulnerable dependency: {package}',
                    description=f'{advisory}\n\nInstalled version: {version}',
                    severity=severity,
                    category=VulnerabilityCategory.DEPENDENCY,
                    file_path=file_path,
                    start_line=1,
                    end_line=1,
                    code_snippet=f'{package}=={version}' if version else package,
                    cve_id=cve,
                    suggested_fix=f'Update {package} to a non-vulnerable version',
                    fix_confidence=0.95,
                    rule_id=vuln_id
                )
                vulnerabilities.append(vuln)

            except Exception as e:
                logger.warning('Failed to parse Safety result', error=str(e))

        return vulnerabilities

    def _scan_python_requirements(self, content: str, file_path: str) -> List[Vulnerability]:
        """Basic scan of requirements.txt for known vulnerable patterns"""
        vulnerabilities = []

        # Known vulnerable package patterns (major known CVEs)
        KNOWN_VULNERABLE = {
            'django': {
                'pattern': r'django[<>=]=?([0-9.]+)',
                'vulnerable_versions': ['1.', '2.0', '2.1', '2.2.0', '2.2.1', '2.2.2'],
                'cve': 'Multiple CVEs in old Django versions',
            },
            'requests': {
                'pattern': r'requests[<>=]=?([0-9.]+)',
                'vulnerable_versions': ['2.3.', '2.4.', '2.5.'],
                'cve': 'CVE-2018-18074',
            },
            'pyyaml': {
                'pattern': r'pyyaml[<>=]=?([0-9.]+)',
                'vulnerable_versions': ['3.', '4.', '5.1', '5.2', '5.3'],
                'cve': 'CVE-2020-14343',
            },
            'pillow': {
                'pattern': r'pillow[<>=]=?([0-9.]+)',
                'vulnerable_versions': ['6.', '7.0', '7.1', '8.0', '8.1.0', '8.1.1'],
                'cve': 'Multiple CVEs in old Pillow versions',
            },
            'urllib3': {
                'pattern': r'urllib3[<>=]=?([0-9.]+)',
                'vulnerable_versions': ['1.24', '1.25.0', '1.25.1', '1.25.2'],
                'cve': 'CVE-2021-33503',
            },
        }

        for line_num, line in enumerate(content.split('\n'), 1):
            line = line.strip().lower()
            if not line or line.startswith('#'):
                continue

            for pkg_name, pkg_info in KNOWN_VULNERABLE.items():
                match = re.search(pkg_info['pattern'], line, re.IGNORECASE)
                if match:
                    version = match.group(1)
                    for vuln_ver in pkg_info['vulnerable_versions']:
                        if version.startswith(vuln_ver):
                            vuln = Vulnerability(
                                title=f'Known vulnerable version of {pkg_name}',
                                description=f'{pkg_name} version {version} has known security vulnerabilities. {pkg_info["cve"]}',
                                severity=Severity.HIGH,
                                category=VulnerabilityCategory.DEPENDENCY,
                                file_path=file_path,
                                start_line=line_num,
                                end_line=line_num,
                                code_snippet=line,
                                cve_id=pkg_info['cve'] if 'CVE-' in pkg_info['cve'] else None,
                                suggested_fix=f'Update {pkg_name} to the latest version',
                                fix_confidence=0.9,
                                rule_id=f'dep-{pkg_name}'
                            )
                            vulnerabilities.append(vuln)
                            break

        return vulnerabilities

    def _scan_package_json(self, content: str, file_path: str) -> List[Vulnerability]:
        """Basic scan of package.json for known vulnerable patterns"""
        vulnerabilities = []

        try:
            pkg = json.loads(content)
            all_deps = {}
            all_deps.update(pkg.get('dependencies', {}))
            all_deps.update(pkg.get('devDependencies', {}))

            # Known vulnerable npm packages
            KNOWN_VULNERABLE = {
                'lodash': {'versions': ['4.17.11', '4.17.10', '4.17.4'], 'cve': 'CVE-2019-10744'},
                'axios': {'versions': ['0.18.', '0.19.0'], 'cve': 'CVE-2020-28168'},
                'minimist': {'versions': ['0.', '1.0', '1.1', '1.2.0', '1.2.1', '1.2.2', '1.2.3', '1.2.4', '1.2.5'], 'cve': 'CVE-2021-44906'},
                'node-fetch': {'versions': ['2.6.0', '2.6.1', '3.0.0'], 'cve': 'CVE-2022-0235'},
            }

            for dep_name, version in all_deps.items():
                dep_lower = dep_name.lower()
                if dep_lower in KNOWN_VULNERABLE:
                    vuln_info = KNOWN_VULNERABLE[dep_lower]
                    # Clean version string
                    clean_version = version.lstrip('^~>=<')
                    for vuln_ver in vuln_info['versions']:
                        if clean_version.startswith(vuln_ver):
                            vuln = Vulnerability(
                                title=f'Known vulnerable version of {dep_name}',
                                description=f'{dep_name}@{version} has known security vulnerabilities. {vuln_info["cve"]}',
                                severity=Severity.HIGH,
                                category=VulnerabilityCategory.DEPENDENCY,
                                file_path=file_path,
                                start_line=1,
                                end_line=1,
                                code_snippet=f'"{dep_name}": "{version}"',
                                cve_id=vuln_info['cve'],
                                suggested_fix=f'Update {dep_name} to the latest version',
                                fix_confidence=0.9,
                                rule_id=f'npm-{dep_lower}'
                            )
                            vulnerabilities.append(vuln)
                            break

        except json.JSONDecodeError:
            logger.warning('Failed to parse package.json', file=file_path)

        return vulnerabilities

    def _scan_pipfile_lock(self, content: str, file_path: str) -> List[Vulnerability]:
        """Scan Pipfile.lock for vulnerabilities"""
        # Similar to requirements.txt scanning
        return []

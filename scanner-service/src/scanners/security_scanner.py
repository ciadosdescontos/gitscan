"""
Main Security Scanner - Orchestrates all security checks
Integrates multiple professional security tools for accurate detection
"""

import os
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Set, Tuple
import structlog

from git import Repo
from git.exc import GitError

from ..config import Config
from ..models import ScanRequest, ScanResult, Vulnerability
from .xss_scanner import XSSScanner
from .injection_scanner import InjectionScanner
from .secrets_scanner import SecretsScanner
from .semgrep_scanner import SemgrepScanner
from .bandit_scanner import BanditScanner
from .dependency_scanner import DependencyScanner
from .csrf_scanner import CSRFScanner
from .session_scanner import SessionScanner
from .idor_scanner import IDORScanner
from .misconfig_scanner import MisconfigScanner
from .base_scanner import BaseScanner

logger = structlog.get_logger()


class SecurityScanner:
    """Main security scanner that orchestrates all security checks"""

    # File extensions to scan
    SCANNABLE_EXTENSIONS = {
        '.js', '.jsx', '.ts', '.tsx',  # JavaScript/TypeScript
        '.py',                          # Python
        '.java',                        # Java
        '.go',                          # Go
        '.rb',                          # Ruby
        '.php',                         # PHP
        '.cs',                          # C#
        '.c', '.cpp', '.h', '.hpp',    # C/C++
        '.swift',                       # Swift
        '.kt', '.kts',                  # Kotlin
        '.rs',                          # Rust
        '.sql',                         # SQL
        '.html', '.htm',               # HTML
        '.xml',                         # XML
        '.json', '.yaml', '.yml',      # Config files
    }

    # Directories to exclude
    EXCLUDED_DIRS = {
        'node_modules', 'venv', '.venv', 'env', '.env',
        '__pycache__', '.git', '.svn', '.hg',
        'vendor', 'bower_components', 'dist', 'build',
        '.idea', '.vscode', 'coverage', '.nyc_output'
    }

    def __init__(self, request: ScanRequest):
        self.request = request
        self.temp_dir: Optional[str] = None
        self.scanners: List[BaseScanner] = []
        self.directory_scanners: List[BaseScanner] = []
        self._init_scanners()

    def _init_scanners(self):
        """Initialize all security scanners based on scan type and selected scanners"""
        # Map of scanner categories to scanners
        scanner_map = {
            'XSS': XSSScanner(),
            'SQL_INJECTION': InjectionScanner(),
            'COMMAND_INJECTION': InjectionScanner(),
            'SECRETS_EXPOSURE': SecretsScanner(),
            'CSRF': CSRFScanner(),
            'SESSION': SessionScanner(),
            'IDOR': IDORScanner(),
            'CONFIGURATION': MisconfigScanner(),
            'AUTHENTICATION': MisconfigScanner(),
            'AUTHORIZATION': MisconfigScanner(),
            'CRYPTOGRAPHY': MisconfigScanner(),
            'OPEN_REDIRECT': MisconfigScanner(),
            'PATH_TRAVERSAL': InjectionScanner(),
            'SSRF': InjectionScanner(),
        }

        # Directory-level scanner map
        directory_scanner_map = {
            'CODE_QUALITY': [SemgrepScanner(), BanditScanner()],
            'DEPENDENCY': [DependencyScanner()],
        }

        # Get selected scanners - for CUSTOM scan type, use the selected scanners list
        selected = self.request.scanners if self.request.scan_type == 'CUSTOM' and self.request.scanners else None

        if selected:
            # Custom scan - only use selected scanners
            used_scanners = set()
            self.scanners = []
            for category in selected:
                if category in scanner_map:
                    scanner = scanner_map[category]
                    # Avoid duplicates (e.g., InjectionScanner for multiple categories)
                    scanner_type = type(scanner).__name__
                    if scanner_type not in used_scanners:
                        self.scanners.append(scanner)
                        used_scanners.add(scanner_type)

            # Directory scanners for custom scan
            self.directory_scanners = []
            for category in selected:
                if category in directory_scanner_map:
                    for scanner in directory_scanner_map[category]:
                        scanner_type = type(scanner).__name__
                        if scanner_type not in used_scanners:
                            self.directory_scanners.append(scanner)
                            used_scanners.add(scanner_type)
        else:
            # FULL or QUICK scan - use all scanners
            self.scanners = [
                XSSScanner(),
                InjectionScanner(),
                SecretsScanner(),
                CSRFScanner(),
                SessionScanner(),
                IDORScanner(),
                MisconfigScanner(),
            ]

            # Directory-level scanners (run once on entire directory)
            self.directory_scanners = [
                SemgrepScanner(),
                BanditScanner(),
                DependencyScanner(),
            ]

        logger.info(
            'Scanners initialized',
            scan_type=self.request.scan_type,
            file_scanners=[type(s).__name__ for s in self.scanners],
            directory_scanners=[type(s).__name__ for s in self.directory_scanners]
        )

    def scan(self) -> ScanResult:
        """Execute the security scan"""
        result = ScanResult(
            scan_id=self.request.scan_id,
            status='RUNNING',
            started_at=datetime.utcnow()
        )

        try:
            # Clone repository
            self.temp_dir = self._clone_repository()
            if not self.temp_dir:
                result.status = 'FAILED'
                result.error_message = 'Failed to clone repository'
                return result

            # Get files to scan
            files = self._get_files_to_scan()
            result.total_files = len(files)

            logger.info('Starting security scan',
                       scan_id=self.request.scan_id,
                       total_files=len(files))

            # Run directory-level scanners first (professional tools)
            # These provide more accurate results with lower false positives
            professional_vulns: List[Vulnerability] = []
            for scanner in self.directory_scanners:
                try:
                    vulns = scanner.scan_directory(self.temp_dir)
                    professional_vulns.extend(vulns)
                    logger.info('Directory scanner completed',
                               scanner=scanner.name,
                               findings=len(vulns))
                except Exception as e:
                    logger.warning('Directory scanner error',
                                  scanner=scanner.name,
                                  error=str(e))

            # Run file-level scanners (regex-based)
            regex_vulns: List[Vulnerability] = []
            for i, file_path in enumerate(files):
                try:
                    file_vulns = self._scan_file(file_path)
                    regex_vulns.extend(file_vulns)
                    result.files_scanned = i + 1
                except Exception as e:
                    logger.warning('Error scanning file',
                                  file=file_path,
                                  error=str(e))

            # Deduplicate: prefer professional tool findings over regex findings
            vulnerabilities = self._deduplicate_vulnerabilities(
                professional_vulns, regex_vulns
            )

            result.vulnerabilities = vulnerabilities
            result.status = 'COMPLETED'
            result.completed_at = datetime.utcnow()

            logger.info('Scan completed',
                       scan_id=self.request.scan_id,
                       professional_findings=len(professional_vulns),
                       regex_findings=len(regex_vulns),
                       final_findings=len(vulnerabilities))

        except Exception as e:
            logger.error('Scan failed', error=str(e))
            result.status = 'FAILED'
            result.error_message = str(e)
            result.completed_at = datetime.utcnow()

        finally:
            self._cleanup()

        return result

    def _deduplicate_vulnerabilities(
        self,
        professional_vulns: List[Vulnerability],
        regex_vulns: List[Vulnerability]
    ) -> List[Vulnerability]:
        """
        Deduplicate vulnerabilities, preferring professional tool findings.
        If a professional tool found the same issue, skip the regex finding.
        """
        # Track what professional tools already found
        found_issues: Set[Tuple[str, int, str]] = set()
        for vuln in professional_vulns:
            # Create a key based on file, line, and category
            key = (vuln.file_path, vuln.start_line, vuln.category.value)
            found_issues.add(key)

        # Also track by file + broader line range for overlap detection
        found_ranges: Set[Tuple[str, str]] = set()
        for vuln in professional_vulns:
            # Key by file and category for broader matching
            key = (vuln.file_path, vuln.category.value)
            found_ranges.add(key)

        # Filter regex findings
        filtered_regex: List[Vulnerability] = []
        for vuln in regex_vulns:
            key = (vuln.file_path, vuln.start_line, vuln.category.value)
            range_key = (vuln.file_path, vuln.category.value)

            # Skip if professional tool already found same location
            if key in found_issues:
                logger.debug('Skipping duplicate (exact match)',
                            file=vuln.file_path, line=vuln.start_line)
                continue

            # Get confidence (default to 0.7 if None)
            confidence = vuln.fix_confidence if vuln.fix_confidence is not None else 0.7

            # For high-confidence regex findings (secrets), keep them
            # even if file/category overlaps
            if confidence >= 0.95:
                filtered_regex.append(vuln)
                continue

            # For lower confidence regex findings, skip if professional
            # tool already scanned that file+category
            if range_key in found_ranges and confidence < 0.85:
                logger.debug('Skipping low-confidence duplicate',
                            file=vuln.file_path, category=vuln.category.value)
                continue

            filtered_regex.append(vuln)

        # Combine: professional findings first, then filtered regex
        all_vulns = professional_vulns + filtered_regex

        # Sort by severity (most critical first) then by file
        severity_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'INFO': 4}
        all_vulns.sort(key=lambda v: (
            severity_order.get(v.severity.value, 5),
            v.file_path,
            v.start_line
        ))

        return all_vulns

    def _clone_repository(self) -> Optional[str]:
        """Clone the repository to a temporary directory"""
        try:
            temp_dir = tempfile.mkdtemp(prefix='gitscan_')

            # Prepare clone URL with token if provided
            clone_url = self.request.clone_url
            if self.request.access_token:
                # Insert token into HTTPS URL
                if clone_url.startswith('https://'):
                    clone_url = clone_url.replace(
                        'https://',
                        f'https://x-access-token:{self.request.access_token}@'
                    )

            logger.info('Cloning repository',
                       branch=self.request.branch,
                       temp_dir=temp_dir)

            Repo.clone_from(
                clone_url,
                temp_dir,
                branch=self.request.branch,
                depth=1,  # Shallow clone
                single_branch=True
            )

            return temp_dir

        except GitError as e:
            logger.error('Git clone failed', error=str(e))
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            return None

    def _get_files_to_scan(self) -> List[str]:
        """Get list of files to scan"""
        if not self.temp_dir:
            return []

        files = []
        base_path = Path(self.temp_dir)

        for path in base_path.rglob('*'):
            if not path.is_file():
                continue

            # Check if in excluded directory
            parts = path.relative_to(base_path).parts
            if any(part in self.EXCLUDED_DIRS for part in parts):
                continue

            # Check file extension
            if path.suffix.lower() not in self.SCANNABLE_EXTENSIONS:
                continue

            # Check file size
            if path.stat().st_size > Config.MAX_FILE_SIZE_MB * 1024 * 1024:
                continue

            files.append(str(path))

            # Limit number of files
            if len(files) >= Config.MAX_FILES_PER_SCAN:
                logger.warning('File limit reached',
                              limit=Config.MAX_FILES_PER_SCAN)
                break

        return files

    def _scan_file(self, file_path: str) -> List[Vulnerability]:
        """Scan a single file with all scanners"""
        vulnerabilities = []

        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            # Get relative path for reporting
            rel_path = os.path.relpath(file_path, self.temp_dir)

            # Run each scanner
            for scanner in self.scanners:
                try:
                    vulns = scanner.scan(content, rel_path)
                    vulnerabilities.extend(vulns)
                except Exception as e:
                    logger.warning('Scanner error',
                                  scanner=scanner.__class__.__name__,
                                  file=rel_path,
                                  error=str(e))

        except Exception as e:
            logger.warning('Failed to read file',
                          file=file_path,
                          error=str(e))

        return vulnerabilities

    def _cleanup(self):
        """Clean up temporary files"""
        if self.temp_dir and os.path.exists(self.temp_dir):
            try:
                shutil.rmtree(self.temp_dir)
                logger.debug('Cleaned up temp directory', dir=self.temp_dir)
            except Exception as e:
                logger.warning('Failed to cleanup', error=str(e))

"""
Data models for the Scanner Service
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime


class Severity(Enum):
    """Vulnerability severity levels"""
    CRITICAL = 'CRITICAL'
    HIGH = 'HIGH'
    MEDIUM = 'MEDIUM'
    LOW = 'LOW'
    INFO = 'INFO'


class VulnerabilityCategory(Enum):
    """Vulnerability categories"""
    XSS = 'XSS'
    SQL_INJECTION = 'SQL_INJECTION'
    COMMAND_INJECTION = 'COMMAND_INJECTION'
    PATH_TRAVERSAL = 'PATH_TRAVERSAL'
    SSRF = 'SSRF'
    XXE = 'XXE'
    DESERIALIZATION = 'DESERIALIZATION'
    AUTHENTICATION = 'AUTHENTICATION'
    AUTHORIZATION = 'AUTHORIZATION'
    CRYPTOGRAPHY = 'CRYPTOGRAPHY'
    SECRETS_EXPOSURE = 'SECRETS_EXPOSURE'
    DEPENDENCY = 'DEPENDENCY'
    CONFIGURATION = 'CONFIGURATION'
    CODE_QUALITY = 'CODE_QUALITY'
    CSRF = 'CSRF'
    SESSION = 'SESSION'
    IDOR = 'IDOR'
    MASS_ASSIGNMENT = 'MASS_ASSIGNMENT'
    OPEN_REDIRECT = 'OPEN_REDIRECT'
    OTHER = 'OTHER'


@dataclass
class ScanRequest:
    """Scan request model"""
    scan_id: str
    clone_url: str
    branch: str = 'main'
    access_token: Optional[str] = None
    scan_type: str = 'FULL'
    file_patterns: Optional[List[str]] = None
    exclude_patterns: Optional[List[str]] = None
    scanners: Optional[List[str]] = None  # For CUSTOM scan type - list of scanner categories to use


@dataclass
class Vulnerability:
    """Vulnerability finding model"""
    title: str
    description: str
    severity: Severity
    category: VulnerabilityCategory
    file_path: str
    start_line: int
    end_line: int
    code_snippet: Optional[str] = None
    cwe_id: Optional[str] = None
    cve_id: Optional[str] = None
    suggested_fix: Optional[str] = None
    fix_confidence: Optional[float] = None
    auto_fix_available: bool = False
    rule_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'title': self.title,
            'description': self.description,
            'severity': self.severity.value,
            'category': self.category.value,
            'file_path': self.file_path,
            'start_line': self.start_line,
            'end_line': self.end_line,
            'code_snippet': self.code_snippet,
            'cwe_id': self.cwe_id,
            'cve_id': self.cve_id,
            'suggested_fix': self.suggested_fix,
            'fix_confidence': self.fix_confidence,
            'auto_fix_available': self.auto_fix_available,
            'rule_id': self.rule_id
        }


@dataclass
class ScanResult:
    """Scan result model"""
    scan_id: str
    status: str
    total_files: int = 0
    files_scanned: int = 0
    vulnerabilities: List[Vulnerability] = field(default_factory=list)
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    @property
    def critical_count(self) -> int:
        return sum(1 for v in self.vulnerabilities if v.severity == Severity.CRITICAL)

    @property
    def high_count(self) -> int:
        return sum(1 for v in self.vulnerabilities if v.severity == Severity.HIGH)

    @property
    def medium_count(self) -> int:
        return sum(1 for v in self.vulnerabilities if v.severity == Severity.MEDIUM)

    @property
    def low_count(self) -> int:
        return sum(1 for v in self.vulnerabilities if v.severity == Severity.LOW)

    @property
    def info_count(self) -> int:
        return sum(1 for v in self.vulnerabilities if v.severity == Severity.INFO)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'scan_id': self.scan_id,
            'status': self.status,
            'total_files': self.total_files,
            'files_scanned': self.files_scanned,
            'vulnerabilities': [v.to_dict() for v in self.vulnerabilities],
            'summary': {
                'critical': self.critical_count,
                'high': self.high_count,
                'medium': self.medium_count,
                'low': self.low_count,
                'info': self.info_count,
                'total': len(self.vulnerabilities)
            },
            'error_message': self.error_message,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }

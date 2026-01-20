"""
Base Scanner - Abstract base class for all security scanners
"""

from abc import ABC, abstractmethod
from typing import List

from ..models import Vulnerability


class BaseScanner(ABC):
    """Abstract base class for security scanners"""

    @property
    @abstractmethod
    def name(self) -> str:
        """Scanner name"""
        pass

    @abstractmethod
    def scan(self, content: str, file_path: str) -> List[Vulnerability]:
        """
        Scan file content for vulnerabilities

        Args:
            content: The file content to scan
            file_path: Relative path of the file

        Returns:
            List of vulnerabilities found
        """
        pass

    def _get_line_number(self, content: str, position: int) -> int:
        """Get line number from character position"""
        return content[:position].count('\n') + 1

    def _get_code_snippet(self, content: str, start_line: int, end_line: int,
                          context_lines: int = 2) -> str:
        """Extract code snippet with context"""
        lines = content.split('\n')
        start = max(0, start_line - context_lines - 1)
        end = min(len(lines), end_line + context_lines)
        return '\n'.join(lines[start:end])

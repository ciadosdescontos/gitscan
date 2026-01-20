"""
API Routes for Scanner Service
"""

from flask import Blueprint, jsonify, request
import structlog

from .scanners.security_scanner import SecurityScanner
from .models import ScanRequest, ScanResult

logger = structlog.get_logger()

# Health check blueprint
health_bp = Blueprint('health', __name__)

# Scanner blueprint
scanner_bp = Blueprint('scanner', __name__)


@health_bp.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'scanner',
        'version': '1.0.0'
    })


@scanner_bp.route('/scan', methods=['POST'])
def start_scan():
    """
    Start a new security scan

    Expected payload:
    {
        "scan_id": "uuid",
        "repository": {
            "clone_url": "https://github.com/user/repo.git",
            "branch": "main",
            "access_token": "github_token"
        },
        "options": {
            "scan_type": "FULL",
            "file_patterns": ["*.js", "*.py"],
            "exclude_patterns": ["node_modules", "venv"]
        }
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        scan_request = ScanRequest(
            scan_id=data.get('scan_id'),
            clone_url=data['repository']['clone_url'],
            branch=data['repository'].get('branch', 'main'),
            access_token=data['repository'].get('access_token'),
            scan_type=data.get('options', {}).get('scan_type', 'FULL'),
            file_patterns=data.get('options', {}).get('file_patterns'),
            exclude_patterns=data.get('options', {}).get('exclude_patterns')
        )

        logger.info('Starting scan', scan_id=scan_request.scan_id)

        # Create scanner and run scan
        scanner = SecurityScanner(scan_request)
        result = scanner.scan()

        return jsonify(result.to_dict()), 200

    except KeyError as e:
        logger.error('Missing required field', field=str(e))
        return jsonify({'error': f'Missing required field: {e}'}), 400
    except Exception as e:
        logger.error('Scan failed', error=str(e))
        return jsonify({'error': str(e)}), 500


@scanner_bp.route('/scan/<scan_id>/status', methods=['GET'])
def get_scan_status(scan_id: str):
    """Get the status of an ongoing scan"""
    # TODO: Implement status tracking with Redis
    return jsonify({
        'scan_id': scan_id,
        'status': 'unknown',
        'message': 'Status tracking not yet implemented'
    })


@scanner_bp.route('/scan/<scan_id>/cancel', methods=['POST'])
def cancel_scan(scan_id: str):
    """Cancel an ongoing scan"""
    # TODO: Implement scan cancellation
    logger.info('Cancelling scan', scan_id=scan_id)
    return jsonify({
        'scan_id': scan_id,
        'status': 'cancelled'
    })


@scanner_bp.route('/rules', methods=['GET'])
def list_rules():
    """List available scanning rules"""
    rules = {
        'categories': [
            {
                'id': 'xss',
                'name': 'Cross-Site Scripting (XSS)',
                'description': 'Detect potential XSS vulnerabilities'
            },
            {
                'id': 'sql_injection',
                'name': 'SQL Injection',
                'description': 'Detect SQL injection vulnerabilities'
            },
            {
                'id': 'command_injection',
                'name': 'Command Injection',
                'description': 'Detect command injection vulnerabilities'
            },
            {
                'id': 'secrets',
                'name': 'Secrets Exposure',
                'description': 'Detect hardcoded secrets and API keys'
            },
            {
                'id': 'authentication',
                'name': 'Authentication Issues',
                'description': 'Detect authentication-related vulnerabilities'
            },
            {
                'id': 'cryptography',
                'name': 'Cryptography Issues',
                'description': 'Detect weak or insecure cryptographic implementations'
            }
        ],
        'supported_languages': [
            'javascript', 'typescript', 'python', 'java',
            'go', 'ruby', 'php', 'csharp'
        ]
    }
    return jsonify(rules)

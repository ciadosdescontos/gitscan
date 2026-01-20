"""
GitScan Security Scanner Service
Main Flask application
"""

import os
from flask import Flask, jsonify, request
from flask_cors import CORS
import structlog

from .config import Config
from .scanners.security_scanner import SecurityScanner
from .utils.logger import setup_logging

# Setup structured logging
setup_logging()
logger = structlog.get_logger()

def create_app(config_class=Config):
    """Application factory"""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Enable CORS
    CORS(app, origins=app.config.get('CORS_ORIGINS', '*'))

    # Register blueprints
    from .routes import scanner_bp, health_bp
    from .routes_llm import llm_bp
    app.register_blueprint(health_bp)
    app.register_blueprint(scanner_bp, url_prefix='/api/scanner')
    app.register_blueprint(llm_bp, url_prefix='/api/llm')

    # Error handlers
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'error': 'Bad request', 'message': str(error)}), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        logger.error('Internal server error', error=str(error))
        return jsonify({'error': 'Internal server error'}), 500

    logger.info('Scanner service initialized', version='1.0.0')

    return app

# Create app instance
app = create_app()

if __name__ == '__main__':
    import os
    # Only for local development - Docker uses 'flask run' command
    debug_mode = os.environ.get('FLASK_ENV', 'development') == 'development'
    port = int(os.environ.get('PORT', 5000))
    # host='0.0.0.0' is required for Docker container networking
    app.run(debug=debug_mode, host='0.0.0.0', port=port)

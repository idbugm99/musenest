#!/usr/bin/env python3
"""
Simple test server to check external IP access
"""

from flask import Flask, jsonify
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

@app.route('/', methods=['GET'])
def home():
    """Home page"""
    return jsonify({
        'message': 'Simple test server is working!',
        'status': 'success',
        'external_ip': '18.221.22.72',
        'port': 5000
    })

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'message': 'Test server running on external IP',
        'version': 'test_1.0'
    })

@app.route('/test', methods=['GET'])
def test():
    """Test endpoint"""
    return jsonify({
        'test': 'passed',
        'external_access': 'working',
        'ip': '18.221.22.72:5000'
    })

if __name__ == '__main__':
    logger.info("🚀 Starting Simple Test Server")
    logger.info("📍 Testing external IP access: 18.221.22.72:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
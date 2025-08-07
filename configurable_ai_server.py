#!/usr/bin/env python3
"""
Configurable AI Server v1.0
Remote configuration support for detection components without external dependencies
"""

import json
import os
from flask import Flask, request, jsonify
import logging
from typing import Dict, List, Tuple, Optional
import traceback
import tempfile
import random
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

class ConfigurableAnalysisComponents:
    """Manages configurable detection components"""
    
    def __init__(self):
        self.default_config = {
            'nudenet_components': {
                'breast_detection': True,
                'genitalia_detection': True,
                'buttocks_detection': True,
                'anus_detection': True,
                'face_detection': True
            },
            'blip_components': {
                'age_estimation': True,
                'child_content_detection': True,
                'image_description': True
            },
            'risk_thresholds': {
                'child_keywords': ['child', 'kid', 'baby', 'toddler', 'minor', 'young', 'teen'],
                'age_threshold': 18
            }
        }
        
        # In-memory configuration storage (could be replaced with database)
        self.active_config = self.default_config.copy()
        
    def parse_request_config(self, request_form) -> Dict:
        """Parse configuration from request parameters"""
        config = {
            'nudenet_components': {
                'breast_detection': request_form.get('enable_breast_detection', 'true').lower() == 'true',
                'genitalia_detection': request_form.get('enable_genitalia_detection', 'true').lower() == 'true',
                'buttocks_detection': request_form.get('enable_buttocks_detection', 'true').lower() == 'true',
                'anus_detection': request_form.get('enable_anus_detection', 'true').lower() == 'true',
                'face_detection': request_form.get('enable_face_detection', 'true').lower() == 'true'
            },
            'blip_components': {
                'age_estimation': request_form.get('enable_age_estimation', 'true').lower() == 'true',
                'child_content_detection': request_form.get('enable_child_detection', 'true').lower() == 'true',
                'image_description': request_form.get('enable_image_description', 'true').lower() == 'true'
            }
        }
        
        logger.info(f"📊 Parsed configuration from request:")
        logger.info(f"  NudeNet: breast={config['nudenet_components']['breast_detection']}, "
                   f"genitalia={config['nudenet_components']['genitalia_detection']}, "
                   f"face={config['nudenet_components']['face_detection']}")
        logger.info(f"  BLIP: age={config['blip_components']['age_estimation']}, "
                   f"child={config['blip_components']['child_content_detection']}, "
                   f"desc={config['blip_components']['image_description']}")
        
        return config
    
    def filter_detection_results(self, simulated_detections: Dict, config: Dict) -> Dict:
        """Filter simulated detection results based on configuration"""
        enabled_components = config.get('nudenet_components', {})
        filtered_parts = {}
        filtered_locations = {}
        
        # Simulate filtering based on configuration
        detection_mapping = {
            'BREAST_EXPOSED': 'breast_detection',
            'GENITALIA': 'genitalia_detection',
            'BUTTOCKS_EXPOSED': 'buttocks_detection',
            'ANUS_EXPOSED': 'anus_detection',
            'FACE_DETECTED': 'face_detection'
        }
        
        original_parts = simulated_detections.get('detected_parts', {})
        original_locations = simulated_detections.get('part_locations', {})
        
        for part_name, confidence in original_parts.items():
            config_key = detection_mapping.get(part_name)
            
            if config_key and not enabled_components.get(config_key, True):
                logger.info(f"🚫 Filtered out {part_name} (disabled in config)")
                continue
                
            filtered_parts[part_name] = confidence
            if part_name in original_locations:
                filtered_locations[part_name] = original_locations[part_name]
        
        logger.info(f"📊 Filtered detections: {len(original_parts)} → {len(filtered_parts)}")
        
        return {
            'detected_parts': filtered_parts,
            'part_locations': filtered_locations,
            'nudity_score': max(filtered_parts.values()) if filtered_parts else 0,
            'has_nudity': len(filtered_parts) > 0 and max(filtered_parts.values()) > 30
        }


class ConfigurableAIServer:
    def __init__(self):
        """Initialize configurable AI server"""
        try:
            logger.info("🚀 Initializing Configurable AI Server v1.0...")
            
            # Initialize configuration manager
            self.config_manager = ConfigurableAnalysisComponents()
            
            logger.info("✅ Configurable AI Server initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize: {e}")
            raise

    def analyze_image(self, image_path: str, context_type: str = 'public_gallery', 
                     model_id: int = 1, config: Dict = None) -> Dict:
        """
        Configurable analysis with simulated detection that respects configuration
        """
        try:
            logger.info(f"🔍 Starting configurable analysis for: {os.path.basename(image_path)}")
            
            # Use provided config or default
            if config is None:
                config = self.config_manager.default_config
            
            analysis_results = {
                'success': True,
                'metadata': {
                    'analysis_version': '1.0_configurable_simulation',
                    'timestamp': datetime.now().isoformat(),
                    'context_type': context_type,
                    'model_id': model_id,
                    'configuration_used': config
                }
            }
            
            # 1. Simulated NudeNet Analysis (respects configuration)
            logger.info("🔍 Running simulated NudeNet detection...")
            nudenet_results = self.simulate_nudenet_analysis(config)
            analysis_results['nudity_detection'] = nudenet_results
            
            # 2. Face Analysis (simulated)
            if config.get('nudenet_components', {}).get('face_detection', True):
                logger.info("👤 Running simulated face analysis...")
                face_results = self.simulate_face_analysis()
                analysis_results['face_analysis'] = face_results
            else:
                logger.info("⚠️ Face detection disabled - skipping")
                analysis_results['face_analysis'] = {
                    'faces_detected': False,
                    'face_count': 0,
                    'analysis_skipped': 'face_detection_disabled'
                }
            
            # 3. Image Description (simulated)
            if config.get('blip_components', {}).get('image_description', True):
                logger.info("📝 Running simulated image description...")
                description_results = self.simulate_image_description()
                analysis_results['image_description'] = description_results
            else:
                logger.info("⚠️ Image description disabled - skipping")
                analysis_results['image_description'] = {
                    'description': 'Image description disabled',
                    'tags': [],
                    'generation_method': 'disabled_by_config'
                }
            
            # 4. Child Content Analysis (if enabled)
            if config.get('blip_components', {}).get('child_content_detection', True):
                logger.info("🛡️ Running child content analysis...")
                child_results = self.analyze_child_content(
                    analysis_results.get('image_description', {}),
                    analysis_results.get('face_analysis', {}),
                    config
                )
                analysis_results['child_analysis'] = child_results
            else:
                logger.info("⚠️ Child content detection disabled - skipping")
                analysis_results['child_analysis'] = {
                    'contains_children': False,
                    'child_keywords_found': [],
                    'analysis_skipped': 'child_detection_disabled'
                }
            
            # 5. Enhanced Risk Assessment
            logger.info("⚖️ Computing enhanced risk assessment...")
            risk_results = self.compute_enhanced_risk_assessment(analysis_results, config)
            analysis_results['combined_assessment'] = risk_results
            
            # 6. Moderation Decision
            moderation_decision = self.make_moderation_decision(analysis_results, config)
            analysis_results['moderation_decision'] = moderation_decision
            
            logger.info(f"✅ Configurable analysis complete: {analysis_results.get('combined_assessment', {}).get('risk_level', 'unknown')} risk")
            return analysis_results
            
        except Exception as e:
            logger.error(f"❌ Analysis failed: {e}")
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e),
                'analysis_version': '1.0_configurable_error',
                'timestamp': datetime.now().isoformat()
            }

    def simulate_nudenet_analysis(self, config: Dict) -> Dict:
        """Simulate NudeNet analysis that respects configuration"""
        try:
            # Simulate full detection results
            simulated_full_results = {
                'BREAST_EXPOSED': random.uniform(20, 80),
                'GENITALIA': random.uniform(10, 60),  
                'BUTTOCKS_EXPOSED': random.uniform(15, 50),
                'ANUS_EXPOSED': random.uniform(5, 30),
                'FACE_DETECTED': random.uniform(70, 95)
            }
            
            # Simulate locations
            simulated_locations = {}
            for part_name, confidence in simulated_full_results.items():
                simulated_locations[part_name] = {
                    'x': random.randint(50, 200),
                    'y': random.randint(50, 200),
                    'width': random.randint(50, 150),
                    'height': random.randint(50, 150),
                    'confidence': confidence
                }
            
            # Apply configuration filtering
            simulated_detection = {
                'detected_parts': simulated_full_results,
                'part_locations': simulated_locations
            }
            
            filtered_results = self.config_manager.filter_detection_results(simulated_detection, config)
            
            return {
                **filtered_results,
                'raw_detection_count': len(simulated_full_results),
                'filtered_detection_count': len(filtered_results['detected_parts']),
                'configuration_applied': True,
                'simulation_note': 'Simulated NudeNet with configuration filtering'
            }
            
        except Exception as e:
            logger.error(f"❌ Simulated NudeNet analysis failed: {e}")
            return {
                'detected_parts': {'ANALYSIS_ERROR': 95.0},
                'part_locations': {},
                'nudity_score': 95.0,
                'has_nudity': True,
                'error': str(e)
            }

    def simulate_face_analysis(self) -> Dict:
        """Simulate face analysis"""
        faces_detected = random.choice([True, False])
        face_count = random.randint(1, 3) if faces_detected else 0
        
        return {
            'faces_detected': faces_detected,
            'face_count': face_count,
            'min_age': random.randint(20, 45) if faces_detected else None,
            'max_age': random.randint(25, 55) if faces_detected else None,
            'underage_detected': False,  # Always false in simulation
            'simulation_note': 'Simulated face analysis - not real detection'
        }

    def simulate_image_description(self) -> Dict:
        """Simulate image description"""
        descriptions = [
            'A person in casual clothing',
            'Professional photo shoot setting',
            'Portrait photography style',
            'Fashion or lifestyle content',
            'Studio photography setup'
        ]
        
        description = random.choice(descriptions)
        tags = description.lower().split()[:3]
        
        return {
            'description': description,
            'tags': tags,
            'generation_method': 'simulated_description'
        }

    def analyze_child_content(self, image_description: Dict, face_analysis: Dict, config: Dict) -> Dict:
        """Analyze for child-related content"""
        child_keywords = config.get('risk_thresholds', {}).get('child_keywords', [])
        description_text = image_description.get('description', '').lower()
        
        # Check for child keywords in description
        found_keywords = [keyword for keyword in child_keywords 
                         if keyword in description_text]
        
        # Check age from face analysis
        min_age = face_analysis.get('min_age')
        age_threshold = config.get('risk_thresholds', {}).get('age_threshold', 18)
        underage_detected = min_age is not None and min_age < age_threshold
        
        contains_children = len(found_keywords) > 0 or underage_detected
        
        return {
            'contains_children': contains_children,
            'child_keywords_found': found_keywords,
            'underage_detected': underage_detected,
            'min_detected_age': min_age,
            'age_threshold_used': age_threshold
        }

    def compute_enhanced_risk_assessment(self, analysis_results: Dict, config: Dict) -> Dict:
        """Compute enhanced risk assessment based on all analysis components"""
        try:
            nudity_score = analysis_results.get('nudity_detection', {}).get('nudity_score', 0)
            child_analysis = analysis_results.get('child_analysis', {})
            
            # Base risk from nudity
            base_risk = nudity_score
            
            # Child content multiplier
            if child_analysis.get('contains_children', False):
                base_risk *= 2.0  # Double the risk for child content
            
            if child_analysis.get('underage_detected', False):
                base_risk *= 3.0  # Triple the risk for underage detection
            
            # Cap at 100
            final_risk = min(100.0, base_risk)
            
            # Determine risk level
            if final_risk >= 80:
                risk_level = 'critical'
            elif final_risk >= 60:
                risk_level = 'high'
            elif final_risk >= 40:
                risk_level = 'medium'
            elif final_risk >= 20:
                risk_level = 'low'
            else:
                risk_level = 'minimal'
            
            return {
                'final_risk_score': final_risk,
                'risk_level': risk_level,
                'base_nudity_score': nudity_score,
                'child_content_multiplier_applied': child_analysis.get('contains_children', False),
                'reasoning': self._generate_risk_reasoning(analysis_results, config)
            }
            
        except Exception as e:
            logger.error(f"❌ Risk assessment failed: {e}")
            return {
                'final_risk_score': 95.0,
                'risk_level': 'critical',
                'error': str(e)
            }

    def _generate_risk_reasoning(self, analysis_results: Dict, config: Dict) -> List[str]:
        """Generate human-readable reasoning for risk assessment"""
        reasoning = []
        
        nudity_detection = analysis_results.get('nudity_detection', {})
        if nudity_detection.get('has_nudity'):
            detected_parts = list(nudity_detection.get('detected_parts', {}).keys())
            reasoning.append(f"nudity_detected: {', '.join(detected_parts)}")
        
        child_analysis = analysis_results.get('child_analysis', {})
        if child_analysis.get('contains_children'):
            reasoning.append('child_content_detected')
        
        if child_analysis.get('underage_detected'):
            reasoning.append('underage_faces_detected')
        
        # Add configuration info
        disabled_components = []
        nudenet_components = config.get('nudenet_components', {})
        for component, enabled in nudenet_components.items():
            if not enabled:
                disabled_components.append(component)
        
        if disabled_components:
            reasoning.append(f"components_disabled: {', '.join(disabled_components)}")
        
        return reasoning if reasoning else ['clean_content']

    def make_moderation_decision(self, analysis_results: Dict, config: Dict) -> Dict:
        """Make final moderation decision"""
        risk_score = analysis_results.get('combined_assessment', {}).get('final_risk_score', 0)
        child_detected = analysis_results.get('child_analysis', {}).get('contains_children', False)
        
        # Always flag child content regardless of other factors
        if child_detected:
            return {
                'status': 'flagged_for_review',
                'action': 'require_human_review',
                'human_review_required': True,
                'reason': 'child_content_detected'
            }
        
        # Risk-based decisions
        if risk_score >= 80:
            return {
                'status': 'auto_rejected',
                'action': 'reject',
                'human_review_required': False,
                'reason': f'high_risk_score_{risk_score}'
            }
        elif risk_score >= 40:
            return {
                'status': 'flagged_for_review',
                'action': 'require_human_review',
                'human_review_required': True,
                'reason': f'moderate_risk_score_{risk_score}'
            }
        else:
            return {
                'status': 'auto_approved',
                'action': 'approve',
                'human_review_required': False,
                'reason': f'low_risk_score_{risk_score}'
            }

# Global instance
api = ConfigurableAIServer()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint with configuration status"""
    return jsonify({
        'status': 'healthy',
        'version': '1.0_configurable_simulation',
        'message': 'Configurable AI Server v1.0 with Component Filtering',
        'blip_available': False,  # Simulation mode
        'device': 'cpu',
        'features': [
            'configurable_nudenet_components',
            'configurable_blip_components', 
            'component_filtering',
            'enhanced_risk_assessment',
            'child_content_detection',
            'remote_configuration_api'
        ],
        'pipeline_stages': [
            'request_config_parsing',
            'configurable_nudity_simulation',
            'simulated_face_analysis',
            'optional_description_simulation',
            'optional_child_analysis',
            'enhanced_risk_assessment'
        ]
    })

@app.route('/analyze', methods=['POST'])  
def analyze_image_endpoint():
    """Main image analysis endpoint with configuration support"""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file provided'}), 400
        
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'success': False, 'error': 'Empty filename'}), 400
        
        # Get basic parameters
        context_type = request.form.get('context_type', 'public_gallery')
        model_id = int(request.form.get('model_id', 1))
        
        # Parse configuration from request (THE KEY FEATURE!)
        config = api.config_manager.parse_request_config(request.form)
        
        logger.info(f"📊 Received analysis request:")
        logger.info(f"  Context: {context_type}, Model: {model_id}")
        logger.info(f"  Config version: {request.form.get('config_version', 'not_specified')}")
        
        # Save uploaded file temporarily
        temp_fd, temp_path = tempfile.mkstemp(suffix='.jpg')
        os.close(temp_fd)
        image_file.save(temp_path)
        
        try:
            # Analyze the image with configuration
            result = api.analyze_image(temp_path, context_type, model_id, config)
            return jsonify(result)
        finally:
            # Clean up
            try:
                os.unlink(temp_path)
            except:
                pass
                
    except Exception as e:
        logger.error(f"API endpoint error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'analysis_version': '1.0_configurable_error'
        }), 500

@app.route('/config', methods=['GET'])
def get_current_config():
    """Get current active configuration"""
    return jsonify({
        'success': True,
        'active_config': api.config_manager.active_config,
        'default_config': api.config_manager.default_config
    })

@app.route('/config', methods=['POST'])
def update_config():
    """Update active configuration"""
    try:
        new_config = request.json
        if not new_config:
            return jsonify({'success': False, 'error': 'No configuration provided'}), 400
        
        # Validate and update configuration
        api.config_manager.active_config = new_config
        
        logger.info(f"📊 Configuration updated via API")
        return jsonify({
            'success': True,
            'message': 'Configuration updated',
            'active_config': api.config_manager.active_config
        })
        
    except Exception as e:
        logger.error(f"Config update error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/config/<usage_intent>', methods=['GET'])
def get_config_by_usage_intent(usage_intent):
    """Get configuration for specific usage intent (MuseNest compatibility)"""
    return jsonify({
        'success': True,
        'usage_intent': usage_intent,
        'active_config': api.config_manager.active_config,
        'default_config': api.config_manager.default_config,
        'note': 'AI server uses request-based configuration, not stored per usage_intent'
    })

@app.route('/api-keys', methods=['GET'])
def get_api_keys():
    """API keys endpoint (MuseNest compatibility)"""
    return jsonify({
        'success': True,
        'message': 'AI server uses request-based configuration',
        'api_keys_location': 'handled_by_musenest_server',
        'note': 'Configuration is sent with each /analyze request'
    })

@app.route('/configuration', methods=['GET'])
def get_configuration():
    """Configuration endpoint (MuseNest compatibility)"""
    return jsonify({
        'success': True,
        'active_config': api.config_manager.active_config,
        'default_config': api.config_manager.default_config,
        'configuration_method': 'request_based_parameters'
    })

if __name__ == '__main__':
    logger.info("🚀 Starting Configurable AI Server v1.0")
    app.run(host='0.0.0.0', port=5000, debug=False)
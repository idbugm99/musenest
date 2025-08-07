#!/usr/bin/env python3
"""
Enhanced Minimal v4.0 - Configurable Analysis Components
Adds remote configuration support for detection components
"""

import cv2
import numpy as np
import json
import os
from flask import Flask, request, jsonify
from nudenet import NudeDetector
import logging
from typing import Dict, List, Tuple, Optional
import traceback
from PIL import Image, ExifTags
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
    
    def filter_nudenet_results(self, detections: List[Dict], config: Dict) -> List[Dict]:
        """Filter NudeNet detection results based on configuration"""
        if not detections:
            return detections
            
        enabled_components = config.get('nudenet_components', {})
        filtered_detections = []
        
        # Mapping from NudeNet class names to config keys
        class_mapping = {
            'BREAST_EXPOSED': 'breast_detection',
            'GENITALIA': 'genitalia_detection',
            'BUTTOCKS_EXPOSED': 'buttocks_detection',
            'ANUS_EXPOSED': 'anus_detection',
            'FACE_COVERED': 'face_detection',
            'FACE_FEMALE': 'face_detection',
            'FACE_MALE': 'face_detection'
        }
        
        for detection in detections:
            class_name = detection.get('class', '').upper()
            config_key = class_mapping.get(class_name)
            
            if config_key is None:
                # Unknown class, include by default
                filtered_detections.append(detection)
                continue
                
            if enabled_components.get(config_key, True):
                # Component is enabled, include detection
                filtered_detections.append(detection)
            else:
                # Component is disabled, exclude detection
                logger.info(f"🚫 Filtered out {class_name} (disabled in config)")
        
        logger.info(f"📊 Filtered detections: {len(detections)} → {len(filtered_detections)}")
        return filtered_detections


class EnhancedMinimalV4Configurable:
    def __init__(self):
        """Initialize enhanced minimal v4.0 with configurable components"""
        try:
            logger.info("🚀 Initializing Enhanced Minimal v4.0 with Configuration Support...")
            
            # Initialize configuration manager
            self.config_manager = ConfigurableAnalysisComponents()
            
            # Initialize NudeNet detector
            self.nude_detector = NudeDetector()
            
            # Try to initialize BLIP for descriptions
            self.blip_available = False
            try:
                logger.info("🖼️ Attempting to load BLIP model...")
                from transformers import BlipProcessor, BlipForConditionalGeneration
                self.blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
                self.blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
                self.blip_available = True
                logger.info("✅ BLIP model loaded successfully")
            except Exception as e:
                logger.warning(f"⚠️ BLIP model failed to load: {e}")
                logger.info("📝 Will use fallback image description method")
            
            # Age thresholds
            self.MIN_AGE_THRESHOLD = 16
            self.SUSPICIOUS_AGE_THRESHOLD = 18
            
            logger.info("✅ Enhanced Minimal v4.0 initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize: {e}")
            raise

    def analyze_image(self, image_path: str, context_type: str = 'public_gallery', 
                     model_id: int = 1, config: Dict = None) -> Dict:
        """
        Enhanced minimal v4.0 analysis with configurable components
        """
        try:
            logger.info(f"🔍 Starting configurable analysis for: {os.path.basename(image_path)}")
            
            # Use provided config or default
            if config is None:
                config = self.config_manager.default_config
            
            analysis_results = {
                'success': True,
                'metadata': {
                    'analysis_version': '4.0_configurable',
                    'timestamp': datetime.now().isoformat(),
                    'context_type': context_type,
                    'model_id': model_id,
                    'configuration_used': config
                }
            }
            
            # 1. NudeNet Analysis (if any components enabled)
            nudenet_enabled = any(config.get('nudenet_components', {}).values())
            if nudenet_enabled:
                logger.info("🔍 Running NudeNet detection...")
                nudenet_results = self.analyze_nudity_configurable(image_path, config)
                analysis_results.update(nudenet_results)
            else:
                logger.info("⚠️ All NudeNet components disabled - skipping")
                analysis_results.update({
                    'nudity_detection': {
                        'detected_parts': {},
                        'part_locations': {},
                        'nudity_score': 0,
                        'has_nudity': False,
                        'analysis_skipped': 'all_nudenet_components_disabled'
                    }
                })
            
            # 2. Face Analysis (simulated for now)
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
            
            # 3. BLIP Image Description (if enabled)
            if config.get('blip_components', {}).get('image_description', True):
                logger.info("📝 Running BLIP image description...")
                description_results = self.generate_image_description(image_path)
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
                'analysis_version': '4.0_configurable_error',
                'timestamp': datetime.now().isoformat()
            }

    def analyze_nudity_configurable(self, image_path: str, config: Dict) -> Dict:
        """Run NudeNet analysis with configurable component filtering"""
        try:
            # Run full NudeNet detection
            raw_detections = self.nude_detector.detect(image_path)
            logger.info(f"🔍 NudeNet raw detections: {len(raw_detections)} items")
            
            # Filter based on configuration
            filtered_detections = self.config_manager.filter_nudenet_results(raw_detections, config)
            logger.info(f"📊 After filtering: {len(filtered_detections)} items")
            
            # Process filtered detections
            detected_parts = {}
            part_locations = {}
            max_confidence = 0
            
            for detection in filtered_detections:
                class_name = detection['class'].upper()
                confidence = detection['score'] * 100
                detected_parts[class_name] = confidence
                max_confidence = max(max_confidence, confidence)
                
                # Store location
                box = detection['box']
                part_locations[class_name] = {
                    'x': int(box[0]),
                    'y': int(box[1]),
                    'width': int(box[2] - box[0]),
                    'height': int(box[3] - box[1]),
                    'confidence': confidence
                }
            
            return {
                'nudity_detection': {
                    'detected_parts': detected_parts,
                    'part_locations': part_locations,
                    'nudity_score': max_confidence,
                    'has_nudity': max_confidence > 30,
                    'raw_detection_count': len(raw_detections),
                    'filtered_detection_count': len(filtered_detections),
                    'configuration_applied': True
                }
            }
            
        except Exception as e:
            logger.error(f"❌ NudeNet analysis failed: {e}")
            return {
                'nudity_detection': {
                    'detected_parts': {'ANALYSIS_ERROR': 95.0},
                    'part_locations': {},
                    'nudity_score': 95.0,
                    'has_nudity': True,
                    'error': str(e)
                }
            }

    def simulate_face_analysis(self) -> Dict:
        """Simulate face analysis (placeholder for future implementation)"""
        return {
            'faces_detected': random.choice([True, False]),
            'face_count': random.randint(0, 3),
            'min_age': random.randint(20, 45) if random.random() > 0.3 else None,
            'max_age': random.randint(25, 55) if random.random() > 0.3 else None,
            'underage_detected': False,  # Always false in simulation
            'simulation_note': 'Simulated face analysis - not real detection'
        }

    def generate_image_description(self, image_path: str) -> Dict:
        """Generate BLIP-based image description"""
        if not self.blip_available:
            return {
                'description': 'BLIP model not available',
                'tags': [],
                'generation_method': 'blip_unavailable'
            }
        
        try:
            # Load and process image
            image = Image.open(image_path).convert('RGB')
            inputs = self.blip_processor(image, return_tensors="pt")
            
            # Generate description
            out = self.blip_model.generate(**inputs, max_length=50)
            description = self.blip_processor.decode(out[0], skip_special_tokens=True)
            
            # Extract tags from description
            tags = [word.lower() for word in description.split() 
                   if len(word) > 3 and word.isalpha()][:5]
            
            return {
                'description': description,
                'tags': tags,
                'generation_method': 'blip_model'
            }
            
        except Exception as e:
            logger.error(f"❌ BLIP description failed: {e}")
            return {
                'description': 'Image description generation failed',
                'tags': [],
                'generation_method': 'blip_error',
                'error': str(e)
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
api = EnhancedMinimalV4Configurable()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint with configuration status"""
    return jsonify({
        'status': 'healthy',
        'version': '4.0_configurable',
        'message': 'Enhanced Minimal v4.0 with Configurable Components',
        'blip_available': api.blip_available,
        'blip_model': 'Salesforce/blip-image-captioning-base' if api.blip_available else None,
        'device': 'cpu',
        'features': [
            'configurable_nudenet_components',
            'configurable_blip_components', 
            'component_filtering',
            'enhanced_risk_assessment',
            'child_content_detection'
        ],
        'pipeline_stages': [
            'request_config_parsing',
            'configurable_nudity_detection',
            'simulated_face_analysis',
            'optional_blip_description',
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
        
        # Parse configuration from request
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
            'analysis_version': '4.0_configurable_error'
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

if __name__ == '__main__':
    logger.info("🚀 Starting Enhanced Minimal v4.0 with Configurable Components")
    app.run(host='0.0.0.0', port=5000, debug=False)
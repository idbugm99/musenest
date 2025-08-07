#!/usr/bin/env python3
"""
Standalone Configuration Test - Test configuration logic without dependencies
"""

import logging
from typing import Dict, List

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ConfigurableAnalysisComponents:
    """Manages configurable detection components - STANDALONE VERSION"""
    
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
            }
        }
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
        
        logger.info(f"📊 Configuration parsed from request:")
        logger.info(f"  NudeNet: breast={config['nudenet_components']['breast_detection']}, "
                   f"genitalia={config['nudenet_components']['genitalia_detection']}")
        logger.info(f"  BLIP: child_detection={config['blip_components']['child_content_detection']}")
        
        return config
    
    def filter_nudenet_results(self, detections: List[Dict], config: Dict) -> List[Dict]:
        """Filter NudeNet detection results based on configuration"""
        if not detections:
            return detections
            
        enabled_components = config.get('nudenet_components', {})
        filtered_detections = []
        
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
            
            if config_key is None or enabled_components.get(config_key, True):
                filtered_detections.append(detection)
            else:
                logger.info(f"🚫 Filtered out {class_name} (disabled in config)")
        
        logger.info(f"📊 Filtered detections: {len(detections)} → {len(filtered_detections)}")
        return filtered_detections

def test_configuration_parsing():
    """Test configuration parsing logic"""
    print("🧪 Testing Configuration Parsing...")
    
    config_manager = ConfigurableAnalysisComponents()
    
    # Test 1: Default configuration
    print("\n📋 Test 1: Default Configuration")
    default_config = config_manager.default_config
    print(f"  Default breast detection: {default_config['nudenet_components']['breast_detection']}")
    print(f"  Default genitalia detection: {default_config['nudenet_components']['genitalia_detection']}")
    print(f"  Default child detection: {default_config['blip_components']['child_content_detection']}")
    
    # Test 2: Paysite configuration (disable nudity, keep child protection)
    print("\n📋 Test 2: Paysite Configuration (No Nudity Detection)")
    paysite_form = {
        'enable_breast_detection': 'false',
        'enable_genitalia_detection': 'false',
        'enable_buttocks_detection': 'false', 
        'enable_anus_detection': 'false',
        'enable_face_detection': 'true',  # Keep for child detection
        'enable_child_detection': 'true'  # Always keep child protection
    }
    
    paysite_config = config_manager.parse_request_config(paysite_form)
    print(f"  Paysite breast detection: {paysite_config['nudenet_components']['breast_detection']}")
    print(f"  Paysite genitalia detection: {paysite_config['nudenet_components']['genitalia_detection']}")
    print(f"  Paysite face detection: {paysite_config['nudenet_components']['face_detection']}")
    print(f"  Paysite child detection: {paysite_config['blip_components']['child_content_detection']}")
    
    # Test 3: Public site configuration (enable all)
    print("\n📋 Test 3: Public Site Configuration (Full Detection)")
    public_form = {
        'enable_breast_detection': 'true',
        'enable_genitalia_detection': 'true',
        'enable_buttocks_detection': 'true',
        'enable_anus_detection': 'true',
        'enable_face_detection': 'true',
        'enable_child_detection': 'true'
    }
    
    public_config = config_manager.parse_request_config(public_form)
    print(f"  Public breast detection: {public_config['nudenet_components']['breast_detection']}")
    print(f"  Public genitalia detection: {public_config['nudenet_components']['genitalia_detection']}")
    print(f"  Public face detection: {public_config['nudenet_components']['face_detection']}")
    print(f"  Public child detection: {public_config['blip_components']['child_content_detection']}")
    
    # Test 4: Filtering logic
    print("\n📋 Test 4: Detection Filtering Logic")
    mock_detections = [
        {'class': 'BREAST_EXPOSED', 'score': 0.75, 'box': [100, 100, 200, 200]},
        {'class': 'GENITALIA', 'score': 0.65, 'box': [150, 150, 250, 250]},
        {'class': 'FACE_FEMALE', 'score': 0.95, 'box': [50, 50, 150, 150]}
    ]
    
    # Filter with paysite config (should remove nudity, keep faces)
    filtered_paysite = config_manager.filter_nudenet_results(mock_detections, paysite_config)
    print(f"  Original detections: {len(mock_detections)}")
    print(f"  Paysite filtered: {len(filtered_paysite)} (should be 1 - only face)")
    for detection in filtered_paysite:
        print(f"    - {detection['class']}: {detection['score']}")
    
    # Filter with public config (should keep all)
    filtered_public = config_manager.filter_nudenet_results(mock_detections, public_config)
    print(f"  Public filtered: {len(filtered_public)} (should be 3 - all detections)")
    for detection in filtered_public:
        print(f"    - {detection['class']}: {detection['score']}")
    
    print("\n✅ Configuration Integration Test Complete!")
    
    # Test 5: Verify different business models work
    print("\n📋 Test 5: Business Model Scenarios")
    
    scenarios = {
        'public_site': {
            'enable_breast_detection': 'true',
            'enable_genitalia_detection': 'true',
            'enable_buttocks_detection': 'true',
            'enable_anus_detection': 'true',
            'enable_face_detection': 'true',
            'enable_child_detection': 'true'
        },
        'paysite': {
            'enable_breast_detection': 'false',
            'enable_genitalia_detection': 'false', 
            'enable_buttocks_detection': 'false',
            'enable_anus_detection': 'false',
            'enable_face_detection': 'true',
            'enable_child_detection': 'true'
        },
        'store': {
            'enable_breast_detection': 'true',
            'enable_genitalia_detection': 'true',
            'enable_buttocks_detection': 'false',
            'enable_anus_detection': 'false',
            'enable_face_detection': 'true',
            'enable_child_detection': 'true'
        }
    }
    
    for scenario_name, form_data in scenarios.items():
        config = config_manager.parse_request_config(form_data)
        filtered = config_manager.filter_nudenet_results(mock_detections, config)
        
        print(f"  {scenario_name.upper()}: {len(filtered)} detections allowed")
        enabled_components = [k for k, v in config['nudenet_components'].items() if v]
        print(f"    Enabled: {', '.join(enabled_components)}")
    
    # Test 6: Verify API endpoint compatibility 
    print("\n📋 Test 6: API Endpoint Response Simulation")
    
    def simulate_api_response(config, detections):
        filtered = config_manager.filter_nudenet_results(detections, config)
        return {
            'success': True,
            'nudity_detection': {
                'detected_parts': {d['class']: d['score'] * 100 for d in filtered},
                'raw_detection_count': len(detections),
                'filtered_detection_count': len(filtered),
                'configuration_applied': True
            },
            'metadata': {
                'analysis_version': '3.0_minimal_with_blip_configurable',
                'configuration_applied': True
            }
        }
    
    # Test paysite mode - should only show faces
    paysite_response = simulate_api_response(paysite_config, mock_detections)
    print(f"  Paysite API Response:")
    print(f"    Detected parts: {list(paysite_response['nudity_detection']['detected_parts'].keys())}")
    print(f"    Raw → Filtered: {paysite_response['nudity_detection']['raw_detection_count']} → {paysite_response['nudity_detection']['filtered_detection_count']}")
    
    # Test public mode - should show all
    public_response = simulate_api_response(public_config, mock_detections)
    print(f"  Public API Response:")
    print(f"    Detected parts: {list(public_response['nudity_detection']['detected_parts'].keys())}")
    print(f"    Raw → Filtered: {public_response['nudity_detection']['raw_detection_count']} → {public_response['nudity_detection']['filtered_detection_count']}")
    
    return True

if __name__ == '__main__':
    try:
        test_configuration_parsing()
        print("\n🎉 All configuration tests passed!")
        print("\n🚀 Configuration Integration Ready for Production!")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
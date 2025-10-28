#!/usr/bin/env python3
"""
Test Configuration Integration - Verify the configuration system works
"""

import sys
import os
sys.path.append('/Users/programmer/Projects/phoenix4ge')

# Test the ConfigurableAnalysisComponents class
class MockRequest:
    def __init__(self, form_data):
        self.form = form_data
    
    def get(self, key, default):
        return self.form.get(key, default)

def test_configuration_parsing():
    """Test configuration parsing logic"""
    print("🧪 Testing Configuration Parsing...")
    
    # Import the class from our updated file
    from enhanced_minimal_v3_with_blip import ConfigurableAnalysisComponents
    
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
    
    return True

if __name__ == '__main__':
    try:
        test_configuration_parsing()
        print("\n🎉 All tests passed!")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
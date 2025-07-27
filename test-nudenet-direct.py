#!/usr/bin/env python3
"""
Direct test of NudeNet analysis 
"""

import json
import requests

# Test the fixed NudeNet service
def test_nudenet_service():
    url = "http://18.191.50.72:5001"
    
    # Test health first
    try:
        health_response = requests.get(f"{url}/health", timeout=5)
        print("Health check:", health_response.json())
    except Exception as e:
        print(f"Health check failed: {e}")
        return False
    
    # Test with a sample image URL
    test_image_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Vd-Orig.svg/256px-Vd-Orig.svg.png"
    
    try:
        analysis_response = requests.post(f"{url}/analyze-url", 
            json={
                "image_url": test_image_url,
                "context_type": "public_gallery",
                "model_id": 1
            },
            timeout=30
        )
        
        result = analysis_response.json()
        print("Analysis result:")
        print(json.dumps(result, indent=2))
        
        if result.get('success'):
            moderation = result['result']
            print(f"\n🎯 ANALYSIS SUMMARY:")
            print(f"Status: {moderation['moderation_status'].upper()}")
            print(f"Nudity Score: {moderation['nudity_score']:.1f}%")
            print(f"Detected Parts: {moderation['detected_parts']}")
            print(f"Caption: {moderation['generated_caption']}")
            print(f"Confidence: {moderation['confidence_score']:.2f}")
            
        return True
        
    except Exception as e:
        print(f"Analysis failed: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing NudeNet Service...")
    test_nudenet_service()
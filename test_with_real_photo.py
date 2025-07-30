#!/usr/bin/env python3
"""
Test MediaPipe with the actual uploaded photo
"""

import cv2
import numpy as np
import mediapipe as mp
import os

def test_real_photo():
    """Test MediaPipe with the real uploaded photo"""
    
    print("🧪 Testing MediaPipe with Real Photo")
    print("=" * 40)
    
    image_path = "real_pose_test.jpg"
    
    if not os.path.exists(image_path):
        print(f"❌ {image_path} not found")
        return
    
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        print(f"❌ Could not load {image_path}")
        return
    
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    print(f"📷 Image shape: {image.shape}")
    
    # Initialize MediaPipe
    mp_pose = mp.solutions.pose
    
    # Test with different configurations
    configs = [
        {'name': 'Ultra Low Threshold', 'min_detection_confidence': 0.1, 'model_complexity': 1},
        {'name': 'Very Low Threshold', 'min_detection_confidence': 0.2, 'model_complexity': 2},
        {'name': 'Low Threshold', 'min_detection_confidence': 0.3, 'model_complexity': 2},
        {'name': 'Default', 'min_detection_confidence': 0.5, 'model_complexity': 1},
    ]
    
    for config in configs:
        print(f"\n🔍 Testing: {config['name']}")
        print(f"   Confidence: {config['min_detection_confidence']}, Complexity: {config['model_complexity']}")
        
        try:
            pose = mp_pose.Pose(
                static_image_mode=True,
                model_complexity=config['model_complexity'],
                enable_segmentation=False,
                min_detection_confidence=config['min_detection_confidence']
            )
            
            results = pose.process(image_rgb)
            
            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                print(f"   ✅ SUCCESS: Detected {len(landmarks)} landmarks!")
                
                # Show first 10 landmarks
                print(f"   📍 First 10 landmarks:")
                landmark_names = ['NOSE', 'L_EYE_INNER', 'L_EYE', 'L_EYE_OUTER', 'R_EYE_INNER', 
                                'R_EYE', 'R_EYE_OUTER', 'L_EAR', 'R_EAR', 'MOUTH_L']
                
                for i in range(min(10, len(landmarks))):
                    lm = landmarks[i]
                    vis = getattr(lm, 'visibility', 1.0)
                    name = landmark_names[i] if i < len(landmark_names) else f"LANDMARK_{i}"
                    print(f"      {name}: ({lm.x:.3f}, {lm.y:.3f}, {lm.z:.3f}) vis={vis:.3f}")
                
                # Check body landmarks
                body_indices = [11, 12, 23, 24, 25, 26]  # shoulders, hips, knees
                body_names = ['L_SHOULDER', 'R_SHOULDER', 'L_HIP', 'R_HIP', 'L_KNEE', 'R_KNEE']
                
                print(f"   🏃 Body landmarks:")
                for idx, name in zip(body_indices, body_names):
                    if idx < len(landmarks):
                        lm = landmarks[idx]
                        vis = getattr(lm, 'visibility', 1.0)
                        print(f"      {name}: ({lm.x:.3f}, {lm.y:.3f}) vis={vis:.3f}")
                
                pose.close()
                break  # Found landmarks, no need to test other configs
                
            else:
                print(f"   ❌ No landmarks detected")
                
            pose.close()
            
        except Exception as e:
            print(f"   💥 Error: {e}")
    
    print(f"\n🏁 Real photo testing complete!")

if __name__ == '__main__':
    test_real_photo()
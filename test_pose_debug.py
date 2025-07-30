#!/usr/bin/env python3
"""
Debug pose detection issues and test different configurations
"""

import cv2
import numpy as np
import mediapipe as mp
import tempfile
import os
from PIL import Image, ImageDraw

def create_test_image():
    """Create a simple test image with a clear human figure"""
    img = Image.new('RGB', (640, 480), 'white')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple but clear human figure
    # Head (circle)
    draw.ellipse([300, 50, 340, 90], outline='black', fill='lightpink', width=2)
    
    # Neck
    draw.line([320, 90, 320, 120], fill='black', width=4)
    
    # Torso (rectangle)
    draw.rectangle([290, 120, 350, 220], outline='black', fill='lightblue', width=2)
    
    # Arms
    draw.line([290, 140, 250, 180], fill='black', width=4)  # Left upper arm
    draw.line([250, 180, 230, 220], fill='black', width=4)  # Left forearm
    draw.line([350, 140, 390, 180], fill='black', width=4)  # Right upper arm
    draw.line([390, 180, 410, 220], fill='black', width=4)  # Right forearm
    
    # Legs
    draw.line([300, 220, 280, 300], fill='black', width=4)  # Left thigh
    draw.line([280, 300, 270, 380], fill='black', width=4)  # Left shin
    draw.line([340, 220, 360, 300], fill='black', width=4)  # Right thigh
    draw.line([360, 300, 370, 380], fill='black', width=4)  # Right shin
    
    # Feet
    draw.ellipse([260, 375, 280, 390], outline='black', fill='brown', width=2)
    draw.ellipse([360, 375, 380, 390], outline='black', fill='brown', width=2)
    
    return img

def test_mediapipe_configurations():
    """Test different MediaPipe configurations"""
    
    print("🧪 Testing MediaPipe Pose Detection Configurations")
    print("=" * 50)
    
    # Create test image
    test_img = create_test_image()
    temp_fd, temp_path = tempfile.mkstemp(suffix='.jpg')
    os.close(temp_fd)
    test_img.save(temp_path, 'JPEG', quality=95)
    
    # Load image with OpenCV
    image = cv2.imread(temp_path)
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    print(f"📷 Test image shape: {image.shape}")
    
    # Test different configurations
    configs = [
        {
            'name': 'Default Configuration',
            'static_image_mode': True,
            'model_complexity': 1,
            'enable_segmentation': False,
            'min_detection_confidence': 0.5
        },
        {
            'name': 'High Sensitivity',
            'static_image_mode': True,
            'model_complexity': 2,
            'enable_segmentation': False,
            'min_detection_confidence': 0.3
        },
        {
            'name': 'Low Sensitivity',
            'static_image_mode': True,
            'model_complexity': 0,
            'enable_segmentation': False,
            'min_detection_confidence': 0.7
        },
        {
            'name': 'Video Mode Test',
            'static_image_mode': False,
            'model_complexity': 1,
            'enable_segmentation': False,
            'min_detection_confidence': 0.5,
            'min_tracking_confidence': 0.5
        }
    ]
    
    mp_pose = mp.solutions.pose
    
    for i, config in enumerate(configs, 1):
        print(f"\n{i}. Testing: {config['name']}")
        print(f"   Config: {config}")
        
        try:
            # Initialize pose detection with current config (remove 'name' key)
            config_copy = {k: v for k, v in config.items() if k != 'name'}
            pose = mp_pose.Pose(**config_copy)
            
            # Process image
            results = pose.process(image_rgb)
            
            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                print(f"   ✅ SUCCESS: Detected {len(landmarks)} landmarks")
                
                # Check key landmarks
                key_landmarks = [0, 11, 12, 23, 24, 25, 26]  # nose, shoulders, hips, knees
                detected_key = 0
                for idx in key_landmarks:
                    if idx < len(landmarks):
                        visibility = getattr(landmarks[idx], 'visibility', 1.0)
                        if visibility > 0.5:
                            detected_key += 1
                
                print(f"   📊 Key landmarks detected: {detected_key}/{len(key_landmarks)}")
                
                # Sample some landmark data
                print(f"   📍 Sample landmarks:")
                for idx in [0, 11, 12, 23, 24]:  # nose, shoulders, hips
                    if idx < len(landmarks):
                        lm = landmarks[idx]
                        visibility = getattr(lm, 'visibility', 1.0)
                        print(f"      {idx}: ({lm.x:.3f}, {lm.y:.3f}) vis={visibility:.3f}")
                
            else:
                print(f"   ❌ FAILED: No pose landmarks detected")
            
            pose.close()
            
        except Exception as e:
            print(f"   💥 ERROR: {e}")
    
    # Clean up
    try:
        os.unlink(temp_path)
    except:
        pass
    
    print(f"\n🏁 MediaPipe configuration testing complete!")

if __name__ == '__main__':
    test_mediapipe_configurations()
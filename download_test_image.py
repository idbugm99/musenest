#!/usr/bin/env python3
"""
Download a test image from the internet and test MediaPipe pose detection
"""

import requests
import cv2
import numpy as np
import mediapipe as mp
import tempfile
import os

def download_and_test():
    """Download a test image and test MediaPipe"""
    
    print("🌐 Downloading test image for MediaPipe validation...")
    
    # Use a public domain image with clear human pose
    test_urls = [
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&h=600&fit=crop",  # Person standing
        "https://httpbin.org/image/jpeg",  # Simple test image
    ]
    
    for i, url in enumerate(test_urls, 1):
        print(f"\n{i}. Testing with URL: {url}")
        
        try:
            # Download image
            response = requests.get(url, timeout=10)
            if response.status_code != 200:
                print(f"   ❌ Failed to download (HTTP {response.status_code})")
                continue
            
            # Save to temporary file
            temp_fd, temp_path = tempfile.mkstemp(suffix='.jpg')
            os.close(temp_fd)
            
            with open(temp_path, 'wb') as f:
                f.write(response.content)
            
            print(f"   ✅ Downloaded image ({len(response.content)} bytes)")
            
            # Test with MediaPipe
            result = test_mediapipe_on_image(temp_path)
            
            # Clean up
            try:
                os.unlink(temp_path)
            except:
                pass
                
            if result:
                print(f"   🎉 SUCCESS: MediaPipe is working correctly!")
                return True
                
        except Exception as e:
            print(f"   💥 Error: {e}")
    
    print(f"\n⚠️ Could not download test images. Creating local test...")
    return test_local_creation()

def test_local_creation():
    """Create a very simple test image locally"""
    try:
        # Create a simple image with basic shapes that might be detected
        import numpy as np
        
        # Create a simple "person" shape using basic OpenCV drawing
        img = np.ones((600, 400, 3), dtype=np.uint8) * 255  # White background
        
        # Draw a simple stick figure in black
        cv2.circle(img, (200, 100), 30, (0, 0, 0), -1)  # Head
        cv2.line(img, (200, 130), (200, 350), (0, 0, 0), 8)  # Body
        cv2.line(img, (200, 200), (150, 250), (0, 0, 0), 6)  # Left arm
        cv2.line(img, (200, 200), (250, 250), (0, 0, 0), 6)  # Right arm
        cv2.line(img, (200, 350), (150, 450), (0, 0, 0), 6)  # Left leg
        cv2.line(img, (200, 350), (250, 450), (0, 0, 0), 6)  # Right leg
        
        # Save test image
        temp_fd, temp_path = tempfile.mkstemp(suffix='.jpg')
        os.close(temp_fd)
        cv2.imwrite(temp_path, img)
        
        print("   ✅ Created local test image")
        
        # Test with MediaPipe
        result = test_mediapipe_on_image(temp_path)
        
        # Clean up
        try:
            os.unlink(temp_path)
        except:
            pass
            
        return result
        
    except Exception as e:
        print(f"   💥 Local creation failed: {e}")
        return False

def test_mediapipe_on_image(image_path):
    """Test MediaPipe pose detection on an image"""
    try:
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            print(f"   ❌ Could not load image")
            return False
        
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        print(f"   📷 Image shape: {image.shape}")
        
        # Initialize MediaPipe with very low threshold
        mp_pose = mp.solutions.pose
        pose = mp_pose.Pose(
            static_image_mode=True,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.1  # Very low threshold
        )
        
        # Process image
        results = pose.process(image_rgb)
        
        if results.pose_landmarks:
            landmarks = results.pose_landmarks.landmark
            print(f"   ✅ DETECTED {len(landmarks)} landmarks!")
            
            # Show sample landmarks
            for i in range(min(5, len(landmarks))):
                lm = landmarks[i]
                vis = getattr(lm, 'visibility', 1.0)
                print(f"      Landmark {i}: ({lm.x:.3f}, {lm.y:.3f}) vis={vis:.3f}")
            
            pose.close()
            return True
        else:
            print(f"   ❌ No landmarks detected")
            pose.close()
            return False
            
    except Exception as e:
        print(f"   💥 MediaPipe test error: {e}")
        return False

if __name__ == '__main__':
    download_and_test()
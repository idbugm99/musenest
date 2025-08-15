#!/usr/bin/env python3
"""
Simple command-line NudeNet processor for MuseNest
Usage: python3 nudenet-cli.py --image /path/to/image.jpg --context_type public_gallery
"""

import argparse
import json
import sys
from pathlib import Path
from nudenet import NudeDetector

def analyze_image(image_path, context_type='public_gallery'):
    """Analyze image with NudeNet and return JSON result"""
    try:
        # Initialize NudeNet detector
        detector = NudeDetector()
        
        # Analyze the image
        detections = detector.detect(image_path)
        
        # Calculate overall nudity score and part-specific scores
        part_scores = {}
        total_score = 0.0
        
        for detection in detections:
            class_name = detection['class']
            confidence = detection['score'] * 100  # Convert to percentage
            
            # Map classes to our part names and store coordinates
            box = detection['box']
            part_location = {
                'x': box[0],
                'y': box[1], 
                'width': box[2] - box[0],
                'height': box[3] - box[1],
                'confidence': confidence
            }
            
            if class_name in ['FEMALE_BREAST_EXPOSED', 'MALE_BREAST_EXPOSED']:
                part_scores['FEMALE_BREAST_EXPOSED'] = max(part_scores.get('FEMALE_BREAST_EXPOSED', 0), confidence)
            elif class_name in ['BUTTOCKS_EXPOSED']:
                part_scores['BUTTOCKS_EXPOSED'] = max(part_scores.get('BUTTOCKS_EXPOSED', 0), confidence)
            elif class_name in ['FEMALE_GENITALIA_EXPOSED', 'MALE_GENITALIA_EXPOSED']:
                part_scores['FEMALE_GENITALIA_EXPOSED'] = max(part_scores.get('FEMALE_GENITALIA_EXPOSED', 0), confidence)
            elif class_name in ['ANUS_EXPOSED']:
                part_scores['ANUS_EXPOSED'] = max(part_scores.get('ANUS_EXPOSED', 0), confidence)
            elif class_name in ['FACE_FEMALE', 'FACE_MALE']:
                part_scores['FACE_FEMALE'] = max(part_scores.get('FACE_FEMALE', 0), confidence)
            elif class_name in ['ARMPITS_COVERED', 'ARMPITS_EXPOSED']:
                part_scores['ARMPITS_EXPOSED'] = max(part_scores.get('ARMPITS_EXPOSED', 0), confidence)
            elif class_name in ['BELLY_COVERED', 'BELLY_EXPOSED']:
                part_scores['BELLY_EXPOSED'] = max(part_scores.get('BELLY_EXPOSED', 0), confidence)
            elif class_name in ['FEET_COVERED', 'FEET_EXPOSED']:
                part_scores['FEET_EXPOSED'] = max(part_scores.get('FEET_EXPOSED', 0), confidence)
            
            total_score = max(total_score, confidence)
        
        # Create part locations dictionary 
        part_locations = {}
        for detection in detections:
            class_name = detection['class']
            box = detection['box']
            part_locations[class_name] = {
                'x': box[0],
                'y': box[1],
                'width': box[2] - box[0], 
                'height': box[3] - box[1],
                'confidence': detection['score'] * 100
            }
        
        result = {
            'success': True,
            'nudity_score': total_score,
            'detected_parts': part_scores,
            'part_locations': part_locations,
            'has_nudity': total_score > 15,
            'context_type': context_type,
            'total_detections': len(detections),
            'processing_method': 'local_nudenet_cli'
        }
        
        return result
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'processing_method': 'local_nudenet_cli'
        }

def main():
    parser = argparse.ArgumentParser(description='Analyze image with NudeNet')
    parser.add_argument('--image', required=True, help='Path to image file')
    parser.add_argument('--context_type', default='public_gallery', help='Context type for analysis')
    
    args = parser.parse_args()
    
    # Check if image file exists
    if not Path(args.image).exists():
        result = {
            'success': False,
            'error': f'Image file not found: {args.image}',
            'processing_method': 'local_nudenet_cli'
        }
        print(json.dumps(result))
        sys.exit(1)
    
    # Analyze the image
    result = analyze_image(args.image, args.context_type)
    
    # Output result as JSON
    print(json.dumps(result))
    
    # Exit with appropriate code
    sys.exit(0 if result['success'] else 1)

if __name__ == '__main__':
    main()
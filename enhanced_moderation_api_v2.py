#!/usr/bin/env python3
"""
Enhanced Moderation API v2.0 - With comprehensive 33-landmark pose analysis
Updated to return all MediaPipe landmarks and enhanced pose metrics
"""

import cv2
import numpy as np
import mediapipe as mp
import json
import os
from flask import Flask, request, jsonify
from nudenet import NudeDetector
import logging
from typing import Dict, List, Tuple, Optional
import traceback
from PIL import Image, ExifTags
import tempfile

# Import our enhanced pose analyzer
from enhanced_pose_analysis import EnhancedPoseAnalyzer

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

class EnhancedModerationAPIv2:
    def __init__(self):
        """Initialize the enhanced moderation system v2.0"""
        try:
            # Initialize Enhanced Pose Analyzer (NEW)
            self.pose_analyzer = EnhancedPoseAnalyzer()
            
            # Initialize NudeNet detector
            self.nude_detector = NudeDetector()
            
            logger.info("Enhanced Moderation API v2.0 initialized successfully with 33-landmark pose analysis")
            
        except Exception as e:
            logger.error(f"Failed to initialize Enhanced Moderation API v2.0: {e}")
            raise

    def normalize_image_orientation(self, image_path: str) -> str:
        """Apply EXIF rotation and normalize orientation"""
        try:
            img = Image.open(image_path)
            original_dims = f"{img.width}x{img.height}"
            
            # Apply EXIF rotation
            try:
                exif = img._getexif()
                if exif is not None:
                    for key, value in ExifTags.TAGS.items():
                        if value == 'Orientation':
                            orientation = exif.get(key)
                            if orientation == 3:
                                img = img.rotate(180, expand=True)
                                logger.info(f"Applied 180° EXIF rotation")
                            elif orientation == 6:
                                img = img.rotate(90, expand=True)
                                logger.info(f"Applied 90° EXIF rotation")
                            elif orientation == 8:
                                img = img.rotate(-90, expand=True)
                                logger.info(f"Applied -90° EXIF rotation")
                            break
            except Exception as e:
                logger.warning(f"EXIF processing failed: {e}")
            
            # Convert to landscape if portrait
            if img.height > img.width:
                logger.info(f"Converting portrait to landscape: {img.width}x{img.height} → {img.height}x{img.width}")
                img = img.rotate(-90, expand=True)
            
            # Save normalized image
            temp_fd, temp_path = tempfile.mkstemp(suffix='.jpg')
            os.close(temp_fd)
            img.save(temp_path, 'JPEG', quality=95, exif=b'')
            logger.info(f"Image normalized: {original_dims} → {img.width}x{img.height}")
            return temp_path
            
        except Exception as e:
            logger.error(f"Image orientation normalization failed: {e}")
            return image_path

    def analyze_image(self, image_path: str, context_type: str = 'public_gallery', 
                     model_id: int = 1) -> Dict:
        """
        Comprehensive image analysis v2.0 with 33-landmark pose detection
        """
        try:
            logger.info(f"🚀 Starting enhanced analysis v2.0 for: {image_path}")
            
            # Load and validate image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Could not load image from {image_path}")
            
            # Convert to RGB for MediaPipe
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            logger.info(f"📷 Image loaded: {image.shape}")
            
            # 1. Nudity Analysis
            logger.info("🔍 Running nudity detection...")
            nudity_analysis = self._analyze_nudity(image_path)
            
            # 2. Enhanced Pose Analysis (NEW - All 33 landmarks)
            logger.info("🎭 Running enhanced pose analysis with 33 landmarks...")
            pose_analysis = self.pose_analyzer._analyze_pose(image_rgb)
            
            # Apply validation to prevent AI hallucinations
            pose_analysis = self._validate_pose_analysis(pose_analysis, nudity_analysis)
            
            # 3. Combined Assessment
            logger.info("🎯 Combining assessments...")
            combined_assessment = self._combine_assessments(nudity_analysis, pose_analysis, context_type)
            
            # 4. Generate moderation decision
            logger.info("⚖️ Generating moderation decision...")
            moderation_decision = self._generate_moderation_decision(combined_assessment, context_type)
            
            logger.info(f"✅ Analysis complete - Status: {moderation_decision['status']}")
            
            return {
                'success': True,
                'image_analysis': {
                    'nudity_detection': nudity_analysis,
                    'pose_analysis': pose_analysis,
                    'combined_assessment': combined_assessment
                },
                'moderation_decision': moderation_decision,
                'metadata': {
                    'context_type': context_type,
                    'model_id': model_id,
                    'analysis_version': '2.0_enhanced_33_landmarks',
                    'landmark_count': pose_analysis.get('landmark_count', 0),
                    'pose_confidence': pose_analysis.get('pose_confidence', 0)
                }
            }
            
        except Exception as e:
            logger.error(f"Image analysis v2.0 failed: {e}")
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e),
                'analysis_version': '2.0_enhanced_33_landmarks'
            }

    def _analyze_nudity(self, image_path: str) -> Dict:
        """Analyze nudity using NudeNet"""
        normalized_path = None
        try:
            # Normalize image orientation
            normalized_path = self.normalize_image_orientation(image_path)
            
            # Get NudeNet predictions
            predictions = self.nude_detector.detect(normalized_path)
            
            if not predictions:
                return {
                    'has_nudity': False,
                    'nudity_score': 0,
                    'detected_parts': {},
                    'part_locations': {},
                    'part_count': 0
                }
            
            # Process predictions
            detected_parts = {}
            part_locations = {}
            max_score = 0
            
            for prediction in predictions:
                part_name = prediction['class']
                confidence = prediction['score'] * 100
                
                # Store highest confidence for each part type
                if part_name not in detected_parts or confidence > detected_parts[part_name]:
                    detected_parts[part_name] = confidence
                    part_locations[part_name] = {
                        'x': int(prediction['box'][0]),
                        'y': int(prediction['box'][1]),
                        'width': int(prediction['box'][2] - prediction['box'][0]),
                        'height': int(prediction['box'][3] - prediction['box'][1]),
                        'confidence': confidence
                    }
                
                max_score = max(max_score, confidence)
            
            return {
                'has_nudity': max_score > 30,
                'nudity_score': max_score,
                'detected_parts': detected_parts,
                'part_locations': part_locations,
                'part_count': len(detected_parts)
            }
            
        except Exception as e:
            logger.error(f"Nudity analysis failed: {e}")
            return {
                'has_nudity': True,  # Conservative fallback
                'nudity_score': 95,
                'detected_parts': {'ANALYSIS_ERROR': 95},
                'part_locations': {},
                'part_count': 1
            }
        finally:
            # Clean up temporary file
            if normalized_path and normalized_path != image_path:
                try:
                    os.unlink(normalized_path)
                except:
                    pass

    def _validate_pose_analysis(self, pose_analysis: Dict, nudity_analysis: Dict) -> Dict:
        """Validate pose analysis to prevent AI hallucinations"""
        if not pose_analysis.get('pose_detected', False):
            return pose_analysis
        
        detected_parts = nudity_analysis.get('detected_parts', {})
        part_types = list(detected_parts.keys())
        
        # Check for face-only images
        face_only_parts = ['FACE_FEMALE', 'FACE_MALE']
        only_face_detected = len(part_types) == 1 and any(part in face_only_parts for part in part_types)
        
        if only_face_detected and pose_analysis.get('pose_detected', False):
            logger.warning("⚠️ Face-only image with pose detection - applying validation override")
            
            # Store original metrics but override detection
            raw_metrics = pose_analysis.get('raw_metrics', {})
            details = pose_analysis.get('details', {})
            details['raw_metrics'] = raw_metrics
            details['validation_override'] = 'pose_detection_disabled_for_face_only_image'
            details['reasoning'] = ['face_only_image_no_body_visible']
            
            return {
                'pose_detected': False,
                'pose_category': 'face_only_no_pose',
                'suggestive_score': 0,
                'details': details,
                'landmarks': pose_analysis.get('landmarks', {}),
                'landmark_count': pose_analysis.get('landmark_count', 0),
                'pose_confidence': pose_analysis.get('pose_confidence', 0)
            }
        
        # Check for extreme/unrealistic pose metrics
        raw_metrics = pose_analysis.get('raw_metrics', {})
        hip_bend = raw_metrics.get('hip_bend_angle', 0)
        torso_angle = raw_metrics.get('torso_angle', 0)
        
        if hip_bend > 4 or torso_angle > 4:  # Unrealistic angles
            logger.warning(f"⚠️ Extreme pose metrics detected - hip_bend: {hip_bend}, torso: {torso_angle}")
            
            details = pose_analysis.get('details', {})
            details['validation_warning'] = 'Pose metrics appear unrealistic'
            details['reasoning'] = ['extreme_metrics_detected']
            
            pose_analysis['pose_category'] = 'uncertain_pose_detection'
            pose_analysis['details'] = details
        
        return pose_analysis

    def _combine_assessments(self, nudity_analysis: Dict, pose_analysis: Dict, context_type: str) -> Dict:
        """Combine nudity and enhanced pose analysis"""
        try:
            nudity_risk = nudity_analysis['nudity_score'] / 100.0
            pose_risk = pose_analysis['suggestive_score']
            
            # Enhanced weighting based on pose confidence
            pose_confidence = pose_analysis.get('pose_confidence', 0)
            pose_weight = 0.3 * pose_confidence  # Adjust weight based on confidence
            
            if nudity_analysis['has_nudity']:
                final_risk_score = (nudity_risk * (1 - pose_weight)) + (pose_risk * pose_weight)
            else:
                final_risk_score = (nudity_risk * 0.9) + (pose_risk * 0.1)
            
            final_risk_score = min(final_risk_score * 100, 100)
            
            # Determine risk level
            if final_risk_score >= 80:
                risk_level = 'high'
            elif final_risk_score >= 50:
                risk_level = 'medium'
            elif final_risk_score >= 20:
                risk_level = 'low'
            else:
                risk_level = 'minimal'
            
            # Generate reasoning
            reasoning = []
            if nudity_analysis['has_nudity']:
                reasoning.append(f"nudity_detected_{nudity_analysis['nudity_score']:.1f}%")
            if pose_analysis['suggestive_score'] > 0.3:
                reasoning.append(f"suggestive_pose_{pose_analysis['pose_category']}")
            if pose_analysis.get('landmark_count', 0) > 25:
                reasoning.append(f"high_quality_pose_data_{pose_analysis['landmark_count']}_landmarks")
            if not reasoning:
                reasoning.append('content_appears_safe')
            
            return {
                'final_risk_score': final_risk_score,
                'risk_level': risk_level,
                'reasoning': reasoning,
                'nudity_contribution': nudity_risk * 100,
                'pose_contribution': pose_risk * 100,
                'pose_confidence': pose_confidence,
                'landmark_count': pose_analysis.get('landmark_count', 0)
            }
            
        except Exception as e:
            logger.error(f"Assessment combination failed: {e}")
            return {
                'final_risk_score': 95.0,
                'risk_level': 'high',
                'reasoning': [f'assessment_error: {str(e)}'],
                'nudity_contribution': 0,
                'pose_contribution': 0
            }

    def _generate_moderation_decision(self, combined_assessment: Dict, context_type: str) -> Dict:
        """Generate moderation decision"""
        risk_score = combined_assessment['final_risk_score']
        
        # Context-based thresholds
        thresholds = {
            'public_gallery': {'auto_approve': 20, 'auto_reject': 80},
            'private_gallery': {'auto_approve': 60, 'auto_reject': 95},
            'paysite_content': {'auto_approve': 40, 'auto_reject': 90}
        }
        
        context_thresholds = thresholds.get(context_type, thresholds['public_gallery'])
        
        # Make decision
        if risk_score <= context_thresholds['auto_approve']:
            status = 'auto_approved'
            action = 'approve_automatically'
            human_review = False
            confidence = 100 - risk_score
        elif risk_score >= context_thresholds['auto_reject']:
            status = 'auto_rejected'
            action = 'reject_automatically'
            human_review = False
            confidence = risk_score
        else:
            status = 'flagged_for_review'
            action = 'require_human_review'
            human_review = True
            confidence = 50
        
        return {
            'status': status,
            'action': action,
            'human_review_required': human_review,
            'confidence': confidence,
            'context_type': context_type,
            'applied_thresholds': context_thresholds
        }

# Initialize the API
api = EnhancedModerationAPIv2()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'message': 'Enhanced Moderation API v2.0 with 33-landmark pose analysis',
        'status': 'healthy',
        'version': '2.0'
    })

@app.route('/analyze', methods=['POST'])
def analyze_image_endpoint():
    """Main image analysis endpoint"""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file provided'}), 400
        
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'success': False, 'error': 'Empty filename'}), 400
        
        # Get parameters
        context_type = request.form.get('context_type', 'public_gallery')
        model_id = int(request.form.get('model_id', 1))
        
        # Save uploaded file temporarily
        temp_fd, temp_path = tempfile.mkstemp(suffix='.jpg')
        os.close(temp_fd)
        image_file.save(temp_path)
        
        try:
            # Analyze the image
            result = api.analyze_image(temp_path, context_type, model_id)
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
            'analysis_version': '2.0_enhanced_33_landmarks'
        }), 500

if __name__ == '__main__':
    logger.info("🚀 Starting Enhanced Moderation API v2.0 with 33-landmark pose analysis")
    app.run(host='0.0.0.0', port=5000, debug=False)
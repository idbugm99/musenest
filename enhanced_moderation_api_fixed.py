#!/usr/bin/env python3
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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

class EnhancedModerationAPI:
    def __init__(self):
        """Initialize the enhanced moderation system with MediaPipe and NudeNet"""
        try:
            # Initialize MediaPipe Pose
            self.mp_pose = mp.solutions.pose
            self.pose = self.mp_pose.Pose(
                static_image_mode=True,
                model_complexity=2,
                enable_segmentation=False,
                min_detection_confidence=0.5
            )
            self.mp_drawing = mp.solutions.drawing_utils
            
            # Initialize NudeNet detector
            self.nude_detector = NudeDetector()
            
            logger.info("Enhanced Moderation API initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Enhanced Moderation API: {e}")
            raise

    def analyze_image(self, image_path: str, context_type: str = 'public_gallery', 
                     model_id: int = 1) -> Dict:
        """
        Comprehensive image analysis combining NudeNet + MediaPipe pose detection
        """
        try:
            # Load and validate image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Could not load image from {image_path}")
            
            # Convert BGR to RGB for MediaPipe
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # 1. NudeNet Analysis
            nudity_analysis = self._analyze_nudity(image_path)
            
            # 2. MediaPipe Pose Analysis
            pose_analysis = self._analyze_pose(image_rgb)
            
            # 3. Combined Assessment
            combined_assessment = self._combine_assessments(nudity_analysis, pose_analysis, context_type)
            
            # 4. Generate moderation decision
            moderation_decision = self._generate_moderation_decision(combined_assessment, context_type)
            
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
                    'analysis_version': '2.0_enhanced_with_pose'
                }
            }
            
        except Exception as e:
            logger.error(f"Image analysis failed: {e}")
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e),
                'analysis_version': '2.0_enhanced_with_pose'
            }

    def _analyze_nudity(self, image_path: str) -> Dict:
        """Analyze nudity using NudeNet"""
        try:
            # Get NudeNet predictions
            predictions = self.nude_detector.detect(image_path)
            
            # Process results
            detected_parts = {}
            max_confidence = 0
            has_nudity = False
            
            for prediction in predictions:
                label = prediction['class']
                confidence = prediction['score'] * 100  # Convert to percentage
                
                detected_parts[label] = confidence
                max_confidence = max(max_confidence, confidence)
                
                # Consider nudity if any explicit parts detected above threshold
                if label.lower() in ['genitalia', 'breast', 'buttocks', 'anus'] and confidence > 30:
                    has_nudity = True
            
            return {
                'detected_parts': detected_parts,
                'nudity_score': max_confidence,
                'has_nudity': has_nudity,
                'part_count': len(detected_parts)
            }
            
        except Exception as e:
            logger.error(f"NudeNet analysis failed: {e}")
            return {
                'detected_parts': {},
                'nudity_score': 0,
                'has_nudity': False,
                'part_count': 0,
                'error': str(e)
            }

    def _analyze_pose(self, image_rgb: np.ndarray) -> Dict:
        """Analyze body pose using MediaPipe"""
        try:
            # Process image with MediaPipe
            results = self.pose.process(image_rgb)
            
            if not results.pose_landmarks:
                return {
                    'pose_detected': False,
                    'pose_category': 'no_pose_detected',
                    'suggestive_score': 0,
                    'details': {'reasoning': ['no_pose_landmarks_found']}
                }
            
            # Extract key landmarks for analysis
            landmarks = results.pose_landmarks.landmark
            
            # Calculate pose metrics
            pose_metrics = self._calculate_pose_metrics(landmarks)
            
            # Classify pose based on metrics
            pose_classification = self._classify_pose(
                pose_metrics['torso_angle'],
                pose_metrics['hip_bend_angle'],
                pose_metrics['body_orientation'],
                pose_metrics['leg_spread']
            )
            
            return {
                'pose_detected': True,
                'pose_category': pose_classification['pose_category'],
                'suggestive_score': pose_classification['suggestive_score'],
                'details': pose_classification['details'],
                'raw_metrics': pose_metrics
            }
            
        except Exception as e:
            logger.error(f"Pose analysis failed: {e}")
            return {
                'pose_detected': False,
                'pose_category': 'analysis_error',
                'suggestive_score': 0,
                'details': {'reasoning': [f'pose_analysis_error: {str(e)}']}
            }

    def _calculate_pose_metrics(self, landmarks) -> Dict:
        """Calculate pose metrics from MediaPipe landmarks"""
        try:
            # Key landmarks indices
            nose = landmarks[0]
            left_shoulder = landmarks[11]
            right_shoulder = landmarks[12]
            left_hip = landmarks[23]
            right_hip = landmarks[24]
            left_knee = landmarks[25]
            right_knee = landmarks[26]
            left_ankle = landmarks[27]
            right_ankle = landmarks[28]
            
            # Calculate torso angle (vertical alignment)
            shoulder_center_y = (left_shoulder.y + right_shoulder.y) / 2
            hip_center_y = (left_hip.y + right_hip.y) / 2
            torso_angle = abs(np.degrees(np.arctan2(
                hip_center_y - shoulder_center_y,
                (left_hip.x + right_hip.x) / 2 - (left_shoulder.x + right_shoulder.x) / 2
            )))
            
            # Calculate hip bend angle
            hip_center_x = (left_hip.x + right_hip.x) / 2
            hip_center_y = (left_hip.y + right_hip.y) / 2
            knee_center_x = (left_knee.x + right_knee.x) / 2
            knee_center_y = (left_knee.y + right_knee.y) / 2
            
            hip_bend_angle = np.degrees(np.arctan2(
                knee_center_y - hip_center_y,
                knee_center_x - hip_center_x
            ))
            hip_bend_angle = abs(hip_bend_angle) if hip_bend_angle < 0 else 180 - hip_bend_angle
            
            # Calculate leg spread
            leg_spread = abs(left_ankle.x - right_ankle.x)
            
            # Determine body orientation
            shoulder_width = abs(left_shoulder.x - right_shoulder.x)
            if shoulder_width < 0.1:
                body_orientation = 'side_view'
            elif nose.x < (left_shoulder.x + right_shoulder.x) / 2 - 0.05:
                body_orientation = 'facing_left'
            elif nose.x > (left_shoulder.x + right_shoulder.x) / 2 + 0.05:
                body_orientation = 'facing_right'
            else:
                body_orientation = 'facing_camera'
            
            return {
                'torso_angle': torso_angle,
                'hip_bend_angle': hip_bend_angle,
                'leg_spread': leg_spread,
                'body_orientation': body_orientation,
                'shoulder_width': shoulder_width
            }
            
        except Exception as e:
            logger.error(f"Pose metrics calculation failed: {e}")
            return {
                'torso_angle': 0,
                'hip_bend_angle': 90,
                'leg_spread': 0,
                'body_orientation': 'unknown',
                'shoulder_width': 0
            }

    def _classify_pose(self, torso_angle: float, hip_bend_angle: float, 
                      body_orientation: str, leg_spread: float) -> Dict:
        """Classify pose as artistic vs suggestive"""
        suggestive_score = 0.0
        reasoning = []
        
        # Bent over poses (high suggestive potential)
        if hip_bend_angle < 100 and torso_angle > 30:
            suggestive_score += 0.4
            reasoning.append('bent_over_pose')
            
        # Wide leg spread (moderate suggestive potential)  
        if leg_spread > 0.3:
            suggestive_score += 0.3
            reasoning.append('wide_leg_spread')
        
        # Extreme torso angles (moderate suggestive potential)
        if torso_angle > 45:
            suggestive_score += 0.2
            reasoning.append('extreme_torso_angle')
        
        # Side view with bent posture (moderate suggestive potential)
        if body_orientation == 'side_view' and hip_bend_angle < 120:
            suggestive_score += 0.25
            reasoning.append('side_view_bent_posture')
        
        # Determine category based on score
        if suggestive_score >= 0.6:
            category = 'highly_suggestive'
        elif suggestive_score >= 0.3:
            category = 'moderately_suggestive'  
        else:
            category = 'artistic_or_neutral'
        
        return {
            'pose_category': category,
            'suggestive_score': suggestive_score,
            'details': {
                'reasoning': reasoning,
                'torso_angle': torso_angle,
                'hip_bend_angle': hip_bend_angle,
                'body_orientation': body_orientation,
                'leg_spread': leg_spread
            }
        }

    def _combine_assessments(self, nudity_analysis: Dict, pose_analysis: Dict, 
                           context_type: str) -> Dict:
        """Combine nudity and pose analysis for final assessment"""
        try:
            # Base risk from nudity detection
            nudity_risk = nudity_analysis['nudity_score'] / 100.0
            
            # Pose risk contribution
            pose_risk = pose_analysis['suggestive_score']
            
            # Combine risks (weighted average)
            if nudity_analysis['has_nudity']:
                # If nudity is detected, pose matters more
                final_risk_score = (nudity_risk * 0.7) + (pose_risk * 0.3)
            else:
                # If no nudity, pose matters less
                final_risk_score = (nudity_risk * 0.9) + (pose_risk * 0.1)
            
            # Convert back to percentage
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
            if not reasoning:
                reasoning.append('content_appears_safe')
            
            return {
                'final_risk_score': final_risk_score,
                'risk_level': risk_level,
                'reasoning': reasoning,
                'nudity_contribution': nudity_risk * 100,
                'pose_contribution': pose_risk * 100
            }
            
        except Exception as e:
            logger.error(f"Assessment combination failed: {e}")
            return {
                'final_risk_score': 95.0,  # Conservative fallback
                'risk_level': 'high',
                'reasoning': [f'assessment_error: {str(e)}'],
                'nudity_contribution': 0,
                'pose_contribution': 0
            }

    def _generate_moderation_decision(self, combined_assessment: Dict, context_type: str) -> Dict:
        """Generate final moderation decision based on combined assessment"""
        risk_score = combined_assessment['final_risk_score']
        risk_level = combined_assessment['risk_level']
        
        # Context-based thresholds
        thresholds = {
            'public_gallery': {'auto_approve': 20, 'auto_reject': 80},
            'private_gallery': {'auto_approve': 60, 'auto_reject': 95},
            'paysite_content': {'auto_approve': 70, 'auto_reject': 90}
        }
        
        context_thresholds = thresholds.get(context_type, thresholds['public_gallery'])
        
        # Make decision
        if risk_score <= context_thresholds['auto_approve']:
            status = 'auto_approved'
            action = 'approve_automatically'
            human_review_required = False
        elif risk_score >= context_thresholds['auto_reject']:
            status = 'auto_rejected'
            action = 'reject_automatically'
            human_review_required = False
        else:
            status = 'flagged_for_review'
            action = 'require_human_review'  
            human_review_required = True
        
        return {
            'status': status,
            'action': action,
            'human_review_required': human_review_required,
            'confidence': min(100 - risk_score, risk_score) if status != 'flagged_for_review' else 50,
            'context_type': context_type,
            'applied_thresholds': context_thresholds
        }

# Flask Routes
api = EnhancedModerationAPI()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Enhanced Moderation API with MediaPipe + NudeNet',
        'version': '2.0'
    })

@app.route('/analyze', methods=['POST'])
def analyze_image():
    """Main analysis endpoint"""
    try:
        # Check if image file is provided
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file provided'}), 400
        
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'success': False, 'error': 'No image file selected'}), 400
        
        # Get additional parameters
        context_type = request.form.get('context_type', 'public_gallery')
        model_id = int(request.form.get('model_id', 1))
        
        # Save uploaded image temporarily
        temp_path = f'/tmp/analysis_{model_id}_{image_file.filename}'
        image_file.save(temp_path)
        
        try:
            # Perform analysis
            result = api.analyze_image(temp_path, context_type, model_id)
            
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
            
            return jsonify(result)
            
        except Exception as e:
            # Clean up temp file on error
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
        
    except Exception as e:
        logger.error(f"Analysis endpoint error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'analysis_version': '2.0_enhanced_with_pose'
        }), 500

if __name__ == '__main__':
    print("🚀 Starting Enhanced Moderation API Server...")
    print("📡 MediaPipe + NudeNet Analysis")
    print("🔍 Endpoints:")
    print("   - Health: http://0.0.0.0:5000/health")
    print("   - Analyze: http://0.0.0.0:5000/analyze")
    print("=" * 50)
    
    app.run(host='0.0.0.0', port=5000, debug=False)
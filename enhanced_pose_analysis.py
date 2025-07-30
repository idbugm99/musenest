#!/usr/bin/env python3
"""
Enhanced MediaPipe Pose Analysis - Returns all 33 body landmarks
This update provides comprehensive pose data for better analysis
"""

import cv2
import numpy as np
import mediapipe as mp
import json
import logging
from typing import Dict, List, Tuple, Optional

logger = logging.getLogger(__name__)

class EnhancedPoseAnalyzer:
    """Enhanced pose analyzer that returns all 33 MediaPipe landmarks"""
    
    def __init__(self):
        """Initialize MediaPipe with all landmark detection"""
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=True,
            model_complexity=2,  # Increased for better accuracy
            enable_segmentation=False,
            min_detection_confidence=0.5,  # Increased confidence threshold
            min_tracking_confidence=0.5
        )
        
        # All 33 MediaPipe landmarks
        self.landmark_names = [
            'NOSE', 'LEFT_EYE_INNER', 'LEFT_EYE', 'LEFT_EYE_OUTER',
            'RIGHT_EYE_INNER', 'RIGHT_EYE', 'RIGHT_EYE_OUTER',
            'LEFT_EAR', 'RIGHT_EAR', 'MOUTH_LEFT', 'MOUTH_RIGHT',
            'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW', 'RIGHT_ELBOW',
            'LEFT_WRIST', 'RIGHT_WRIST', 'LEFT_PINKY', 'RIGHT_PINKY',
            'LEFT_INDEX', 'RIGHT_INDEX', 'LEFT_THUMB', 'RIGHT_THUMB',
            'LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE',
            'LEFT_ANKLE', 'RIGHT_ANKLE', 'LEFT_HEEL', 'RIGHT_HEEL',
            'LEFT_FOOT_INDEX', 'RIGHT_FOOT_INDEX'
        ]

    def _analyze_pose(self, image_rgb: np.ndarray) -> Dict:
        """Enhanced pose analysis returning all 33 landmarks"""
        try:
            # Process image with MediaPipe
            results = self.pose.process(image_rgb)
            
            if not results.pose_landmarks:
                return {
                    'pose_detected': False,
                    'pose_category': 'no_pose_detected',
                    'suggestive_score': 0,
                    'details': {'reasoning': ['no_pose_landmarks_found']},
                    'landmarks': {},
                    'landmark_count': 0
                }
            
            # Extract ALL landmarks with comprehensive data
            landmarks = results.pose_landmarks.landmark
            landmark_data = self._extract_all_landmarks(landmarks)
            
            # Calculate comprehensive pose metrics
            pose_metrics = self._calculate_comprehensive_pose_metrics(landmarks)
            
            # Enhanced pose classification
            pose_result = self._classify_enhanced_pose(pose_metrics, landmark_data)
            
            return {
                'pose_detected': True,
                'pose_category': pose_result['pose_category'],
                'suggestive_score': pose_result['suggestive_score'],
                'details': pose_result['details'],
                'raw_metrics': pose_metrics,
                'landmarks': landmark_data,
                'landmark_count': len(landmark_data),
                'pose_confidence': self._calculate_pose_confidence(landmarks)
            }
            
        except Exception as e:
            logger.error(f"Enhanced pose analysis failed: {e}")
            return {
                'pose_detected': False,
                'pose_category': 'analysis_error',
                'suggestive_score': 0,
                'details': {'reasoning': [f'pose_analysis_error: {str(e)}']},
                'landmarks': {},
                'landmark_count': 0
            }

    def _extract_all_landmarks(self, landmarks) -> Dict:
        """Extract all 33 landmarks with coordinates and visibility"""
        landmark_data = {}
        
        for i, landmark in enumerate(landmarks):
            if i < len(self.landmark_names):
                landmark_name = self.landmark_names[i]
                landmark_data[landmark_name] = {
                    'x': float(landmark.x),
                    'y': float(landmark.y),
                    'z': float(landmark.z),
                    'visibility': float(getattr(landmark, 'visibility', 1.0))
                }
        
        return landmark_data

    def _calculate_comprehensive_pose_metrics(self, landmarks) -> Dict:
        """Calculate comprehensive pose metrics using all available landmarks"""
        try:
            # Core body landmarks
            nose = landmarks[0]
            left_shoulder = landmarks[11]
            right_shoulder = landmarks[12]
            left_elbow = landmarks[13]
            right_elbow = landmarks[14]
            left_wrist = landmarks[15]
            right_wrist = landmarks[16]
            left_hip = landmarks[23]
            right_hip = landmarks[24]
            left_knee = landmarks[25]
            right_knee = landmarks[26]
            left_ankle = landmarks[27]
            right_ankle = landmarks[28]
            
            # Hand landmarks
            left_pinky = landmarks[17]
            right_pinky = landmarks[18]
            left_index = landmarks[19]
            right_index = landmarks[20]
            left_thumb = landmarks[21]
            right_thumb = landmarks[22]
            
            # Foot landmarks
            left_heel = landmarks[29]
            right_heel = landmarks[30]
            left_foot_index = landmarks[31]
            right_foot_index = landmarks[32]
            
            # Calculate enhanced metrics
            metrics = {}
            
            # 1. Torso metrics
            shoulder_center = ((left_shoulder.x + right_shoulder.x) / 2, 
                             (left_shoulder.y + right_shoulder.y) / 2)
            hip_center = ((left_hip.x + right_hip.x) / 2, 
                         (left_hip.y + right_hip.y) / 2)
            
            torso_dx = hip_center[0] - shoulder_center[0]
            torso_dy = hip_center[1] - shoulder_center[1]
            metrics['torso_angle'] = np.degrees(np.arctan2(abs(torso_dx), abs(torso_dy))) if torso_dy != 0 else 90
            metrics['torso_lean'] = torso_dx
            
            # 2. Arm positioning
            metrics['left_arm_angle'] = self._calculate_arm_angle(left_shoulder, left_elbow, left_wrist)
            metrics['right_arm_angle'] = self._calculate_arm_angle(right_shoulder, right_elbow, right_wrist)
            metrics['arms_raised'] = (left_shoulder.y > nose.y or right_shoulder.y > nose.y)
            
            # 3. Leg positioning
            metrics['leg_spread'] = abs(left_ankle.x - right_ankle.x)
            metrics['left_leg_bend'] = self._calculate_leg_bend(left_hip, left_knee, left_ankle)
            metrics['right_leg_bend'] = self._calculate_leg_bend(right_hip, right_knee, right_ankle)
            
            # 4. Hip analysis
            hip_knee_center = ((left_knee.x + right_knee.x) / 2, 
                              (left_knee.y + right_knee.y) / 2)
            hip_dx = hip_knee_center[0] - hip_center[0]
            hip_dy = hip_knee_center[1] - hip_center[1]
            metrics['hip_bend_angle'] = np.degrees(np.arctan2(abs(hip_dx), abs(hip_dy))) if hip_dy != 0 else 0
            
            # 5. Body orientation (enhanced)
            metrics['body_orientation'] = self._determine_enhanced_body_orientation(landmarks)
            
            # 6. Hand positioning
            metrics['hand_positions'] = {
                'left_hand_near_body': self._is_hand_near_body(left_wrist, left_hip, left_shoulder),
                'right_hand_near_body': self._is_hand_near_body(right_wrist, right_hip, right_shoulder),
                'hands_together': abs(left_wrist.x - right_wrist.x) < 0.1
            }
            
            # 7. Overall body symmetry
            metrics['body_symmetry'] = self._calculate_body_symmetry(landmarks)
            
            # 8. Pose stability
            metrics['pose_stability'] = self._calculate_pose_stability(landmarks)
            
            return metrics
            
        except Exception as e:
            logger.error(f"Comprehensive pose metrics calculation failed: {e}")
            return {
                'torso_angle': 0,
                'hip_bend_angle': 90,
                'leg_spread': 0,
                'body_orientation': 'unknown'
            }

    def _calculate_arm_angle(self, shoulder, elbow, wrist):
        """Calculate arm angle from shoulder to wrist"""
        try:
            shoulder_to_elbow = np.array([elbow.x - shoulder.x, elbow.y - shoulder.y])
            elbow_to_wrist = np.array([wrist.x - elbow.x, wrist.y - elbow.y])
            
            dot_product = np.dot(shoulder_to_elbow, elbow_to_wrist)
            norms = np.linalg.norm(shoulder_to_elbow) * np.linalg.norm(elbow_to_wrist)
            
            if norms == 0:
                return 180
                
            cos_angle = dot_product / norms
            cos_angle = np.clip(cos_angle, -1, 1)
            return np.degrees(np.arccos(cos_angle))
        except:
            return 180

    def _calculate_leg_bend(self, hip, knee, ankle):
        """Calculate leg bend angle"""
        try:
            hip_to_knee = np.array([knee.x - hip.x, knee.y - hip.y])
            knee_to_ankle = np.array([ankle.x - knee.x, ankle.y - knee.y])
            
            dot_product = np.dot(hip_to_knee, knee_to_ankle)
            norms = np.linalg.norm(hip_to_knee) * np.linalg.norm(knee_to_ankle)
            
            if norms == 0:
                return 180
                
            cos_angle = dot_product / norms
            cos_angle = np.clip(cos_angle, -1, 1)
            return np.degrees(np.arccos(cos_angle))
        except:
            return 180

    def _determine_enhanced_body_orientation(self, landmarks):
        """Enhanced body orientation detection using multiple landmarks"""
        try:
            # Face landmarks
            nose = landmarks[0]
            left_ear = landmarks[7]
            right_ear = landmarks[8]
            
            # Shoulder landmarks
            left_shoulder = landmarks[11]
            right_shoulder = landmarks[12]
            
            # Calculate metrics
            ear_spread = abs(left_ear.x - right_ear.x)
            shoulder_spread = abs(left_shoulder.x - right_shoulder.x)
            
            # Face visibility
            nose_vis = getattr(nose, 'visibility', 1.0)
            left_ear_vis = getattr(left_ear, 'visibility', 1.0)
            right_ear_vis = getattr(right_ear, 'visibility', 1.0)
            avg_face_vis = (nose_vis + left_ear_vis + right_ear_vis) / 3
            
            # Determine orientation
            if ear_spread < 0.08 and avg_face_vis < 0.7:
                return 'facing_away'
            elif shoulder_spread < 0.15:
                return 'side_view'
            else:
                return 'facing_camera'
                
        except:
            return 'unknown'

    def _is_hand_near_body(self, wrist, hip, shoulder):
        """Check if hand is positioned near body"""
        try:
            body_center_x = (hip.x + shoulder.x) / 2
            return abs(wrist.x - body_center_x) < 0.2
        except:
            return False

    def _calculate_body_symmetry(self, landmarks):
        """Calculate overall body symmetry score"""
        try:
            symmetry_score = 0
            comparisons = 0
            
            # Compare paired landmarks
            pairs = [
                (11, 12),  # shoulders
                (13, 14),  # elbows
                (15, 16),  # wrists
                (23, 24),  # hips
                (25, 26),  # knees
                (27, 28),  # ankles
            ]
            
            for left_idx, right_idx in pairs:
                left_point = landmarks[left_idx]
                right_point = landmarks[right_idx]
                
                # Calculate symmetry based on y-coordinate similarity
                y_diff = abs(left_point.y - right_point.y)
                symmetry_score += max(0, 1 - y_diff * 5)  # Scale factor
                comparisons += 1
            
            return symmetry_score / comparisons if comparisons > 0 else 0
            
        except:
            return 0

    def _calculate_pose_stability(self, landmarks):
        """Calculate pose stability based on landmark confidence"""
        try:
            total_visibility = 0
            count = 0
            
            for landmark in landmarks:
                visibility = getattr(landmark, 'visibility', 1.0)
                total_visibility += visibility
                count += 1
            
            return total_visibility / count if count > 0 else 0
            
        except:
            return 0

    def _calculate_pose_confidence(self, landmarks):
        """Calculate overall pose detection confidence"""
        try:
            # Key landmarks for pose confidence
            key_indices = [0, 11, 12, 23, 24, 25, 26]  # nose, shoulders, hips, knees
            total_visibility = 0
            
            for idx in key_indices:
                if idx < len(landmarks):
                    visibility = getattr(landmarks[idx], 'visibility', 1.0)
                    total_visibility += visibility
            
            return total_visibility / len(key_indices)
            
        except:
            return 0

    def _classify_enhanced_pose(self, metrics: Dict, landmarks: Dict) -> Dict:
        """Enhanced pose classification using comprehensive metrics"""
        try:
            suggestive_score = 0.0
            reasoning = []
            pose_category = 'neutral'
            
            # Analyze various pose aspects
            
            # 1. Torso positioning
            if metrics.get('torso_angle', 0) > 45:
                suggestive_score += 0.3
                reasoning.append('significant_torso_lean')
                pose_category = 'leaning'
            
            # 2. Hip positioning
            if metrics.get('hip_bend_angle', 0) < 60:
                suggestive_score += 0.4
                reasoning.append('pronounced_hip_bend')
                pose_category = 'bent_over'
            
            # 3. Leg positioning
            leg_spread = metrics.get('leg_spread', 0)
            if leg_spread > 0.3:
                suggestive_score += 0.2
                reasoning.append('wide_leg_stance')
            
            # 4. Arm positioning
            if metrics.get('arms_raised', False):
                suggestive_score += 0.1
                reasoning.append('arms_raised')
            
            # 5. Hand positioning
            hand_pos = metrics.get('hand_positions', {})
            if hand_pos.get('left_hand_near_body') or hand_pos.get('right_hand_near_body'):
                suggestive_score += 0.15
                reasoning.append('hands_near_body')
            
            # 6. Body orientation factor
            orientation = metrics.get('body_orientation', 'unknown')
            if orientation == 'facing_away':
                suggestive_score += 0.2
                reasoning.append('facing_away')
            
            # Normalize suggestive score
            suggestive_score = min(suggestive_score, 1.0)
            
            # Determine final category
            if suggestive_score >= 0.7:
                pose_category = 'highly_suggestive'
            elif suggestive_score >= 0.4:
                pose_category = 'moderately_suggestive'
            elif suggestive_score >= 0.2:
                pose_category = 'mildly_suggestive'
            else:
                pose_category = 'neutral_or_artistic'
            
            if not reasoning:
                reasoning = ['neutral_pose_detected']
            
            return {
                'pose_category': pose_category,
                'suggestive_score': suggestive_score,
                'details': {
                    'reasoning': reasoning,
                    'body_orientation': orientation,
                    'torso_angle': metrics.get('torso_angle', 0),
                    'hip_bend_angle': metrics.get('hip_bend_angle', 0),
                    'leg_spread': leg_spread,
                    'pose_stability': metrics.get('pose_stability', 0),
                    'body_symmetry': metrics.get('body_symmetry', 0)
                }
            }
            
        except Exception as e:
            logger.error(f"Enhanced pose classification failed: {e}")
            return {
                'pose_category': 'analysis_error',
                'suggestive_score': 0,
                'details': {'reasoning': [f'classification_error: {str(e)}']}
            }
#!/usr/bin/env python3
"""
Enhanced Moderation Pipeline v3.0
Multi-stage content moderation with NudeNet + BLIP + InsightFace
Replaces pose detection with age estimation and image description
"""

import cv2
import numpy as np
import json
import os
from flask import Flask, request, jsonify
from nudenet import NudeDetector
import logging
from typing import Dict, List, Tuple, Optional
import traceback
from PIL import Image, ExifTags
import tempfile
import torch
from transformers import BlipProcessor, BlipForConditionalGeneration
import insightface
from insightface.app import FaceAnalysis

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

class EnhancedModerationPipelineV3:
    def __init__(self):
        """Initialize the enhanced moderation pipeline v3.0"""
        try:
            logger.info("🚀 Initializing Enhanced Moderation Pipeline v3.0...")
            
            # 1. Initialize NudeNet detector (existing)
            logger.info("📱 Loading NudeNet detector...")
            self.nude_detector = NudeDetector()
            
            # 2. Initialize BLIP-2 for image description
            logger.info("🖼️ Loading BLIP-2 model for image descriptions...")
            self.blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
            self.blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
            
            # 3. Initialize InsightFace for age/gender detection
            logger.info("👤 Loading InsightFace for age estimation...")
            self.face_analyzer = FaceAnalysis(providers=['CPUExecutionProvider'])
            self.face_analyzer.prepare(ctx_id=0, det_size=(640, 640))
            
            # Age thresholds
            self.MIN_AGE_THRESHOLD = 16
            self.SUSPICIOUS_AGE_THRESHOLD = 18
            
            logger.info("✅ Enhanced Moderation Pipeline v3.0 initialized successfully!")
            
        except Exception as e:
            logger.error(f"Failed to initialize Enhanced Moderation Pipeline v3.0: {e}")
            raise

    def normalize_image_orientation(self, image_path: str) -> str:
        """Apply EXIF rotation and normalize orientation"""
        try:
            img = Image.open(image_path)
            
            # Apply EXIF rotation
            try:
                exif = img._getexif()
                if exif is not None:
                    for key, value in ExifTags.TAGS.items():
                        if value == 'Orientation':
                            orientation = exif.get(key)
                            if orientation == 3:
                                img = img.rotate(180, expand=True)
                            elif orientation == 6:
                                img = img.rotate(90, expand=True)
                            elif orientation == 8:
                                img = img.rotate(-90, expand=True)
                            break
            except Exception as e:
                logger.warning(f"EXIF processing failed: {e}")
            
            # Save normalized image
            temp_fd, temp_path = tempfile.mkstemp(suffix='.jpg')
            os.close(temp_fd)
            img.save(temp_path, 'JPEG', quality=95, exif=b'')
            return temp_path
            
        except Exception as e:
            logger.error(f"Image orientation normalization failed: {e}")
            return image_path

    def analyze_image(self, image_path: str, context_type: str = 'public_gallery', 
                     model_id: int = 1) -> Dict:
        """
        Multi-stage content analysis pipeline v3.0
        """
        try:
            logger.info(f"🚀 Starting moderation pipeline v3.0 for: {image_path}")
            
            # Load and validate image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Could not load image from {image_path}")
            
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            logger.info(f"📷 Image loaded: {image.shape}")
            
            # Stage 1: NSFW Detection with NudeNet
            logger.info("🔞 Stage 1: Running NSFW detection...")
            nudity_analysis = self._analyze_nudity(image_path)
            
            # Stage 2: Face Detection & Age Estimation
            logger.info("👤 Stage 2: Running face detection and age estimation...")
            face_analysis = self._analyze_faces(image_rgb)
            
            # Stage 3: Image Description Generation
            logger.info("📝 Stage 3: Generating image description...")
            image_description = self._generate_image_description(image_path)
            
            # Stage 4: Combined Risk Assessment
            logger.info("⚖️ Stage 4: Performing combined risk assessment...")
            combined_assessment = self._combine_v3_assessments(
                nudity_analysis, face_analysis, image_description, context_type
            )
            
            # Stage 5: Generate Moderation Decision
            logger.info("🎯 Stage 5: Generating moderation decision...")
            moderation_decision = self._generate_v3_moderation_decision(
                combined_assessment, face_analysis, context_type
            )
            
            logger.info(f"✅ Analysis complete - Status: {moderation_decision['status']}")
            
            return {
                'success': True,
                'image_analysis': {
                    'nudity_detection': nudity_analysis,
                    'face_analysis': face_analysis,
                    'image_description': image_description,
                    'combined_assessment': combined_assessment
                },
                'moderation_decision': moderation_decision,
                'metadata': {
                    'context_type': context_type,
                    'model_id': model_id,
                    'analysis_version': '3.0_nudenet_blip_insightface',
                    'pipeline_stages': ['nudity_detection', 'face_analysis', 'image_description', 'risk_assessment']
                }
            }
            
        except Exception as e:
            logger.error(f"Pipeline v3.0 analysis failed: {e}")
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e),
                'analysis_version': '3.0_nudenet_blip_insightface'
            }

    def _analyze_nudity(self, image_path: str) -> Dict:
        """Stage 1: Analyze nudity using NudeNet"""
        normalized_path = None
        try:
            normalized_path = self.normalize_image_orientation(image_path)
            predictions = self.nude_detector.detect(normalized_path)
            
            if not predictions:
                return {
                    'has_nudity': False,
                    'nudity_score': 0,
                    'detected_parts': {},
                    'part_locations': {},
                    'part_count': 0
                }
            
            detected_parts = {}
            part_locations = {}
            max_score = 0
            
            for prediction in predictions:
                part_name = prediction['class']
                confidence = prediction['score'] * 100
                
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
            if normalized_path and normalized_path != image_path:
                try:
                    os.unlink(normalized_path)
                except:
                    pass

    def _analyze_faces(self, image_rgb: np.ndarray) -> Dict:
        """Stage 2: Detect faces and estimate ages using InsightFace"""
        try:
            # Detect faces
            faces = self.face_analyzer.get(image_rgb)
            
            if not faces:
                return {
                    'faces_detected': False,
                    'face_count': 0,
                    'faces': [],
                    'min_age': None,
                    'max_age': None,
                    'underage_detected': False,
                    'suspicious_ages': False
                }
            
            face_data = []
            ages = []
            genders = []
            
            for i, face in enumerate(faces):
                # Extract age and gender
                age = int(face.age) if hasattr(face, 'age') else 25  # Default fallback
                gender = 'M' if face.sex == 1 else 'F' if hasattr(face, 'sex') else 'Unknown'
                
                # Face bounding box
                bbox = face.bbox.astype(int) if hasattr(face, 'bbox') else [0, 0, 100, 100]
                
                face_info = {
                    'face_id': i + 1,
                    'age': age,
                    'gender': gender,
                    'bbox': {
                        'x': int(bbox[0]),
                        'y': int(bbox[1]),
                        'width': int(bbox[2] - bbox[0]),
                        'height': int(bbox[3] - bbox[1])
                    },
                    'confidence': float(face.det_score) if hasattr(face, 'det_score') else 0.9
                }
                
                face_data.append(face_info)
                ages.append(age)
                genders.append(gender)
            
            min_age = min(ages) if ages else None
            max_age = max(ages) if ages else None
            
            # Determine risk flags
            underage_detected = min_age < self.MIN_AGE_THRESHOLD if min_age else False
            suspicious_ages = min_age < self.SUSPICIOUS_AGE_THRESHOLD if min_age else False
            
            return {
                'faces_detected': True,
                'face_count': len(faces),
                'faces': face_data,
                'min_age': min_age,
                'max_age': max_age,
                'underage_detected': underage_detected,
                'suspicious_ages': suspicious_ages,
                'age_distribution': {
                    'under_16': sum(1 for age in ages if age < 16),
                    'under_18': sum(1 for age in ages if age < 18),
                    'adult': sum(1 for age in ages if age >= 18)
                }
            }
            
        except Exception as e:
            logger.error(f"Face analysis failed: {e}")
            return {
                'faces_detected': False,
                'face_count': 0,
                'faces': [],
                'min_age': None,
                'max_age': None,
                'underage_detected': False,
                'suspicious_ages': False,
                'error': str(e)
            }

    def _generate_image_description(self, image_path: str) -> Dict:
        """Stage 3: Generate image description using BLIP-2"""
        try:
            # Load and process image
            image = Image.open(image_path).convert('RGB')
            
            # Generate description
            inputs = self.blip_processor(image, return_tensors="pt")
            
            with torch.no_grad():
                out = self.blip_model.generate(**inputs, max_length=100, num_beams=3)
            
            description = self.blip_processor.decode(out[0], skip_special_tokens=True)
            
            # Generate tags from description
            tags = self._extract_tags_from_description(description)
            
            return {
                'description': description,
                'tags': tags,
                'description_length': len(description),
                'tag_count': len(tags)
            }
            
        except Exception as e:
            logger.error(f"Image description generation failed: {e}")
            return {
                'description': 'Description generation failed',
                'tags': [],
                'description_length': 0,
                'tag_count': 0,
                'error': str(e)
            }

    def _extract_tags_from_description(self, description: str) -> List[str]:
        """Extract relevant tags from image description"""
        # Simple keyword extraction (can be enhanced with NLP)
        keywords = [
            'woman', 'man', 'person', 'child', 'adult', 'beach', 'bedroom', 'bathroom',
            'bikini', 'underwear', 'dress', 'shirt', 'pants', 'nude', 'naked',
            'posing', 'sitting', 'standing', 'lying', 'smiling', 'looking'
        ]
        
        tags = []
        description_lower = description.lower()
        
        for keyword in keywords:
            if keyword in description_lower:
                tags.append(keyword)
        
        return tags

    def _combine_v3_assessments(self, nudity_analysis: Dict, face_analysis: Dict, 
                               image_description: Dict, context_type: str) -> Dict:
        """Stage 4: Combine all analyses for final risk assessment"""
        try:
            # Base nudity risk
            nudity_risk = nudity_analysis['nudity_score'] / 100.0
            
            # Age-based risk multiplier
            age_risk_multiplier = 1.0
            if face_analysis['underage_detected']:
                age_risk_multiplier = 3.0  # Severe penalty for underage
            elif face_analysis['suspicious_ages']:
                age_risk_multiplier = 1.5  # Moderate penalty for suspicious ages
            
            # Description-based risk adjustment
            description_risk = 0.0
            risky_tags = ['nude', 'naked', 'underwear', 'bikini', 'bedroom', 'bathroom']
            description_tags = image_description.get('tags', [])
            
            for tag in risky_tags:
                if tag in description_tags:
                    description_risk += 0.1
            
            # Calculate final risk score
            base_risk = nudity_risk + description_risk
            final_risk_score = min(base_risk * age_risk_multiplier * 100, 100)
            
            # Determine risk level
            if final_risk_score >= 90:
                risk_level = 'critical'
            elif final_risk_score >= 70:
                risk_level = 'high'
            elif final_risk_score >= 40:
                risk_level = 'medium'
            elif final_risk_score >= 20:
                risk_level = 'low'
            else:
                risk_level = 'minimal'
            
            # Generate reasoning
            reasoning = []
            if nudity_analysis['has_nudity']:
                reasoning.append(f"nudity_detected_{nudity_analysis['nudity_score']:.1f}%")
            if face_analysis['underage_detected']:
                reasoning.append(f"underage_face_detected_min_age_{face_analysis['min_age']}")
            elif face_analysis['suspicious_ages']:
                reasoning.append(f"suspicious_age_detected_min_age_{face_analysis['min_age']}")
            if description_risk > 0:
                reasoning.append(f"risky_content_tags_{len([t for t in description_tags if t in risky_tags])}")
            if not reasoning:
                reasoning.append('content_appears_safe')
            
            return {
                'final_risk_score': final_risk_score,
                'risk_level': risk_level,
                'reasoning': reasoning,
                'nudity_contribution': nudity_risk * 100,
                'age_risk_multiplier': age_risk_multiplier,
                'description_risk': description_risk * 100,
                'face_count': face_analysis['face_count'],
                'min_detected_age': face_analysis['min_age']
            }
            
        except Exception as e:
            logger.error(f"Assessment combination failed: {e}")
            return {
                'final_risk_score': 95.0,
                'risk_level': 'critical',
                'reasoning': [f'assessment_error: {str(e)}'],
                'nudity_contribution': 0,
                'age_risk_multiplier': 1.0,
                'description_risk': 0
            }

    def _generate_v3_moderation_decision(self, combined_assessment: Dict, 
                                        face_analysis: Dict, context_type: str) -> Dict:
        """Stage 5: Generate final moderation decision"""
        risk_score = combined_assessment['final_risk_score']
        
        # Auto-reject if underage detected
        if face_analysis['underage_detected']:
            return {
                'status': 'auto_rejected',
                'action': 'reject_underage_content',
                'human_review_required': True,
                'confidence': 99,
                'context_type': context_type,
                'rejection_reason': f"Detected face appears under {self.MIN_AGE_THRESHOLD} years old",
                'min_detected_age': face_analysis['min_age']
            }
        
        # Context-based thresholds
        thresholds = {
            'public_gallery': {'auto_approve': 15, 'auto_reject': 70},
            'private_gallery': {'auto_approve': 40, 'auto_reject': 85},
            'paysite_content': {'auto_approve': 25, 'auto_reject': 80}
        }
        
        context_thresholds = thresholds.get(context_type, thresholds['public_gallery'])
        
        # Make standard decision
        if risk_score <= context_thresholds['auto_approve']:
            status = 'auto_approved'
            action = 'approve_automatically'
            human_review = False
            confidence = 100 - risk_score
        elif risk_score >= context_thresholds['auto_reject']:
            status = 'auto_rejected'
            action = 'reject_automatically'
            human_review = True
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
            'applied_thresholds': context_thresholds,
            'face_count': face_analysis['face_count'],
            'min_detected_age': face_analysis['min_age']
        }

# Initialize the API
api = EnhancedModerationPipelineV3()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'message': 'Enhanced Moderation Pipeline v3.0 (NudeNet + BLIP + InsightFace)',
        'status': 'healthy',
        'version': '3.0',
        'pipeline_stages': ['nudity_detection', 'face_analysis', 'image_description', 'risk_assessment']
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
            'analysis_version': '3.0_nudenet_blip_insightface'
        }), 500

if __name__ == '__main__':
    logger.info("🚀 Starting Enhanced Moderation Pipeline v3.0")
    app.run(host='0.0.0.0', port=5000, debug=False)
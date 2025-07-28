#!/usr/bin/env python3

# Quick diagnostic script to find the pose_category issue
import traceback

def test_classify_pose():
    """Test the _classify_pose method in isolation"""
    try:
        # Simulate the method logic that's failing
        torso_angle = 30.0
        hip_bend_angle = 95.0
        body_orientation = "facing_camera"
        leg_spread = 0.2
        
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
        
        # THIS IS THE KEY - make sure we return 'pose_category' not 'category'
        result = {
            'pose_category': category,  # This must match what the calling code expects
            'suggestive_score': suggestive_score,
            'details': {
                'reasoning': reasoning,
                'torso_angle': torso_angle,
                'hip_bend_angle': hip_bend_angle,
                'body_orientation': body_orientation,
                'leg_spread': leg_spread
            }
        }
        
        print("✅ Classification result:", result)
        print(f"✅ pose_category = {result['pose_category']}")
        
        return result
        
    except Exception as e:
        print(f"❌ Error in classify_pose: {e}")
        print(traceback.format_exc())
        return None

if __name__ == '__main__':
    print("🔍 Testing pose classification logic...")
    test_classify_pose()
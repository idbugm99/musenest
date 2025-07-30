#!/bin/bash

echo "🧪 Testing Pose Analysis API with Real Image"
echo "============================================="

# Test with the actual provided image
echo "1. Checking for test image..."
TEST_IMAGE="real_pose_test.jpg"

if [ ! -f "$TEST_IMAGE" ]; then
    echo "❌ $TEST_IMAGE not found. Please upload the image as '$TEST_IMAGE' first."
    echo "Usage: Copy your image to this directory and rename it to '$TEST_IMAGE'"
    exit 1
fi

echo "✅ Found test image: $TEST_IMAGE"

echo -e "\n2. Testing API endpoint with real image..."
echo "📤 Uploading real pose image to analysis server..."
curl -X POST http://localhost:5000/analyze \
     -F "image=@$TEST_IMAGE" \
     -F "context_type=public_gallery" \
     -F "model_id=1" \
     --max-time 30 \
     | python3 -m json.tool 2>/dev/null || echo "JSON parsing failed"

echo -e "\n3. Checking for error patterns in recent logs..."
journalctl --since "30 minutes ago" | grep -i "error\|exception\|traceback" | tail -5
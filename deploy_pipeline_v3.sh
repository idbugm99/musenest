#!/bin/bash

echo "🚀 Deploying Enhanced Moderation Pipeline v3.0"
echo "NudeNet + BLIP + InsightFace Integration"
echo "================================================"

echo "1. 🛑 Stopping current API service..."
pkill -f enhanced_moderation_api_debug.py
sleep 3

echo "2. 📋 Backing up current version..."
if [ -f "enhanced_moderation_api_debug.py" ]; then
    cp enhanced_moderation_api_debug.py enhanced_moderation_api_debug_backup_v2_$(date +%Y%m%d_%H%M%S).py
    echo "   ✅ v2.0 backup created"
fi

echo "3. 📦 Installing new dependencies..."
source venv/bin/activate

echo "   📥 Installing PyTorch and transformers..."
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo "   📥 Installing BLIP and InsightFace..."
pip install transformers>=4.21.0
pip install insightface>=0.7.3
pip install onnx>=1.14.0
pip install onnxruntime>=1.15.0
pip install accelerate>=0.20.0
pip install safetensors>=0.3.0

echo "4. 🔄 Activating pipeline v3.0..."
cp enhanced_moderation_pipeline_v3.py enhanced_moderation_api_debug.py
echo "   ✅ Pipeline v3.0 activated"

echo "5. 🧪 Testing new pipeline imports..."
python3 -c "
try:
    from transformers import BlipProcessor, BlipForConditionalGeneration
    print('   ✅ BLIP models imported successfully')
except Exception as e:
    print(f'   ❌ BLIP import failed: {e}')
    exit(1)

try:
    import insightface
    from insightface.app import FaceAnalysis
    print('   ✅ InsightFace imported successfully')
except Exception as e:
    print(f'   ❌ InsightFace import failed: {e}')
    exit(1)

try:
    from nudenet import NudeDetector
    print('   ✅ NudeNet imported successfully')
except Exception as e:
    print(f'   ❌ NudeNet import failed: {e}')
    exit(1)

print('   🎉 All pipeline components ready!')
"

if [ $? -eq 0 ]; then
    echo "6. 🚀 Starting Enhanced Pipeline v3.0..."
    nohup python enhanced_moderation_api_debug.py > api_pipeline_v3.log 2>&1 &
    
    echo "7. ⏳ Waiting for service to start..."
    sleep 10
    
    echo "8. 🔍 Testing health endpoint..."
    curl -s http://localhost:5000/health | python3 -m json.tool
    
    echo -e "\n✅ Enhanced Moderation Pipeline v3.0 deployed successfully!"
    echo ""
    echo "🔬 New Features:"
    echo "   • NudeNet NSFW detection (existing)"
    echo "   • BLIP-2 image description generation"
    echo "   • InsightFace age estimation"
    echo "   • Auto-rejection for under-16 faces"
    echo "   • Multi-stage risk assessment"
    echo ""
    echo "📊 Pipeline Stages:"
    echo "   1. NSFW Detection (NudeNet)"
    echo "   2. Face Detection & Age Estimation (InsightFace)"
    echo "   3. Image Description (BLIP-2)"
    echo "   4. Combined Risk Assessment"
    echo "   5. Moderation Decision"
    echo ""
    echo "📝 Log file: api_pipeline_v3.log"
    echo "🔄 To rollback: cp enhanced_moderation_api_debug_backup_v2_*.py enhanced_moderation_api_debug.py"
else
    echo "❌ Pipeline v3.0 dependencies failed to install - deployment aborted"
    exit 1
fi
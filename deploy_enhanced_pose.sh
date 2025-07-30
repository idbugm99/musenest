#!/bin/bash

echo "🚀 Deploying Enhanced MediaPipe Pose Analysis (33 landmarks)"
echo "============================================================"

echo "1. 🛑 Stopping current API service..."
pkill -f enhanced_moderation_api_debug.py
sleep 3

echo "2. 📋 Backing up current version..."
if [ -f "enhanced_moderation_api_debug.py" ]; then
    cp enhanced_moderation_api_debug.py enhanced_moderation_api_debug_backup_$(date +%Y%m%d_%H%M%S).py
    echo "   ✅ Backup created"
fi

echo "3. 🔄 Activating enhanced version with 33 landmarks..."
cp enhanced_moderation_api_v2.py enhanced_moderation_api_debug.py
echo "   ✅ Enhanced version activated"

echo "4. 🧪 Testing enhanced pose analyzer import..."
python3 -c "
try:
    from enhanced_pose_analysis import EnhancedPoseAnalyzer
    analyzer = EnhancedPoseAnalyzer()
    print('   ✅ Enhanced pose analyzer imported successfully')
    print(f'   📊 Landmark count: {len(analyzer.landmark_names)}')
    print('   🎯 All 33 MediaPipe landmarks ready')
except Exception as e:
    print(f'   ❌ Import failed: {e}')
    exit(1)
"

if [ $? -eq 0 ]; then
    echo "5. 🚀 Starting enhanced API service..."
    cd /home/ubuntu/ai-moderation
    source venv/bin/activate
    nohup python enhanced_moderation_api_debug.py > api_enhanced_33landmarks.log 2>&1 &
    
    echo "6. ⏳ Waiting for service to start..."
    sleep 5
    
    echo "7. 🔍 Testing health endpoint..."
    curl -s http://localhost:5000/health | python3 -m json.tool
    
    echo -e "\n✅ Enhanced MediaPipe pose analysis deployed successfully!"
    echo "📊 Features:"
    echo "   • All 33 MediaPipe landmarks"
    echo "   • Comprehensive pose metrics"
    echo "   • Enhanced body orientation detection"
    echo "   • Improved pose confidence scoring"
    echo "   • Better symmetry and stability analysis"
    echo ""
    echo "📝 Log file: api_enhanced_33landmarks.log"
    echo "🔄 To rollback: cp enhanced_moderation_api_debug_backup_*.py enhanced_moderation_api_debug.py"
else
    echo "❌ Enhanced pose analyzer failed to import - deployment aborted"
    exit 1
fi
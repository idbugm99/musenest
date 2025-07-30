#!/bin/bash

echo "🔍 Pose Analysis Server Diagnostics"
echo "=================================="

echo -e "\n1. 📊 System Status:"
uptime
free -h
df -h /

echo -e "\n2. 🐍 Python Processes:"
ps aux | grep -i python

echo -e "\n3. 🌐 Network Services:"
netstat -tlnp | grep 5000 || ss -tlnp | grep 5000

echo -e "\n4. 📂 Service Files:"
find /home -name "*pose*" -o -name "*mediapipe*" -o -name "*analysis*" 2>/dev/null | head -20
find /opt -name "*pose*" -o -name "*mediapipe*" -o -name "*analysis*" 2>/dev/null | head -20

echo -e "\n5. 📋 Recent Logs:"
journalctl --since "1 hour ago" | grep -i "pose\|error\|python" | tail -10

echo -e "\n6. 🔧 Python Environment:"
which python3
python3 --version
python3 -c "import tensorflow as tf; print('TensorFlow:', tf.__version__)" 2>/dev/null || echo "TensorFlow not found"
python3 -c "import mediapipe as mp; print('MediaPipe:', mp.__version__)" 2>/dev/null || echo "MediaPipe not found"

echo -e "\n7. 🧪 Service Health Test:"
curl -s -X GET http://localhost:5000/health || echo "Health endpoint not responding"

echo -e "\n8. 📁 Current Directory Contents:"
pwd
ls -la

echo -e "\n9. 🔍 Service Configuration:"
if [ -f "config.py" ]; then
    echo "Found config.py:"
    head -20 config.py
elif [ -f "app.py" ]; then
    echo "Found app.py (first 30 lines):"
    head -30 app.py
else
    echo "Looking for main application file..."
    find . -name "*.py" | head -5
fi

echo -e "\n10. 💾 Disk Space in Working Directory:"
du -sh . 2>/dev/null || echo "Cannot check directory size"
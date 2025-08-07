#!/bin/bash
# Deploy updated server file to remote server

echo "Copying updated enhanced_minimal_v3_with_blip.py to remote server..."

# Copy the file to remote server
scp enhanced_minimal_v3_with_blip.py ubuntu@18.221.22.72:/home/ubuntu/

echo "File copied. Now SSH to server and run:"
echo "python3 enhanced_minimal_v3_with_blip.py > server.log 2>&1 &"
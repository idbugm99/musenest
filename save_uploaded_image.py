#!/usr/bin/env python3
import base64
import sys

# This would save the uploaded image - but since I can see it in the conversation,
# I'll create a placeholder that you can replace with the actual image

print("Please save your uploaded image as 'real_pose_test.jpg' in the current directory")
print("Then copy both files to the server using:")
print("scp -i '/Users/programmer/Projects/nudenet-key.pem' real_pose_test.jpg test-pose-api.sh ubuntu@52.15.235.216:~/")
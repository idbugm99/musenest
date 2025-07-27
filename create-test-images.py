#!/usr/bin/env python3
"""
Create test images for NudeNet testing
"""

from PIL import Image, ImageDraw
import os

# Create test directory
os.makedirs('/tmp/nudenet_test', exist_ok=True)

# Test 1: Simple colored square (should be safe)
img1 = Image.new('RGB', (200, 200), color='blue')
img1.save('/tmp/nudenet_test/safe_image.jpg')
print('Created safe test image')

# Test 2: More complex safe image with shapes
img2 = Image.new('RGB', (300, 300), color='white')
draw = ImageDraw.Draw(img2)
draw.rectangle([50, 50, 150, 150], fill='red')
draw.ellipse([200, 200, 280, 280], fill='green')
img2.save('/tmp/nudenet_test/shapes_image.jpg')
print('Created shapes test image')

# Test 3: Text-like pattern
img3 = Image.new('RGB', (400, 200), color='lightgray')
draw3 = ImageDraw.Draw(img3)
for i in range(0, 400, 20):
    draw3.line([(i, 0), (i, 200)], fill='black', width=2)
img3.save('/tmp/nudenet_test/pattern_image.jpg')
print('Created pattern test image')

print('All test images created successfully')
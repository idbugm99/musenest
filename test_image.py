from PIL import Image
import os

# Create test image
img = Image.new('RGB', (200, 200), color='blue')
img.save('test_image.jpg')
print("Created test_image.jpg")
const sharp = require('sharp');
const path = require('path');

async function testOrientation() {
    const imagePath = '/Users/programmer/Projects/phoenix4ge/public/uploads/escort-example/originals/1753575429628_20250622_003419.jpg';
    
    console.log('=== ORIENTATION TEST ===');
    
    // Get metadata without auto-rotation
    const rawImage = sharp(imagePath, { autoRotate: false });
    const rawMetadata = await rawImage.metadata();
    console.log('Raw metadata:', {
        width: rawMetadata.width,
        height: rawMetadata.height,
        orientation: rawMetadata.orientation
    });
    
    // Get metadata with auto-rotation (default)
    const autoImage = sharp(imagePath);
    const autoMetadata = await autoImage.metadata();
    console.log('Auto-rotated metadata:', {
        width: autoMetadata.width,
        height: autoMetadata.height,
        orientation: autoMetadata.orientation
    });
    
    // Save both versions to compare
    await sharp(imagePath, { autoRotate: false })
        .jpeg({ quality: 90 })
        .toFile('/Users/programmer/Projects/phoenix4ge/test-raw.jpg');
    
    await sharp(imagePath)
        .jpeg({ quality: 90 })
        .toFile('/Users/programmer/Projects/phoenix4ge/test-auto.jpg');
    
    console.log('Test images saved: test-raw.jpg and test-auto.jpg');
    
    // Test coordinate transformation for orientation 6 (rotate 90° clockwise)
    if (rawMetadata.orientation === 6) {
        console.log('\n=== COORDINATE TRANSFORMATION FOR ORIENTATION 6 ===');
        console.log('Original image (raw): 2944w x 2208h');
        console.log('After 90° rotation: 2208w x 2944h');
        console.log('');
        
        // Test coordinates from admin interface
        const adminX = 1024, adminY = 1402, adminW = 655, adminH = 731;
        console.log(`Admin interface coordinates: x=${adminX}, y=${adminY}, w=${adminW}, h=${adminH}`);
        
        // For orientation 6, transform coordinates:
        // new_x = old_y
        // new_y = width - old_x - old_width  
        const rawX = adminY;
        const rawY = rawMetadata.width - adminX - adminW;
        const rawW = adminH;
        const rawH = adminW;
        
        console.log(`Raw image coordinates: x=${rawX}, y=${rawY}, w=${rawW}, h=${rawH}`);
    }
}

testOrientation().catch(console.error);
const sharp = require('sharp');
const path = require('path');

async function manualBlurTest() {
    try {
        console.log('=== Manual Blur Test ===');
        console.log('Replicating the exact same blur operation from the logs...');
        
        const originalPath = '/Users/programmer/Projects/phoenix4ge/public/uploads/escortexample/originals/1753687362085_BlowJob.jpg';
        const outputPath = '/Users/programmer/Projects/phoenix4ge/manual-blur-test.jpg';
        
        // From the logs: coordinates 416,463 with 121x139 dimensions
        const coordinates = { x: 416, y: 463, width: 121, height: 139 };
        const blurRadius = 25; // From logs: "Blur calibration: admin setting 10px → actual 25px"
        
        console.log('Original image:', originalPath);
        console.log('Coordinates:', coordinates);
        console.log('Blur radius:', blurRadius);
        
        // Step 1: Extract the region that should be blurred
        console.log('\n1. Extracting region...');
        const extractedRegion = await sharp(originalPath)
            .extract({ 
                left: coordinates.x, 
                top: coordinates.y, 
                width: coordinates.width, 
                height: coordinates.height 
            })
            .toBuffer();
            
        console.log('✅ Region extracted');
        
        // Step 2: Apply blur to the extracted region
        console.log('\n2. Applying blur...');
        const blurredRegion = await sharp(extractedRegion)
            .blur(blurRadius)
            .toBuffer();
            
        console.log('✅ Blur applied');
        
        // Step 3: Composite the blurred region back onto the original image
        console.log('\n3. Compositing back onto original...');
        await sharp(originalPath)
            .composite([{
                input: blurredRegion,
                left: coordinates.x,
                top: coordinates.y
            }])
            .jpeg({ quality: 90 })
            .toFile(outputPath);
            
        console.log('✅ Manual blur test completed');
        console.log('Output saved to:', outputPath);
        
        // Also save just the blurred region for inspection
        const regionPath = '/Users/programmer/Projects/phoenix4ge/manual-blur-region.jpg';
        await sharp(blurredRegion).jpeg().toFile(regionPath);
        console.log('Blurred region saved to:', regionPath);
        
    } catch (error) {
        console.error('❌ Manual blur test failed:', error);
    }
}

manualBlurTest();
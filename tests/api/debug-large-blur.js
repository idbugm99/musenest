const sharp = require('sharp');

async function testLargeBlur() {
    try {
        console.log('=== Large Blur Visibility Test ===');
        
        const originalPath = '/Users/programmer/Projects/phoenix4ge/public/uploads/escortexample/originals/1753687362085_BlowJob.jpg';
        const outputPath = '/Users/programmer/Projects/phoenix4ge/large-blur-test.jpg';
        
        // Create a much larger blur region in the center to make it clearly visible
        const metadata = await sharp(originalPath).metadata();
        console.log(`Image dimensions: ${metadata.width}x${metadata.height}`);
        
        const centerX = Math.floor(metadata.width / 2) - 400;
        const centerY = Math.floor(metadata.height / 2) - 300;
        const blurWidth = 800;
        const blurHeight = 600;
        const blurRadius = 50; // Very strong blur
        
        console.log(`Creating large blur region at: ${centerX},${centerY} ${blurWidth}x${blurHeight}`);
        console.log(`Blur radius: ${blurRadius}px`);
        
        // Extract large center region
        const extractedRegion = await sharp(originalPath)
            .extract({ 
                left: centerX, 
                top: centerY, 
                width: blurWidth, 
                height: blurHeight 
            })
            .toBuffer();
            
        // Apply strong blur
        const blurredRegion = await sharp(extractedRegion)
            .blur(blurRadius)
            .toBuffer();
            
        // Composite back
        await sharp(originalPath)
            .composite([{
                input: blurredRegion,
                left: centerX,
                top: centerY
            }])
            .jpeg({ quality: 90 })
            .toFile(outputPath);
            
        console.log('✅ Large blur test completed');
        console.log('Output saved to:', outputPath);
        console.log('This should show a clearly visible blurred region in the center');
        
    } catch (error) {
        console.error('❌ Large blur test failed:', error);
    }
}

testLargeBlur();
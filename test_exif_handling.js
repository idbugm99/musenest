const sharp = require('sharp');

// Test how Sharp handles EXIF vs our manual approach
async function compareExifHandling() {
    const testImage = '/Users/programmer/Projects/musenest/public/uploads/escortexample/originals/1753738244223_BendoverAss.jpg';
    
    console.log('=== SHARP AUTOMATIC EXIF ===');
    const autoExif = sharp(testImage); 
    const autoMeta = await autoExif.metadata();
    console.log('Auto EXIF dimensions:', autoMeta.width + 'x' + autoMeta.height);
    console.log('Original orientation:', autoMeta.orientation);
    
    console.log('\n=== SHARP WITHOUT EXIF ===');
    const noExif = sharp(testImage, { autoRotate: false });
    const noExifMeta = await noExif.metadata();
    console.log('No EXIF dimensions:', noExifMeta.width + 'x' + noExifMeta.height);
    console.log('Raw orientation:', noExifMeta.orientation);
    
    console.log('\n=== COORDINATE SYSTEM DIFFERENCE ===');
    if (autoMeta.width !== noExifMeta.width || autoMeta.height !== noExifMeta.height) {
        console.log('⚠️  DIMENSIONS DIFFERENT - Sharp auto-rotation affects coordinate system!');
        console.log('NudeNet sends coordinates for: manually rotated image');
        console.log('Sharp blur processes: auto-rotated image with different dimensions');
        console.log('This explains why blur appears in wrong location!');
    } else {
        console.log('✅ Dimensions match - coordinate systems should align');
    }
}

compareExifHandling().catch(console.error);
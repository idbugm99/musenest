/**
 * Blur Utility Functions
 * Shared blur implementation for consistency across the application
 */

class BlurUtils {
    
    /**
     * Apply Gaussian blur to a canvas overlay
     * @param {HTMLElement} overlay - The overlay element to apply blur to
     * @param {HTMLImageElement} sourceImage - The source image to blur from
     * @param {number} blurStrength - Blur strength in pixels
     * @param {number} opacity - Opacity of the white overlay (0-1)
     */
    static applyCanvasBlur(overlay, sourceImage, blurStrength, opacity) {
        if (!overlay || !sourceImage) return;
        
        // Remove any existing blur elements
        const existingCanvas = overlay.querySelector('canvas.blur-canvas');
        if (existingCanvas) existingCanvas.remove();
        
        // Create canvas for real Gaussian blur
        const canvas = document.createElement('canvas');
        canvas.className = 'blur-canvas';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        
        const ctx = canvas.getContext('2d');
        
        // Get dimensions
        const overlayRect = overlay.getBoundingClientRect();
        const imageRect = sourceImage.getBoundingClientRect();
        
        canvas.width = overlayRect.width;
        canvas.height = overlayRect.height;
        
        // Calculate source coordinates
        const scaleX = sourceImage.naturalWidth / imageRect.width;
        const scaleY = sourceImage.naturalHeight / imageRect.height;
        const sourceX = (overlayRect.left - imageRect.left) * scaleX;
        const sourceY = (overlayRect.top - imageRect.top) * scaleY;
        const sourceWidth = overlayRect.width * scaleX;
        const sourceHeight = overlayRect.height * scaleY;
        
        // Draw the image region
        ctx.drawImage(
            sourceImage,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, canvas.width, canvas.height
        );
        
        // Apply Gaussian blur using multiple box blurs (approximation)
        if (blurStrength > 0) {
            BlurUtils.applyGaussianBlur(ctx, canvas.width, canvas.height, blurStrength);
        }
        
        // Add white opacity overlay
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Clear overlay background
        overlay.style.backgroundColor = 'transparent';
        overlay.style.backdropFilter = 'none';
        
        // Add canvas to overlay
        overlay.appendChild(canvas);
    }
    
    /**
     * Remove blur from overlay
     * @param {HTMLElement} overlay - The overlay element to remove blur from
     */
    static removeCanvasBlur(overlay) {
        const existingCanvas = overlay.querySelector('canvas.blur-canvas');
        if (existingCanvas) existingCanvas.remove();
        
        // Reset styles
        overlay.style.backdropFilter = 'none';
        overlay.style.backgroundColor = 'transparent';
    }
    
    /**
     * Apply Gaussian blur to canvas context using box blur approximation
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {number} radius - Blur radius
     */
    static applyGaussianBlur(ctx, width, height, radius) {
        // Box blur approximation of Gaussian blur
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Apply multiple box blurs for Gaussian approximation
        BlurUtils.boxBlur(data, width, height, Math.floor(radius / 3));
        BlurUtils.boxBlur(data, width, height, Math.floor(radius / 3));
        BlurUtils.boxBlur(data, width, height, Math.floor(radius / 3));
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    /**
     * Box blur implementation for Gaussian approximation
     * @param {Uint8ClampedArray} data - Image data array
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} radius - Blur radius
     */
    static boxBlur(data, width, height, radius) {
        const temp = new Uint8ClampedArray(data);
        
        // Horizontal pass
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, a = 0, count = 0;
                
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = Math.max(0, Math.min(width - 1, x + dx));
                    const idx = (y * width + nx) * 4;
                    r += temp[idx];
                    g += temp[idx + 1];
                    b += temp[idx + 2];
                    a += temp[idx + 3];
                    count++;
                }
                
                const idx = (y * width + x) * 4;
                data[idx] = r / count;
                data[idx + 1] = g / count;
                data[idx + 2] = b / count;
                data[idx + 3] = a / count;
            }
        }
        
        // Copy back to temp for vertical pass
        temp.set(data);
        
        // Vertical pass
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                let r = 0, g = 0, b = 0, a = 0, count = 0;
                
                for (let dy = -radius; dy <= radius; dy++) {
                    const ny = Math.max(0, Math.min(height - 1, y + dy));
                    const idx = (ny * width + x) * 4;
                    r += temp[idx];
                    g += temp[idx + 1];
                    b += temp[idx + 2];
                    a += temp[idx + 3];
                    count++;
                }
                
                const idx = (y * width + x) * 4;
                data[idx] = r / count;
                data[idx + 1] = g / count;
                data[idx + 2] = b / count;
                data[idx + 3] = a / count;
            }
        }
    }
    
    /**
     * Real Gaussian blur preview that matches Sharp's backend processing
     * @param {HTMLElement} overlay - The overlay element
     * @param {number} blurRadius - Blur radius for visualization
     * @param {HTMLImageElement} sourceImage - The source image to blur from
     */
    static updateCanvasBlurPreview(overlay, blurRadius, sourceImage) {
        const canvas = overlay.querySelector('.blur-preview-canvas');
        if (!canvas) {
            console.warn('No canvas found in overlay');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        const width = parseFloat(overlay.style.width) || 100;
        const height = parseFloat(overlay.style.height) || 100;
        
        // Set canvas size to match overlay
        canvas.width = width;
        canvas.height = height;
        
        // Clear canvas first
        ctx.clearRect(0, 0, width, height);
        
        if (blurRadius > 0 && sourceImage) {
            try {
                // Get image position relative to canvas
                const imageElement = document.querySelector('.image-preview');
                if (!imageElement) {
                    console.warn('No image element found for blur preview');
                    return;
                }
                
                const imageRect = imageElement.getBoundingClientRect();
                const overlayRect = overlay.getBoundingClientRect();
                
                // Calculate source coordinates on the actual image
                const scaleX = sourceImage.naturalWidth / imageElement.clientWidth;
                const scaleY = sourceImage.naturalHeight / imageElement.clientHeight;
                const sourceX = (overlayRect.left - imageRect.left) * scaleX;
                const sourceY = (overlayRect.top - imageRect.top) * scaleY;
                const sourceWidth = width * scaleX;
                const sourceHeight = height * scaleY;
                
                // Draw the actual image region
                ctx.drawImage(
                    sourceImage,
                    sourceX, sourceY, sourceWidth, sourceHeight,
                    0, 0, width, height
                );
                
                // Apply REAL Gaussian blur
                if (ctx.filter !== undefined) {
                    // Modern browsers: use native Canvas filter
                    ctx.filter = `blur(${blurRadius}px)`;
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = width;
                    tempCanvas.height = height;
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.drawImage(canvas, 0, 0);
                    
                    ctx.clearRect(0, 0, width, height);
                    ctx.drawImage(tempCanvas, 0, 0);
                    ctx.filter = 'none';
                } else {
                    // Fallback: Apply Gaussian blur using multiple box blur passes
                    BlurUtils.applyGaussianBlur(ctx, width, height, blurRadius);
                }
                
                console.log(`Applied REAL Gaussian blur preview with ${blurRadius}px radius`);
            } catch (error) {
                console.warn('Failed to create real blur preview, using fallback:', error);
                // Fallback to simple visualization
                const opacity = Math.min(0.8, blurRadius / 20);
                ctx.fillStyle = `rgba(128, 128, 128, ${opacity})`;
                ctx.fillRect(0, 0, width, height);
            }
        } else {
            // No blur - show transparent overlay
            ctx.fillStyle = 'rgba(200, 200, 200, 0.2)';
            ctx.fillRect(0, 0, width, height);
        }
    }
}

// Export for both module and global usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlurUtils;
} else {
    window.BlurUtils = BlurUtils;
}
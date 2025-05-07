// WebGL Image Utilities
// Functions for converting WebGL canvas content to images

/**
 * Converts a WebGL canvas to a data URL representing a PNG image
 */
export function convertSceneToImage(canvas: HTMLCanvasElement): string {
  try {
    // Generate a PNG data URL from the canvas
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('Error converting WebGL scene to image:', err);
    throw new Error(`Failed to convert scene to image: ${err}`);
  }
}

/**
 * Takes a screenshot of a specific region in a WebGL canvas
 */
export function captureRegion(
  canvas: HTMLCanvasElement, 
  x: number, 
  y: number, 
  width: number, 
  height: number
): string {
  try {
    // Create a temporary canvas to hold the cropped region
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context for temporary canvas');
    }
    
    // Draw the region from the source canvas to the temporary canvas
    ctx.drawImage(
      canvas, 
      x, y, width, height,   // Source rectangle
      0, 0, width, height    // Destination rectangle
    );
    
    // Convert the temporary canvas to a data URL
    return tempCanvas.toDataURL('image/png');
  } catch (err) {
    console.error('Error capturing region from WebGL canvas:', err);
    throw new Error(`Failed to capture region: ${err}`);
  }
}

/**
 * Creates a Blob from a canvas for file saving
 */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob() returned null'));
        }
      }, 'image/png');
    } catch (err) {
      reject(new Error(`Failed to convert canvas to blob: ${err}`));
    }
  });
}

/**
 * Creates a download link for a WebGL canvas image
 */
export function downloadCanvasImage(canvas: HTMLCanvasElement, filename: string = 'webgl-design.png'): void {
  try {
    // Create a data URL from the canvas
    const dataURL = canvas.toDataURL('image/png');
    
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;
    
    // Trigger a click on the anchor to start the download
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
  } catch (err) {
    console.error('Error creating download link:', err);
    throw new Error(`Failed to create download: ${err}`);
  }
}

/**
 * Creates a high-resolution version of the canvas for retina displays
 */
export function createHighResolutionImage(
  canvas: HTMLCanvasElement, 
  renderCallback: (width: number, height: number) => void
): string {
  try {
    // Save the original dimensions
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;
    
    // Calculate pixel ratio for high-DPI displays
    const pixelRatio = window.devicePixelRatio || 1;
    
    // Double the resolution for high-quality output
    const scaling = 2 * pixelRatio;
    
    // Set the canvas dimensions to the high-res size
    canvas.width = originalWidth * scaling;
    canvas.height = originalHeight * scaling;
    
    // Call the provided callback to re-render at the new resolution
    renderCallback(canvas.width, canvas.height);
    
    // Capture the high-res image
    const highResImage = canvas.toDataURL('image/png');
    
    // Restore the original dimensions
    canvas.width = originalWidth;
    canvas.height = originalHeight;
    
    // Re-render at the original size
    renderCallback(originalWidth, originalHeight);
    
    return highResImage;
  } catch (err) {
    console.error('Error creating high-resolution image:', err);
    throw new Error(`Failed to create high-resolution image: ${err}`);
  }
}

/**
 * Applies a custom filter effect to an existing canvas
 */
export function applyImageEffect(
  canvas: HTMLCanvasElement,
  effect: 'grayscale' | 'sepia' | 'invert' | 'blur' | 'sharpen'
): string {
  try {
    // Create a temporary canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context for filter canvas');
    }
    
    // Draw the original canvas onto the temporary canvas
    ctx.drawImage(canvas, 0, 0);
    
    // Apply the requested effect
    switch (effect) {
      case 'grayscale':
        ctx.filter = 'grayscale(100%)';
        break;
      case 'sepia':
        ctx.filter = 'sepia(100%)';
        break;
      case 'invert':
        ctx.filter = 'invert(100%)';
        break;
      case 'blur':
        ctx.filter = 'blur(5px)';
        break;
      case 'sharpen':
        // No direct CSS filter for sharpen, would need custom implementation
        // using convolution matrix
        console.warn('Sharpen effect not implemented');
        break;
    }
    
    // Redraw with the filter applied
    ctx.drawImage(canvas, 0, 0);
    
    // Convert to data URL
    return tempCanvas.toDataURL('image/png');
  } catch (err) {
    console.error('Error applying image effect:', err);
    throw new Error(`Failed to apply image effect: ${err}`);
  }
} 
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import styled from 'styled-components';
import html2canvas from 'html2canvas';

interface HtmlDesignRendererProps {
  htmlContent: string;
  cssContent: string;
  onRender?: (success: boolean) => void;
  width?: number;
  height?: number;
  showBorder?: boolean;
}

export interface HtmlDesignRendererHandle {
  convertToImage: () => Promise<string | null>;
}

const RendererContainer = styled.div<{ width?: number; height?: number; showBorder?: boolean }>`
  position: relative;
  width: ${props => props.width ? `${props.width}px` : 'auto'};
  height: ${props => props.height ? `${props.height}px` : 'auto'};
  min-width: 320px;
  overflow: hidden;
  background-color: white;
  box-shadow: ${props => props.showBorder ? '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)' : 'none'};
  border-radius: ${props => props.showBorder ? '4px' : '0'};
  transition: box-shadow 0.2s ease-in-out;
  
  &:hover {
    box-shadow: ${props => props.showBorder ? '0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)' : 'none'};
  }
`;

// iframe approach for isolation
const IsolatedFrame = styled.iframe`
  border: none;
  width: 100%;
  height: 100%;
  display: block;
`;

export const HtmlDesignRenderer = forwardRef<HtmlDesignRendererHandle, HtmlDesignRendererProps>(({
  htmlContent,
  cssContent,
  onRender,
  width,
  height,
  showBorder = true
}, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Combine HTML and CSS content with viewport settings to ensure proper sizing
  const combinedContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src data: blob: 'self'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; script-src 'self' 'unsafe-inline';">
      
      <!-- Improved font loading -->
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&family=Open+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
      
      <!-- Font Awesome for icons -->
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      
      <style>
        /* Reset styles */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        html, body {
          width: ${width ? `${width}px` : '100%'};
          height: ${height ? `${height}px` : '100%'};
          overflow: hidden;
          background-color: #FFFFFF;
        }
        
        body {
          font-family: 'Inter', 'Roboto', 'Plus Jakarta Sans', 'Open Sans', sans-serif;
          line-height: 1.5;
          position: relative;
          color: #333333;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        /* Better image handling */
        img {
          object-fit: cover;
          display: block;
          max-width: 100%;
          max-height: 100%;
        }
        
        /* Improved Unsplash images loading */
        img[src*="unsplash.com"] {
          object-fit: cover;
          background-color: #f0f0f0; /* Light gray placeholder */
          display: block !important;
          visibility: visible !important;
          width: 100%;
          height: 100%;
        }
        
        .img-container {
          position: relative;
          overflow: hidden;
          background-color: #f0f0f0; /* Placeholder background */
        }
        
        /* Image placeholder styling */
        .image-placeholder {
          background-color: #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #ccc;
          color: #888;
          font-size: 10px;
          overflow: hidden;
        }
        
        /* Font Awesome icon improvements */
        .fa, .fas, .far, .fab {
          display: inline-flex;
          justify-content: center;
          align-items: center;
        }
        
        /* High-quality rendering support */
        canvas, svg {
          shape-rendering: geometricPrecision;
          text-rendering: optimizeLegibility;
        }
        
        /* Custom CSS */
        ${cssContent || ''}
      </style>
      
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          // Process all images for better loading
          const processImages = () => {
            // Find all images
            const images = document.querySelectorAll('img');
            
            // Process each image
            images.forEach(function(img) {
              const src = img.getAttribute('src');
              if (!src) return;
              
              // Set dimensions if missing
              if (!img.getAttribute('width')) {
                img.setAttribute('width', '100%');
              }
              if (!img.getAttribute('height')) {
                img.setAttribute('height', '100%');
              }
              
              // Get dimensions for placeholder
              const width = img.offsetWidth || parseInt(img.style.width) || 100;
              const height = img.offsetHeight || parseInt(img.style.height) || 100;
              
              // Create placeholder function to replace failed images
              const createPlaceholder = () => {
                // Create placeholder div
                const placeholder = document.createElement('div');
                placeholder.className = 'image-placeholder';
                placeholder.style.width = width + 'px';
                placeholder.style.height = height + 'px';
                
                // Determine background color - use a gradient for visual interest
                const colors = ['#e0e0e0', '#d0d0d0', '#f0f0f0', '#e8e8e8'];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                placeholder.style.background = randomColor;
                
                // Replace image with placeholder
                if (img.parentNode) {
                  img.parentNode.replaceChild(placeholder, img);
                }
              };
              
              // Handle errors - replace with placeholder
              img.onerror = createPlaceholder;
              
              // Also handle timeout - sometimes images hang
              setTimeout(() => {
                if (!img.complete) {
                  createPlaceholder();
                }
              }, 2000);
            });
            
            // Also handle any divs with background images
            document.querySelectorAll('[style*="background-image"]').forEach(el => {
              const style = getComputedStyle(el);
              const bgImage = style.backgroundImage;
              
              // If background image contains unsplash or placeholder domain
              if (bgImage.includes('unsplash.com') || bgImage.includes('placeholder.com')) {
                el.style.backgroundImage = 'none';
                el.style.backgroundColor = '#e0e0e0';
                el.style.border = '1px solid #ccc';
              }
            });
          };
          
          // Fix font awesome icons
          const processIcons = () => {
            document.querySelectorAll('.fa, .fas, .far, .fab').forEach(icon => {
              // Ensure icons have proper alignment
              if (getComputedStyle(icon).display !== 'inline-flex') {
                icon.style.display = 'inline-flex';
                icon.style.alignItems = 'center';
                icon.style.justifyContent = 'center';
              }
            });
          };
          
          // Fix for exact positioning
          const processPositionedElements = () => {
            // Get all positioned elements
            const elements = document.querySelectorAll('[style*="position:absolute"], [style*="position: absolute"]');
            elements.forEach(el => {
              // Ensure the parent is positioned relatively if not already
              const parent = el.parentElement;
              if (parent && parent !== document.body) {
                const parentStyle = getComputedStyle(parent);
                if (parentStyle.position === 'static') {
                  parent.style.position = 'relative';
                }
              }
            });
          };
          
          // Run all processors
          processImages();
          processIcons();
          processPositionedElements();
          
          // Signal that content is loaded and ready
          if (window.parent) {
            window.parent.postMessage('design-rendered', '*');
          }
        });
      </script>
    </head>
    <body>
      ${htmlContent || '<div>No content to display</div>'}
    </body>
    </html>
  `;

  useEffect(() => {
    const renderHtml = () => {
      try {
        const iframe = iframeRef.current;
        if (!iframe) return;
        
        // Get the iframe document
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          setError('Could not access iframe document');
          onRender?.(false);
          return;
        }
        
        // Write the content to the iframe
        iframeDoc.open();
        iframeDoc.write(combinedContent);
        iframeDoc.close();
        
        // Add event listener for message from iframe
        const handleMessage = (event: MessageEvent) => {
          if (event.data === 'design-rendered') {
            // Mark render as successful
            setError(null);
            onRender?.(true);
          }
        };
        
        window.addEventListener('message', handleMessage);
        
        // Cleanup
        return () => {
          window.removeEventListener('message', handleMessage);
        };
      } catch (err) {
        console.error('Error rendering HTML:', err);
        setError(`Rendering error: ${err}`);
        onRender?.(false);
      }
    };
    
    renderHtml();
  }, [htmlContent, cssContent, combinedContent, onRender, width, height]);

  // Method to convert the rendered HTML to an image
  const convertToImage = async (): Promise<string | null> => {
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentDocument?.body) {
        throw new Error('Iframe or iframe body not available');
      }

      // Use html2canvas to capture the iframe content
      const canvas = await html2canvas(iframe.contentDocument.body, {
        // Configuration for better rendering
        allowTaint: true,
        useCORS: true,
        logging: false,
        scale: 2, // Higher scale for better quality
        width: width,
        height: height,
        backgroundColor: '#FFFFFF' // Ensure white background
      });

      // Convert canvas to data URL
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Error converting HTML to image:', err);
      return null;
    }
  };

  // Expose the convertToImage method to parent components via ref
  useImperativeHandle(ref, () => ({
    convertToImage
  }));

  return (
    <RendererContainer width={width} height={height} showBorder={showBorder}>
      {error ? (
        <div style={{ color: 'red', padding: '8px' }}>
          Error: {error}
        </div>
      ) : (
        <IsolatedFrame 
          ref={iframeRef} 
          title="Design Renderer"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          width={width}
          height={height}
          style={{ width: width ? `${width}px` : '100%', height: height ? `${height}px` : '100%' }}
        />
      )}
    </RendererContainer>
  );
});

export default HtmlDesignRenderer; 
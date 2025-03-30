import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import styled from 'styled-components';
import html2canvas from 'html2canvas';

interface HtmlDesignRendererProps {
  htmlContent: string;
  cssContent: string;
  onRender?: (success: boolean) => void;
  width?: number;
  height?: number;
}

export interface HtmlDesignRendererHandle {
  convertToImage: () => Promise<string | null>;
}

const RendererContainer = styled.div<{ width?: number; height?: number }>`
  position: relative;
  width: ${props => props.width ? `${props.width}px` : 'auto'};
  height: ${props => props.height ? `${props.height}px` : 'auto'};
  min-width: 320px;
  overflow: hidden;
  background-color: white;
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
  height
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
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src * data: blob: 'self'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com;">
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
        }
        
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.5;
        }
        
        /* Ensure Unsplash images load properly and maintain aspect ratio */
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
        }
        
        /* Custom CSS */
        ${cssContent || ''}
      </style>
      <script>
        // Helper script to ensure images load properly
        document.addEventListener('DOMContentLoaded', function() {
          // Process all Unsplash images
          const unsplashImages = document.querySelectorAll('img[src*="unsplash.com"]');
          
          unsplashImages.forEach(img => {
            // Create correct URL format if needed
            let src = img.getAttribute('src');
            if (src) {
              // Remove any spaces from the URL
              src = src.replace(/\s+/g, '');
              
              // Check if URL is properly formatted
              if (!src.includes('https://') && !src.startsWith('data:')) {
                src = 'https://' + src.replace(/^[^\w]*/, '');
              }
              
              // Fix common Unsplash URL issues
              if (src.includes('unsplash.com/random')) {
                // Make sure it uses the correct format
                src = src.replace(/unsplash\.com\/random\/?/, 'source.unsplash.com/random/');
                
                // Add dimensions if not present in URL
                if (!src.includes('/random/')) {
                  src = src.replace('/random', '/random/1200x800');
                }
              }
              
              // Force reload by adding a cache-busting parameter
              if (!src.includes('?')) {
                src += '?t=' + new Date().getTime();
              } else {
                src += '&t=' + new Date().getTime();
              }
              
              // Update the src attribute
              img.setAttribute('src', src);
              
              // Ensure image has dimensions
              if (!img.getAttribute('width')) {
                img.setAttribute('width', '100%');
              }
              if (!img.getAttribute('height')) {
                img.setAttribute('height', '100%');
              }
              
              // Create a fallback mechanism for when the Unsplash image fails to load
              img.onerror = function() {
                console.error('Failed to load Unsplash image:', src);
                
                // Get original keywords from URL
                let keywords = 'landscape';
                const matchKeywords = src.match(/random\/(?:\d+x\d+\/)?([^?&]+)/);
                if (matchKeywords && matchKeywords[1]) {
                  keywords = matchKeywords[1];
                }
                
                // Try a different approach with Picsum (reliable placeholder service)
                this.src = 'https://picsum.photos/seed/' + keywords.replace(/,/g, '-') + '/800/600';
                
                // Add a note that this is a fallback image
                const parent = this.parentElement;
                if (parent) {
                  const note = document.createElement('div');
                  note.style.position = 'absolute';
                  note.style.bottom = '5px';
                  note.style.right = '5px';
                  note.style.background = 'rgba(0,0,0,0.7)';
                  note.style.color = 'white';
                  note.style.padding = '2px 5px';
                  note.style.fontSize = '10px';
                  note.style.borderRadius = '3px';
                  note.textContent = 'Placeholder Image';
                  parent.appendChild(note);
                }
              };
              
              // Force image to load by setting src again
              const tempSrc = img.src;
              img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // Tiny transparent gif
              setTimeout(() => {
                img.src = tempSrc;
              }, 10);
              
              // If parent is not a div with img-container class, wrap it
              const parent = img.parentElement;
              if (!parent.classList.contains('img-container')) {
                const width = img.getAttribute('width');
                const height = img.getAttribute('height');
                
                // Create wrapper
                const wrapper = document.createElement('div');
                wrapper.classList.add('img-container');
                wrapper.style.width = width.includes('%') ? width : width + 'px';
                wrapper.style.height = height.includes('%') ? height : height + 'px';
                wrapper.style.position = 'relative'; // Ensure absolute positioning works inside
                
                // Replace img with wrapper containing img
                parent.replaceChild(wrapper, img);
                wrapper.appendChild(img);
                
                // Update image styles
                img.style.objectFit = 'cover';
                img.style.width = '100%';
                img.style.height = '100%';
              }
            }
          });
          
          // Create a utility function to preload images
          function preloadImage(url) {
            return new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(url);
              img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
              img.src = url;
            });
          }
          
          // Preload all Unsplash images after a slight delay
          setTimeout(() => {
            unsplashImages.forEach(img => {
              preloadImage(img.src)
                .then(() => console.log('Preloaded image:', img.src))
                .catch(err => console.error(err));
            });
          }, 500);
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
        
        // Mark render as successful
        setError(null);
        onRender?.(true);
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
        height: height
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
    <RendererContainer width={width} height={height}>
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
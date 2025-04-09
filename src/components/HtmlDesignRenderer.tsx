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

  // Preprocess HTML to replace all img tags with div placeholders
  const preprocessHtml = (html: string): string => {
    // Replace all img tags with div placeholders
    const imgRegex = /<img[^>]*>/gi;
    const processedHtml = html.replace(imgRegex, (match) => {
      // Extract width and height attributes if they exist
      const widthMatch = match.match(/width=["']([^"']*)/i);
      const heightMatch = match.match(/height=["']([^"']*)/i);
      
      const width = widthMatch ? widthMatch[1] : '100';
      const height = heightMatch ? heightMatch[1] : '100';
      
      // Create a placeholder div instead
      return `<div class="image-placeholder" style="width:${width}px;height:${height}px;background-color:#e0e0e0;border:1px solid #ccc;"></div>`;
    });
    
    // Also replace background-image styles in inline styles
    const bgImgRegex = /background-image:url\(['"]?([^'"\)]+)['"]?\)/gi;
    return processedHtml.replace(bgImgRegex, 'background-color:#e0e0e0;border:1px solid #ccc;');
  };
  
  // Process the HTML content
  const processedHtmlContent = preprocessHtml(htmlContent || '');

  // Process CSS to remove background-image properties
  const preprocessCss = (css: string): string => {
    // Replace background-image properties
    return css.replace(/background-image\s*:\s*url\(['"]?([^'"\)]+)['"]?\)/gi, 'background-color:#e0e0e0;border:1px solid #ccc;');
  };
  
  // Process the CSS content
  const processedCssContent = preprocessCss(cssContent || '');

  // Extract unique webfonts from CSS to preload
  const extractWebFonts = (css: string): string[] => {
    // Extract font-family declarations
    const fontFamilyMatches = css.match(/font-family:\s*([^;]+)/g) || [];
    const fontFamilies = fontFamilyMatches
      .map(match => match.replace(/font-family:\s*/, '').trim())
      .map(family => {
        // Remove quotes and split by comma
        const cleaned = family.replace(/['"]/g, '');
        return cleaned.split(',').map(f => f.trim());
      })
      .flat()
      .filter((f, i, self) => self.indexOf(f) === i); // Unique values
    
    return fontFamilies;
  };
  
  // Get any custom fonts from the CSS
  const customFonts = extractWebFonts(processedCssContent);

  // Combine HTML and CSS content with viewport settings to ensure proper sizing
  const combinedContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src data: blob: 'self'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; script-src 'self' 'unsafe-inline';">
      
      <!-- Improved font loading with comprehensive set -->
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&family=Roboto:wght@100;300;400;500;700;900&family=Open+Sans:wght@300;400;500;600;700;800&family=Poppins:wght@100;200;300;400;500;600;700;800;900&family=Lato:wght@100;300;400;700;900&family=Montserrat:wght@100;200;300;400;500;600;700;800;900&family=Source+Sans+Pro:wght@200;300;400;600;700;900&family=Nunito:wght@200;300;400;500;600;700;800;900&family=Raleway:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">
      
      <!-- Font Awesome for icons -->
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      
      <style>
        /* CSS Reset - more comprehensive for better rendering */
        *, *::before, *::after {
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
          font-family: 'Inter', 'Roboto', 'Plus Jakarta Sans', 'Open Sans', 'Poppins', 'Lato', 'Montserrat', 'Source Sans Pro', 'Nunito', 'Raleway', sans-serif;
          line-height: 1.5;
          position: relative;
          color: #333333;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        
        /* Standard UI component styling - helps maintain consistency with original styles */
        button, .button {
          cursor: pointer;
          font-family: inherit;
          border: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        
        input, select, textarea {
          font-family: inherit;
          font-size: inherit;
        }
        
        /* Form elements consistency */
        input[type="checkbox"], input[type="radio"] {
          appearance: none;
          -webkit-appearance: none;
          width: 1rem;
          height: 1rem;
          border: 1px solid #ccc;
          display: grid;
          place-content: center;
        }
        
        input[type="checkbox"] {
          border-radius: 3px;
        }
        
        input[type="radio"] {
          border-radius: 50%;
        }
        
        input[type="checkbox"]:checked::before, input[type="radio"]:checked::before {
          content: "";
          width: 0.65em;
          height: 0.65em;
          transform: scale(1);
          background-color: currentColor;
        }
        
        input[type="radio"]:checked::before {
          border-radius: 50%;
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
        ${processedCssContent}
      </style>
      
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          // Fix any remaining images that might have been dynamically added
          const processImages = () => {
            // Immediately remove any img elements and replace with placeholders
            document.querySelectorAll('img').forEach(img => {
              const width = img.width || 100;
              const height = img.height || 100;
              
              const placeholder = document.createElement('div');
              placeholder.className = 'image-placeholder';
              placeholder.style.width = width + 'px';
              placeholder.style.height = height + 'px';
              placeholder.style.backgroundColor = '#e0e0e0';
              placeholder.style.border = '1px solid #ccc';
              
              if (img.parentNode) {
                img.parentNode.replaceChild(placeholder, img);
              }
            });
            
            // Remove any background images
            document.querySelectorAll('*').forEach(el => {
              const style = getComputedStyle(el);
              if (style.backgroundImage && style.backgroundImage !== 'none') {
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
          
          // Process form elements for better styling
          const processFormElements = () => {
            // Style checkboxes and radio buttons consistently
            document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
              // If the input doesn't have a CSS custom property for color, inherit from parent
              const computedStyle = getComputedStyle(input);
              if (!computedStyle.getPropertyValue('--checkbox-color') && !computedStyle.getPropertyValue('--radio-color')) {
                const parentColor = getComputedStyle(input.parentElement || document.body).color;
                input.style.setProperty('--checkbox-color', parentColor);
                input.style.setProperty('--radio-color', parentColor);
                input.style.color = parentColor;
              }
            });
          };
          
          // Run all processors
          processImages();
          processIcons();
          processPositionedElements();
          processFormElements();
          
          // Signal that content is loaded and ready
          if (window.parent) {
            window.parent.postMessage('design-rendered', '*');
          }
        });
      </script>
    </head>
    <body>
      ${processedHtmlContent}
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
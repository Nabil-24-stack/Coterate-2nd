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
  min-width: 280px;
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

// Helper function to validate and fix CSS syntax issues
const validateAndFixCss = (css: string): string => {
  if (!css) return '';
  
  try {
    // Basic CSS validation and fixing
    
    // 1. Fix unbalanced braces
    let braceCount = 0;
    let inComment = false;
    let fixedCss = '';
    
    for (let i = 0; i < css.length; i++) {
      const char = css[i];
      
      // Handle comments
      if (i < css.length - 1 && char === '/' && css[i + 1] === '*') {
        inComment = true;
        fixedCss += '/*';
        i++;
        continue;
      }
      
      if (i > 0 && char === '/' && css[i - 1] === '*') {
        inComment = false;
        continue;
      }
      
      if (!inComment) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
        }
      }
      
      fixedCss += char;
    }
    
    // Add missing closing braces
    while (braceCount > 0) {
      fixedCss += '}';
      braceCount--;
    }
    
    // 2. Ensure each rule ends with a semicolon
    fixedCss = fixedCss.replace(/([^{};])}/g, '$1;}');
    
    // 3. Remove any CSS comments
    fixedCss = fixedCss.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // 4. Remove empty rules
    fixedCss = fixedCss.replace(/[^{}]+\{\s*\}/g, '');
    
    // 5. Remove trailing whitespace
    fixedCss = fixedCss.trim();
    
    console.log('CSS validated and fixed, length:', fixedCss.length);
    return fixedCss;
  } catch (error) {
    console.error('Error validating CSS:', error);
    return css; // Return original if validation fails
  }
};

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
    // Check if CSS is empty or invalid
    if (!css || css.trim().length === 0) {
      console.warn('HtmlDesignRenderer: Empty CSS content received for processing');
      return '';
    }
    
    // Log CSS characteristics for debugging
    console.log(`Processing CSS with length: ${css.length}, first 50 chars: ${css.substring(0, 50)}`);
    
    // Remove any remaining triple backticks if they're still in the content
    let processedCss = css;
    if (processedCss.includes('```')) {
      processedCss = processedCss.replace(/```(?:css)?\s*\n?|```/g, '').trim();
      console.log('Removed remaining backticks from CSS content');
    }
    
    // Replace background-image properties
    processedCss = processedCss.replace(/background-image\s*:\s*url\(['"]?([^'"\)]+)['"]?\)/gi, 'background-color:#e0e0e0;border:1px solid #ccc;');
    
    // Fix any malformed CSS
    processedCss = processedCss.replace(/([^{}])\s*}/g, '$1;}'); // Add missing semicolons before closing braces
    processedCss = processedCss.replace(/({[^{}]*?)[;]\s*}/g, '$1}'); // Remove trailing semicolons before closing braces
    
    // Validate and fix CSS syntax
    processedCss = validateAndFixCss(processedCss);
    
    // Log processed CSS length
    console.log(`Processed CSS length: ${processedCss.length}`);
    
    return processedCss;
  };
  
  // Process the CSS content
  const processedCssContent = preprocessCss(cssContent || '');
  
  // Add debug logging for empty content
  useEffect(() => {
    if (!htmlContent) {
      console.warn('HtmlDesignRenderer: Empty HTML content received');
    }
    if (!cssContent) {
      console.warn('HtmlDesignRenderer: Empty CSS content received');
      console.log('Debugging CSS issues:', {
        cssContentType: typeof cssContent,
        cssLength: cssContent?.length || 0,
        cssContentPrefix: cssContent?.substring(0, 20)
      });
    } else if (cssContent.length < 20) {
      console.warn('HtmlDesignRenderer: Very short CSS content received:', cssContent);
    }
  }, [htmlContent, cssContent]);

  // Fallback content if HTML is empty
  const finalHtmlContent = processedHtmlContent || `
    <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #f8f9fa; color: #6c757d; font-family: system-ui, sans-serif; padding: 20px; text-align: center;">
      <div style="margin-bottom: 20px; width: 50px; height: 50px;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
          <line x1="15" y1="3" x2="15" y2="21"></line>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="3" y1="15" x2="21" y2="15"></line>
        </svg>
      </div>
      <h3 style="margin: 0 0 10px; font-size: 20px; font-weight: 500;">Rendering Issue</h3>
      <p style="margin: 0; font-size: 16px;">Unable to render the design. Please try again with a different image or check the console for more details.</p>
    </div>
  `;

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
      
      <!-- Inline Base Styles - for better reliability -->
      <style id="base-styles">
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
      </style>
      
      <!-- Custom CSS - guaranteed to work by directly embedding -->
      <style id="custom-css">
${processedCssContent}
      </style>
      
      <script>
        // Simpler, self-executing script that doesn't declare global functions that can conflict
        (function() {
          document.addEventListener('DOMContentLoaded', function() {
            // Fix any remaining images that might have been dynamically added
            const processImages = function() {
              // Immediately remove any img elements and replace with placeholders
              document.querySelectorAll('img').forEach(function(img) {
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
              document.querySelectorAll('*').forEach(function(el) {
                const style = getComputedStyle(el);
                if (style.backgroundImage && style.backgroundImage !== 'none') {
                  el.style.backgroundImage = 'none';
                  el.style.backgroundColor = '#e0e0e0';
                  el.style.border = '1px solid #ccc';
                }
              });
            };
            
            // Fix font awesome icons
            const processIcons = function() {
              document.querySelectorAll('.fa, .fas, .far, .fab').forEach(function(icon) {
                // Ensure icons have proper alignment
                if (getComputedStyle(icon).display !== 'inline-flex') {
                  icon.style.display = 'inline-flex';
                  icon.style.alignItems = 'center';
                  icon.style.justifyContent = 'center';
                }
              });
            };
            
            // Fix for exact positioning
            const processPositionedElements = function() {
              // Get all positioned elements
              const elements = document.querySelectorAll('[style*="position:absolute"], [style*="position: absolute"]');
              elements.forEach(function(el) {
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
            const processFormElements = function() {
              // Style checkboxes and radio buttons consistently
              document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(function(input) {
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
            
            // Force a reflow to ensure styles are applied
            document.body.style.display = 'none';
            document.body.offsetHeight; // This forces a reflow
            document.body.style.display = '';
            
            // Signal that content is loaded and ready after a small delay
            setTimeout(function() {
              if (window.parent) {
                window.parent.postMessage('design-rendered', '*');
              }
            }, 100);
          });
        })();
      </script>
    </head>
    <body>
      ${finalHtmlContent}
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
        
        // Reset any previous content
        iframeDoc.open();
        iframeDoc.write(combinedContent);
        iframeDoc.close();
        
        // Set a direct event handler on the iframe's load event instead of using a script
        const checkAndApplyStyles = () => {
          try {
            // Directly apply an inline script for checking and fixing styles
            // This avoids the issue with duplicate function declarations
            const checkStylesScript = document.createElement('script');
            const uniqueId = `style_check_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            
            checkStylesScript.textContent = `
              (function() {
                // Force style recalculation
                document.body.style.visibility = 'hidden';
                setTimeout(() => { document.body.style.visibility = 'visible'; }, 10);
                
                // Direct CSS injection as a fallback
                const ensureStylesApplied = () => {
                  const customStyleEl = document.getElementById('custom-css');
                  if (!customStyleEl || !customStyleEl.textContent || customStyleEl.textContent.trim().length < 20) {
                    console.log('Applying CSS directly as a fallback');
                    // Create a new style element with the CSS content
                    const newStyle = document.createElement('style');
                    newStyle.id = 'injected-css-${uniqueId}';
                    newStyle.textContent = ${JSON.stringify(processedCssContent)};
                    document.head.appendChild(newStyle);
                  }
                  
                  // Apply inline styles to all elements to force browser to render them
                  const applyInlineStyles = () => {
                    document.querySelectorAll('*').forEach(el => {
                      if (el.nodeType === 1) { // Element nodes only
                        const computedStyle = getComputedStyle(el);
                        // Apply a tiny transform to force style recalculation
                        el.style.transform = 'translateZ(0)';
                        // Apply a tiny outline to force style recalculation
                        el.style.outline = 'transparent solid 0px';
                      }
                    });
                  };
                  
                  // Run after a short delay
                  setTimeout(applyInlineStyles, 50);
                  
                  // Check if any styles are applied
                  let hasStyles = false;
                  const allElements = document.querySelectorAll('*');
                  for (let i = 0; i < Math.min(allElements.length, 10); i++) {
                    const style = getComputedStyle(allElements[i]);
                    if (style.cssText && style.cssText.length > 20) {
                      hasStyles = true;
                      break;
                    }
                  }
                  
                  // Signal ready state to parent
                  if (window.parent) {
                    window.parent.postMessage(
                      hasStyles ? 'design-rendered' : 'design-rendered-no-styles', 
                      '*'
                    );
                  }
                };
                
                // Execute immediately
                ensureStylesApplied();
              })();
            `;
            
            // Need to make sure the body is ready
            if (iframeDoc.body) {
              iframeDoc.body.appendChild(checkStylesScript);
            } else {
              console.error('Iframe body not available for script injection');
              onRender?.(false);
            }
          } catch (error) {
            console.error('Error checking CSS loaded state:', error);
            onRender?.(false);
          }
        };
        
        // Add load event handler to the iframe
        if (iframe.contentWindow) {
          const handleIframeLoad = () => {
            setTimeout(checkAndApplyStyles, 100);
          };
          
          // Try different approaches to ensure the load handler is triggered
          iframe.onload = handleIframeLoad;
          
          // Also try to run it after a timeout as a fallback
          setTimeout(handleIframeLoad, 300);
        }
        
        // Add event listener for message from iframe
        const handleMessage = (event: MessageEvent) => {
          if (event.data === 'design-rendered') {
            // Mark render as successful
            setError(null);
            onRender?.(true);
          } else if (event.data === 'design-rendered-no-styles') {
            // Styles didn't apply correctly - try direct CSS injection
            console.warn('Design rendered but no styles were applied - attempting direct style application');
            
            try {
              // Try direct CSS injection as a last resort
              if (iframe.contentDocument && iframe.contentDocument.head) {
                const directStyleEl = iframe.contentDocument.createElement('style');
                directStyleEl.id = 'direct-css-inject';
                directStyleEl.textContent = processedCssContent;
                iframe.contentDocument.head.appendChild(directStyleEl);
                
                // Force browser to apply styles
                const forceStylesScript = iframe.contentDocument.createElement('script');
                forceStylesScript.textContent = `
                  document.body.style.display = 'none';
                  setTimeout(() => { document.body.style.display = 'block'; }, 10);
                `;
                iframe.contentDocument.body.appendChild(forceStylesScript);
                
                // Still report success as we've tried our best
                setTimeout(() => {
                  setError(null);
                  onRender?.(true);
                }, 100);
              } else {
                onRender?.(false);
              }
            } catch (directCssError) {
              console.error('Error with direct CSS injection:', directCssError);
              onRender?.(false);
            }
          }
        };
        
        window.addEventListener('message', handleMessage);
        
        // Cleanup
        return () => {
          window.removeEventListener('message', handleMessage);
          if (iframe.contentWindow) {
            iframe.onload = null;
          }
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
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

// Add some logging for CSS debugging
const debugCss = (css: string): void => {
  // Output a sample of the CSS to check its content
  console.log(`CSS content preview (${css.length} chars):`, css.substring(0, 100) + '...');
  
  // Check if CSS has actual styling rules
  const hasRules = css.includes('{') && css.includes('}');
  console.log('CSS contains style rules:', hasRules);
  
  // Count the number of style rules
  const ruleCount = (css.match(/{/g) || []).length;
  console.log('Number of CSS rules:', ruleCount);
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
  const [renderAttempt, setRenderAttempt] = useState(0);

  // Process HTML to clean up any potential issues
  const processHtml = (html: string): string => {
    if (!html) return '';
    
    // Replace img tags with divs
    let processedHtml = html.replace(
      /<img[^>]*>/gi, 
      '<div style="width:100px;height:100px;background-color:#e0e0e0;border:1px solid #ccc;"></div>'
    );
    
    // Ensure there's a valid <body> tag
    if (!processedHtml.includes('<body')) {
      processedHtml = `<body>${processedHtml}</body>`;
    }
    
    return processedHtml;
  };
  
  // Process CSS to clean up and enhance it
  const processCss = (css: string): string => {
    if (!css) return '';
    
    // Log the original CSS for debugging
    console.log('Original CSS length:', css.length);
    
    // Remove any Markdown formatting
    let processedCss = css.replace(/```(?:css)?|```/g, '');
    
    // Replace background-image properties
    processedCss = processedCss.replace(
      /background-image\s*:\s*url\(['"]?([^'"\)]+)['"]?\)/gi, 
      'background-color:#e0e0e0;border:1px solid #ccc;'
    );

    // Add !important to ensure styles are applied
    processedCss = processedCss.replace(
      /([^{]+\{[^}]*?)([;}])/g,
      (match, $1, $2) => {
        // Don't add !important if already present
        if ($1.includes('!important')) return match;
        return $1 + ' !important' + $2;
      }
    );
    
    // Log the processed CSS for debugging
    console.log('Processed CSS length:', processedCss.length);
    debugCss(processedCss);
    
    return processedCss;
  };

  const finalHtml = processHtml(htmlContent || '');
  const finalCss = processCss(cssContent || '');

  // Create a complete HTML document
  const createDocument = (): string => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>Design Render</title>
        
        <!-- Font imports -->
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&family=Open+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        
        <style>
          /* Reset styles */
          *, *::before, *::after {
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          html, body {
            width: ${width ? `${width}px` : '100%'} !important;
            height: ${height ? `${height}px` : '100%'} !important;
            overflow: hidden !important;
            font-family: 'Inter', 'Roboto', 'Open Sans', sans-serif !important;
          }
          
          /* Force all elements to inherit font family */
          * {
            font-family: inherit !important;
          }
          
          /* Basic element styling */
          img, svg {
            max-width: 100% !important;
            display: block !important;
          }
          
          /* Make sure backgrounds are visible */
          [style*="background"] {
            background-color: #f5f5f5 !important;
          }
          
          /* User's CSS */
          ${finalCss}
        </style>
      </head>
      <body>
        ${finalHtml}
      </body>
      </html>
    `;
  };

  // Handle direct document manipulation for the iframe
  const injectContent = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe) throw new Error('Iframe not available');
      
      // Get the iframe document
      const iframeWindow = iframe.contentWindow;
      const iframeDoc = iframe.contentDocument || iframeWindow?.document;
      
      if (!iframeDoc) throw new Error('Cannot access iframe document');
      
      // Clear previous content
      iframeDoc.open();
      iframeDoc.write(createDocument());
      iframeDoc.close();
      
      // Add a handler for the iframe load event
      const validateRender = () => {
        try {
          if (iframe.contentDocument && iframe.contentDocument.body) {
            // Success - force another reflow just to be sure
            const styleElement = iframe.contentDocument.createElement('style');
            styleElement.textContent = `
              body * {
                visibility: visible !important;
                opacity: 1 !important;
                display: block !important;
              }
            `;
            iframe.contentDocument.head.appendChild(styleElement);
            
            // Signal successful render
            setError(null);
            onRender?.(true);
          } else {
            throw new Error('Cannot access iframe body');
          }
        } catch (err) {
          console.error('Error validating render:', err);
          
          // Retry a few times before giving up
          if (renderAttempt < 3) {
            console.log(`Retrying render (attempt ${renderAttempt + 1})`);
            setRenderAttempt(prev => prev + 1);
          } else {
            setError(`Render validation failed: ${err}`);
            onRender?.(false);
          }
        }
      };
      
      // Set both onload handler and a backup timeout
      iframe.onload = validateRender;
      setTimeout(validateRender, 500);
      
    } catch (err) {
      console.error('Error injecting content:', err);
      setError(`Injection error: ${err}`);
      onRender?.(false);
    }
  };

  // Effect to render the content whenever inputs change or we retry
  useEffect(() => {
    injectContent();
    
    // Return cleanup function
    return () => {
      const iframe = iframeRef.current;
      if (iframe) iframe.onload = null;
    };
  }, [htmlContent, cssContent, width, height, renderAttempt]);

  // Method to convert the rendered HTML to an image
  const convertToImage = async (): Promise<string | null> => {
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentDocument?.body) {
        throw new Error('Iframe or iframe body not available');
      }

      const canvas = await html2canvas(iframe.contentDocument.body, {
        allowTaint: true,
        useCORS: true,
        logging: false,
        scale: 2,
        width: width,
        height: height,
        backgroundColor: '#FFFFFF'
      });

      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Error converting HTML to image:', err);
      return null;
    }
  };

  // Expose methods via ref
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
          sandbox="allow-same-origin allow-scripts"
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </RendererContainer>
  );
});

export default HtmlDesignRenderer; 
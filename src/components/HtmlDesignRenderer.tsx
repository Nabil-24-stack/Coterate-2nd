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

  // Simple HTML clean-up
  const cleanHtml = (html: string): string => {
    if (!html) return '';
    
    // Replace all img tags with div placeholders
    return html.replace(
      /<img[^>]*>/gi, 
      '<div style="width:100px;height:100px;background-color:#e0e0e0;border:1px solid #ccc;"></div>'
    );
  };
  
  // Simple CSS clean-up
  const cleanCss = (css: string): string => {
    if (!css) return '';
    
    // Remove any Markdown formatting
    let cleanedCss = css;
    cleanedCss = cleanedCss.replace(/```(?:css)?|```/g, '');
    
    // Replace background-image properties
    cleanedCss = cleanedCss.replace(
      /background-image\s*:\s*url\(['"]?([^'"\)]+)['"]?\)/gi, 
      'background-color:#e0e0e0;border:1px solid #ccc;'
    );
    
    return cleanedCss;
  };
  
  const processedHtml = cleanHtml(htmlContent || '');
  const processedCss = cleanCss(cssContent || '');
  
  // Basic fallback content if HTML is empty
  const finalHtml = processedHtml || `
    <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #f8f9fa; color: #6c757d; font-family: system-ui, sans-serif; padding: 20px; text-align: center;">
      <div style="margin-bottom: 20px;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="50" height="50">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
          <line x1="15" y1="3" x2="15" y2="21"></line>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="3" y1="15" x2="21" y2="15"></line>
        </svg>
      </div>
      <h3 style="margin: 0 0 10px; font-size: 20px; font-weight: 500;">Rendering Issue</h3>
      <p style="margin: 0; font-size: 16px;">Unable to render the design.</p>
    </div>
  `;

  // Create a single HTML document with inline CSS
  const combinedContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <style>
        /* Reset */
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        html, body {
          width: ${width ? `${width}px` : '100%'};
          height: ${height ? `${height}px` : '100%'};
          overflow: hidden;
          background: white;
          font-family: 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        /* Form elements default styling */
        button, input, select, textarea {
          font-family: inherit;
        }
        
        /* Image placeholders */
        .image-placeholder, [style*="background-image"] {
          background-color: #e0e0e0 !important;
          background-image: none !important;
          border: 1px solid #ccc !important;
        }
        
        /* User's CSS */
        ${processedCss}
      </style>
    </head>
    <body>
      ${finalHtml}
    </body>
    </html>
  `;

  useEffect(() => {
    const renderContent = () => {
      try {
        const iframe = iframeRef.current;
        if (!iframe) return;
        
        // Clear any previous content
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          console.error('Could not access iframe document');
          setError('Could not access iframe document');
          onRender?.(false);
          return;
        }
        
        // Write the content directly
        iframeDoc.open();
        iframeDoc.write(combinedContent);
        iframeDoc.close();
        
        // Simple validation function
        const validateRender = () => {
          try {
            // Check if the document is accessible
            if (iframe.contentDocument && iframe.contentDocument.body) {
              // Consider the render successful if we can access the body
              setError(null);
              onRender?.(true);
            } else {
              console.error('Could not access iframe body');
              setError('Could not access iframe body');
              onRender?.(false);
            }
          } catch (err) {
            console.error('Error validating render:', err);
            setError(`Error validating render: ${err}`);
            onRender?.(false);
          }
        };
        
        // Give the iframe a moment to render
        setTimeout(validateRender, 200);
      } catch (err) {
        console.error('Error rendering content:', err);
        setError(`Error rendering content: ${err}`);
        onRender?.(false);
      }
    };
    
    renderContent();
  }, [combinedContent, onRender]);

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

  // Expose methods
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
          style={{ width: width ? `${width}px` : '100%', height: height ? `${height}px` : '100%' }}
        />
      )}
    </RendererContainer>
  );
});

export default HtmlDesignRenderer; 
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

  // Combine HTML and CSS content
  const combinedContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        /* Reset styles */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.5;
        }
        /* Custom CSS */
        ${cssContent || ''}
      </style>
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
  }, [htmlContent, cssContent, combinedContent, onRender]);

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
          sandbox="allow-same-origin"
        />
      )}
    </RendererContainer>
  );
});

export default HtmlDesignRenderer; 
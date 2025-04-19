import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import styled from 'styled-components';
import html2canvas from 'html2canvas';

interface SVGDesignRendererProps {
  svgContent: string;
  onRender?: (success: boolean) => void;
  width?: number;
  height?: number;
  showBorder?: boolean;
}

export interface SVGDesignRendererHandle {
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

// Enhanced logging for SVG debugging
const debugSvg = (svg: string): void => {
  // Output a sample of the SVG to check its content
  console.log(`SVG content preview (${svg.length} chars):`, svg.substring(0, 100) + '...');
  
  // Check if SVG has valid structure
  const hasValidStructure = svg.includes('<svg') && svg.includes('</svg>');
  console.log('SVG contains valid structure:', hasValidStructure);
  
  // Check if SVG has viewBox or dimensions
  const hasViewBox = svg.includes('viewBox');
  const hasDimensions = svg.includes('width=') && svg.includes('height=');
  console.log('SVG has viewBox:', hasViewBox, 'dimensions:', hasDimensions);
  
  // Check for common problematic elements
  const hasCData = svg.includes('CDATA');
  const hasStyle = svg.includes('<style');
  const hasScript = svg.includes('<script');
  
  console.log('SVG contains CDATA:', hasCData);
  console.log('SVG contains style element:', hasStyle);
  console.log('SVG contains script element:', hasScript);
  
  // Generate validation warnings
  if (hasStyle && !hasCData) {
    console.warn('SVG has style element without CDATA - might cause parsing issues');
  }
  
  if (hasScript) {
    console.warn('SVG has script element - security considerations may apply');
  }
};

export const SVGDesignRenderer = forwardRef<SVGDesignRendererHandle, SVGDesignRendererProps>(({
  svgContent,
  onRender,
  width,
  height,
  showBorder = true
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [renderMethod, setRenderMethod] = useState<'dom' | 'blob' | 'innerHTML'>('dom');

  // Enhanced processing to clean up any potential issues
  const processSvg = (svg: string): string => {
    if (!svg) return '';
    
    console.log('Processing SVG content...');
    
    // Clean up the SVG content
    let processedSvg = svg.trim();
    
    // If it doesn't start with <svg, try to find and extract the svg tag
    if (!processedSvg.startsWith('<svg')) {
      const svgStartIndex = processedSvg.indexOf('<svg');
      const svgEndIndex = processedSvg.lastIndexOf('</svg>');
      
      if (svgStartIndex !== -1 && svgEndIndex !== -1) {
        processedSvg = processedSvg.substring(svgStartIndex, svgEndIndex + 6); // +6 to include </svg>
        console.log('Extracted SVG tag from content');
      }
    }
    
    // FIXES FOR COMMON SVG ISSUES:
    
    // 1. Missing or improper xmlns
    if (!processedSvg.includes('xmlns=')) {
      processedSvg = processedSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      console.log('Added missing xmlns attribute');
    }
    
    // 2. Missing dimensions
    if (!processedSvg.includes('width=') && width) {
      processedSvg = processedSvg.replace('<svg', `<svg width="${width}"`);
      console.log('Added width attribute:', width);
    }
    
    if (!processedSvg.includes('height=') && height) {
      processedSvg = processedSvg.replace('<svg', `<svg height="${height}"`);
      console.log('Added height attribute:', height);
    }
    
    // 3. Missing viewBox
    if (!processedSvg.includes('viewBox=') && width && height) {
      processedSvg = processedSvg.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`);
      console.log('Added viewBox attribute');
    } else if (!processedSvg.includes('viewBox=')) {
      // If we don't have width/height provided, try to extract them from the SVG
      const widthMatch = processedSvg.match(/width=["']([^"']+)["']/);
      const heightMatch = processedSvg.match(/height=["']([^"']+)["']/);
      
      if (widthMatch && heightMatch) {
        const extractedWidth = widthMatch[1].replace('px', '').trim();
        const extractedHeight = heightMatch[1].replace('px', '').trim();
        
        if (!isNaN(Number(extractedWidth)) && !isNaN(Number(extractedHeight))) {
          processedSvg = processedSvg.replace('<svg', `<svg viewBox="0 0 ${extractedWidth} ${extractedHeight}"`);
          console.log('Added viewBox attribute based on extracted dimensions');
        } else {
          // Fallback to default viewBox
          processedSvg = processedSvg.replace('<svg', `<svg viewBox="0 0 800 600"`);
          console.log('Added default viewBox attribute');
        }
      }
    }
    
    // 4. Fix any malformed style elements - ensure CDATA is used
    if (processedSvg.includes('<style>') && !processedSvg.includes('CDATA')) {
      processedSvg = processedSvg.replace(/<style>([\s\S]*?)<\/style>/g, '<style><![CDATA[$1]]></style>');
      console.log('Fixed malformed style tag by adding CDATA');
    }
    
    // 5. Fix missing style closing tag
    if (processedSvg.includes('<style>') && !processedSvg.includes('</style>')) {
      processedSvg = processedSvg.replace('</svg>', '</style></svg>');
      console.log('Added missing style closing tag');
    }
    
    // 6. Ensure text elements have proper attributes for positioning
    if (processedSvg.includes('<text') && (!processedSvg.includes('text-anchor') || !processedSvg.includes('dominant-baseline'))) {
      // Add default text properties to improve text rendering
      processedSvg = processedSvg.replace(/<text([^>]*)>/g, (match, attributes) => {
        if (!attributes.includes('text-anchor')) {
          return `<text${attributes} text-anchor="start">`;
        }
        return match;
      });
      console.log('Added missing text attributes');
    }
    
    // 7. Fix font-family issues
    processedSvg = processedSvg.replace(/font-family:([^;,"']+)/g, "font-family:'$1', Arial, sans-serif");
    
    // 8. Fix unclosed tags
    const selfClosingElements = ['rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'image', 'use'];
    
    // Fix tags that should be self-closing
    selfClosingElements.forEach(tagName => {
      // Match unclosed tags that should be self-closing
      const unclosedPattern = new RegExp(`<${tagName}([^>]*[^/])>(?![\\s\\S]*?</${tagName}>)`, 'g');
      processedSvg = processedSvg.replace(unclosedPattern, `<${tagName}$1/>`);
      
      // Convert empty tags to self-closing
      const emptyTagPattern = new RegExp(`<${tagName}([^>]*)></\\s*${tagName}\\s*>`, 'g');
      processedSvg = processedSvg.replace(emptyTagPattern, `<${tagName}$1/>`);
    });
    
    // 9. Fix improper nesting before </svg>
    const endingPatterns = [
      { pattern: /<(rect|circle|path|line)([^>]*?)>([^<]*?)<\/svg>/g, replacement: '<$1$2/>$3</svg>' },
      { pattern: /<g([^>]*?)>([^<]*?)<\/svg>/g, replacement: '<g$1>$2</g></svg>' },
      { pattern: /<text([^>]*?)>([^<]*?)<\/svg>/g, replacement: '<text$1>$2</text></svg>' }
    ];
    
    endingPatterns.forEach(({ pattern, replacement }) => {
      processedSvg = processedSvg.replace(pattern, replacement);
    });
    
    // 10. Fix missing g tag closures - count g tags
    const openGTags = (processedSvg.match(/<g\b[^>]*>/g) || []).length;
    const closeGTags = (processedSvg.match(/<\/g>/g) || []).length;
    
    if (openGTags > closeGTags) {
      const missingClosures = openGTags - closeGTags;
      processedSvg = processedSvg.replace('</svg>', '</g>'.repeat(missingClosures) + '</svg>');
      console.log(`Added ${missingClosures} missing </g> tags`);
    }
    
    // Final validation with DOM parser
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(processedSvg, 'image/svg+xml');
      const errorNode = doc.querySelector('parsererror');
      
      if (errorNode) {
        console.warn('SVG parsing issues remain after processing:', errorNode.textContent);
        // We'll still return the processed SVG and try rendering it anyway
      } else {
        console.log('SVG validated successfully after processing');
      }
    } catch (err) {
      console.warn('Error validating SVG:', err);
    }
    
    return processedSvg;
  };

  // Create a fallback SVG for error cases
  const createFallbackSvg = (): string => {
    const w = width || 300;
    const h = height || 200;
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
      <rect width="100%" height="100%" fill="#f8f9fa" />
      <g transform="translate(${w/2}, ${h/2})">
        <text x="0" y="-20" text-anchor="middle" font-size="16" fill="#cc0000" font-family="sans-serif">SVG Rendering Error</text>
        <text x="0" y="10" text-anchor="middle" font-size="12" fill="#666666" font-family="sans-serif">Check console for details</text>
      </g>
    </svg>`;
  };

  // Try to parse SVG content or use fallback
  const finalSvg = (() => {
    try {
      const processed = processSvg(svgContent || '');
      
      // Basic validation - if it doesn't have svg tags, it's invalid
      if (!processed.includes('<svg') || !processed.includes('</svg>')) {
        console.error('Invalid SVG content (missing svg tags)');
        return createFallbackSvg();
      }
      
      return processed;
    } catch (err) {
      console.error('Error processing SVG:', err);
      return createFallbackSvg();
    }
  })();

  // IMPROVED RENDERING METHODS:
  
  // 1. DOM API method (safest)
  const renderWithDOM = (container: HTMLElement, svg: string): boolean => {
    try {
      // Create an SVG element via DOM API rather than innerHTML
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
      const parserError = svgDoc.querySelector('parsererror');
      
      if (parserError) {
        console.warn('Parser error in DOM rendering method:', parserError.textContent);
        return false;
      }
      
      const svgElement = svgDoc.querySelector('svg');
      if (!svgElement) {
        console.error('No SVG element found after parsing');
        return false;
      }
      
      // Clear the container
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      // Apply dimensions if needed
      if (width) {
        svgElement.setAttribute('width', `${width}px`);
      }
      if (height) {
        svgElement.setAttribute('height', `${height}px`);
      }
      
      // Make it responsive
      svgElement.style.width = '100%';
      svgElement.style.height = '100%';
      svgElement.style.display = 'block';
      
      // Clone and append the SVG element to avoid any existing references
      const importedNode = document.importNode(svgElement, true);
      container.appendChild(importedNode);
      
      console.log('Successfully rendered SVG with DOM API method');
      return true;
    } catch (error) {
      console.error('Error in direct DOM rendering method:', error);
      return false;
    }
  };
  
  // 2. Blob URL method (useful for complex SVGs)
  const renderWithBlobURL = (container: HTMLElement, svg: string): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        console.log('Trying Blob URL rendering method');
        
        // Create a blob from the SVG content
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        // Create an img element to display the SVG
        const img = document.createElement('img');
        img.width = width || 400;
        img.height = height || 300;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        
        // Set up onload/onerror handlers
        img.onload = () => {
          console.log('Successfully rendered SVG with Blob URL method');
          URL.revokeObjectURL(url); // Clean up
          resolve(true);
        };
        
        img.onerror = (err) => {
          console.error('Blob URL rendering method failed:', err);
          URL.revokeObjectURL(url); // Clean up
          resolve(false);
        };
        
        // Clear container
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
        
        // Set the src and add to container
        img.src = url;
        container.appendChild(img);
      } catch (error) {
        console.error('Error in Blob URL rendering method:', error);
        resolve(false);
      }
    });
  };
  
  // 3. innerHTML method (fallback, less safe but most compatible)
  const renderWithInnerHTML = (container: HTMLElement, svg: string): boolean => {
    try {
      console.log('Using innerHTML rendering method');
      
      // Clear container
      container.innerHTML = '';
      
      // Set the HTML content
      container.innerHTML = svg;
      
      // Apply dimensions to the rendered SVG if needed
      const svgElement = container.querySelector('svg');
      if (svgElement) {
        if (width) {
          svgElement.setAttribute('width', `${width}px`);
        }
        if (height) {
          svgElement.setAttribute('height', `${height}px`);
        }
        
        // Make it responsive
        svgElement.style.width = '100%';
        svgElement.style.height = '100%';
        svgElement.style.display = 'block';
        
        console.log('Successfully rendered SVG with innerHTML method');
        return true;
      } else {
        console.error('No SVG element found after innerHTML rendering');
        return false;
      }
    } catch (error) {
      console.error('Error in innerHTML rendering method:', error);
      return false;
    }
  };

  // Render error message when all methods fail
  const renderErrorMessage = (container: HTMLElement, errorMsg: string): void => {
    container.innerHTML = `
      <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f9fa;color:#cc0000;font-family:sans-serif;padding:20px;text-align:center;">
        <div style="font-weight:bold;margin-bottom:8px;">SVG Rendering Failed</div>
        <div style="font-size:12px;color:#666;">${errorMsg}</div>
      </div>
    `;
  };

  // Main rendering effect
  useEffect(() => {
    const attemptRender = async () => {
      try {
        if (!svgContent) {
          setError('No SVG content provided');
          onRender?.(false);
          return;
        }
        
        debugSvg(finalSvg);
        
        const container = containerRef.current;
        if (!container) {
          setError('Container not available');
          onRender?.(false);
          return;
        }
        
        // Try each rendering method in sequence if previous ones fail
        let success = false;
        
        // Method 1: DOM API (safest)
        if (renderMethod === 'dom' || renderAttempt === 0) {
          success = renderWithDOM(container, finalSvg);
          if (success) {
            setRenderMethod('dom');
            setError(null);
            onRender?.(true);
            return;
          }
        }
        
        // Method 2: Blob URL (good for complex SVGs)
        if (renderMethod === 'blob' || renderAttempt === 1) {
          success = await renderWithBlobURL(container, finalSvg);
          if (success) {
            setRenderMethod('blob');
            setError(null);
            onRender?.(true);
            return;
          }
        }
        
        // Method 3: innerHTML (fallback)
        if (renderMethod === 'innerHTML' || renderAttempt === 2) {
          success = renderWithInnerHTML(container, finalSvg);
          if (success) {
            setRenderMethod('innerHTML');
            setError(null);
            onRender?.(true);
            return;
          }
        }
        
        // All methods failed
        if (!success) {
          // If all rendering methods failed, try one more time with the fallback SVG
          if (renderAttempt < 3) {
            console.warn(`All rendering methods failed, retrying with fallback (attempt ${renderAttempt + 1})`);
            setRenderAttempt(prev => prev + 1);
          } else {
            // Give up and show error message
            console.error('All SVG rendering methods failed after multiple attempts');
            renderErrorMessage(container, 'Failed to render SVG after multiple attempts');
            setError('All rendering methods failed');
            onRender?.(false);
          }
        }
      } catch (err) {
        console.error('Unexpected error in SVG rendering:', err);
        
        // Try fallback if available
        if (containerRef.current) {
          renderErrorMessage(containerRef.current, err instanceof Error ? err.message : 'Unknown error');
        }
        
        setError(`SVG render error: ${err instanceof Error ? err.message : String(err)}`);
        onRender?.(false);
      }
    };
    
    attemptRender();
  }, [svgContent, width, height, renderAttempt, finalSvg, onRender, renderMethod]);

  // Method to convert the rendered SVG to an image
  const convertToImage = async (): Promise<string | null> => {
    try {
      const container = containerRef.current;
      if (!container) {
        throw new Error('Container not available');
      }

      const canvas = await html2canvas(container, {
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
      console.error('Error converting SVG to image:', err);
      return null;
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    convertToImage
  }));

  return (
    <RendererContainer 
      ref={containerRef} 
      width={width} 
      height={height} 
      showBorder={showBorder}
      data-testid="svg-renderer"
    >
      {error && process.env.NODE_ENV === 'development' && (
        <div style={{ color: 'red', padding: '8px', fontSize: '12px', position: 'absolute', top: 0, left: 0, background: 'rgba(255,255,255,0.8)', zIndex: 10 }}>
          Error: {error}
        </div>
      )}
    </RendererContainer>
  );
});

export default SVGDesignRenderer; 
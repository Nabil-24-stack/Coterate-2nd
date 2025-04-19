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

// Add some logging for SVG debugging
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

  // Process SVG to clean up any potential issues
  const processSvg = (svg: string): string => {
    if (!svg) return '';
    
    console.log('Processing SVG content...');
    
    // Clean up the SVG content
    let processedSvg = svg.trim();
    
    // If it doesn't start with <svg, try to find and extract the svg tag
    if (!processedSvg.startsWith('<svg')) {
      const svgStartIndex = processedSvg.indexOf('<svg');
      const svgEndIndex = processedSvg.indexOf('</svg>');
      
      if (svgStartIndex !== -1 && svgEndIndex !== -1) {
        processedSvg = processedSvg.substring(svgStartIndex, svgEndIndex + 6); // +6 to include </svg>
        console.log('Extracted SVG tag from content');
      }
    }
    
    // Check for and fix common SVG issues
    
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
    }
    
    // 4. Fix any malformed style elements
    if (processedSvg.includes('<style>') && !processedSvg.includes('</style>')) {
      processedSvg = processedSvg.replace('<style>', '<style><![CDATA[');
      processedSvg = processedSvg.replace(/<\/svg>/, ']]></style></svg>');
      console.log('Fixed malformed style tag');
    }
    
    // 5. Ensure text elements have proper attributes for positioning
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
    
    // 6. Fix font-family issues
    processedSvg = processedSvg.replace(/font-family:([^;,"']+)/g, "font-family:'$1', Arial, sans-serif");
    
    // 7. Check for and fix missing/malformed SVG elements or attributes
    processedSvg = fixCommonSvgIssues(processedSvg);
    
    return processedSvg;
  };

  // Helper function to fix common SVG issues
  const fixCommonSvgIssues = (svg: string): string => {
    let fixedSvg = svg;
    
    // Fix unclosed tags
    const openTags = svg.match(/<([a-zA-Z]+)(?:\s+[^>]*)?>/g) || [];
    const closeTags = svg.match(/<\/([a-zA-Z]+)>/g) || [];
    
    if (openTags.length > closeTags.length) {
      console.log('Detected unclosed tags, attempting to fix');
      
      // Find tags that aren't properly closed
      const openTagNames = openTags.map(tag => tag.match(/<([a-zA-Z]+)(?:\s+[^>]*)?>/)?.[1] || '');
      const closeTagNames = closeTags.map(tag => tag.match(/<\/([a-zA-Z]+)>/)?.[1] || '');
      
      // Count occurrences of each tag
      const tagCounts: {[key: string]: number} = {};
      openTagNames.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
      
      closeTagNames.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) - 1;
      });
      
      // Find unclosed tags
      Object.keys(tagCounts).forEach(tag => {
        if (tagCounts[tag] > 0) {
          // Add missing closing tags before </svg>
          const closingTag = `</${tag}>`;
          if (!fixedSvg.includes(closingTag)) {
            fixedSvg = fixedSvg.replace('</svg>', `${closingTag}</svg>`);
            console.log(`Added missing closing tag: ${closingTag}`);
          }
        }
      });
    }
    
    // Check for style tag with actual styling but missing CDATA
    if (fixedSvg.includes('<style>') && 
        fixedSvg.match(/<style>(?![<!\[CDATA\[]).*\{/g) &&
        !fixedSvg.includes('<![CDATA[')) {
      // Add CDATA to style tag
      fixedSvg = fixedSvg.replace(/<style>([\s\S]*?)<\/style>/g, '<style><![CDATA[$1]]></style>');
      console.log('Added missing CDATA to style tag');
    }
    
    return fixedSvg;
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

  // Effect to render the SVG content
  useEffect(() => {
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
      
      // Clear previous content
      container.innerHTML = '';
      
      // Try to parse the SVG as XML to check for any syntax errors
      try {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(finalSvg, 'image/svg+xml');
        
        // Check for parsing errors (DOMParser puts errors in a parsererror tag)
        const parserError = svgDoc.querySelector('parsererror');
        if (parserError) {
          throw new Error(`SVG parsing error: ${parserError.textContent}`);
        }
      } catch (parseError) {
        console.error('SVG parsing error:', parseError);
        // Continue with direct setting - we'll still try to render it
      }
      
      try {
        // Set the SVG content directly in the container
        container.innerHTML = finalSvg;
        
        // Adjust SVG to fit the container if needed
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
          
          // Signal successful render
          setError(null);
          onRender?.(true);
        } else {
          throw new Error('Failed to render SVG - no SVG element found after insertion');
        }
      } catch (renderError) {
        console.error('SVG rendering error:', renderError);
        
        // For catastrophic rendering failures, use a simple error message as HTML
        container.innerHTML = `
          <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f9fa;color:#cc0000;font-family:sans-serif;padding:20px;text-align:center;">
            <div style="font-weight:bold;margin-bottom:8px;">SVG Rendering Failed</div>
            <div style="font-size:12px;color:#666;">${renderError instanceof Error ? renderError.message : 'Unknown error'}</div>
          </div>
        `;
        
        setError(`SVG render error: ${renderError instanceof Error ? renderError.message : String(renderError)}`);
        onRender?.(false);
      }
    } catch (err) {
      console.error('Error in SVG render effect:', err);
      
      // Retry a few times before giving up
      if (renderAttempt < 3) {
        console.log(`Retrying SVG render (attempt ${renderAttempt + 1})`);
        setRenderAttempt(prev => prev + 1);
      } else {
        setError(`SVG render failed: ${err instanceof Error ? err.message : String(err)}`);
        onRender?.(false);
        
        // Try one last fallback directly
        try {
          if (containerRef.current) {
            containerRef.current.innerHTML = createFallbackSvg();
          }
        } catch (fallbackErr) {
          console.error('Even fallback SVG failed:', fallbackErr);
        }
      }
    }
  }, [svgContent, width, height, renderAttempt, finalSvg, onRender]);

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
      {error && (
        <div style={{ color: 'red', padding: '8px', fontSize: '12px' }}>
          Error: {error}
        </div>
      )}
    </RendererContainer>
  );
});

export default SVGDesignRenderer; 
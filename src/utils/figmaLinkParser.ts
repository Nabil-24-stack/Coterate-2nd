/**
 * Utility functions for parsing Figma selection links
 */

/**
 * Interface for parsed Figma link data
 */
export interface FigmaLinkData {
  fileKey: string;
  nodeId: string;
  isValid: boolean;
}

/**
 * Parse a Figma selection link and extract file key and node ID
 * Handles multiple Figma link formats:
 * - Standard selection link: https://www.figma.com/file/abcdef123456/FileName?node-id=123%3A456
 * - Direct node link: https://www.figma.com/file/abcdef123456/FileName?node-id=123%3A456&t=abcdef
 * - Share link with node: https://www.figma.com/file/abcdef123456/FileName/nodes/123%3A456
 * - Design link: https://www.figma.com/design/abcdef123456/FileName
 * 
 * @param linkText The Figma selection link to parse
 * @returns An object containing the file key, node ID, and validity status
 */
export function parseFigmaSelectionLink(linkText: string): FigmaLinkData {
  try {
    // Default result with invalid state
    const defaultResult: FigmaLinkData = {
      fileKey: '',
      nodeId: '',
      isValid: false
    };

    // Handle design link format first (/design/ route)
    if (linkText && linkText.includes('figma.com/design/')) {
      // Extract the design key which is the fileKey for Figma API
      const designKeyRegex = /figma\.com\/design\/([^/]+)/;
      const designKeyMatch = linkText.match(designKeyRegex);
      
      if (designKeyMatch && designKeyMatch[1]) {
        const fileKey = designKeyMatch[1];
        // For design links, we use a default node ID of "0:1" which represents the first frame
        return {
          fileKey,
          nodeId: '0:1', // Default node ID for the first frame
          isValid: true
        };
      }
      return defaultResult;
    }

    // Check if the text might be a Figma file link
    if (!linkText || !linkText.includes('figma.com/file/')) {
      return defaultResult;
    }

    // Extract the file key using regex
    const fileKeyRegex = /figma\.com\/file\/([^/?]+)/;
    const fileKeyMatch = linkText.match(fileKeyRegex);
    if (!fileKeyMatch || !fileKeyMatch[1]) {
      return defaultResult;
    }

    const fileKey = fileKeyMatch[1];
    let nodeId = '';
    
    // Try multiple node ID extraction patterns
    
    // 1. Standard query parameter format: node-id=123%3A456
    const queryNodeIdRegex = /node-id=([^&]+)/;
    const queryNodeIdMatch = linkText.match(queryNodeIdRegex);
    
    // 2. Path format: /nodes/123%3A456
    const pathNodeIdRegex = /\/nodes\/([^/]+)/;
    const pathNodeIdMatch = linkText.match(pathNodeIdRegex);
    
    // Use whichever pattern matched
    if (queryNodeIdMatch && queryNodeIdMatch[1]) {
      nodeId = decodeURIComponent(queryNodeIdMatch[1]);
    } else if (pathNodeIdMatch && pathNodeIdMatch[1]) {
      nodeId = decodeURIComponent(pathNodeIdMatch[1]);
    } else {
      // No node ID found - use default node ID
      nodeId = '0:1'; // Default node ID for the first frame
    }
    
    return {
      fileKey,
      nodeId,
      isValid: true
    };
  } catch (error) {
    console.error('Error parsing Figma selection link:', error);
    return {
      fileKey: '',
      nodeId: '',
      isValid: false
    };
  }
}

/**
 * Check if a string is likely a Figma selection link
 * 
 * @param text Text to check
 * @returns Boolean indicating if the text appears to be a Figma link
 */
export function isFigmaSelectionLink(text: string): boolean {
  if (!text) return false;
  
  // Check for all possible Figma link patterns
  const patterns = [
    /figma\.com\/file\/[^/?]+.*node-id=/i,      // Standard query param format
    /figma\.com\/file\/[^/?]+\/nodes\//i,       // Path format
    /figma\.com\/file\/[^/?]+.*view\?node-id=/i, // View format
    /figma\.com\/design\/[^/]+/i,               // Design format
    /figma\.com\/file\/[^/?]+/i                 // Any file link (fallback)
  ];
  
  // Return true if any pattern matches
  return patterns.some(pattern => pattern.test(text));
} 
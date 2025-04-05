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
 * - Design link: https://www.figma.com/design/abcdef123456/FileName?node-id=123-456
 * 
 * @param linkText The Figma selection link to parse
 * @returns An object containing the file key, node ID, and validity status
 */
export function parseFigmaSelectionLink(linkText: string): FigmaLinkData {
  try {
    console.log('Parsing Figma link:', linkText);
    
    // Default result with invalid state
    const defaultResult: FigmaLinkData = {
      fileKey: '',
      nodeId: '',
      isValid: false
    };

    // Handle design link format first (/design/ route)
    if (linkText && linkText.includes('figma.com/design/')) {
      // Extract the design key which is the fileKey for Figma API
      const designKeyRegex = /figma\.com\/design\/([^/?]+)/;
      const designKeyMatch = linkText.match(designKeyRegex);
      
      console.log('Design key match:', designKeyMatch ? designKeyMatch[1] : 'none');
      
      if (designKeyMatch && designKeyMatch[1]) {
        const fileKey = designKeyMatch[1];
        
        // For /design/ links, we need to look for node IDs with multiple patterns
        // Try all known formats for node ID parameters
        const nodeIdPatterns = [
          /[?&]node[-_]?id=([^&]+)/i,     // Standard node-id or node_id
          /[?&]node=([^&]+)/i,            // Shortened 'node' param
          /[?&]id=([^&]+)/i,              // Just 'id' param
          /[?&]selection=([^&]+)/i        // Selection param
        ];
        
        // Try each pattern until we find a match
        let nodeId = '';
        for (const pattern of nodeIdPatterns) {
          const nodeMatch = linkText.match(pattern);
          if (nodeMatch && nodeMatch[1]) {
            nodeId = decodeURIComponent(nodeMatch[1]);
            console.log(`Found node ID using pattern ${pattern}: ${nodeId}`);
            break;
          }
        }
        
        // Even if we don't find a specific node ID, let's assume it's the first node
        // The important part is that we have a valid fileKey for design links
        return {
          fileKey,
          nodeId: nodeId || '0:1', // Default to root node if none specified
          isValid: !!nodeId  // Only mark as fully valid if we have both fileKey and nodeId
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
    
    // 1. Standard query parameter format: node-id=123%3A456 or node-id=123-456
    const queryNodeIdRegex = /node-id=([^&]+)/;
    const queryNodeIdMatch = linkText.match(queryNodeIdRegex);
    
    // 2. Path format: /nodes/123%3A456
    const pathNodeIdRegex = /\/nodes\/([^/]+)/;
    const pathNodeIdMatch = linkText.match(pathNodeIdRegex);
    
    // Use whichever pattern matched
    if (queryNodeIdMatch && queryNodeIdMatch[1]) {
      nodeId = decodeURIComponent(queryNodeIdMatch[1]);
      console.log('Found node ID in query string:', nodeId);
    } else if (pathNodeIdMatch && pathNodeIdMatch[1]) {
      nodeId = decodeURIComponent(pathNodeIdMatch[1]);
      console.log('Found node ID in path:', nodeId);
    } else {
      // No node ID found - for file links, this isn't valid
      // We need a specific node ID for selection links
      console.log('No node ID found in link');
      return defaultResult;
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
  
  // More permissive patterns to match a wider range of Figma links
  const patterns = [
    /figma\.com\/file\/[^/?]+.*node-id=/i,      // Standard query param format
    /figma\.com\/file\/[^/?]+\/nodes\//i,       // Path format
    /figma\.com\/file\/[^/?]+.*view\?node-id=/i, // View format
    /figma\.com\/design\/[^/?]+/i,              // Match ANY design link - we'll parse the details later
  ];
  
  const isMatch = patterns.some(pattern => pattern.test(text));
  console.log('isFigmaSelectionLink result:', isMatch);
  return isMatch;
} 
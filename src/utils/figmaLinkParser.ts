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
 * Example link format: https://www.figma.com/file/abcdef123456/FileName?node-id=123%3A456
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

    // Check if the text might be a Figma link
    if (!linkText || !linkText.includes('figma.com/file/')) {
      return defaultResult;
    }

    // Extract the file key using regex
    const fileKeyRegex = /figma\.com\/file\/([^/?]+)/;
    const fileKeyMatch = linkText.match(fileKeyRegex);
    if (!fileKeyMatch || !fileKeyMatch[1]) {
      return defaultResult;
    }

    // Extract the node ID from the URL
    const nodeIdRegex = /node-id=([^&]+)/;
    const nodeIdMatch = linkText.match(nodeIdRegex);
    if (!nodeIdMatch || !nodeIdMatch[1]) {
      return defaultResult;
    }

    // Decode the node ID (it might be URL encoded)
    const nodeId = decodeURIComponent(nodeIdMatch[1]);
    
    return {
      fileKey: fileKeyMatch[1],
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
  
  // Check if it has the basic pattern of a Figma file URL with node-id
  const pattern = /figma\.com\/file\/[^/?]+.*node-id=/i;
  return pattern.test(text);
} 
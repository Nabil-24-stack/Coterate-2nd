/**
 * FigmaService.ts
 * Service for interacting with the Figma API to fetch design data
 */

import axios from 'axios';
import { UIComponent } from '../types';
import { getFigmaAccessTokenFromUser } from './SupabaseService';
import { getSupabase } from './SupabaseService';

// Get the Figma client credentials from environment variables
export const getFigmaClientCredentials = (): { clientId: string | null; clientSecret: string | null } => {
  // Check for client ID in various environment variable formats
  const clientId = 
    process.env.NEXT_PUBLIC_FIGMA_CLIENT_ID ||
    process.env.FIGMA_CLIENT_ID ||
    process.env.REACT_APP_FIGMA_CLIENT_ID ||
    null;
  
  // Check for client secret in various environment variable formats
  // Note: Client secret should only be used on the server side
  const clientSecret = 
    process.env.FIGMA_CLIENT_SECRET ||
    process.env.REACT_APP_FIGMA_CLIENT_SECRET ||
    null;
  
  if (clientId) {
    console.log('Found Figma Client ID in environment variables');
  }
  
  if (clientSecret) {
    console.log('Found Figma Client Secret in environment variables (should only be used on server)');
  }
  
  return { clientId, clientSecret };
};

// Get the Figma API key from environment variables or user's token
const getFigmaApiKey = async (): Promise<string> => {
  try {
    // First try to get the token from the authenticated user (via Supabase)
    console.log('Attempting to get Figma token from user session...');
    const userToken = await getFigmaAccessTokenFromUser();
    
    if (userToken) {
      // Mask token for logging
      const maskedToken = userToken.substring(0, 5) + '...' + userToken.substring(userToken.length - 5);
      console.log('Using user Figma auth token (masked):', maskedToken);
      return userToken;
    }
    
    // Check our direct localStorage backup for the Figma token
    console.log('Checking for directly stored Figma token...');
    const directToken = localStorage.getItem('figma_provider_token');
    if (directToken) {
      console.log('Found directly stored Figma provider token');
      return directToken;
    }
    
    // If we can't get a token from Supabase, check local storage directly
    console.log('No token from session, checking localStorage directly...');
    
    try {
      const supabaseAuthToken = localStorage.getItem('supabase.auth.token');
      if (supabaseAuthToken) {
        const authData = JSON.parse(supabaseAuthToken);
        const providerToken = authData?.currentSession?.provider_token;
        
        if (providerToken) {
          console.log('Found provider token in localStorage');
          return providerToken;
        }
      }
    } catch (storageError) {
      console.error('Error accessing localStorage:', storageError);
    }
    
    // If we can't get a token from either source, we may not be authenticated correctly
    console.warn('Could not retrieve Figma token from user session or localStorage. You may need to sign out and sign in again with Figma.');

    // Fall back to environment variable if needed - support both formats
    const envToken = (
      process.env.NEXT_PUBLIC_FIGMA_ACCESS_TOKEN || 
      process.env.FIGMA_ACCESS_TOKEN || 
      process.env.REACT_APP_FIGMA_ACCESS_TOKEN || 
      ''
    );
    
    if (envToken && envToken !== 'replace_with_your_key') {
      console.log('Using environment variable token as fallback');
      return envToken;
    }
    
    // Check if we have client credentials - if so, inform that user needs to authenticate
    const { clientId } = getFigmaClientCredentials();
    if (clientId) {
      console.log('Figma client credentials are set up, but no access token is available. User needs to sign in.');
      throw new Error('No Figma access token available. Please sign in with Figma to authorize access to your designs.');
    }
    
    throw new Error('No Figma API token available. Please sign in with Figma or configure an API token.');
  } catch (error) {
    console.error('Error getting Figma API key:', error);
    throw new Error('Failed to get Figma access token. Please sign in with Figma again.');
  }
};

// Constants for Figma API
const FIGMA_API_BASE_URL = 'https://api.figma.com/v1';

/**
 * Parse a Figma URL to extract file ID and node ID
 * @param figmaUrl - Figma URL (copy link to selection format)
 * @returns Object with fileId and nodeId
 */
export const parseFigmaUrl = (figmaUrl: string): { fileId: string; nodeId: string } => {
  try {
    // Expected format: https://www.figma.com/file/[fileId]/[fileName]?node-id=[nodeId]
    const url = new URL(figmaUrl);
    const fileId = url.pathname.split('/')[2]; // Extract file ID from path
    
    // Extract node ID from query parameters
    const nodeId = url.searchParams.get('node-id') || '';
    
    if (!fileId || !nodeId) {
      throw new Error('Invalid Figma URL format');
    }
    
    return { fileId, nodeId };
  } catch (error) {
    console.error('Error parsing Figma URL:', error);
    throw new Error('Failed to parse Figma URL. Please ensure it\'s a valid "Copy link to selection" URL');
  }
};

/**
 * Check if Figma API is configured correctly
 */
export const isFigmaApiConfigured = async (): Promise<boolean> => {
  const apiKey = await getFigmaApiKey();
  return Boolean(apiKey);
};

/**
 * Main function to handle the Figma design import flow
 * @param figmaUrl - Figma URL (copy link to selection format)
 * @returns Promise with the design data, components, and image
 */
export const importFigmaDesign = async (figmaUrl: string) => {
  try {
    // Step 1: Check if we have a valid Figma token
    const apiKey = await getFigmaApiKey();
    if (!apiKey) {
      throw new Error('You need to log in with Figma to access this design. Please sign in using the Figma authentication.');
    }
    
    // Step 2: Parse the Figma URL to extract file and node IDs
    console.log('Parsing Figma URL...');
    const { fileId, nodeId } = parseFigmaUrl(figmaUrl);
    
    // Step 3: Fetch the Figma design data
    console.log('Fetching Figma design data...');
    try {
      const { fileData } = await fetchFigmaDesign(figmaUrl);
      
      // Step 4: Extract components from the Figma data
      console.log('Extracting components from Figma data...');
      const components = extractComponentsFromFigma(fileData, nodeId);
      
      // Step 5: Fetch the image for the selected node
      console.log('Fetching node image...');
      const imageData = await fetchFigmaNodeImage(fileId, nodeId);
      
      // Return the complete Figma design data
      return {
        fileData,
        nodeId,
        fileId,
        components,
        imageData,
        figmaUrl
      };
    } catch (error: any) {
      // Handle specific API errors
      if (error.response) {
        if (error.response.status === 403) {
          throw new Error('Access denied to this Figma file. Make sure you have permission to view this file or you are logged in with the right Figma account.');
        } else if (error.response.status === 404) {
          throw new Error('Figma file not found. The file may have been deleted or you don\'t have access to it.');
        } else {
          throw new Error(`Figma API error: ${error.response.data?.message || error.response.statusText || 'Unknown error'}`);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Error importing Figma design:', error);
    throw error;
  }
};

/**
 * Fetch design data from Figma API
 * @param figmaUrl - Figma URL (copy link to selection format)
 * @returns Promise with the design data
 */
export const fetchFigmaDesign = async (figmaUrl: string): Promise<any> => {
  try {
    const apiKey = await getFigmaApiKey();
    if (!apiKey) {
      throw new Error('Figma API key not configured. Please log in with Figma.');
    }
    
    console.log('Using Figma token (masked):', 
      apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 5));
    
    // Parse the Figma URL to get file ID and node ID
    const { fileId, nodeId } = parseFigmaUrl(figmaUrl);
    
    // Validate fileId to ensure it's in the right format
    if (!fileId.match(/^[a-zA-Z0-9]{22,}$/)) {
      throw new Error('Invalid Figma file ID format. Please ensure you copied a valid "Copy link to selection" URL.');
    }
    
    try {
      // Fetch file data from Figma API
      const response = await axios.get(`${FIGMA_API_BASE_URL}/files/${fileId}`, {
        headers: {
          'X-Figma-Token': apiKey
        }
      });
      
      if (!response.data) {
        throw new Error('Failed to fetch design data from Figma');
      }
      
      return {
        fileData: response.data,
        nodeId
      };
    } catch (error: any) {
      // Handle specific error cases
      if (error.response) {
        if (error.response.status === 403) {
          // Access denied error - provide a clear message about file permissions
          console.error(`Figma API returned 403 Access Denied for file ID: ${fileId}`);
          
          // This is likely a token issue - try to get a fresh token
          console.log('Access denied - suggesting to reauthenticate with Figma');
          
          throw new Error(
            'Access denied to this Figma file. Please check that:\n' + 
            '1. You are logged in with the correct Figma account\n' + 
            '2. Your account has permission to view this file\n' + 
            '3. You are trying to access a file that exists and is shared with you\n\n' +
            'Try signing out and signing back in with Figma to refresh your access token.'
          );
        } else if (error.response.status === 404) {
          throw new Error('Figma file not found. The file may have been deleted or the URL is incorrect.');
        } else {
          console.error('Figma API error:', error.response.status, error.response.data);
          throw new Error(`Figma API error: ${error.response.status} - ${error.response.data?.message || error.response.statusText || 'Unknown error'}`);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching Figma design:', error);
    throw error;
  }
};

/**
 * Fetch image for a specific node in Figma
 * @param fileId - Figma file ID
 * @param nodeId - Figma node ID
 * @returns Promise with the image URL
 */
export const fetchFigmaNodeImage = async (fileId: string, nodeId: string): Promise<string> => {
  try {
    const apiKey = await getFigmaApiKey();
    if (!apiKey) {
      throw new Error('Figma API key not configured');
    }
    
    // Fetch image URLs from Figma API
    const response = await axios.get(
      `${FIGMA_API_BASE_URL}/images/${fileId}?ids=${nodeId}&format=png&scale=2`,
      {
        headers: {
          'X-Figma-Token': apiKey
        }
      }
    );
    
    if (!response.data || !response.data.images || !response.data.images[nodeId]) {
      throw new Error('Failed to fetch image URL from Figma');
    }
    
    // Get the image URL from the response
    const imageUrl = response.data.images[nodeId];
    
    // Fetch the actual image data
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });
    
    // Convert the image data to a base64 string
    const imageBase64 = Buffer.from(imageResponse.data, 'binary').toString('base64');
    return `data:image/png;base64,${imageBase64}`;
  } catch (error) {
    console.error('Error fetching Figma node image:', error);
    throw error;
  }
};

/**
 * Extract UI components from Figma nodes
 * @param fileData - Figma file data
 * @param nodeId - Target node ID
 * @returns Array of UI components
 */
export const extractComponentsFromFigma = (fileData: any, nodeId: string): UIComponent[] => {
  try {
    const components: UIComponent[] = [];
    const document = fileData.document;
    
    // Find the target node in the document
    const targetNode = findNodeById(document, nodeId);
    if (!targetNode) {
      throw new Error(`Node with ID ${nodeId} not found in the document`);
    }
    
    // Process the node and its children recursively
    processNode(targetNode, components);
    
    return components;
  } catch (error) {
    console.error('Error extracting components from Figma:', error);
    return [];
  }
};

/**
 * Find a node by ID in the Figma document
 * @param node - Current node to search
 * @param nodeId - Target node ID
 * @returns The node if found, null otherwise
 */
const findNodeById = (node: any, nodeId: string): any => {
  if (node.id === nodeId) {
    return node;
  }
  
  // Check children
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, nodeId);
      if (found) return found;
    }
  }
  
  return null;
};

/**
 * Process a Figma node and convert it to UI components
 * @param node - Figma node
 * @param components - Array to store components
 * @param parentId - Optional parent component ID
 */
const processNode = (node: any, components: UIComponent[], parentId?: string): void => {
  // Skip invisible nodes
  if (node.visible === false) return;
  
  // Convert node to component based on type
  if (shouldProcessNodeType(node.type)) {
    const component = convertNodeToComponent(node);
    if (component) {
      if (parentId) {
        component.parent = parentId;
      }
      components.push(component);
      
      // Process children for container-like nodes
      if (node.children && isContainerType(node.type)) {
        for (const child of node.children) {
          processNode(child, components, component.id);
        }
      }
    }
  }
};

/**
 * Check if the node type should be processed
 * @param nodeType - Figma node type
 * @returns Boolean indicating if the node should be processed
 */
const shouldProcessNodeType = (nodeType: string): boolean => {
  const processableTypes = [
    'FRAME', 'GROUP', 'RECTANGLE', 'TEXT', 'VECTOR', 'INSTANCE', 
    'COMPONENT', 'ELLIPSE', 'POLYGON', 'STAR', 'LINE', 'BOOLEAN_OPERATION',
    'COMPONENT_SET'
  ];
  return processableTypes.includes(nodeType);
};

/**
 * Check if the node type is a container that can have children
 * @param nodeType - Figma node type
 * @returns Boolean indicating if the node is a container
 */
const isContainerType = (nodeType: string): boolean => {
  const containerTypes = ['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT', 'COMPONENT_SET', 'BOOLEAN_OPERATION'];
  return containerTypes.includes(nodeType);
};

/**
 * Convert a Figma node to a UI component
 * @param node - Figma node
 * @returns UI component or null if conversion failed
 */
const convertNodeToComponent = (node: any): UIComponent | null => {
  try {
    // Map Figma node type to our component type
    const componentType = mapFigmaNodeTypeToComponentType(node.type, node);
    
    // Extract position and size
    const position = {
      x: node.absoluteBoundingBox?.x || 0,
      y: node.absoluteBoundingBox?.y || 0,
      width: node.absoluteBoundingBox?.width || 0,
      height: node.absoluteBoundingBox?.height || 0,
      zIndex: node.zIndex || 0
    };
    
    // Extract styles
    const style = extractStylesFromNode(node);
    
    // Extract text content if available
    const content = node.characters || '';
    
    return {
      id: node.id,
      type: componentType,
      position,
      style,
      content
    };
  } catch (error) {
    console.error('Error converting Figma node to component:', error, node);
    return null;
  }
};

/**
 * Map Figma node type to our component type
 * @param nodeType - Figma node type
 * @param node - The full node for additional context
 * @returns Component type
 */
const mapFigmaNodeTypeToComponentType = (nodeType: string, node: any): UIComponent['type'] => {
  // Check for button-like nodes
  if (node.name?.toLowerCase().includes('button') || 
      (node.characters && nodeType === 'TEXT' && node.fills?.some((fill: any) => fill.type === 'SOLID')) ||
      (nodeType === 'RECTANGLE' && node.cornerRadius > 0)) {
    return 'button';
  }
  
  // Check for text fields
  if (node.name?.toLowerCase().includes('input') || 
      node.name?.toLowerCase().includes('field') ||
      (nodeType === 'RECTANGLE' && node.strokes?.length > 0)) {
    return 'text_field';
  }
  
  // Handle text nodes
  if (nodeType === 'TEXT') {
    return 'text';
  }
  
  // Handle vectors (often icons)
  if (nodeType === 'VECTOR' || nodeType === 'STAR' || nodeType === 'ELLIPSE' || nodeType === 'POLYGON') {
    return 'icon';
  }
  
  // Handle container types
  if (isContainerType(nodeType)) {
    return 'container';
  }
  
  // Default fallback
  return 'unknown';
};

/**
 * Extract styles from a Figma node
 * @param node - Figma node
 * @returns Component style object
 */
const extractStylesFromNode = (node: any): UIComponent['style'] => {
  const colors: string[] = [];
  
  // Extract fill colors
  if (node.fills) {
    node.fills.forEach((fill: any) => {
      if (fill.type === 'SOLID') {
        const { r, g, b, a } = fill.color;
        const hexColor = rgbaToHex(r, g, b, a);
        colors.push(hexColor);
      }
    });
  }
  
  // Extract stroke colors
  if (node.strokes) {
    node.strokes.forEach((stroke: any) => {
      if (stroke.type === 'SOLID') {
        const { r, g, b, a } = stroke.color;
        const hexColor = rgbaToHex(r, g, b, a);
        colors.push(hexColor);
      }
    });
  }
  
  // Extract text styles if available
  let fontFamily: string | undefined;
  let fontSize: number | undefined;
  let fontWeight: string | undefined;
  
  if (node.style) {
    fontFamily = node.style.fontFamily;
    fontSize = node.style.fontSize;
    fontWeight = node.style.fontWeight?.toString();
  }
  
  // Extract border radius
  let borderRadius: number | undefined;
  if (node.cornerRadius !== undefined) {
    borderRadius = node.cornerRadius;
  }
  
  // Extract border width
  let borderWidth: number | undefined;
  if (node.strokeWeight !== undefined) {
    borderWidth = node.strokeWeight;
  }
  
  // Extract border color
  let borderColor: string | undefined;
  if (node.strokes && node.strokes.length > 0 && node.strokes[0].type === 'SOLID') {
    const { r, g, b, a } = node.strokes[0].color;
    borderColor = rgbaToHex(r, g, b, a);
  }
  
  // Extract shadow
  let shadow: UIComponent['style']['shadow'] | undefined;
  if (node.effects) {
    const dropShadow = node.effects.find((effect: any) => effect.type === 'DROP_SHADOW');
    if (dropShadow) {
      const { r, g, b, a } = dropShadow.color;
      shadow = {
        offsetX: dropShadow.offset.x,
        offsetY: dropShadow.offset.y,
        blur: dropShadow.radius,
        color: rgbaToHex(r, g, b, a)
      };
    }
  }
  
  // Extract opacity
  let opacity: number | undefined;
  if (node.opacity !== undefined) {
    opacity = node.opacity;
  }
  
  return {
    colors,
    fontFamily,
    fontSize,
    fontWeight,
    borderRadius,
    borderWidth,
    borderColor,
    shadow,
    opacity
  };
};

/**
 * Convert RGBA values to HEX color
 * @param r - Red (0-1)
 * @param g - Green (0-1)
 * @param b - Blue (0-1)
 * @param a - Alpha (0-1)
 * @returns HEX color string
 */
const rgbaToHex = (r: number, g: number, b: number, a: number = 1): string => {
  // Convert 0-1 values to 0-255
  const rInt = Math.round(r * 255);
  const gInt = Math.round(g * 255);
  const bInt = Math.round(b * 255);
  const aInt = Math.round(a * 255);
  
  // Convert to hex
  const rHex = rInt.toString(16).padStart(2, '0');
  const gHex = gInt.toString(16).padStart(2, '0');
  const bHex = bInt.toString(16).padStart(2, '0');
  
  // Include alpha only if not fully opaque
  if (a < 1) {
    const aHex = aInt.toString(16).padStart(2, '0');
    return `#${rHex}${gHex}${bHex}${aHex}`;
  }
  
  return `#${rHex}${gHex}${bHex}`;
};

// Add a new function to reset Figma auth state
export const resetFigmaAuth = async (): Promise<void> => {
  try {
    const supabase = getSupabase();
    
    // Sign out and sign back in to refresh the token
    await supabase.auth.signOut();
    console.log('Signed out to reset Figma auth state');
    
    // Clear any cached auth data
    localStorage.removeItem('supabase.auth.token');
    
    console.log('Auth state reset. Please sign in with Figma again.');
  } catch (error) {
    console.error('Error resetting auth state:', error);
    throw error;
  }
}; 
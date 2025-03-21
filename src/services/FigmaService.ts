/**
 * FigmaService.ts
 * Service for interacting with the Figma API to fetch design data
 */

import axios from 'axios';
import { UIComponent } from '../types';
import { getFigmaAccessTokenFromUser } from './SupabaseService';

// Get the Figma API key from environment variables or user's token
const getFigmaApiKey = async (): Promise<string> => {
  // First try to get the token from the authenticated user (via Supabase)
  const userToken = await getFigmaAccessTokenFromUser();
  if (userToken) {
    return userToken;
  }
  
  // Fall back to environment variable if needed - support both formats
  return (
    process.env.NEXT_PUBLIC_FIGMA_ACCESS_TOKEN || 
    process.env.FIGMA_ACCESS_TOKEN || 
    process.env.REACT_APP_FIGMA_ACCESS_TOKEN || 
    ''
  );
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
    // Step 1: Fetch the Figma design data
    console.log('Fetching Figma design data...');
    const { fileData, nodeId } = await fetchFigmaDesign(figmaUrl);
    
    // Step 2: Extract components from the Figma data
    console.log('Extracting components from Figma data...');
    const components = extractComponentsFromFigma(fileData, nodeId);
    
    // Step 3: Fetch the image for the selected node
    console.log('Fetching node image...');
    const { fileId } = parseFigmaUrl(figmaUrl);
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
      throw new Error('Figma API key not configured');
    }
    
    // Parse the Figma URL to get file ID and node ID
    const { fileId, nodeId } = parseFigmaUrl(figmaUrl);
    
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
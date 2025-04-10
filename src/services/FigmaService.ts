import { Page } from '../types';
import { exchangeFigmaAuthCode } from './ApiService';

// Constants
const FIGMA_TOKEN_KEY = 'figma_access_token';
const FIGMA_USER_KEY = 'figma_user';
const FIGMA_API_BASE = 'https://api.figma.com/v1';

// Types
export interface FigmaUser {
  id: string;
  email: string;
  handle: string;
  img_url: string;
}

export interface FigmaFile {
  key: string;
  name: string;
  thumbnail_url: string;
  last_modified: string;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  imageUrl?: string;
}

// Figma Authentication Service
class FigmaService {
  private accessToken: string | null = null;
  private currentUser: FigmaUser | null = null;

  constructor() {
    // Load token and user from localStorage if they exist
    this.accessToken = localStorage.getItem(FIGMA_TOKEN_KEY);
    const userStr = localStorage.getItem(FIGMA_USER_KEY);
    if (userStr) {
      try {
        this.currentUser = JSON.parse(userStr);
      } catch (e) {
        console.error('Error parsing Figma user data:', e);
      }
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // Get current user
  getCurrentUser(): FigmaUser | null {
    return this.currentUser;
  }

  // Store authentication data
  storeAuthData(token: string, user: FigmaUser): void {
    this.accessToken = token;
    this.currentUser = user;
    
    localStorage.setItem(FIGMA_TOKEN_KEY, token);
    localStorage.setItem(FIGMA_USER_KEY, JSON.stringify(user));
  }

  // Clear authentication data
  logout(): void {
    this.accessToken = null;
    this.currentUser = null;
    
    localStorage.removeItem(FIGMA_TOKEN_KEY);
    localStorage.removeItem(FIGMA_USER_KEY);
  }

  // Start OAuth process
  startOAuthFlow(): void {
    // Use environment variables for client ID, check both naming conventions
    // Create React App uses REACT_APP_ prefix, but it's good to check both formats
    const clientId = process.env.REACT_APP_FIGMA_CLIENT_ID || process.env.FIGMA_CLIENT_ID || '';
    
    // For Vercel deployment, use the callback URL properly
    const redirectUri = process.env.REACT_APP_FIGMA_REDIRECT_URI || 
                       process.env.FIGMA_REDIRECT_URI ||
                       'https://coterate-2nd.vercel.app/auth/figma/callback';
    
    const scope = 'file_read';
    
    if (!clientId) {
      console.error('Figma client ID not configured. Please check your environment variables.');
      alert('Figma client ID is missing. Please check the application configuration.');
      return;
    }
    
    console.log('Starting OAuth flow with:', { 
      clientIdExists: !!clientId,
      clientIdLength: clientId.length,
      redirectUri,
      usingReactAppPrefix: !!process.env.REACT_APP_FIGMA_CLIENT_ID,
      usingDirectFormat: !!process.env.FIGMA_CLIENT_ID
    });
    
    // Generate a state parameter to prevent CSRF attacks
    const state = this.generateRandomString(32);
    localStorage.setItem('figma_auth_state', state);
    
    // Build the authorization URL
    const authUrl = `https://www.figma.com/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&response_type=code`;
    
    // Log URL for debugging (without the client ID)
    console.log('Auth URL (without client ID):', 
      `https://www.figma.com/oauth?client_id=[REDACTED]&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&response_type=code`);
    
    // Redirect to Figma's authorization page
    window.location.href = authUrl;
  }

  // Handle OAuth callback
  async handleOAuthCallback(code: string, state: string): Promise<boolean> {
    // Verify state parameter to prevent CSRF attacks
    const savedState = localStorage.getItem('figma_auth_state');
    if (!savedState || savedState !== state) {
      console.error('State parameter mismatch');
      return false;
    }
    
    try {
      // Call our backend API to exchange the code for tokens
      const authData = await exchangeFigmaAuthCode(code);
      
      // Store token and user data
      this.storeAuthData(authData.access_token, authData.user);
      
      return true;
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      return false;
    }
  }

  // Get Figma files for current user
  async getUserFiles(): Promise<FigmaFile[]> {
    if (!this.accessToken) {
      throw new Error('User not authenticated');
    }
    
    try {
      const response = await fetch(`${FIGMA_API_BASE}/me/files`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Map the API response to our FigmaFile interface
      return data.projects.map((project: any) => ({
        key: project.key,
        name: project.name,
        thumbnail_url: project.thumbnail_url || 'https://via.placeholder.com/300/e3e6ea/808080?text=No+Thumbnail',
        last_modified: project.last_modified
      }));
    } catch (error) {
      console.error('Error fetching Figma files:', error);
      
      // Return empty array on error
      return [];
    }
  }

  // Get a specific Figma file
  async getFile(fileKey: string): Promise<any> {
    if (!this.accessToken) {
      throw new Error('User not authenticated');
    }
    
    try {
      const response = await fetch(`${FIGMA_API_BASE}/files/${fileKey}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching Figma file ${fileKey}:`, error);
      throw error;
    }
  }

  // Get image URLs for nodes
  async getImageUrls(fileKey: string, nodeIds: string[]): Promise<Record<string, string>> {
    if (!this.accessToken) {
      throw new Error('User not authenticated');
    }
    
    try {
      const nodeIdsParam = nodeIds.join(',');
      const response = await fetch(
        `${FIGMA_API_BASE}/images/${fileKey}?ids=${nodeIdsParam}&format=png`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image URLs: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.images || {};
    } catch (error) {
      console.error('Error fetching image URLs:', error);
      return {};
    }
  }

  // Import frame from Figma as a page
  async importFrameAsPage(fileKey: string, nodeId: string): Promise<Page> {
    if (!this.accessToken) {
      throw new Error('User not authenticated');
    }
    
    try {
      // Get file data to get the node name
      const fileData = await this.getFile(fileKey);
      const node = this.findNodeById(fileData.document, nodeId);
      
      if (!node) {
        throw new Error('Node not found');
      }
      
      // Get image URL for the node
      const imageUrls = await this.getImageUrls(fileKey, [nodeId]);
      const imageUrl = imageUrls[nodeId];
      
      if (!imageUrl) {
        throw new Error('Failed to get image URL for node');
      }
      
      // Create a new page
      const newPage: Page = {
        id: crypto.randomUUID ? crypto.randomUUID() : this.generateRandomString(16),
        name: node.name,
        baseImage: imageUrl,
      };
      
      return newPage;
    } catch (error) {
      console.error('Error importing frame as page:', error);
      throw error;
    }
  }

  // Helper to find a node by ID in the Figma document
  private findNodeById(node: any, id: string): any {
    if (node.id === id) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const result = this.findNodeById(child, id);
        if (result) {
          return result;
        }
      }
    }
    
    return null;
  }

  // Helper method to generate a random string for state parameter
  private generateRandomString(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters.charAt(randomIndex);
    }
    
    return result;
  }

  // Add new method to extract detailed style information from a Figma node
  async getNodeStyleData(fileKey: string, nodeId: string): Promise<any> {
    if (!this.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      console.log(`Getting detailed style data for node ${nodeId} in file ${fileKey}`);
      
      // First, get the full node data from Figma API
      const response = await fetch(
        `${FIGMA_API_BASE}/files/${fileKey}/nodes?ids=${nodeId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch node data: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Extract the node from the response
      const node = data.nodes[nodeId]?.document;
      if (!node) {
        throw new Error('Node not found in response');
      }
      
      // Extract style information
      const styleData = this.extractStyleInformation(node);
      
      // Get image URL if needed for reference
      const imageUrls = await this.getImageUrls(fileKey, [nodeId]);
      const imageUrl = imageUrls[nodeId];
      
      return {
        node,
        styleData,
        imageUrl
      };
    } catch (error) {
      console.error('Error fetching node style data:', error);
      throw error;
    }
  }

  // Extract detailed style information from a node and its children
  private extractStyleInformation(node: any): any {
    if (!node) return null;

    // Initialize the style data structure
    const styleData = {
      name: node.name || 'Unnamed Node',
      type: node.type || 'UNKNOWN',
      width: node.absoluteBoundingBox?.width || 0,
      height: node.absoluteBoundingBox?.height || 0,
      colors: [] as string[],
      typography: [] as any[],
      effects: [] as any[],
      components: [] as any[],
      childrenData: [] as any[]
    };

    // Process fills to extract colors
    if (node.fills && Array.isArray(node.fills)) {
      node.fills.forEach((fill: any) => {
        if (fill.type === 'SOLID' && fill.visible !== false) {
          const { r, g, b, a = 1 } = fill.color || {};
          if (r !== undefined && g !== undefined && b !== undefined) {
            // Convert RGB to hex
            const hexColor = this.rgbToHex(r, g, b, a);
            styleData.colors.push(hexColor);
          }
        } else if (fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_RADIAL') {
          // Extract colors from gradients
          fill.gradientStops?.forEach((stop: any) => {
            const { r, g, b, a = 1 } = stop.color || {};
            if (r !== undefined && g !== undefined && b !== undefined) {
              const hexColor = this.rgbToHex(r, g, b, a);
              styleData.colors.push(hexColor);
            }
          });
        }
      });
    }

    // Process strokes to extract border colors
    if (node.strokes && Array.isArray(node.strokes)) {
      node.strokes.forEach((stroke: any) => {
        if (stroke.type === 'SOLID' && stroke.visible !== false) {
          const { r, g, b, a = 1 } = stroke.color || {};
          if (r !== undefined && g !== undefined && b !== undefined) {
            const hexColor = this.rgbToHex(r, g, b, a);
            styleData.colors.push(hexColor);
          }
        }
      });
    }

    // Extract typography information
    if (node.style) {
      styleData.typography.push({
        fontFamily: node.style.fontFamily,
        fontSize: node.style.fontSize,
        fontWeight: node.style.fontWeight,
        lineHeight: node.style.lineHeightPx || node.style.lineHeightPercent,
        letterSpacing: node.style.letterSpacing,
        textAlignHorizontal: node.style.textAlignHorizontal,
        textAlignVertical: node.style.textAlignVertical,
        textCase: node.style.textCase,
        textDecoration: node.style.textDecoration,
        text: node.characters || ''
      });
    }

    // Extract effects (shadows, blurs)
    if (node.effects && Array.isArray(node.effects)) {
      node.effects.forEach((effect: any) => {
        if (effect.visible !== false) {
          styleData.effects.push({
            type: effect.type,
            radius: effect.radius,
            color: effect.color ? this.rgbToHex(effect.color.r, effect.color.g, effect.color.b, effect.color.a) : undefined,
            offset: effect.offset,
            spread: effect.spread
          });
        }
      });
    }

    // Process children recursively
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: any) => {
        const childData = this.extractStyleInformation(child);
        styleData.childrenData.push(childData);
        
        // Merge colors and typography from children
        styleData.colors = [...styleData.colors, ...childData.colors];
        styleData.typography = [...styleData.typography, ...childData.typography];
        styleData.effects = [...styleData.effects, ...childData.effects];
        
        // If this is a component, add it to components list
        if (child.type === 'COMPONENT' || child.type === 'INSTANCE') {
          styleData.components.push({
            name: child.name,
            type: child.type,
            id: child.id
          });
        }
      });
    }

    // Remove duplicates from colors
    styleData.colors = [...new Set(styleData.colors)];

    return styleData;
  }

  // Helper to convert RGB values (0-1) to hex color
  private rgbToHex(r: number, g: number, b: number, a: number = 1): string {
    // Convert 0-1 values to 0-255
    const rInt = Math.round(r * 255);
    const gInt = Math.round(g * 255);
    const bInt = Math.round(b * 255);
    
    // Create hex strings
    const rHex = rInt.toString(16).padStart(2, '0');
    const gHex = gInt.toString(16).padStart(2, '0');
    const bHex = bInt.toString(16).padStart(2, '0');
    
    // Return with alpha if not 1
    if (a !== 1) {
      const aInt = Math.round(a * 255);
      const aHex = aInt.toString(16).padStart(2, '0');
      return `#${rHex}${gHex}${bHex}${aHex}`;
    }
    
    return `#${rHex}${gHex}${bHex}`;
  }

  // Get a comprehensive structure representation
  async getStructuredNodeData(fileKey: string, nodeId: string): Promise<any> {
    const styleData = await this.getNodeStyleData(fileKey, nodeId);
    
    // Process the data into a comprehensive design system structure
    const designSystem = this.processIntoDesignSystem(styleData);
    
    return {
      ...styleData,
      designSystem
    };
  }

  // Process style data into a design system representation
  private processIntoDesignSystem(styleData: any): any {
    // Create a standardized design system from the extracted style data
    const designSystem = {
      colors: {
        primary: [] as string[],
        secondary: [] as string[],
        background: [] as string[],
        text: [] as string[]
      },
      typography: {
        families: [] as string[],
        sizes: [] as number[],
        weights: [] as number[],
        styles: [] as any[]
      },
      spacing: {
        values: [] as number[]
      },
      borderRadius: {
        values: [] as number[]
      },
      shadows: [] as any[],
      components: [] as any[]
    };

    // Extract unique font families
    const fontFamiliesSet = new Set<string>();
    styleData.styleData.typography.forEach((t: any) => {
      if (t.fontFamily) fontFamiliesSet.add(t.fontFamily);
    });
    designSystem.typography.families = Array.from(fontFamiliesSet);

    // Extract unique font sizes
    const fontSizesSet = new Set<number>();
    styleData.styleData.typography.forEach((t: any) => {
      if (t.fontSize) fontSizesSet.add(t.fontSize);
    });
    designSystem.typography.sizes = Array.from(fontSizesSet).sort((a, b) => a - b);

    // Extract unique font weights
    const fontWeightsSet = new Set<number>();
    styleData.styleData.typography.forEach((t: any) => {
      if (t.fontWeight) fontWeightsSet.add(t.fontWeight);
    });
    designSystem.typography.weights = Array.from(fontWeightsSet).sort((a, b) => a - b);

    // Categorize colors (simple heuristic - could be improved)
    const colors = styleData.styleData.colors;
    if (colors.length > 0) {
      // Assign primary color (first colors, usually brand colors)
      designSystem.colors.primary = colors.slice(0, Math.max(1, Math.floor(colors.length * 0.2)));
      
      // Assign background colors (usually light colors, whites, grays)
      const backgroundColors = colors.filter((c: string) => {
        // Light colors are likely backgrounds
        const isLight = c.toLowerCase() === '#ffffff' || 
                        c.toLowerCase() === '#f8f8f8' || 
                        c.toLowerCase() === '#f0f0f0' ||
                        c.toLowerCase().startsWith('#e') ||
                        c.toLowerCase().startsWith('#f');
        return isLight;
      });
      designSystem.colors.background = backgroundColors;
      
      // Assign text colors (usually dark colors, blacks, dark grays)
      const textColors = colors.filter((c: string) => {
        // Dark colors are likely text
        const isDark = c.toLowerCase() === '#000000' || 
                       c.toLowerCase() === '#333333' || 
                       c.toLowerCase() === '#222222' ||
                       c.toLowerCase().startsWith('#0') ||
                       c.toLowerCase().startsWith('#1') ||
                       c.toLowerCase().startsWith('#2') ||
                       c.toLowerCase().startsWith('#3');
        return isDark;
      });
      designSystem.colors.text = textColors;
      
      // Remaining colors are secondary
      const usedColors = [...designSystem.colors.primary, ...designSystem.colors.background, ...designSystem.colors.text];
      designSystem.colors.secondary = colors.filter((c: string) => !usedColors.includes(c));
    }

    // Add all effects as shadows
    designSystem.shadows = styleData.styleData.effects.filter((e: any) => 
      e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW'
    );

    // Add components
    designSystem.components = styleData.styleData.components;

    return designSystem;
  }
}

// Create a named instance
const figmaService = new FigmaService();

export default figmaService;

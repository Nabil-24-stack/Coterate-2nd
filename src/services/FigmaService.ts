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
    // Use environment variables for client ID, with fallback for local development
    const clientId = process.env.REACT_APP_FIGMA_CLIENT_ID;
    
    // For Vercel deployment, use the callback URL properly
    const redirectUri = process.env.REACT_APP_FIGMA_REDIRECT_URI || 
                       'https://coterate-2nd.vercel.app/auth/figma/callback';
    
    const scope = 'file_read';
    
    if (!clientId) {
      console.error('Figma client ID not configured. Please check your environment variables.');
      return;
    }
    
    console.log('Starting OAuth flow with:', { 
      clientIdExists: !!clientId,
      redirectUri 
    });
    
    // Generate a state parameter to prevent CSRF attacks
    const state = this.generateRandomString(32);
    localStorage.setItem('figma_auth_state', state);
    
    // Build the authorization URL
    const authUrl = `https://www.figma.com/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&response_type=code`;
    
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
}

export default new FigmaService();

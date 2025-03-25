import { createClient } from '@supabase/supabase-js';
import { Page } from '../types';

// Supabase configuration
const supabaseUrl = 'https://tsqfwommnuhtbeupuwwm.supabase.co';
// IMPORTANT: This is a temporary fix - in production, this should come from environment variables
// We're hardcoding it temporarily to fix the "supabaseKey is required" error
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcWZ3b21tbm1odGJldXB1d3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDg0MjQ0ODIsImV4cCI6MjAyNDAwMDQ4Mn0.NSBHiYRCL0I4IxgXTpxEoAZbFvPlvdOiYiTgfE8uGTc';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface FigmaUser {
  id: string;
  email?: string;
  handle?: string;
  img_url?: string;
}

class SupabaseService {
  // Get auth state change listener
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  // Initialize Figma auth flow through Supabase
  async signInWithFigma() {
    try {
      console.log('Starting Figma auth flow via Supabase');
      
      // Generate a random state to prevent CSRF attacks
      const state = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('figma_auth_state', state);
      
      // First check if we already have a session
      const existingSession = await this.getSession();
      console.log('Existing session check:', existingSession);
      
      if (existingSession?.provider_token) {
        console.log('User already authenticated with Figma');
        return { url: null, provider: 'figma', session: existingSession };
      }
      
      // Use signInWithOAuth which will direct to Figma auth
      // The redirectTo should be our app's auth callback endpoint
      // Supabase will redirect the user back to this URL after the Figma auth flow
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'figma',
        options: {
          // This needs to match the URL we set in the Supabase dashboard under Auth > URL Configuration
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'files:read',
        },
      });

      console.log('Supabase OAuth initialization response:', data);

      if (error) {
        console.error('Error starting Figma auth flow:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error starting Figma auth flow:', error);
      throw error;
    }
  }

  // Get the current user session
  async getSession() {
    try {
      console.log('Getting session from Supabase');
      const { data, error } = await supabase.auth.getSession();
      
      console.log('Session data:', data);
      
      if (error) {
        console.error('Error getting session:', error);
        return null;
      }
      
      return data.session;
    } catch (error) {
      console.error('Unexpected error getting session:', error);
      return null;
    }
  }

  // Get current user
  async getCurrentUser() {
    try {
      console.log('Getting current user from Supabase');
      const { data, error } = await supabase.auth.getUser();
      
      console.log('User data:', data);
      
      if (error) {
        console.error('Error getting user:', error);
        return null;
      }
      
      return data.user;
    } catch (error) {
      console.error('Unexpected error getting user:', error);
      return null;
    }
  }

  // Get user data from Figma
  async getFigmaUserData() {
    try {
      const session = await this.getSession();
      
      if (!session?.provider_token) {
        console.error('No provider token available for Figma API call');
        return null;
      }
      
      const userData = await this.callFigmaApi('me');
      console.log('Figma user data:', userData);
      
      return userData;
    } catch (error) {
      console.error('Error getting Figma user data:', error);
      return null;
    }
  }

  // Sign out the user
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error('Unexpected error during sign out:', error);
      throw error;
    }
  }

  // Helper to access Figma API with the user's token
  async callFigmaApi(endpoint: string) {
    try {
      const session = await this.getSession();
      
      if (!session?.provider_token) {
        console.error('No provider token available for Figma API call');
        throw new Error('No provider token available');
      }

      console.log(`Calling Figma API: ${endpoint}`);
      
      const response = await fetch(`https://api.figma.com/v1/${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${session.provider_token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Figma API error (${response.status}):`, errorText);
        throw new Error(`Failed to call Figma API: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error calling Figma API (${endpoint}):`, error);
      throw error;
    }
  }

  // Get user's Figma files
  async getFigmaFiles() {
    try {
      // First, try to get the user data which will validate our token
      await this.getFigmaUserData();
      
      const data = await this.callFigmaApi('me/files');
      console.log('Figma files data:', data);
      
      // Map the API response to our expected format
      return Array.isArray(data.projects) ? data.projects.map((project: any) => ({
        key: project.key,
        name: project.name,
        thumbnail_url: project.thumbnail_url || 'https://via.placeholder.com/300/e3e6ea/808080?text=No+Thumbnail',
        last_modified: project.last_modified
      })) : [];
    } catch (error) {
      console.error('Error fetching Figma files:', error);
      return [];
    }
  }

  // Get a specific Figma file
  async getFigmaFile(fileKey: string) {
    try {
      return await this.callFigmaApi(`files/${fileKey}`);
    } catch (error) {
      console.error(`Error fetching Figma file ${fileKey}:`, error);
      throw error;
    }
  }

  // Get image URLs for nodes
  async getFigmaImageUrls(fileKey: string, nodeIds: string[]) {
    try {
      const nodeIdsParam = nodeIds.join(',');
      const data = await this.callFigmaApi(`images/${fileKey}?ids=${nodeIdsParam}&format=png`);
      return data.images || {};
    } catch (error) {
      console.error('Error fetching image URLs:', error);
      return {};
    }
  }

  // Import frame from Figma as a page
  async importFrameAsPage(fileKey: string, nodeId: string): Promise<Page> {
    try {
      // Get file data to get the node name
      const fileData = await this.getFigmaFile(fileKey);
      
      // Find the node by ID
      const findNodeById = (node: any, id: string): any => {
        if (node.id === id) {
          return node;
        }
        
        if (node.children) {
          for (const child of node.children) {
            const result = findNodeById(child, id);
            if (result) {
              return result;
            }
          }
        }
        
        return null;
      };
      
      const node = findNodeById(fileData.document, nodeId);
      
      if (!node) {
        throw new Error('Node not found');
      }
      
      // Get image URL for the node
      const imageUrls = await this.getFigmaImageUrls(fileKey, [nodeId]);
      const imageUrl = imageUrls[nodeId];
      
      if (!imageUrl) {
        throw new Error('Failed to get image URL for node');
      }
      
      // Create a new page
      const newPage: Page = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
        name: node.name,
        baseImage: imageUrl,
      };
      
      return newPage;
    } catch (error) {
      console.error('Error importing frame as page:', error);
      throw error;
    }
  }
}

// Create and export a single instance
const supabaseService = new SupabaseService();
export default supabaseService; 
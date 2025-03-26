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
  // Static instance for singleton pattern
  private static instance: SupabaseService;

  // Static method to get the instance
  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // Private constructor to prevent multiple instances
  private constructor() {}

  // Get auth state change listener
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  // Initialize Figma auth flow through Supabase
  async signInWithFigma() {
    try {
      console.log('==== STARTING FIGMA AUTH FLOW ====');
      console.log('Browser URL:', window.location.href);
      console.log('Origin:', window.location.origin);
      
      // First check if we already have a session
      const existingSession = await this.getSession();
      console.log('Existing session check:', existingSession ? {
        user: existingSession.user.id,
        provider: existingSession.user.app_metadata?.provider,
        expires_at: existingSession.expires_at,
        has_provider_token: !!existingSession.provider_token
      } : 'No session');
      
      if (existingSession?.provider_token) {
        console.log('User already authenticated with Figma, reusing session');
        return { url: null, provider: 'figma', session: existingSession };
      }
      
      // Construct redirect URL with correct callback location
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log('Using redirectTo URL:', redirectUrl);
      
      // Clear any previous auth state from localStorage to avoid conflicts
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('figma_auth_state')) {
            console.log('Removing stale auth state key:', key);
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        console.warn('Error clearing localStorage:', e);
      }
      
      // Use signInWithOAuth which will direct to Figma auth
      console.log('Initiating OAuth flow with params:', {
        provider: 'figma', 
        redirectTo: redirectUrl,
        scopes: 'files:read'
      });
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'figma',
        options: {
          redirectTo: redirectUrl,
          scopes: 'files:read',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      });

      console.log('Supabase OAuth initialization response:', data ? {
        provider: data.provider,
        url: data.url,
        hasSession: !!(data as any).session
      } : 'No data');

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

  // Test direct code exchange - can be used as fallback
  async exchangeCodeForSession(code: string) {
    try {
      console.log('Manually exchanging code for session, code length:', code.length);
      
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      console.log('Manual code exchange result:', {
        success: !!data,
        hasSession: !!data?.session,
        error: error
      });
      
      if (error) {
        throw error;
      }
      
      return data.session;
    } catch (error) {
      console.error('Error exchanging code for session:', error);
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
const supabaseService = SupabaseService.getInstance();
export default supabaseService; 
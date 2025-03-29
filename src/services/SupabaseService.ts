import { createClient } from '@supabase/supabase-js';
import { Page } from '../types';

// Supabase configuration
const supabaseUrl = 'https://tsqfwommnuhtbeupuwwm.supabase.co';
// IMPORTANT: This is a temporary fix - in production, this should come from environment variables
// We're hardcoding it temporarily to fix the "supabaseKey is required" error
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcWZ3b21tbm1odGJldXB1d3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDg0MjQ0ODIsImV4cCI6MjAyNDAwMDQ4Mn0.NSBHiYRCL0I4IxgXTpxEoAZbFvPlvdOiYiTgfE8uGTc';

// Create Supabase client with implicit flow type for better token handling
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
  },
});

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
      
      // The flowType is configured at the client level, so we don't need to specify it here
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
      
      // Try standard auth first
      const { data, error } = await supabase.auth.getUser();
      
      if (data?.user) {
        console.log('Got user from Supabase auth:', data.user.email);
        return data.user;
      }
      
      // Fallback to manually stored token
      const token = localStorage.getItem('figma_access_token');
      if (token) {
        console.log('Trying with manually stored access token');
        try {
          const { data: tokenData, error: tokenError } = await supabase.auth.getUser(token);
          
          if (tokenData?.user) {
            console.log('Got user with stored token:', tokenData.user.email);
            return tokenData.user;
          }
          
          if (tokenError) {
            console.error('Error getting user with stored token:', tokenError);
          }
        } catch (tokenError) {
          console.error('Error using stored token:', tokenError);
        }
      }
      
      // If we reach here, we couldn't get the user
      if (error) {
        console.error('Error getting user:', error);
      } else {
        console.error('No user found in session or with stored token');
      }
      
      return null;
    } catch (error) {
      console.error('Unexpected error getting user:', error);
      return null;
    }
  }

  // Helper to access Figma API with the user's token
  async callFigmaApi(endpoint: string) {
    try {
      // First try to get the token from the session
      const session = await this.getSession();
      let token = session?.provider_token;
      
      // If no token in session, check localStorage as fallback
      if (!token) {
        console.log('No provider token in session, checking localStorage');
        token = localStorage.getItem('figma_provider_token');
        
        if (token) {
          console.log('Found Figma provider token in localStorage, length:', token.length);
          
          // Log a portion of the token for debugging (safely)
          const safeTokenPreview = token.length > 10 ? 
            `${token.substring(0, 5)}...${token.substring(token.length - 5)}` : 
            '[token too short]';
          console.log('Token preview:', safeTokenPreview);
        }
      }
      
      if (!token) {
        console.error('No provider token available for Figma API call');
        throw new Error('No provider token available');
      }

      console.log(`Calling Figma API: ${endpoint} with token (length: ${token.length})`);
      
      const response = await fetch(`https://api.figma.com/v1/${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Figma API error (${response.status}):`, errorText);
        throw new Error(`Failed to call Figma API: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Figma API response for ${endpoint}:`, data);
      return data;
    } catch (error) {
      console.error(`Error calling Figma API (${endpoint}):`, error);
      throw error;
    }
  }

  // Get user data from Figma
  async getFigmaUserData() {
    try {
      console.log('Attempting to get Figma user data...');
      
      // First try to get provider token
      const session = await this.getSession();
      const hasSessionToken = !!session?.provider_token;
      const hasLocalToken = !!localStorage.getItem('figma_provider_token');
      
      console.log('Token availability check:', {
        hasSessionToken,
        hasLocalToken
      });
      
      if (!hasSessionToken && !hasLocalToken) {
        console.error('No Figma authentication token available');
        return null;
      }
      
      const userData = await this.callFigmaApi('me');
      console.log('Figma user data retrieved successfully:', userData);
      
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

  // Check if user is authenticated with Figma (includes fallback to localStorage)
  async isAuthenticatedWithFigma() {
    try {
      // Check for session first
      const session = await this.getSession();
      if (session?.provider_token) {
        return true;
      }
      
      // Fallback to localStorage
      const token = localStorage.getItem('figma_provider_token');
      return !!token;
    } catch (error) {
      console.error('Error checking Figma authentication:', error);
      return false;
    }
  }

  // Get all pages for the current user
  async getPages() {
    try {
      console.log('SupabaseService: Attempting to fetch pages');
      const user = await this.getCurrentUser();
      if (!user) {
        console.error('No user found when trying to get pages');
        return [];
      }

      console.log('SupabaseService: Fetching pages for user:', user.id);
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pages:', error);
        return [];
      }

      console.log(`SupabaseService: Fetched ${data?.length || 0} pages`);
      
      // Examine the designs for each page
      if (data && data.length > 0) {
        data.forEach((page, index) => {
          console.log(`SupabaseService: Page ${index + 1}/${data.length} (${page.id}):`, {
            name: page.name,
            hasDesigns: !!page.designs,
            designsCount: page.designs?.length || 0
          });
        });
      }

      return data as Page[];
    } catch (error) {
      console.error('Error in getPages:', error);
      return [];
    }
  }

  // Create a new page
  async createPage(page: Omit<Page, 'user_id' | 'created_at' | 'updated_at'>) {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        console.error('No user found when trying to create page');
        throw new Error('User not authenticated');
      }

      const newPage = {
        ...page,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('pages')
        .insert([newPage])
        .select()
        .single();

      if (error) {
        console.error('Error creating page:', error);
        throw error;
      }

      return data as Page;
    } catch (error) {
      console.error('Error in createPage:', error);
      throw error;
    }
  }

  // Update an existing page
  async updatePage(id: string, updates: Partial<Page>) {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        console.error('No user found when trying to update page');
        throw new Error('User not authenticated');
      }

      console.log('SupabaseService: Updating page in database:', id);
      console.log('SupabaseService: Update payload:', JSON.stringify(updates));

      // Ensure designs are properly serialized for JSONB storage
      let updatedPage: any = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // If designs are included, ensure they are properly serialized
      if (updates.designs) {
        console.log('SupabaseService: Processing designs array for storage, count:', updates.designs.length);
        // Clone to avoid reference issues
        const designsToStore = JSON.parse(JSON.stringify(updates.designs));
        updatedPage.designs = designsToStore;
      }

      console.log('SupabaseService: Final update payload:', JSON.stringify(updatedPage));

      const { data, error } = await supabase
        .from('pages')
        .update(updatedPage)
        .eq('id', id)
        .eq('user_id', user.id)  // Security: ensure user owns this page
        .select()
        .single();

      if (error) {
        console.error('Error updating page:', error);
        throw error;
      }

      console.log('SupabaseService: Page updated successfully:', data?.id);
      return data as Page;
    } catch (error) {
      console.error('Error in updatePage:', error);
      throw error;
    }
  }

  // Delete a page
  async deletePage(id: string) {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        console.error('No user found when trying to delete page');
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('pages')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);  // Security: ensure user owns this page

      if (error) {
        console.error('Error deleting page:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in deletePage:', error);
      throw error;
    }
  }
}

// Create and export a single instance
const supabaseService = SupabaseService.getInstance();
export default supabaseService; 
import { createClient } from '@supabase/supabase-js';
import { Page, Design, DesignIteration } from '../types';

// Add interface extension for the Window object to allow our custom property
interface Window {
  setSupabaseCredentials?: (url: string, key: string) => boolean;
}

// Helper for debugging environment variables
const debugEnvironmentVars = () => {
  // List all window.__env variables if they exist (sometimes used for runtime env vars)
  const windowEnv = (window as any).__env || {};
  const envKeys = Object.keys(windowEnv);
  
  console.log('Available window.__env variables:', envKeys.length > 0 ? envKeys : 'None');
  
  // Check for specific Supabase env vars in various locations
  const envVarCombinations = [
    { name: 'NEXT_PUBLIC_SUPABASE_URL', value: process.env.NEXT_PUBLIC_SUPABASE_URL },
    { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    { name: 'SUPABASE_URL', value: process.env.SUPABASE_URL },
    { name: 'SUPABASE_ANON_KEY', value: process.env.SUPABASE_ANON_KEY },
    { name: 'REACT_APP_SUPABASE_URL', value: process.env.REACT_APP_SUPABASE_URL },
    { name: 'REACT_APP_SUPABASE_ANON_KEY', value: process.env.REACT_APP_SUPABASE_ANON_KEY },
    { name: 'window.__env.NEXT_PUBLIC_SUPABASE_URL', value: windowEnv.NEXT_PUBLIC_SUPABASE_URL },
    { name: 'window.__env.NEXT_PUBLIC_SUPABASE_ANON_KEY', value: windowEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY }
  ];
  
  console.log('Environment variable checks:');
  envVarCombinations.forEach(v => {
    console.log(`  ${v.name}: ${v.value ? 'Available' : 'Not available'}`);
  });
};

// Run environment variable check on load
debugEnvironmentVars();

// Try to get Supabase URL from various sources
const getSupabaseUrl = () => {
  // Try environment variables in various formats
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL;
  if (process.env.REACT_APP_SUPABASE_URL) return process.env.REACT_APP_SUPABASE_URL;
  
  // Try window.__env (sometimes used for runtime env vars)
  const windowEnv = (window as any).__env || {};
  if (windowEnv.NEXT_PUBLIC_SUPABASE_URL) return windowEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (windowEnv.SUPABASE_URL) return windowEnv.SUPABASE_URL;
  
  // Try looking for values in localStorage (sometimes apps store this for development)
  const localStorageUrl = localStorage.getItem('supabase_url');
  if (localStorageUrl) return localStorageUrl;
  
  // IMPORTANT: This is the correct Supabase project URL - don't try to guess it
  return 'https://tsqfwommnuhtbeupuwwm.supabase.co';
};

// Try to get Supabase anon key from various sources
const getSupabaseAnonKey = () => {
  // Try specific environment variables first
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY;
  if (process.env.REACT_APP_SUPABASE_ANON_KEY) return process.env.REACT_APP_SUPABASE_ANON_KEY;
  
  // Try window.__env (sometimes used for runtime env vars)
  const windowEnv = (window as any).__env || {};
  if (windowEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) return windowEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (windowEnv.SUPABASE_ANON_KEY) return windowEnv.SUPABASE_ANON_KEY;
  
  // Try looking for values in localStorage (sometimes apps store this for development)
  const localStorageKey = localStorage.getItem('supabase_anon_key');
  if (localStorageKey) return localStorageKey;
  
  // Default key that was working before (but may be expired now)
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcWZ3b21tbm1odGJldXB1d3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDg0MjQ0ODIsImV4cCI6MjAyNDAwMDQ4Mn0.NSBHiYRCL0I4IxgXTpxEoAZbFvPlvdOiYiTgfE8uGTc';
};

// Function to try multiple anon keys to find a working one
const findWorkingAnonKey = async () => {
  // List of possible keys to try (add any other potential keys here)
  // Since we're getting "Failed to fetch" errors, it's possible the key is invalid or expired
  const possibleKeys = [
    getSupabaseAnonKey(), // First try our primary key finder
    localStorage.getItem('supabase_anon_key'), // Try any manually set key
    // Add direct reference to the key in Vercel
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    
    // Using key from screenshot (visible in the preview, but obscured in Vercel UI)
    // If you know part of the key, you could try it directly
    // This is just a generic test to see if your Vercel keys are being loaded at all
    localStorage.getItem('backup_supabase_anon_key')
  ].filter(Boolean) as string[]; // Remove any null/undefined values
  
  console.log(`Testing ${possibleKeys.length} possible Supabase anon keys...`);
  
  // Try each key
  const url = getSupabaseUrl();
  for (const key of possibleKeys) {
    try {
      const testResult = await testSupabaseConnection(url, key);
      if (testResult.success) {
        console.log('Found working Supabase key! Storing it for future use.');
        
        // Save the working key to localStorage for future sessions
        localStorage.setItem('supabase_anon_key', key);
        return key;
      }
    } catch (e) {
      console.warn('Error testing key:', e);
    }
  }
  
  console.error('None of the available Supabase keys worked.');
  return null;
};

// Get Supabase configuration
const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

console.log('Initial Supabase configuration:', {
  url: supabaseUrl,
  keyLength: supabaseAnonKey?.length || 0,
});

// Try multiple keys to see if we can find a working one
setTimeout(async () => {
  const workingKey = await findWorkingAnonKey();
  if (workingKey && workingKey !== supabaseAnonKey) {
    console.log('Found a working Supabase key that differs from the initial one! Using the new key automatically.');
    
    // Store the key in localStorage for the next page load
    localStorage.setItem('supabase_anon_key', workingKey);
    
    // Note: We're not reloading the page immediately to avoid disrupting the user experience
    // The new key will be used on the next reload/visit
  }
}, 2000);

// Create a mechanism to manually set API credentials at runtime as a global function
// This can be useful for debugging or for setting credentials via UI
(window as any).setSupabaseCredentials = (url: string, key: string) => {
  try {
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_anon_key', key);
    console.log('Supabase credentials set in localStorage. Reload page to use them.');
    return true;
  } catch (e) {
    console.error('Error storing Supabase credentials:', e);
    return false;
  }
};

// Create Supabase client with implicit flow type for better token handling
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
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

  // Supabase client instance (might be updated if we find a better key)
  private supabaseClient: ReturnType<typeof createClient>;

  // Add properties for connection status
  private connectionTested = false;
  private isConnected = false;
  
  // Flag to prevent repeated API key error logging
  private hasLoggedApiKeyErrorRecently = false;
  
  // Add throttling for common log messages
  private logThrottles: Record<string, number> = {};
  private lastLogs: Record<string, string> = {};
  
  // Log throttling method to reduce console spam
  private throttledLog(key: string, level: 'log' | 'warn' | 'error', message: string, ...args: any[]) {
    const now = Date.now();
    const lastLog = this.lastLogs[key];
    
    // If this is a duplicate of the last message and within throttle period, skip it
    if (lastLog === message && this.logThrottles[key] && now < this.logThrottles[key]) {
      return;
    }
    
    // Update throttle time (5 seconds for most messages)
    this.logThrottles[key] = now + 5000;
    this.lastLogs[key] = message;
    
    // Use the appropriate console method
    if (level === 'error') {
      console.error(message, ...args);
    } else if (level === 'warn') {
      console.warn(message, ...args);
    } else {
      console.log(message, ...args);
    }
  }
  
  // Logging shortcuts
  private logInfo(key: string, message: string, ...args: any[]) {
    this.throttledLog(key, 'log', message, ...args);
  }
  
  private logWarning(key: string, message: string, ...args: any[]) {
    this.throttledLog(key, 'warn', message, ...args);
  }
  
  private logError(key: string, message: string, ...args: any[]) {
    this.throttledLog(key, 'error', message, ...args);
  }

  // Static method to get the instance
  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // Private constructor to prevent multiple instances
  private constructor() {
    // Initialize with the default client
    this.supabaseClient = supabase as any; // Use type assertion to avoid client type mismatch
    
    // Test connection and try to find better keys
    this.testConnectionAndFixKeys();
  }
  
  // Method to test connection and try to find a better key
  private async testConnectionAndFixKeys() {
    setTimeout(async () => {
      try {
        // First test with the current configuration
        const initialTest = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
        if (initialTest.success) {
          console.log('Initial Supabase connection is working correctly!');
          this.connectionTested = true;
          this.isConnected = true;
          return;
        }
        
        // If we're here, the initial configuration didn't work
        console.warn('Initial Supabase connection failed. Trying to find a working key...');
        
        // Try to find a working key
        const workingKey = await findWorkingAnonKey();
        if (workingKey && workingKey !== supabaseAnonKey) {
          console.log('Found a working Supabase key! Updating client...');
          
          // Create a new client with the working key
          this.supabaseClient = createClient(supabaseUrl, workingKey, {
            auth: {
              flowType: 'implicit',
              autoRefreshToken: true,
              persistSession: true,
              detectSessionInUrl: true
            },
          });
          
          // Test the new client
          const newTest = await this.testConnection();
          if (newTest.success) {
            console.log('Successfully updated Supabase client with a working key!');
            this.isConnected = true;
          }
        } else {
          console.error('Could not find a working Supabase key. Some features may not work correctly.');
        }
      } catch (e) {
        console.error('Error testing Supabase connection:', e);
      } finally {
        this.connectionTested = true;
      }
    }, 1000);
  }
  
  // Public method to test the connection
  async testConnection() {
    try {
      const { data, error } = await this.supabaseClient.from('pages').select('count').limit(1);
      
      if (error) {
        console.error('Supabase connection test failed:', error);
        this.isConnected = false;
        return { success: false, error: error.message };
      }
      
      console.log('Supabase connection test successful:', data);
      this.isConnected = true;
      return { success: true, data };
    } catch (err: any) {
      console.error('Supabase connection test exception:', err);
      this.isConnected = false;
      return { success: false, error: err.message };
    }
  }
  
  // Getter for the current client
  getClient() {
    return this.supabaseClient;
  }
  
  // Getter for connection status
  getConnectionStatus() {
    return {
      tested: this.connectionTested,
      connected: this.isConnected
    };
  }

  // Get auth state change listener
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.supabaseClient.auth.onAuthStateChange(callback);
  }

  // Initialize Figma auth flow through Supabase
  async signInWithFigma() {
    try {
      console.log('==== STARTING FIGMA AUTH FLOW ====');
      console.log('Browser URL:', window.location.href);
      console.log('Origin:', window.location.origin);
      
      // First check if we already have a session
      const existingSession = await this.getSession();
      
      // Only log session info if it exists
      if (existingSession) {
        const isSupabaseSession = 'provider_token' in existingSession;
        console.log('Existing session check:', existingSession ? {
          user: existingSession.user.id,
          isSupabaseSession,
        } : 'No session');
        
        if (isSupabaseSession && existingSession.provider_token) {
          console.log('User already authenticated with Figma, reusing session');
          return { url: null, provider: 'figma', session: existingSession };
        }
      } else {
        console.log('No existing session found');
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
      const { data, error } = await this.supabaseClient.auth.signInWithOAuth({
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
      
      const { data, error } = await this.supabaseClient.auth.exchangeCodeForSession(code);
      
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
      // Always try to get the session from Supabase first
      const { data, error } = await this.supabaseClient.auth.getSession();
      
      if (error) {
        this.logError('session-error', 'Error getting session:', error);
        return null;
      }
      
      if (data?.session) {
        this.logInfo('session-found', `Valid Supabase session found for user: ${data.session.user.id}`);
        return data.session;
      }
      
      // If no valid Supabase session, do NOT fallback to using a fake session
      // This was causing RLS policy violations - only use real authenticated sessions
      this.logInfo('no-session', 'No valid Supabase session found');
      return null;
    } catch (error) {
      this.logError('session-exception', 'Exception getting session:', error);
      return null;
    }
  }

  // Get current user
  async getCurrentUser() {
    try {
      console.log('Getting current user from Supabase');
      
      // Try standard auth first
      const { data, error } = await this.supabaseClient.auth.getUser();
      
      if (data?.user) {
        console.log('Got user from Supabase auth:', data.user.email);
        return data.user;
      }
      
      // Fallback to manually stored token
      const token = localStorage.getItem('figma_access_token');
      if (token) {
        console.log('Trying with manually stored access token');
        try {
          const { data: tokenData, error: tokenError } = await this.supabaseClient.auth.getUser(token);
          
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
      let token: string | null = null;
      
      // Safely check for provider_token in session
      if (session && typeof session === 'object' && 'provider_token' in session) {
        const providerToken = session.provider_token;
        if (typeof providerToken === 'string') {
          token = providerToken;
        }
      }
      
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
      
      try {
        const response = await fetch(`https://api.figma.com/v1/${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
  
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Figma API error (${response.status}):`, errorText);
          
          // If we get a 401 Unauthorized, the token is invalid - clear it
          if (response.status === 401) {
            console.warn('Received 401 Unauthorized from Figma API - clearing invalid token');
            this.clearInvalidFigmaToken();
          }
          
          throw new Error(`Failed to call Figma API: ${response.statusText}`);
        }
  
        const data = await response.json();
        console.log(`Figma API response for ${endpoint}:`, data);
        return data;
      } catch (fetchError: any) {
        // If the fetch fails with a network error, the token might be invalid
        console.error('Fetch error in Figma API call:', fetchError);
        
        // Clear invalid token if it seems to be an auth issue
        if (fetchError.message && (
            fetchError.message.includes('Unauthorized') || 
            fetchError.message.includes('Invalid API key'))) {
          this.clearInvalidFigmaToken();
        }
        
        throw fetchError;
      }
    } catch (error) {
      console.error(`Error calling Figma API (${endpoint}):`, error);
      throw error;
    }
  }
  
  // Clear invalid Figma tokens
  clearInvalidFigmaToken() {
    console.log('Clearing invalid Figma tokens from storage');
    
    // Remove from localStorage
    localStorage.removeItem('figma_provider_token');
    localStorage.removeItem('figma_access_token');
    localStorage.removeItem('figma_user');
    
    // Also clear any Figma-related session data in Supabase
    try {
      this.supabaseClient.auth.signOut()
        .then(() => console.log('Signed out of Supabase to clear session'))
        .catch(err => console.error('Error signing out:', err));
    } catch (e) {
      console.error('Error clearing Supabase session:', e);
    }
  }

  // Get user data from Figma
  async getFigmaUserData() {
    try {
      console.log('Attempting to get Figma user data...');
      
      // First try to get provider token
      const session = await this.getSession();
      
      // Safely check for provider_token
      const hasSessionToken = session && typeof session === 'object' && 
                            'provider_token' in session && !!session.provider_token;
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
      const { error } = await this.supabaseClient.auth.signOut();
      
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
      this.logInfo('getFigmaImageUrls', `Getting image URLs for file ${fileKey}, nodes: ${nodeIds.join(',')}`);
      const nodeIdsParam = nodeIds.join(',');
      const data = await this.callFigmaApi(`images/${fileKey}?ids=${nodeIdsParam}&format=png&scale=2`);
      
      // Check if we have valid response with images
      if (!data || !data.images) {
        this.logError('getFigmaImageUrls', `Invalid response from Figma API: ${JSON.stringify(data)}`);
        throw new Error('Invalid response from Figma API');
      }
      
      // Check if any of the requested nodes are missing in the response
      const missingNodes = nodeIds.filter(id => !data.images[id]);
      if (missingNodes.length > 0) {
        this.logWarning('getFigmaImageUrls', `Some nodes not found: ${missingNodes.join(', ')}`);
        
        // If all nodes are missing, throw an error
        if (missingNodes.length === nodeIds.length) {
          throw new Error(`Nodes not found: ${missingNodes.join(', ')}`);
        }
      }
      
      this.logInfo('getFigmaImageUrls', `Successfully got images for ${Object.keys(data.images).length} nodes`);
      return data.images;
    } catch (error) {
      this.logError('getFigmaImageUrls', `Error fetching image URLs: ${error}`);
      throw error; // Propagate error for better error handling upstream
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
      const hasSessionToken = session && 
                             typeof session === 'object' && 
                             'provider_token' in session && 
                             !!session.provider_token;
      
      // Fallback to localStorage
      const hasLocalToken = !!localStorage.getItem('figma_provider_token') || 
                           !!localStorage.getItem('figma_access_token');
                           
      console.log('Figma auth check:', { hasSessionToken, hasLocalToken });
      
      if (!hasSessionToken && !hasLocalToken) {
        return false;
      }
      
      // Actually test the token by making a simple API call
      try {
        // A lightweight call to test authentication
        await this.callFigmaApi('me');
        return true;
      } catch (apiError) {
        console.error('Failed to validate Figma token with API call:', apiError);
        return false;
      }
    } catch (error) {
      console.error('Error checking Figma authentication:', error);
      return false;
    }
  }

  // Add method for resilient Supabase operations with automatic fallback
  private async resilientOperation<T>(operation: string, dbOperation: () => Promise<T>, fallback: T | null = null): Promise<T | null> {
    try {
      // Try the operation against Supabase
      return await dbOperation();
    } catch (error: any) {
      // Check for recurring API key errors to avoid spamming the console
      const isApiKeyError = error?.message?.includes('Invalid API key');
      
      // Only log detailed errors for non-API key issues (to reduce noise)
      if (!isApiKeyError) {
        console.error(`Error in ${operation}:`, error);
      } else if (!this.hasLoggedApiKeyErrorRecently) {
        // Log API key errors but throttle them
        console.warn(`Supabase API key error in ${operation}. Using offline mode with localStorage.`);
        this.hasLoggedApiKeyErrorRecently = true;
        
        // Reset the flag after a while to allow another warning
        setTimeout(() => {
          this.hasLoggedApiKeyErrorRecently = false;
        }, 60000); // Only log once per minute
      }
      
      return fallback;
    }
  }

  // Update the getPages method to use resilient operation
  async getPages() {
    try {
      this.logInfo('get-pages', 'Attempting to fetch pages');
      const user = await this.getCurrentUser();
      
      // Check if we have a session through alternative means
      const session = await this.getSession();
      
      // If we have a session but it's a local-storage-user, skip Supabase queries
      if (session?.user?.id === 'local-storage-user') {
        this.logInfo('local-pages', 'Using localStorage user, skipping Supabase queries');
        // Try to load from localStorage
        try {
          const storedPages = localStorage.getItem('coterate_pages');
          if (storedPages) {
            const parsedPages = JSON.parse(storedPages) as Page[];
            this.logInfo('loaded-local', `Loaded ${parsedPages.length} pages from localStorage`);
            return parsedPages;
          }
        } catch (e) {
          this.logError('parse-local', 'Error parsing localStorage pages:', e);
        }
        return [];
      }
      
      // If we have a regular user, proceed with Supabase queries
      if (user) {
        this.logInfo('user-pages', `Fetching pages for user: ${user.id}`);
        return await this.resilientOperation('getPages', async () => {
          const { data, error } = await this.supabaseClient
            .from('pages')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;
          return this.processFetchedPages(data);
        }, []);
      }
      
      // If we have a session but no user, try using the session user ID
      if (session) {
        const userId = session.user?.id;
        if (userId && userId !== 'local-storage-user') {
          this.logInfo('session-pages', `Attempting to fetch pages for session user: ${userId}`);
          
          return await this.resilientOperation('getPages', async () => {
            const { data, error } = await this.supabaseClient
              .from('pages')
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });
    
            if (error) throw error;
            
            this.logInfo('pages-fetched', `Fetched ${data?.length || 0} pages using session user ID`);
            return this.processFetchedPages(data);
          }, []);
        }
      }
      
      // If we reach here, we have no valid user or session
      this.logInfo('no-user', 'No valid user or session found for fetching pages');
      return [];
    } catch (error) {
      this.logError('get-pages-error', 'Error in getPages:', error);
      return [];
    }
  }
  
  // Helper to process fetched pages and log debug info
  private processFetchedPages(data: any[]) {
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

    return data;
  }

  // Create a new page
  async createPage(page: Omit<Page, 'user_id' | 'created_at' | 'updated_at'>) {
    try {
      const session = await this.getSession();
      if (!session) {
        this.logError('create-no-session', 'No session found when trying to create page');
        throw new Error('User not authenticated');
      }

      // Use user ID from session or fallback
      const userId = session.user?.id || 'local-storage-user';
      
      // Skip Supabase updates for local-storage-user since they'll always fail with 401
      if (userId === 'local-storage-user') {
        this.logInfo('create-local-user', 'Using local storage user, skipping Supabase create');
        
        // Return a local page with the properties needed for the app to function
        const localPage: Page = {
          ...page,
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        return localPage;
      }
      
      this.logInfo('create-page', `Creating new page in database for user: ${userId}`);

      // Ensure designs are properly handled for storage
      let pageToCreate: any = {
        ...page,
        user_id: userId,
      };

      // If designs are included, ensure they are properly serialized
      if (page.designs && Array.isArray(page.designs)) {
        this.logInfo('create-designs', `Processing designs array for new page, count: ${page.designs.length}`);
        // Clone to avoid reference issues
        const designsToStore = JSON.parse(JSON.stringify(page.designs));
        pageToCreate.designs = designsToStore;
      } else {
        // Ensure designs is at least an empty array
        pageToCreate.designs = [];
      }

      const { data, error } = await this.supabaseClient
        .from('pages')
        .insert([pageToCreate])
        .select()
        .single();

      if (error) {
        this.logError('create-error', 'Error creating page:', error);
        throw error;
      }

      this.logInfo('create-success', `New page created successfully: ${data?.id}`);
      // Convert to Page type, ensuring it has the required properties
      return {
        id: data.id as string,
        name: data.name as string,
        user_id: data.user_id as string,
        created_at: data.created_at as string,
        updated_at: data.updated_at as string,
        designs: data.designs as Design[]
      } as Page;
    } catch (error) {
      this.logError('create-exception', 'Error in createPage:', error);
      throw error;
    }
  }

  // Update an existing page
  async updatePage(id: string, updates: Partial<Page>) {
    const session = await this.getSession();
    if (!session) {
      this.logInfo('update-no-session', 'No session found when trying to update page, using localStorage only');
      return null;
    }

    // Use user ID from session or fallback
    const userId = session.user?.id || 'local-storage-user';
    
    // Skip Supabase updates for local-storage-user since they'll always fail with 401
    if (userId === 'local-storage-user') {
      this.logInfo('update-local-user', 'Using local storage user, skipping Supabase update');
      return null;
    }
    
    this.logInfo('update-page', `Updating page in database: ${id} for user: ${userId}`);
    
    return await this.resilientOperation('updatePage', async () => {
      // First get the current page to ensure we don't lose data
      const { data: existingPage, error: fetchError } = await this.supabaseClient
        .from('pages')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (fetchError) throw fetchError;

      // Ensure designs are properly serialized for JSONB storage
      let updatedPage: any = {
        ...existingPage,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // If designs are included, ensure they are properly serialized
      if (updates.designs !== undefined) {
        console.log('SupabaseService: Processing designs array for storage, count:', updates.designs?.length || 0);
        // Clone to avoid reference issues
        const designsToStore = updates.designs && Array.isArray(updates.designs) 
          ? JSON.parse(JSON.stringify(updates.designs))
          : [];
        updatedPage.designs = designsToStore;
      }

      const { data, error } = await this.supabaseClient
        .from('pages')
        .update(updatedPage)
        .eq('id', id)
        .eq('user_id', userId)  // Security: ensure user owns this page
        .select()
        .single();

      if (error) throw error;

      console.log('SupabaseService: Page updated successfully:', data?.id);
      // Convert to Page type, ensuring it has the required properties
      return {
        id: data.id as string,
        name: data.name as string,
        user_id: data.user_id as string,
        created_at: data.created_at as string,
        updated_at: data.updated_at as string,
        designs: data.designs as Design[]
      } as Page;
    }, null);
  }

  // Delete a page
  async deletePage(id: string) {
    try {
      const session = await this.getSession();
      if (!session) {
        this.logError('delete-no-session', 'No session found when trying to delete page');
        throw new Error('User not authenticated');
      }
      
      // Use user ID from session
      const userId = session.user?.id;
      
      // Skip Supabase calls for local-storage-user
      if (userId === 'local-storage-user') {
        this.logInfo('delete-local-user', 'Using local storage user, skipping Supabase delete');
        return true;
      }

      const { error } = await this.supabaseClient
        .from('pages')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);  // Security: ensure user owns this page

      if (error) {
        this.logError('delete-error', 'Error deleting page:', error);
        throw error;
      }

      return true;
    } catch (error) {
      this.logError('delete-exception', 'Error in deletePage:', error);
      throw error;
    }
  }

  // Add storage methods for handling images
  async uploadImageToStorage(imageBlob: Blob, fileName: string): Promise<string | null> {
    try {
      this.logInfo('storage-upload', `Uploading image ${fileName} to Supabase Storage`);
      
      // Skip storage upload for local-storage users
      const session = await this.getSession();
      if (!session || session.user.id === 'local-storage-user') {
        this.logInfo('storage-local', 'Local storage user, converting to data URL instead');
        // For local users, convert the image to a data URL and store that instead
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imageBlob);
        });
      }
      
      // For authenticated users, upload to Supabase Storage
      const userId = session.user.id;
      // Create a unique file path including the user ID to avoid conflicts
      const filePath = `${userId}/${fileName}`;
      
      const { data, error } = await this.supabaseClient
        .storage
        .from('designs') // Use 'designs' as the bucket name
        .upload(filePath, imageBlob, {
          cacheControl: '3600',
          upsert: true // Overwrite if exists
        });
      
      if (error) {
        this.logError('storage-error', 'Error uploading to Supabase Storage:', error);
        throw error;
      }
      
      // Get public URL for the uploaded file
      const { data: urlData } = this.supabaseClient
        .storage
        .from('designs')
        .getPublicUrl(filePath);
      
      this.logInfo('storage-success', `Successfully uploaded image to ${urlData.publicUrl}`);
      return urlData.publicUrl;
    } catch (error) {
      this.logError('storage-exception', 'Exception uploading to Supabase Storage:', error);
      return null;
    }
  }

  // Convert base64 data URI to Blob
  dataURItoBlob(dataURI: string): Blob {
    // convert base64/URLEncoded data component to raw binary data held in a string
    let byteString;
    if (dataURI.split(',')[0].indexOf('base64') >= 0) {
      byteString = atob(dataURI.split(',')[1]);
    } else {
      byteString = decodeURIComponent(dataURI.split(',')[1]);
    }
    
    // separate out the mime component
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    
    // write the bytes of the string to a typed array
    const ia = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ia], { type: mimeString });
  }

  // Upload an image from a data URI
  async uploadImageFromDataURI(dataURI: string, fileName: string): Promise<string | null> {
    try {
      // Convert data URI to Blob
      const blob = this.dataURItoBlob(dataURI);
      // Upload to storage
      return await this.uploadImageToStorage(blob, fileName);
    } catch (error) {
      this.logError('storage-data-uri', 'Error uploading image from data URI:', error);
      return null;
    }
  }

  // Delete an image from storage
  async deleteImageFromStorage(imageUrl: string): Promise<boolean> {
    try {
      // Skip for local storage users or data URIs
      if (imageUrl.startsWith('data:')) {
        this.logInfo('storage-delete-skip', 'Skipping delete for data URI');
        return true;
      }
      
      const session = await this.getSession();
      if (!session || session.user.id === 'local-storage-user') {
        this.logInfo('storage-delete-local', 'Local storage user, skipping storage delete');
        return true;
      }
      
      // Extract the path from the URL
      // URL will be like: https://tsqfwommnuhtbeupuwwm.supabase.co/storage/v1/object/public/designs/userId/fileName
      const urlParts = imageUrl.split('/public/designs/');
      if (urlParts.length !== 2) {
        this.logError('storage-delete-path', 'Cannot extract path from URL:', imageUrl);
        return false;
      }
      
      const filePath = urlParts[1];
      this.logInfo('storage-delete', `Deleting file from storage: ${filePath}`);
      
      const { error } = await this.supabaseClient
        .storage
        .from('designs')
        .remove([filePath]);
      
      if (error) {
        this.logError('storage-delete-error', 'Error deleting from storage:', error);
        return false;
      }
      
      this.logInfo('storage-delete-success', `Successfully deleted image from storage`);
      return true;
    } catch (error) {
      this.logError('storage-delete-exception', 'Exception deleting from storage:', error);
      return false;
    }
  }

  /**
   * Import a design from Figma using a file key and node ID
   * @param fileKey The Figma file key
   * @param nodeId The Figma node ID
   * @returns Promise with the imported design data including imageUrl
   */
  async importFigmaDesign(fileKey: string, nodeId: string): Promise<{ imageUrl: string; name?: string } | null> {
    this.logInfo('importFigmaDesign', `Importing Figma design: fileKey=${fileKey}, nodeId=${nodeId}`);
    
    try {
      // Normalize the node ID format if needed
      // Figma node IDs can be in formats like "2181-1361" or "2181:1361"
      const normalizedNodeId = nodeId.includes('-') ? nodeId.replace('-', ':') : nodeId;
      this.logInfo('importFigmaDesign', `Using normalized node ID: ${normalizedNodeId}`);
      
      // Validate that we have a proper node ID
      if (!normalizedNodeId || normalizedNodeId === '0:1') {
        this.logError('importFigmaDesign', 'Invalid or missing node ID. Cannot import entire document.');
        throw new Error('Please select a specific component in Figma and use its selection link.');
      }
      
      // Check if authenticated with Figma
      const isAuth = await this.isAuthenticatedWithFigma();
      if (!isAuth) {
        this.logError('importFigmaDesign', 'Not authenticated with Figma');
        throw new Error('Not authenticated with Figma. Please sign in first.');
      }
      
      // Get the Figma file data to find the node
      this.logInfo('importFigmaDesign', `Getting Figma file: ${fileKey}`);
      const fileData = await this.getFigmaFile(fileKey);
      
      if (!fileData) {
        this.logError('importFigmaDesign', `Failed to get Figma file: ${fileKey}`);
        throw new Error('Failed to get Figma file data');
      }
      
      // Try to get image URLs for the node
      this.logInfo('importFigmaDesign', `Getting image URL for node: ${normalizedNodeId}`);
      let imageUrls;
      
      try {
        // Use normalized node ID for API call
        imageUrls = await this.getFigmaImageUrls(fileKey, [normalizedNodeId]);
      } catch (nodeError: any) {
        // Only try original node ID if normalized one failed
        if (normalizedNodeId !== nodeId) {
          this.logInfo('importFigmaDesign', `Normalized node ID failed, trying original: ${nodeId}`);
          try {
            imageUrls = await this.getFigmaImageUrls(fileKey, [nodeId]);
          } catch (originalError) {
            this.logError('importFigmaDesign', `Both node IDs failed. Original error: ${nodeError.message}`);
            throw nodeError; // Throw the original error
          }
        } else {
          // This is a legitimate node not found error, don't try to fallback to document root
          this.logError('importFigmaDesign', `Node ${normalizedNodeId} not found in file ${fileKey}`);
          throw new Error(`The selected component could not be found in this Figma file. Please try a different selection.`);
        }
      }
      
      // Determine which node ID worked
      const effectiveNodeId = imageUrls && imageUrls[normalizedNodeId] ? normalizedNodeId : 
                              imageUrls && imageUrls[nodeId] ? nodeId : null;
      
      if (!effectiveNodeId || !imageUrls || !imageUrls[effectiveNodeId]) {
        this.logError('importFigmaDesign', `Failed to get image URL for node`);
        throw new Error('Failed to get image URL for the selected component');
      }
      
      const imageUrl = imageUrls[effectiveNodeId];
      
      // Get node name if possible
      let nodeName = '';
      try {
        // Create a function that can find nodes with either format
        const findNodeById = (node: any, id: string, normalizedId: string): any => {
          if (node.id === id || node.id === normalizedId) return node;
          if (node.children) {
            for (const child of node.children) {
              const found = findNodeById(child, id, normalizedId);
              if (found) return found;
            }
          }
          return null;
        };
        
        // Try to find with either the original or normalized ID
        const node = findNodeById(fileData.document, nodeId, normalizedNodeId);
        if (node) {
          nodeName = node.name;
        } else {
          nodeName = fileData.name || 'Figma Design';
        }
      } catch (err) {
        this.logWarning('importFigmaDesign', `Couldn't find node name: ${err}`);
        nodeName = fileData.name || 'Figma Design';
      }
      
      // Return the image URL and name
      return {
        imageUrl,
        name: nodeName
      };
    } catch (error) {
      this.logError('importFigmaDesign', `Error importing Figma design: ${error}`);
      throw error;
    }
  }

  // New methods for normalized schema with separate tables
  
  // PAGES API

  // Get all pages for a user with their designs
  async getPagesWithDesigns() {
    try {
      const session = await this.getSession();
      if (!session) {
        this.logInfo('get-pages-no-session', 'No session found, returning localStorage pages');
        return this.getLocalStoragePages();
      }

      const { data: pages, error } = await this.supabaseClient
        .from('pages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        this.logError('get-pages-error', 'Error fetching pages:', error);
        return this.getLocalStoragePages();
      }

      // For each page, fetch its designs
      const pagesWithDesigns = await Promise.all(pages.map(async (page: any) => {
        const designs = await this.getDesignsForPage(page.id);
        return {
          ...page,
          designs: designs || []
        };
      }));

      // Update localStorage for offline access
      try {
        localStorage.setItem('coterate_pages', JSON.stringify(pagesWithDesigns));
      } catch (storageError) {
        this.logError('local-store-error', 'Error storing pages in localStorage:', storageError);
      }

      return pagesWithDesigns;
    } catch (error) {
      this.logError('get-pages-exception', 'Exception fetching pages:', error);
      return this.getLocalStoragePages();
    }
  }

  // Get pages from localStorage as a fallback
  async getLocalStoragePages(): Promise<Page[]> {
    try {
      const pagesJson = localStorage.getItem('coterate_pages');
      if (pagesJson) {
        return JSON.parse(pagesJson) as Page[];
      }
      return [];
    } catch (error) {
      this.logError('local-storage-error', 'Error reading from localStorage:', error);
      return [];
    }
  }

  // Create a page in the normalized schema
  async createPageNormalized(page: Omit<Page, 'id' | 'user_id' | 'designs'>): Promise<Page> {
    try {
      const session = await this.getSession();
      if (!session) {
        this.logInfo('create-page-no-session', 'No session found, adding to localStorage only');
        
        // Generate a new page with local ID
        const localPage: Page = {
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
          name: page.name,
          user_id: 'local-storage-user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          designs: []
        };
        
        // Add to localStorage
        const existingPages = await this.getLocalStoragePages();
        const updatedPages = [...existingPages, localPage];
        localStorage.setItem('coterate_pages', JSON.stringify(updatedPages));
        
        return localPage;
      }

      // Create page in Supabase
      const { data: newPage, error } = await this.supabaseClient
        .from('pages')
        .insert({
          name: page.name,
          user_id: session.user.id
        })
        .select()
        .single();

      if (error) {
        this.logError('create-page-error', 'Error creating page:', error);
        throw error;
      }

      // Ensure all required Page properties are present
      return {
        id: newPage.id as string,
        name: newPage.name as string,
        user_id: newPage.user_id as string,
        created_at: newPage.created_at as string,
        updated_at: newPage.updated_at as string,
        designs: []
      };
    } catch (error) {
      this.logError('create-page-exception', 'Exception creating page:', error);
      throw error;
    }
  }

  // Delete a page and all its designs (cascade will handle design deletion)
  async deletePageNormalized(pageId: string) {
    try {
      const session = await this.getSession();
      if (!session) {
        this.logInfo('delete-page-no-session', 'No session found, removing from localStorage only');
        
        // Remove from localStorage
        const pages = await this.getLocalStoragePages();
        const updatedPages = pages.filter((p: {id: string}) => p.id !== pageId);
        localStorage.setItem('coterate_pages', JSON.stringify(updatedPages));
        
        return true;
      }

      // Delete page from Supabase
      const { error } = await this.supabaseClient
        .from('pages')
        .delete()
        .eq('id', pageId);

      if (error) {
        this.logError('delete-page-error', 'Error deleting page:', error);
        throw error;
      }

      return true;
    } catch (error) {
      this.logError('delete-page-exception', 'Exception deleting page:', error);
      throw error;
    }
  }

  // DESIGNS API

  // Get all designs for a page, including their iterations
  async getDesignsForPage(pageId: string) {
    try {
      const { data: designs, error } = await this.supabaseClient
        .from('designs')
        .select('*')
        .eq('page_id', pageId)
        .order('created_at', { ascending: true });

      if (error) {
        this.logError('get-designs-error', 'Error fetching designs for page:', error);
        return [];
      }

      // For each design, fetch its iterations
      const designsWithIterations = await Promise.all(designs.map(async (design) => {
        const iterations = await this.getIterationsForDesign(design.id as string);
        
        // Convert from normalized format to the format expected by the frontend
        return {
          id: design.id as string,
          imageUrl: design.image_url as string,
          position: { 
            x: design.position_x as number, 
            y: design.position_y as number 
          },
          dimensions: { 
            width: design.width as number, 
            height: design.height as number 
          },
          figmaFileKey: design.figma_file_key as string | undefined,
          figmaNodeId: design.figma_node_id as string | undefined,
          figmaSelectionLink: design.figma_selection_link as string | undefined,
          isFromFigma: design.is_from_figma as boolean,
          iterations: iterations || []
        };
      }));

      return designsWithIterations;
    } catch (error) {
      this.logError('get-designs-exception', 'Exception fetching designs:', error);
      return [];
    }
  }

  // Create a new design for a page
  async createDesign(pageId: string, design: {
    imageUrl: string;
    position: { x: number; y: number };
    dimensions?: { width: number; height: number };
    figmaFileKey?: string;
    figmaNodeId?: string;
    figmaSelectionLink?: string;
    isFromFigma?: boolean;
  }) {
    try {
      const { data: newDesign, error } = await this.supabaseClient
        .from('designs')
        .insert({
          page_id: pageId,
          image_url: design.imageUrl,
          position_x: design.position.x,
          position_y: design.position.y,
          width: design.dimensions?.width || 0,
          height: design.dimensions?.height || 0,
          figma_file_key: design.figmaFileKey,
          figma_node_id: design.figmaNodeId,
          figma_selection_link: design.figmaSelectionLink,
          is_from_figma: design.isFromFigma || false
        })
        .select()
        .single();

      if (error) {
        this.logError('create-design-error', 'Error creating design:', error);
        throw error;
      }

      // Convert to the format expected by the frontend
      return {
        id: newDesign.id,
        imageUrl: newDesign.image_url,
        position: { x: newDesign.position_x, y: newDesign.position_y },
        dimensions: { width: newDesign.width, height: newDesign.height },
        figmaFileKey: newDesign.figma_file_key,
        figmaNodeId: newDesign.figma_node_id,
        figmaSelectionLink: newDesign.figma_selection_link,
        isFromFigma: newDesign.is_from_figma,
        iterations: []
      };
    } catch (error) {
      this.logError('create-design-exception', 'Exception creating design:', error);
      throw error;
    }
  }

  // Update an existing design
  async updateDesign(designId: string, updates: {
    imageUrl?: string;
    position?: { x: number; y: number };
    dimensions?: { width: number; height: number };
  }) {
    try {
      const updateData: any = {};
      
      if (updates.imageUrl) updateData.image_url = updates.imageUrl;
      if (updates.position) {
        updateData.position_x = updates.position.x;
        updateData.position_y = updates.position.y;
      }
      if (updates.dimensions) {
        updateData.width = updates.dimensions.width;
        updateData.height = updates.dimensions.height;
      }
      
      updateData.updated_at = new Date().toISOString();

      const { data: updatedDesign, error } = await this.supabaseClient
        .from('designs')
        .update(updateData)
        .eq('id', designId)
        .select()
        .single();

      if (error) {
        this.logError('update-design-error', 'Error updating design:', error);
        throw error;
      }

      return {
        id: updatedDesign.id,
        imageUrl: updatedDesign.image_url,
        position: { x: updatedDesign.position_x, y: updatedDesign.position_y },
        dimensions: { width: updatedDesign.width, height: updatedDesign.height },
        figmaFileKey: updatedDesign.figma_file_key,
        figmaNodeId: updatedDesign.figma_node_id,
        figmaSelectionLink: updatedDesign.figma_selection_link,
        isFromFigma: updatedDesign.is_from_figma
      };
    } catch (error) {
      this.logError('update-design-exception', 'Exception updating design:', error);
      throw error;
    }
  }

  // Delete a design and its iterations (cascade will handle iteration deletion)
  async deleteDesign(designId: string) {
    try {
      const { error } = await this.supabaseClient
        .from('designs')
        .delete()
        .eq('id', designId);

      if (error) {
        this.logError('delete-design-error', 'Error deleting design:', error);
        throw error;
      }

      return true;
    } catch (error) {
      this.logError('delete-design-exception', 'Exception deleting design:', error);
      throw error;
    }
  }

  // ITERATIONS API

  // Get all iterations for a design
  async getIterationsForDesign(designId: string): Promise<DesignIteration[]> {
    try {
      const { data: iterations, error } = await this.supabaseClient
        .from('iterations')
        .select('*')
        .eq('design_id', designId)
        .order('created_at', { ascending: true });

      if (error) {
        this.logError('get-iterations-error', 'Error fetching iterations for design:', error);
        return [];
      }

      // Convert to the format expected by the frontend
      return iterations.map(iteration => ({
        id: iteration.id as string,
        parentId: iteration.design_id as string,
        htmlContent: iteration.html_content as string,
        cssContent: iteration.css_content as string,
        position: { 
          x: iteration.position_x as number, 
          y: iteration.position_y as number 
        },
        dimensions: { 
          width: iteration.width as number, 
          height: iteration.height as number 
        },
        analysis: iteration.analysis as any as import('../types').DesignAnalysis | undefined,
        created_at: iteration.created_at as string
      }));
    } catch (error) {
      this.logError('get-iterations-exception', 'Exception fetching iterations:', error);
      return [];
    }
  }

  // Create a new iteration for a design
  async createIteration(designId: string, iteration: {
    htmlContent: string;
    cssContent: string;
    position: { x: number; y: number };
    dimensions?: { width: number; height: number };
    analysis?: any;
  }) {
    try {
      const { data: newIteration, error } = await this.supabaseClient
        .from('iterations')
        .insert({
          design_id: designId,
          html_content: iteration.htmlContent,
          css_content: iteration.cssContent,
          position_x: iteration.position.x,
          position_y: iteration.position.y,
          width: iteration.dimensions?.width || 0,
          height: iteration.dimensions?.height || 0,
          analysis: iteration.analysis || null
        })
        .select()
        .single();

      if (error) {
        this.logError('create-iteration-error', 'Error creating iteration:', error);
        throw error;
      }

      // Convert to the format expected by the frontend
      return {
        id: newIteration.id,
        parentId: newIteration.design_id,
        htmlContent: newIteration.html_content,
        cssContent: newIteration.css_content,
        position: { x: newIteration.position_x, y: newIteration.position_y },
        dimensions: { width: newIteration.width, height: newIteration.height },
        analysis: newIteration.analysis,
        created_at: newIteration.created_at
      };
    } catch (error) {
      this.logError('create-iteration-exception', 'Exception creating iteration:', error);
      throw error;
    }
  }

  // Update an existing iteration
  async updateIteration(iterationId: string, updates: {
    position?: { x: number; y: number };
    dimensions?: { width: number; height: number };
  }) {
    try {
      const updateData: any = {};
      
      if (updates.position) {
        updateData.position_x = updates.position.x;
        updateData.position_y = updates.position.y;
      }
      if (updates.dimensions) {
        updateData.width = updates.dimensions.width;
        updateData.height = updates.dimensions.height;
      }
      
      updateData.updated_at = new Date().toISOString();

      const { data: updatedIteration, error } = await this.supabaseClient
        .from('iterations')
        .update(updateData)
        .eq('id', iterationId)
        .select()
        .single();

      if (error) {
        this.logError('update-iteration-error', 'Error updating iteration:', error);
        throw error;
      }

      return {
        id: updatedIteration.id,
        parentId: updatedIteration.design_id,
        htmlContent: updatedIteration.html_content,
        cssContent: updatedIteration.css_content,
        position: { x: updatedIteration.position_x, y: updatedIteration.position_y },
        dimensions: { width: updatedIteration.width, height: updatedIteration.height },
        analysis: updatedIteration.analysis,
        created_at: updatedIteration.created_at
      };
    } catch (error) {
      this.logError('update-iteration-exception', 'Exception updating iteration:', error);
      throw error;
    }
  }

  // Delete an iteration
  async deleteIteration(iterationId: string) {
    try {
      const { error } = await this.supabaseClient
        .from('iterations')
        .delete()
        .eq('id', iterationId);

      if (error) {
        this.logError('delete-iteration-error', 'Error deleting iteration:', error);
        throw error;
      }

      return true;
    } catch (error) {
      this.logError('delete-iteration-exception', 'Exception deleting iteration:', error);
      throw error;
    }
  }

  // Migration methods

  // Migrate data from old schema (designs as JSON in pages) to new normalized schema
  async migrateToNormalizedSchema() {
    try {
      this.logInfo('migration-started', 'Starting migration to normalized schema');
      
      // Get all pages from old schema
      const session = await this.getSession();
      if (!session) {
        this.logError('migration-no-session', 'No session found, cannot migrate');
        return { success: false, message: 'No session found. User must be logged in to migrate data.' };
      }

      // Get pages from the old schema
      const { data: oldPages, error: fetchError } = await this.supabaseClient
        .from('pages')
        .select('*');

      if (fetchError) {
        this.logError('migration-fetch-error', 'Error fetching pages for migration:', fetchError);
        return { success: false, message: 'Failed to fetch existing pages.' };
      }

      if (!oldPages || oldPages.length === 0) {
        this.logInfo('migration-no-pages', 'No pages found to migrate');
        return { success: true, message: 'No pages found to migrate.' };
      }

      this.logInfo('migration-pages-found', `Found ${oldPages.length} pages to migrate`);

      // Process each page
      let migratedDesigns = 0;
      let migratedIterations = 0;

      for (const page of oldPages) {
        // Skip pages without designs
        if (!page.designs || !Array.isArray(page.designs) || page.designs.length === 0) {
          this.logInfo('migration-skip-page', `Skipping page ${page.id} - no designs`);
          continue;
        }

        // Migrate each design in the page
        for (const design of page.designs) {
          try {
            // Create the design in the new table
            const { data: newDesign, error: designError } = await this.supabaseClient
              .from('designs')
              .insert({
                page_id: page.id,
                image_url: design.imageUrl,
                position_x: design.position?.x || 0,
                position_y: design.position?.y || 0,
                width: design.dimensions?.width || 0,
                height: design.dimensions?.height || 0,
                figma_file_key: design.figmaFileKey,
                figma_node_id: design.figmaNodeId,
                figma_selection_link: design.figmaSelectionLink,
                is_from_figma: design.isFromFigma || false
              })
              .select()
              .single();

            if (designError) {
              this.logError('migration-design-error', `Error migrating design ${design.id} for page ${page.id}:`, designError);
              continue;
            }

            migratedDesigns++;
            this.logInfo('migration-design-success', `Migrated design ${design.id} to new ID ${newDesign.id}`);

            // Skip designs without iterations
            if (!design.iterations || !Array.isArray(design.iterations) || design.iterations.length === 0) {
              continue;
            }

            // Migrate each iteration of the design
            for (const iteration of design.iterations) {
              try {
                const { error: iterationError } = await this.supabaseClient
                  .from('iterations')
                  .insert({
                    design_id: newDesign.id,
                    html_content: iteration.htmlContent,
                    css_content: iteration.cssContent,
                    position_x: iteration.position?.x || 0,
                    position_y: iteration.position?.y || 0,
                    width: iteration.dimensions?.width || 0,
                    height: iteration.dimensions?.height || 0,
                    analysis: iteration.analysis || null
                  });

                if (iterationError) {
                  this.logError('migration-iteration-error', `Error migrating iteration ${iteration.id}:`, iterationError);
                  continue;
                }

                migratedIterations++;
                this.logInfo('migration-iteration-success', `Migrated iteration ${iteration.id}`);
              } catch (iterationError) {
                this.logError('migration-iteration-exception', `Exception migrating iteration ${iteration.id}:`, iterationError);
              }
            }
          } catch (designError) {
            this.logError('migration-design-exception', `Exception migrating design ${design.id}:`, designError);
          }
        }
      }

      this.logInfo('migration-complete', `Migration complete. Migrated ${migratedDesigns} designs and ${migratedIterations} iterations.`);
      return { 
        success: true, 
        message: `Migration complete. Migrated ${migratedDesigns} designs and ${migratedIterations} iterations.`,
        migratedDesigns,
        migratedIterations
      };
    } catch (error) {
      this.logError('migration-exception', 'Exception during migration:', error);
      return { success: false, message: 'Migration failed due to an unexpected error.' };
    }
  }
}

// Create and export a single instance
const supabaseService = SupabaseService.getInstance();
export default supabaseService;

// Add a helper function to test Supabase connection
const testSupabaseConnection = async (url: string, key: string) => {
  console.log(`Testing Supabase connection to ${url}...`);
  try {
    // Create a temporary client for testing
    const testClient = createClient(url, key, {
      auth: { autoRefreshToken: false }
    });
    
    // Try a simple query that should always work with anon key
    const { data, error } = await testClient.from('pages').select('count').limit(1);
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Supabase connection test successful:', data);
    return { success: true, data };
  } catch (err: any) {
    console.error('Supabase connection test exception:', err);
    return { success: false, error: err.message };
  }
};

// Test the connection immediately for debugging
setTimeout(async () => {
  const result = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
  console.log('Connection test result:', result);
  
  if (!result.success) {
    console.warn('⚠️ Failed to connect to Supabase. Please check your environment variables and network connection.');
    console.warn('🔍 To fix this, use the following command in your browser console:');
    console.warn(`   window.setSupabaseCredentials('https://tsqfwommnuhtbeupuwwm.supabase.co', 'your-actual-anon-key')`);
    console.warn('   Replace "your-actual-anon-key" with the valid anon key from your Supabase project settings.');
  }
}, 1000); 
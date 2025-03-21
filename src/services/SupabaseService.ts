/**
 * SupabaseService.ts
 * Service for interacting with Supabase database and authentication
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Page } from '../types';

// Initialize Supabase client with environment variables
// Support both React and Next.js style environment variables
const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  process.env.SUPABASE_URL || 
  process.env.REACT_APP_SUPABASE_URL || 
  '';

const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  process.env.REACT_APP_SUPABASE_ANON_KEY || 
  '';

let supabaseInstance: SupabaseClient | null = null;

// Get or create Supabase client instance
export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase URL and anon key must be provided');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
};

// Check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

// User Authentication Functions

/**
 * Sign in with Figma OAuth
 */
export const signInWithFigma = async (): Promise<void> => {
  const supabase = getSupabase();
  
  try {
    // Get the current origin for the redirect
    const redirectUrl = window.location.origin;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'figma',
      options: {
        redirectTo: redirectUrl
      }
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error signing in with Figma:', error);
    throw error;
  }
};

/**
 * Sign out current user
 */
export const signOut = async (): Promise<void> => {
  const supabase = getSupabase();
  
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

/**
 * Get current session and user
 */
export const getCurrentSession = async () => {
  const supabase = getSupabase();
  
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

/**
 * Get current user
 */
export const getCurrentUser = async () => {
  const supabase = getSupabase();
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const session = await getCurrentSession();
  return !!session;
};

// Database Operations

/**
 * Save page to Supabase
 */
export const savePage = async (page: Page): Promise<Page> => {
  const supabase = getSupabase();
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('User must be authenticated to save pages');
  }
  
  try {
    // Prepare page data with user ID
    const pageData = {
      ...page,
      user_id: user.id,
      updated_at: new Date().toISOString()
    };
    
    // If page doesn't have created_at, add it
    if (!pageData.created_at) {
      pageData.created_at = new Date().toISOString();
    }
    
    // Insert or update page in Supabase
    const { data, error } = await supabase
      .from('pages')
      .upsert(pageData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving page:', error);
    throw error;
  }
};

/**
 * Get all pages for current user
 */
export const getPages = async (): Promise<Page[]> => {
  const supabase = getSupabase();
  const user = await getCurrentUser();
  
  if (!user) {
    return [];
  }
  
  try {
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting pages:', error);
    return [];
  }
};

/**
 * Delete a page from Supabase
 */
export const deletePage = async (pageId: string): Promise<void> => {
  const supabase = getSupabase();
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('User must be authenticated to delete pages');
  }
  
  try {
    const { error } = await supabase
      .from('pages')
      .delete()
      .match({ id: pageId, user_id: user.id });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting page:', error);
    throw error;
  }
};

// Export Figma access token getter (to be used by FigmaService)
export const getFigmaAccessTokenFromUser = async (): Promise<string | null> => {
  try {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) return null;
    
    // Get access token from user metadata
    if (user.app_metadata?.provider === 'figma' && user.app_metadata?.access_token) {
      return user.app_metadata.access_token;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting Figma access token:', error);
    return null;
  }
}; 
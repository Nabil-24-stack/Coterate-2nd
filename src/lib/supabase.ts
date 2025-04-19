import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client with environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a singleton instance of the Supabase client
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Export a function to get the client for easier mocking in tests
export const getSupabaseClient = () => supabaseClient; 
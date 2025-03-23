import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { PageProvider } from './contexts/PageContext';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getSupabase, isAuthenticated, refreshAuthState } from './services/SupabaseService';
import * as SupabaseService from './services/SupabaseService';

const AppContainer = styled.div`
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  font-family: 'Plus Jakarta Sans', sans-serif;
  position: relative;
`;

const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Handle the auth callback using Supabase
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback triggered, URL:', window.location.href);
        
        // We need to check different ways the auth tokens might be returned
        // 1. Check for access_token in the URL hash (standard OAuth redirect)
        // 2. Check for code in URL params (PKCE flow)
        // 3. Check if we're already logged in despite not having tokens in URL
        
        const supabase = getSupabase();
        let authSuccess = false;
        
        // Check if we already have a session first
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData && sessionData.session) {
          console.log('Existing session found.');
          authSuccess = true;
        }
        // Check for access_token in the URL hash
        else if (window.location.hash && window.location.hash.includes('access_token')) {
          console.log('Found auth tokens in URL hash - processing...');
          
          // First, we'll extract the tokens from the URL for debug purposes
          const hashContent = window.location.hash.substring(1);
          const params = new URLSearchParams(hashContent);
          
          // Log the token types we've found (without revealing the actual tokens)
          console.log('Auth tokens found:', {
            hasAccessToken: !!params.get('access_token'),
            hasRefreshToken: !!params.get('refresh_token'),
            hasProviderToken: !!params.get('provider_token'),
            expires_in: params.get('expires_in'),
            token_type: params.get('token_type')
          });
          
          // If we have a provider_token, store it directly in localStorage as backup
          const providerToken = params.get('provider_token');
          if (providerToken) {
            console.log('Found provider_token in URL hash, storing it for Figma API access');
            try {
              // Save the Figma token directly to localStorage for our app to use
              localStorage.setItem('figma_provider_token', providerToken);
            } catch (storageError) {
              console.error('Error saving provider token to localStorage:', storageError);
            }
          }
          
          // Wait a moment for Supabase to process the hash
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Now check if we have a session
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Supabase auth error:', error);
            setError(`Authentication failed: ${error.message}. This may be due to invalid API keys.`);
          } else if (data && data.session) {
            console.log('Authentication successful! Session established.');
            console.log('User metadata:', data.session.user?.user_metadata);
            authSuccess = true;
          } else {
            console.error('No session established despite having tokens in URL');
            
            // Attempt to manually set the session with the tokens from the URL
            try {
              const accessToken = params.get('access_token');
              const refreshToken = params.get('refresh_token');
              
              if (accessToken && refreshToken) {
                console.log('Attempting to manually set session with tokens from URL');
                
                const { error: setSessionError } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken
                });
                
                if (setSessionError) {
                  console.error('Error setting session manually:', setSessionError);
                  setError(`Error setting session: ${setSessionError.message}`);
                } else {
                  console.log('Session set manually');
                  authSuccess = true;
                }
              } else {
                console.error('Missing required tokens for manual session setup');
                setError('Missing required authentication tokens. Please try again.');
              }
            } catch (setSessionError) {
              console.error('Exception during manual session setup:', setSessionError);
              setError(`Error during authentication: ${setSessionError}`);
            }
          }
        }
        // Check for code param (PKCE flow)
        else if (window.location.search && window.location.search.includes('code=')) {
          console.log('Found auth code in URL query params - PKCE flow');
          
          // Let Supabase handle the PKCE exchange
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if we now have a session
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.error('Supabase auth error:', error);
            setError(`Authentication failed: ${error.message}`);
          } else if (data && data.session) {
            console.log('PKCE authentication successful! Session established.');
            authSuccess = true;
          } else {
            console.error('No session established after PKCE code exchange');
            setError('Authentication failed. Could not establish a session after code exchange.');
          }
        } else {
          console.error('No auth tokens or code found in URL');
          setError('No authentication tokens found in URL. Please try signing in again.');
        }
        
        // If authentication was successful, redirect to the main page
        if (authSuccess) {
          console.log('Authentication successful - redirecting to home page');
          window.location.href = window.location.origin;
          return;
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(`An error occurred during authentication: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    
    handleAuthCallback();
  }, []);
  
  // If still loading, show a loading message
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        fontFamily: 'Plus Jakarta Sans, sans-serif'
      }}>
        <h2>Finalizing authentication...</h2>
        <p>Please wait while we complete the sign-in process.</p>
      </div>
    );
  }
  
  // If there was an error, show an error message
  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        color: '#e53935'
      }}>
        <h2>Authentication Error</h2>
        <p>{error}</p>
        <button 
          onClick={() => window.location.href = window.location.origin}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            background: '#4A90E2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Return to Application
        </button>
      </div>
    );
  }
  
  // If authentication was successful but we're still on this page
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      color: '#4caf50'
    }}>
      <h2>Authentication Successful</h2>
      <p>You have successfully logged in with Figma.</p>
      <p>Redirecting you to the application...</p>
      
      {/* Add a manual redirect button in case the automatic redirect fails */}
      <button 
        onClick={() => window.location.href = window.location.origin}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          background: '#4A90E2',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Go to Application
      </button>
    </div>
  );
};

function App() {
  // Set up auth listener
  useEffect(() => {
    const supabase = getSupabase();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth event:', event);
        if (event === 'SIGNED_IN') {
          console.log('User signed in:', session?.user);
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
        }
      }
    );
    
    // Clean up subscription when component unmounts
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  return (
    <Router>
      <PageProvider>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/" element={
            <AppContainer>
              <Sidebar />
              <Canvas />
            </AppContainer>
          } />
          {/* Add a catch-all route to handle redirects from Supabase auth */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </PageProvider>
    </Router>
  );
}

export default App; 
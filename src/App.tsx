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
        
        // Check for access_token in the URL hash
        if (window.location.hash && window.location.hash.includes('access_token')) {
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
          
          // Let Supabase handle the auth flow - this will automatically process the tokens in the URL
          const supabase = getSupabase();
          
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
            
            // Force reload the page to ensure the auth state is properly picked up
            // This is more reliable than just redirecting
            window.location.href = window.location.origin;
            return;
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
                  console.log('Session set manually, forcing page reload');
                  window.location.href = window.location.origin;
                  return;
                }
              } else {
                console.error('Missing required tokens for manual session setup');
              }
            } catch (setSessionError) {
              console.error('Exception during manual session setup:', setSessionError);
            }
            
            setError('Authentication failed. Could not establish a session.');
          }
        } else {
          console.error('No auth tokens found in URL');
          setError('No authentication tokens found in URL');
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
        </Routes>
      </PageProvider>
    </Router>
  );
}

export default App; 
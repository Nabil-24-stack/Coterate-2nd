import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { PageProvider } from './contexts/PageContext';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getSupabase, isAuthenticated, refreshAuthState } from './services/SupabaseService';

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
        console.log('Auth callback triggered');
        
        // First, verify Supabase configuration
        try {
          const supabase = getSupabase();
          console.log('Supabase client created successfully');
        } catch (configError) {
          console.error('Supabase configuration error:', configError);
          setError(`Supabase configuration error: ${configError.message}. Please check your API keys in the environment variables.`);
          setLoading(false);
          return;
        }
        
        // Check for access_token in the URL hash
        if (window.location.hash && window.location.hash.includes('access_token')) {
          console.log('Found auth tokens in URL hash - processing...');
          
          // The hash includes the token - we need to let Supabase process this
          // Supabase automatically looks for these tokens on page load
          const supabase = getSupabase();
          
          // Wait a moment for Supabase to process the hash
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Now check if we have a session
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Supabase auth error:', error);
            setError(`Authentication failed: ${error.message}. This may be due to invalid API keys.`);
          } else if (data && data.session) {
            console.log('Authentication successful!', data.session.user);
            
            // Explicitly refresh the auth state to ensure it's updated across the app
            await refreshAuthState();
            
            // Redirect to main app
            window.location.href = window.location.origin;
            return;
          } else {
            console.error('No session found despite having tokens in URL');
            console.log('Full URL hash:', window.location.hash);
            
            // Attempt to manually extract and set the session
            try {
              // Get just the hash content (remove the # symbol)
              const hashContent = window.location.hash.substring(1);
              const params = new URLSearchParams(hashContent);
              
              // Log the access token (censored for security)
              const accessToken = params.get('access_token');
              if (accessToken) {
                const censoredToken = accessToken.substring(0, 10) + '...' + 
                  accessToken.substring(accessToken.length - 5);
                console.log('Found access token:', censoredToken);
                
                // Try to exchange this token for a session
                const { error: signInError } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: params.get('refresh_token') || '',
                });
                
                if (signInError) {
                  console.error('Error setting session:', signInError);
                  setError(`Error processing authentication tokens: ${signInError.message}. This may be due to invalid API keys.`);
                } else {
                  // Check if we have a session now
                  const { data: sessionData } = await supabase.auth.getSession();
                  if (sessionData && sessionData.session) {
                    console.log('Successfully set session manually');
                    await refreshAuthState();
                    window.location.href = window.location.origin;
                    return;
                  }
                }
              }
            } catch (err) {
              console.error('Error processing hash params:', err);
            }
            
            setError('No session found after authentication attempt. Please check your Supabase API keys and try again.');
          }
        } else {
          console.error('No auth tokens found in URL');
          setError('No authentication tokens found in URL');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(`An error occurred during authentication: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, []);

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
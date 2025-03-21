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
        const supabase = getSupabase();
        
        // Get URL hash parameters
        const hashParams = window.location.hash 
          ? new URLSearchParams(window.location.hash.substring(1))
          : new URLSearchParams(window.location.search);
        
        console.log('Auth callback triggered - checking for auth response');
        
        // First check if we have the access_token in the URL (Supabase OAuth flow)
        if (hashParams.get('access_token')) {
          console.log('Found access_token in URL, processing authentication...');
        }
        
        // Let Supabase process the URL parameters
        // This is needed even if getSession is called later
        const { data: authData, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          console.error('Error getting authenticated user:', authError);
        } else if (authData && authData.user) {
          console.log('Successfully authenticated user:', authData.user.id);
        }
        
        // Get the session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Supabase auth error:', error);
          setError('Authentication failed: ' + error.message);
        } else if (data && data.session) {
          console.log('Authentication successful!', data.session.user);
          
          // Explicitly refresh the auth state to ensure it's updated
          await refreshAuthState();
          
          // Redirect to main app
          window.location.href = window.location.origin;
        } else {
          console.error('No session found after authentication attempt');
          console.log('URL hash:', window.location.hash);
          console.log('URL search:', window.location.search);
          setError('No session found after authentication attempt. Please try again.');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('An error occurred during authentication');
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
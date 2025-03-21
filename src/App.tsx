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
        
        // Let Supabase handle the auth callback
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
          setError('No session found after authentication attempt');
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
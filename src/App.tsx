import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { PageProvider } from './contexts/PageContext';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getSupabase, isAuthenticated } from './services/SupabaseService';

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
    // Handle the auth callback
    const handleAuthCallback = async () => {
      try {
        // Get the URL hash parameters
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        // If there's an access_token, it's a successful auth
        if (params.get('access_token')) {
          // Get the current origin as the base URL
          const baseUrl = window.location.origin;
          
          setLoading(false);
          // Redirect to main app after a short delay
          setTimeout(() => {
            window.location.href = baseUrl;
          }, 1000);
        } else if (params.get('error')) {
          setError(params.get('error_description') || 'Authentication failed');
          setLoading(false);
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('An error occurred during authentication');
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, []);

  if (loading) {
    return <div>Loading authentication...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return <div>Authentication successful. Redirecting...</div>;
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
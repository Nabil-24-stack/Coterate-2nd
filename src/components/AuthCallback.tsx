import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { createClient } from '@supabase/supabase-js';

// Styled components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  background-color: #f8f8f8;
`;

const Card = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 32px;
  max-width: 400px;
  text-align: center;
`;

const Title = styled.h1`
  font-size: 24px;
  margin-bottom: 16px;
  color: #333;
`;

const Message = styled.p`
  font-size: 16px;
  color: #666;
  margin-bottom: 24px;
`;

const StatusIcon = styled.div<{ success?: boolean }>`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: ${props => props.success ? '#4caf50' : '#f44336'};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin: 0 auto 24px;
`;

const RetryButton = styled.button`
  background-color: #4A90E2;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 16px;
  
  &:hover {
    background-color: #3A80D2;
  }
`;

// Supabase configuration
const supabaseUrl = 'https://tsqfwommnuhtbeupuwwm.supabase.co';
// IMPORTANT: This is a temporary fix - in production, this should come from environment variables
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcWZ3b21tbm1odGJldXB1d3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDg0MjQ0ODIsImV4cCI6MjAyNDAwMDQ4Mn0.NSBHiYRCL0I4IxgXTpxEoAZbFvPlvdOiYiTgfE8uGTc';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const AuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Processing your login...');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setStatus('loading');
        setMessage('Processing your login...');

        // Debug: Log environment and initialization
        console.log('==== AUTH CALLBACK DEBUGGING ====');
        console.log('Environment:', {
          windowLocation: window.location.origin,
          isDevelopment: process.env.NODE_ENV === 'development'
        });
        console.log('Supabase client initialized with:', { 
          url: supabaseUrl,
          keyLength: supabaseAnonKey ? supabaseAnonKey.length : 0 
        });

        // Debug: Log entire URL and parse components
        console.log('Auth callback URL:', window.location.href);
        const urlParams = new URLSearchParams(window.location.search);
        console.log('URL params:', Object.fromEntries(urlParams.entries()));
        
        // Get the hash fragment from the URL if it exists
        const hashFragment = window.location.hash;
        console.log('Hash fragment raw:', hashFragment);

        // Parse the hash fragment (very important for Figma auth)
        const hashParams = hashFragment 
          ? new URLSearchParams(hashFragment.substring(1))
          : null;
          
        console.log('Hash params:', hashParams ? Object.fromEntries(hashParams.entries()) : 'none');

        // Explicitly check for error parameters
        const error = urlParams.get('error') || hashParams?.get('error');
        const errorDescription = urlParams.get('error_description') || hashParams?.get('error_description');
        const errorCode = urlParams.get('error_code') || hashParams?.get('error_code');
        
        if (error) {
          console.error('Auth error in URL:', { 
            error, 
            errorDescription, 
            errorCode 
          });
          setStatus('error');
          setMessage(`Authentication failed: ${error}`);
          setErrorDetails(`${errorDescription || 'Unknown error'} (${errorCode || 'no code'})`);
          return;
        }
        
        // Clear local storage of any stale auth data that might interfere
        try {
          console.log('Checking local storage for stale auth data');
          const authKeys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('supabase') || key.includes('figma') || key.includes('auth'))) {
              authKeys.push(key);
              console.log('Found potentially stale auth key:', key);
            }
          }
          console.log('Auth related localStorage keys:', authKeys);
        } catch (storageError) {
          console.error('Error checking localStorage:', storageError);
        }
        
        // First check if we have tokens in the hash fragment (implicit flow from Figma)
        if (hashParams && hashParams.get('access_token')) {
          console.log('Found access_token in hash fragment - handling implicit flow');
          try {
            // We need to handle the implicit flow by setting session with the token data
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const expiresIn = hashParams.get('expires_in');
            const expiresAt = hashParams.get('expires_at');
            const providerToken = hashParams.get('provider_token');
            const providerRefreshToken = hashParams.get('provider_refresh_token');
            
            console.log('Extracted tokens from hash:', { 
              hasAccessToken: !!accessToken,
              hasRefreshToken: !!refreshToken,
              expiresIn,
              hasProviderToken: !!providerToken
            });
            
            // Log the URLs and configuration to check for issues
            console.log('Current environment:', {
              origin: window.location.origin,
              url: supabaseUrl,
              keyLength: supabaseAnonKey ? supabaseAnonKey.length : 0
            });
            
            try {
              // Attempt to manually persist the session to localStorage first
              const expiresInSeconds = parseInt(expiresIn || '3600');
              const expiresAtTimestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;
              
              // Store session raw in localStorage (debugging approach)
              const sessionData = {
                access_token: accessToken,
                refresh_token: refreshToken || undefined,
                expires_at: expiresAtTimestamp,
                provider_token: providerToken,
                provider_refresh_token: providerRefreshToken
              };
              
              console.log('Manually storing session data:', sessionData);
              
              // Try direct approach - store tokens in localStorage manually
              try {
                // Store provider token for Figma API access
                if (providerToken) {
                  localStorage.setItem('figma_provider_token', providerToken);
                  console.log('Stored Figma provider token in localStorage');
                }
                
                // Store access token for authentication
                if (accessToken) {
                  localStorage.setItem('figma_access_token', accessToken);
                  console.log('Stored access token in localStorage');
                }
                
                // This is a minimal approach just to get authentication working
                // In a production app, you'd want to handle this more securely
                console.log('Successfully stored tokens, redirecting to home page');
                setStatus('success');
                setMessage('Authentication successful! Redirecting...');
                
                // Redirect back to the main app after a short delay
                setTimeout(() => {
                  navigate('/');
                }, 1000);
                return;
              } catch (storageError) {
                console.error('Error storing tokens in localStorage:', storageError);
              }
              
              // Try an alternate approach - use getUser directly with the access token
              const { data: userData, error: userError } = await supabase.auth.getUser(accessToken!);
              
              console.log('Get user with token result:', {
                success: !!userData,
                hasUser: !!userData?.user,
                error: userError
              });
              
              if (userError) {
                console.error('Error getting user with token:', userError);
                throw userError;
              }
              
              if (userData?.user) {
                console.log('Successfully verified user with token:', userData.user.email);
                
                // Try to refresh the session using the API
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                console.log('Session refresh result:', { success: !!refreshData, error: refreshError });
                
                setStatus('success');
                setMessage(`Welcome, ${userData.user.email || 'User'}!`);
                
                // Redirect back to the main app after a short delay
                setTimeout(() => {
                  navigate('/');
                }, 2000);
                return;
              }
            } catch (tokenUserError) {
              console.error('Error getting user with token:', tokenUserError);
            }
            
            // If direct token approach failed, try traditional way
            console.log('Falling back to traditional setSession approach');
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken!,
              refresh_token: refreshToken || ''
            });
            
            console.log('Set session result:', {
              success: !!data,
              hasSession: !!data?.session,
              error
            });
            
            if (error) {
              throw error;
            }
            
            if (data?.session) {
              console.log('Successfully created session from hash tokens');
              
              // Verify we can use the session
              const { data: userData, error: userError } = await supabase.auth.getUser();
              
              if (userError) {
                throw userError;
              }
              
              if (userData?.user) {
                console.log('Successfully verified user with hash token session');
                setStatus('success');
                setMessage(`Welcome, ${userData.user.email || 'User'}!`);
                
                // Redirect back to the main app after a short delay
                setTimeout(() => {
                  navigate('/');
                }, 2000);
                return;
              }
            }
            
            throw new Error('Failed to create valid session from hash tokens');
          } catch (hashTokenError) {
            console.error('Error handling hash tokens:', hashTokenError);
            setStatus('error');
            setMessage('Failed to authenticate with token data');
            setErrorDetails(hashTokenError instanceof Error 
              ? hashTokenError.message 
              : 'Unknown error processing authentication tokens');
            return;
          }
        }
        
        // Look for and process authorization code - this is the most important part
        const code = urlParams.get('code');
        
        if (code) {
          console.log('Found authorization code in URL, length:', code.length);
          try {
            // Try exchanging the code for a session
            console.log('Attempting to exchange code for session...');
            const { data: signInData, error: signInError } = 
              await supabase.auth.exchangeCodeForSession(code);
            
            console.log('Code exchange response:', { 
              success: !!signInData, 
              hasSession: !!signInData?.session,
              error: signInError
            });
            
            if (signInError) {
              console.error('Error exchanging code:', signInError);
              throw signInError;
            }
            
            if (signInData?.session) {
              console.log('Successfully obtained session from code exchange');
              
              // Verify we can actually use the session by checking user data
              const { data: userData, error: userError } = await supabase.auth.getUser();
              console.log('User data after session exchange:', { 
                success: !!userData, 
                user: userData?.user ? { 
                  id: userData.user.id,
                  email: userData.user.email,
                  provider: userData.user.app_metadata?.provider
                } : null,
                error: userError
              });
              
              if (userData?.user) {
                console.log('Successfully verified user with new session');
                setStatus('success');
                setMessage(`Welcome, ${userData.user.email}!`);
                
                // Redirect back to the main app after a short delay
                setTimeout(() => {
                  navigate('/');
                }, 2000);
                return;
              } else {
                console.error('Got session but failed to get user data:', userError);
                throw new Error('Failed to get user data with new session');
              }
            } else {
              console.error('No session returned from code exchange');
              throw new Error('No session returned from code exchange');
            }
          } catch (codeExchangeError) {
            console.error('Error in code exchange process:', codeExchangeError);
            setStatus('error');
            setMessage('Failed to complete authentication');
            setErrorDetails(codeExchangeError instanceof Error 
              ? codeExchangeError.message 
              : 'Unknown error during code exchange');
            return;
          }
        } else {
          console.warn('No authorization code found in URL');
        }
        
        // If we get here, check if we already have a session
        const { data, error: sessionError } = await supabase.auth.getSession();
        console.log('Auth session response:', data);

        if (sessionError) {
          console.error('Session retrieval error:', sessionError);
          setStatus('error');
          setMessage('Failed to retrieve session');
          setErrorDetails(sessionError.message);
          return;
        }

        if (data.session) {
          setStatus('success');
          setMessage('Successfully authenticated with Figma!');
          
          // Redirect back to the main app after a short delay
          setTimeout(() => {
            navigate('/');
          }, 2000);
          return;
        }

        // If we reach this point, we don't have a session
        console.error('No session found and no code to exchange');
        setStatus('error');
        setMessage('No session found after authentication');
        setErrorDetails('The authentication process did not return a valid session. Please try again.');
        
      } catch (error) {
        console.error('Error processing auth callback:', error);
        setStatus('error');
        setMessage('An unexpected error occurred');
        setErrorDetails(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  const handleRetry = () => {
    // Navigate back to home to restart the auth flow
    navigate('/');
  };

  return (
    <Container>
      <Card>
        {status === 'loading' && (
          <>
            <StatusIcon>⏳</StatusIcon>
            <Title>Processing</Title>
            <Message>{message}</Message>
          </>
        )}
        
        {status === 'success' && (
          <>
            <StatusIcon success>✓</StatusIcon>
            <Title>Success!</Title>
            <Message>{message}</Message>
          </>
        )}
        
        {status === 'error' && (
          <>
            <StatusIcon>✗</StatusIcon>
            <Title>Error</Title>
            <Message>{message}</Message>
            {errorDetails && <Message style={{ fontSize: '14px', opacity: 0.8 }}>{errorDetails}</Message>}
            <RetryButton onClick={handleRetry}>Try Again</RetryButton>
          </>
        )}
      </Card>
    </Container>
  );
};

export default AuthCallback; 
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

        // Debug: Log URL parameters
        console.log('Auth callback URL:', window.location.href);
        const urlParams = new URLSearchParams(window.location.search);
        console.log('URL params:', Object.fromEntries(urlParams.entries()));

        // Get the session - Supabase should handle the token exchange automatically
        const { data, error } = await supabase.auth.getSession();
        
        // Debug: Log the session data
        console.log('Auth session response:', data);

        if (error) {
          console.error('Authentication error:', error);
          setStatus('error');
          setMessage('Failed to authenticate with Figma');
          setErrorDetails(error.message);
          return;
        }

        // Try to exchange the code manually if the session isn't already available
        if (!data.session) {
          console.log('No session found, attempting to exchange code for token...');
          
          // Extract code from URL if present
          const code = urlParams.get('code');
          
          if (code) {
            try {
              // Exchange the code for a token
              const { data: signInData, error: signInError } = 
                await supabase.auth.exchangeCodeForSession(code);
              
              console.log('Code exchange result:', signInData, signInError);
              
              if (signInError) {
                throw signInError;
              }
              
              if (signInData.session) {
                setStatus('success');
                setMessage('Successfully authenticated with Figma!');
                
                // Redirect back to the main app after a short delay
                setTimeout(() => {
                  navigate('/');
                }, 2000);
                return;
              }
            } catch (exchangeError) {
              console.error('Error exchanging code:', exchangeError);
              // Continue to the error handling below
            }
          }
          
          setStatus('error');
          setMessage('No session found after authentication');
          setErrorDetails('The authentication process did not return a valid session');
          return;
        }

        setStatus('success');
        setMessage('Successfully authenticated with Figma!');
        
        // Redirect back to the main app after a short delay
        setTimeout(() => {
          navigate('/');
        }, 2000);
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
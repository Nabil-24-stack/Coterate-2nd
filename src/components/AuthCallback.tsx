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
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
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

        // Get the session - Supabase should handle the token exchange automatically
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Authentication error:', error);
          setStatus('error');
          setMessage('Failed to authenticate with Figma');
          setErrorDetails(error.message);
          return;
        }

        if (data.session) {
          setStatus('success');
          setMessage('Successfully authenticated with Figma!');
          
          // Redirect back to the main app after a short delay
          setTimeout(() => {
            navigate('/');
          }, 2000);
        } else {
          setStatus('error');
          setMessage('No session found after authentication');
          setErrorDetails('The authentication process did not return a valid session');
        }
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
import React, { useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import FigmaService from '../services/FigmaService';

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

const FigmaAuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Processing your login...');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const navigate = useNavigate();

  const processAuth = useCallback(async () => {
    try {
      setStatus('loading');
      setMessage('Processing your login...');
      setErrorDetails(null);
      
      // Get code and state from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      // Handle errors from Figma
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');
      
      if (error) {
        setStatus('error');
        setMessage(`Authentication failed: ${error}`);
        setErrorDetails(errorDescription || null);
        return;
      }
      
      // Validate required parameters
      if (!code || !state) {
        setStatus('error');
        setMessage('Missing required parameters');
        setErrorDetails('The authentication response is missing the code or state parameter');
        return;
      }
      
      // Process the callback
      const success = await FigmaService.handleOAuthCallback(code, state);
      
      if (success) {
        setStatus('success');
        setMessage('Successfully authenticated with Figma!');
        
        // Redirect back to the main app after a short delay
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        setStatus('error');
        setMessage('Failed to authenticate with Figma');
        setErrorDetails('There was a problem exchanging the authorization code for an access token');
      }
    } catch (error) {
      console.error('Error processing auth callback:', error);
      setStatus('error');
      setMessage('An unexpected error occurred');
      setErrorDetails(error instanceof Error ? error.message : 'Unknown error');
    }
  }, [navigate]);
  
  useEffect(() => {
    processAuth();
  }, [processAuth]);

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

export default FigmaAuthCallback; 
import React, { useEffect, useState } from 'react';
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

const FigmaAuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Processing your login...');
  const navigate = useNavigate();

  useEffect(() => {
    const processAuth = async () => {
      try {
        // Get code and state from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        
        // Handle errors from Figma
        const error = urlParams.get('error');
        if (error) {
          setStatus('error');
          setMessage(`Authentication failed: ${error}`);
          return;
        }
        
        // Validate required parameters
        if (!code || !state) {
          setStatus('error');
          setMessage('Missing required parameters');
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
          setMessage('Failed to authenticate with Figma. Please try again.');
        }
      } catch (error) {
        console.error('Error processing auth callback:', error);
        setStatus('error');
        setMessage('An unexpected error occurred');
      }
    };
    
    processAuth();
  }, [navigate]);

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
          </>
        )}
      </Card>
    </Container>
  );
};

export default FigmaAuthCallback; 
"use client";

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import supabaseService from '../../services/SupabaseService';

// Styled components
const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
`;

const Card = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const CardHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid #eee;
`;

const CardTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
`;

const CardDescription = styled.p`
  margin: 0.5rem 0 0;
  color: #666;
`;

const CardContent = styled.div`
  padding: 1.5rem;
`;

const CardFooter = styled.div`
  padding: 1.5rem;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: space-between;
`;

const Button = styled.button<{ variant?: 'outline' | 'primary'; disabled?: boolean }>`
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: 500;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  display: flex;
  align-items: center;
  justify-content: center;
  
  ${props => props.variant === 'outline' ? `
    background: transparent;
    border: 1px solid #ccc;
    color: #666;
    &:hover {
      background: #f5f5f5;
    }
  ` : `
    background: #3f51b5;
    border: 1px solid #3f51b5;
    color: white;
    opacity: ${props.disabled ? 0.7 : 1};
    &:hover {
      background: ${props.disabled ? '#3f51b5' : '#303f9f'};
    }
  `}
`;

const Alert = styled.div<{ variant?: 'destructive' }>`
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  
  ${props => props.variant === 'destructive' ? `
    background-color: #ffebee;
    border: 1px solid #ffcdd2;
  ` : `
    background-color: #e8f5e9;
    border: 1px solid #c8e6c9;
  `}
`;

const AlertTitle = styled.h4<{ variant?: 'destructive' }>`
  margin: 0 0 0.5rem;
  color: ${props => props.variant === 'destructive' ? '#c62828' : '#2e7d32'};
`;

const AlertDescription = styled.div<{ variant?: 'destructive' }>`
  color: ${props => props.variant === 'destructive' ? '#b71c1c' : '#1b5e20'};
`;

const Progress = styled.div`
  height: 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
`;

const ProgressBar = styled.div<{ value: number }>`
  height: 100%;
  background-color: #3f51b5;
  width: ${props => `${props.value}%`};
  transition: width 0.3s ease;
`;

const FlexRow = styled.div`
  display: flex;
  align-items: center;
`;

const SpinnerContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
`;

// Loading spinner component
const LoadingSpinner = ({ size = 'md' }) => {
  const spinnerSize = size === 'sm' ? '20px' : '40px';
  
  return (
    <div style={{ 
      width: spinnerSize, 
      height: spinnerSize, 
      border: '3px solid rgba(0, 0, 0, 0.1)',
      borderRadius: '50%',
      borderTop: '3px solid #3f51b5',
      animation: 'spin 1s linear infinite'
    }} />
  );
};

type MigrationStatus = {
  status: 'idle' | 'checking' | 'migrating' | 'success' | 'error';
  message: string;
  progress: number;
  details?: {
    migratedDesigns?: number;
    migratedIterations?: number;
  };
};

export default function MigratePage() {
  const navigate = useNavigate();
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>({
    status: 'idle',
    message: 'Checking system status...',
    progress: 0
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Add keyframe animation for spinner
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Check if the user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await supabaseService.getSession();
        setIsAuthenticated(!!session);
      } catch (error) {
        console.error('Error checking authentication:', error);
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, []);

  // Start the migration process
  const handleMigrate = async () => {
    try {
      setMigrationStatus({
        status: 'migrating',
        message: 'Starting migration. This may take a few minutes...',
        progress: 10
      });

      // Wait a bit to show the UI update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMigrationStatus(prev => ({
        ...prev,
        message: 'Migrating designs and iterations to the new database structure...',
        progress: 30
      }));

      // Perform the migration
      const result = await supabaseService.migrateToNormalizedSchema();
      
      if (result.success) {
        setMigrationStatus({
          status: 'success',
          message: result.message,
          progress: 100,
          details: {
            migratedDesigns: result.migratedDesigns,
            migratedIterations: result.migratedIterations
          }
        });
      } else {
        setMigrationStatus({
          status: 'error',
          message: result.message || 'An unknown error occurred during migration.',
          progress: 0
        });
      }
    } catch (error) {
      console.error('Migration error:', error);
      setMigrationStatus({
        status: 'error',
        message: 'An unexpected error occurred during the migration process.',
        progress: 0
      });
    }
  };

  // Redirect to the app after successful migration
  const handleContinue = () => {
    navigate('/');
  };

  if (isAuthenticated === null) {
    return (
      <SpinnerContainer>
        <LoadingSpinner />
      </SpinnerContainer>
    );
  }

  if (isAuthenticated === false) {
    return (
      <Container>
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              You need to be logged in to migrate your data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTitle>Not Authenticated</AlertTitle>
              <AlertDescription>
                Please log in to access the data migration tools.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button onClick={() => navigate('/login')}>Go to Login</Button>
          </CardFooter>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Card>
        <CardHeader>
          <CardTitle>Database Migration Tool</CardTitle>
          <CardDescription>
            This tool will migrate your existing designs and iterations to the new database structure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
              We've improved our database structure to provide better performance and more features.
              This migration will move your existing designs and iterations to the new structure.
            </p>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
              <strong>Important:</strong> This process cannot be undone. We recommend backing up your data before proceeding.
            </p>
          </div>

          {migrationStatus.status === 'migrating' && (
            <div style={{ marginBottom: '1rem' }}>
              <p>{migrationStatus.message}</p>
              <Progress>
                <ProgressBar value={migrationStatus.progress} />
              </Progress>
            </div>
          )}

          {migrationStatus.status === 'success' && (
            <Alert>
              <AlertTitle>Migration Complete</AlertTitle>
              <AlertDescription>
                <p>{migrationStatus.message}</p>
                {migrationStatus.details && (
                  <ul style={{ listStyle: 'disc', marginLeft: '1.25rem', marginTop: '0.5rem' }}>
                    <li>Migrated Designs: {migrationStatus.details.migratedDesigns}</li>
                    <li>Migrated Iterations: {migrationStatus.details.migratedIterations}</li>
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {migrationStatus.status === 'error' && (
            <Alert variant="destructive">
              <AlertTitle>Migration Failed</AlertTitle>
              <AlertDescription>{migrationStatus.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          {migrationStatus.status === 'success' ? (
            <Button onClick={handleContinue}>Continue to App</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => navigate('/')}>
                Cancel
              </Button>
              <Button 
                disabled={migrationStatus.status === 'migrating'}
                onClick={handleMigrate}
              >
                {migrationStatus.status === 'migrating' ? (
                  <FlexRow>
                    <span style={{ marginRight: '0.5rem' }}>Migrating...</span>
                    <LoadingSpinner size="sm" />
                  </FlexRow>
                ) : (
                  'Start Migration'
                )}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </Container>
  );
} 
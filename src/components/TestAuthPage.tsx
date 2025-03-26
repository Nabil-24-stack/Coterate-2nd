import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import supabaseService from '../services/SupabaseService';

// Types
interface Session {
  provider_token?: string | null;
  user: {
    id: string;
    email?: string;
    app_metadata?: {
      provider?: string;
    };
    [key: string]: any;
  };
  expires_at?: number;
  [key: string]: any;
}

interface User {
  id: string;
  email?: string;
  app_metadata?: {
    provider?: string;
  };
  [key: string]: any;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  max-width: 800px;
  margin: 0 auto;
`;

const Button = styled.button`
  background-color: #4A90E2;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  margin: 10px 0;
  
  &:hover {
    background-color: #3A80D2;
  }
`;

const Card = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin: 20px 0;
  width: 100%;
  overflow: auto;
`;

const Title = styled.h2`
  font-size: 20px;
  margin-bottom: 10px;
`;

const LogItem = styled.pre`
  background-color: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  overflow: auto;
  font-size: 14px;
  margin: 5px 0;
`;

const TestAuthPage: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      try {
        addLog('Checking for existing session...');
        const currentSession = await supabaseService.getSession();
        addLog(`Session check result: ${currentSession ? 'Found' : 'Not found'}`);
        
        if (currentSession) {
          // Cast the Supabase session to our Session type to avoid type errors
          setSession(currentSession as unknown as Session);
          addLog('Session details: ' + JSON.stringify(currentSession, null, 2));
          
          // Also get user if we have a session
          const currentUser = await supabaseService.getCurrentUser();
          setUser(currentUser as User);
          addLog('User details: ' + JSON.stringify(currentUser, null, 2));
        }
      } catch (error) {
        addLog(`Error checking session: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: authListener } = supabaseService.onAuthStateChange((event: string, newSession: any) => {
      addLog(`Auth state changed: ${event}`);
      addLog(`New session: ${newSession ? 'Available' : 'None'}`);
      
      if (newSession) {
        // Cast the session to our Session type
        setSession(newSession as unknown as Session);
        // Update user as well
        supabaseService.getCurrentUser().then((newUser: any) => {
          setUser(newUser as User);
          addLog('Updated user details: ' + JSON.stringify(newUser, null, 2));
        });
      } else {
        setSession(null);
        setUser(null);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async () => {
    try {
      addLog('Starting Figma sign in process...');
      const { url } = await supabaseService.signInWithFigma();
      addLog(`Sign in initiated, redirecting to: ${url}`);
    } catch (error) {
      addLog(`Error during sign in: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleSignOut = async () => {
    try {
      addLog('Signing out...');
      await supabaseService.signOut();
      addLog('Sign out successful');
      setSession(null);
      setUser(null);
    } catch (error) {
      addLog(`Error during sign out: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <Container>
      <h1>Auth Test Page</h1>
      
      <div>
        {session ? (
          <>
            <p>You are signed in</p>
            <Button onClick={handleSignOut}>Sign Out</Button>
          </>
        ) : (
          <>
            <p>You are not signed in</p>
            <Button onClick={handleSignIn}>Sign In with Figma</Button>
          </>
        )}
      </div>
      
      {user && (
        <Card>
          <Title>User Profile</Title>
          <p>ID: {user.id}</p>
          <p>Email: {user.email}</p>
          <p>Provider: {user.app_metadata?.provider || 'None'}</p>
        </Card>
      )}
      
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title>Debug Logs</Title>
          <Button onClick={clearLogs}>Clear Logs</Button>
        </div>
        <div style={{ maxHeight: '300px', overflow: 'auto' }}>
          {logs.map((log, index) => (
            <LogItem key={index}>{log}</LogItem>
          ))}
        </div>
      </Card>
    </Container>
  );
};

export default TestAuthPage; 
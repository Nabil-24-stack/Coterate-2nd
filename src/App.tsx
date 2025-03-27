import React from 'react';
import styled from 'styled-components';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import Header from './components/Header';
import { PageProvider } from './contexts/PageContext';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FigmaAuthCallback from './components/FigmaAuthCallback';
import AuthCallback from './components/AuthCallback';
import TestAuthPage from './components/TestAuthPage';

// Main app container - only used for global styles and positioning
const AppContainer = styled.div`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  font-family: 'Plus Jakarta Sans', sans-serif;
`;

function App() {
  return (
    <Router>
      <PageProvider>
        <Routes>
          <Route path="/auth/figma/callback" element={<FigmaAuthCallback />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/test-auth" element={<TestAuthPage />} />
          <Route path="/" element={
            <AppContainer>
              <Header />
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
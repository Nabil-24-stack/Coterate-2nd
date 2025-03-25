import React from 'react';
import styled from 'styled-components';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { PageProvider } from './contexts/PageContext';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FigmaAuthCallback from './components/FigmaAuthCallback';
import AuthCallback from './components/AuthCallback';

const AppContainer = styled.div`
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  font-family: 'Plus Jakarta Sans', sans-serif;
  position: relative;
`;

function App() {
  return (
    <Router>
      <PageProvider>
        <Routes>
          <Route path="/auth/figma/callback" element={<FigmaAuthCallback />} />
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
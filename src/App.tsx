import React from 'react';
import styled from 'styled-components';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { PageProvider } from './contexts/PageContext';
import { BrowserRouter as Router } from 'react-router-dom';

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
        <AppContainer>
          <Sidebar />
          <Canvas />
        </AppContainer>
      </PageProvider>
    </Router>
  );
}

export default App; 
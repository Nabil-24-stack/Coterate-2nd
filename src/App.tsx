import React, { useState } from 'react';
import styled from 'styled-components';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import Header from './components/Header';
import Research from './components/Research';
import BottomToolbar from './components/BottomToolbar';
import { PageProvider } from './contexts/PageContext';
import { CursorProvider } from './contexts/CursorContext';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FigmaAuthCallback from './components/FigmaAuthCallback';
import AuthCallback from './components/AuthCallback';
import TestAuthPage from './components/TestAuthPage';
import MigratePage from './app/migrate/page';

// Main app container - only used for global styles and positioning
const AppContainer = styled.div`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  font-family: 'Plus Jakarta Sans', sans-serif;
`;

// Tabs container for switching between Iteration and Research
const TabsContainer = styled.div`
  display: flex;
  gap: 0;
  position: absolute;
  top: 12px;
  right: 20px;
  z-index: 1001;
  background-color: #393A3A;
  border: 1px solid #6A6A6A;
  border-radius: 8px;
`;

const Tab = styled.div<{ active: boolean }>`
  width: 120px;
  padding: 6px 0px 8px;
  text-align: center;
  cursor: pointer;
  background-color: ${props => props.active ? '#444444' : 'transparent'};
  color: #FFFFFF;
  font-weight: ${props => props.active ? '600' : '500'};
  font-size: 14px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  border: ${props => props.active ? '1px solid #26D4C8' : 'none'};
  border-radius: 8px;
  line-height: 1.26em;
`;

function App() {
  const [activeTab, setActiveTab] = useState<'design' | 'research'>('design');

  return (
    <Router>
      <PageProvider>
        <CursorProvider>
          <Routes>
            <Route path="/auth/figma/callback" element={<FigmaAuthCallback />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/test-auth" element={<TestAuthPage />} />
            <Route path="/migrate" element={<MigratePage />} />
            <Route path="/" element={
              <AppContainer>
                <Header />
                <TabsContainer>
                  <Tab 
                    active={activeTab === 'design'} 
                    onClick={() => setActiveTab('design')}
                  >
                    Design
                  </Tab>
                  <Tab 
                    active={activeTab === 'research'} 
                    onClick={() => setActiveTab('research')}
                  >
                    Research
                  </Tab>
                </TabsContainer>
                <Sidebar />
                {activeTab === 'design' ? <Canvas /> : <Research />}
                <BottomToolbar />
              </AppContainer>
            } />
          </Routes>
        </CursorProvider>
      </PageProvider>
    </Router>
  );
}

export default App; 
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { usePageContext } from '../contexts/PageContext';
import { Design, DesignIteration, Page } from '../types';
import supabaseService from '../services/SupabaseService';
import openAIService from '../services/OpenAIService';
import HtmlDesignRenderer, { HtmlDesignRendererHandle } from './HtmlDesignRenderer';
import SVGDesignRenderer, { SVGDesignRendererHandle } from './SVGDesignRenderer';
import { isFigmaSelectionLink, parseFigmaSelectionLink, FigmaLinkData } from '../utils/figmaLinkParser';

// Global style to ensure no focus outlines or borders
const GlobalStyle = createGlobalStyle`
  * {
    outline: none !important;
  }
  
  button, h1, h2, h3, h4, h5, h6, p, span, div {
    font-family: 'Plus Jakarta Sans', sans-serif;
  }
`;

// Main canvas container that sits next to the sidebar
const CanvasContainer = styled.div`
  position: absolute;
  top: 60px; /* Header height */
  right: 0;
  bottom: 0;
  left: 230px; /* Sidebar width */
  background-color: #767676;
  overflow: hidden;
`;

// The infinite canvas with grid background
const InfiniteCanvas = styled.div<{ scale: number }>`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: #767676;
  cursor: grab;
  
  &:active {
    cursor: grabbing;
  }
`;

// The canvas content that can be transformed (panned and zoomed)
const CanvasContent = styled.div<{ x: number; y: number; scale: number }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: translate(${props => props.x}px, ${props => props.y}px) scale(${props => props.scale});
  transform-origin: 0 0;
`;

// Container for designs
const DesignContainer = styled.div<{ x: number; y: number }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(calc(-50% + ${props => props.x}px), calc(-50% + ${props => props.y}px));
  display: flex;
  justify-content: center;
  align-items: center;
`;

// Design card that holds the image, now with isSelected prop
const DesignCard = styled.div<{ isSelected: boolean }>`
  position: relative;
  border-radius: 8px;
  overflow: visible;
  box-shadow: ${props => props.isSelected 
    ? '0 0 0 2px #26D4C8, 0 4px 12px rgba(0, 0, 0, 0.15)' 
    : '0 4px 12px rgba(0, 0, 0, 0.08)'};
  background: white;
  cursor: ${props => props.isSelected ? 'move' : 'pointer'};
  
  &:hover {
    box-shadow: ${props => props.isSelected 
      ? '0 0 0 2px #26D4C8, 0 6px 16px rgba(0, 0, 0, 0.18)' 
      : '0 6px 16px rgba(0, 0, 0, 0.12)'};
  }
`;

// The image itself
const DesignImage = styled.img`
  display: block;
  max-width: 100%;
  height: auto;
  object-fit: contain;
  overflow: hidden;
  border-radius: 8px;
  user-select: none;
  -webkit-user-drag: none;
`;

// Iteration button (+ button) that appears next to selected designs
const IterationButton = styled.button`
  position: absolute;
  right: -50px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  background-color: #26D4C8;
  color: #383838;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 20;
  transition: background-color 0.2s ease, transform 0.2s ease;
  padding: 0;
  
  &:hover {
    background-color: #1fb9ae;
    transform: translateY(-50%) scale(1.05);
  }
  
  &:active {
    background-color: #18a79d;
    transform: translateY(-50%) scale(0.95);
  }
`;

// SVG Plus icon for perfect centering
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2V14" stroke="#383838" strokeWidth="2" strokeLinecap="round" />
    <path d="M2 8H14" stroke="#383838" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Empty state message
const EmptyCanvasMessage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #FFFFFF;
  text-align: center;
  max-width: 500px;
  line-height: 1.5;
  background-color: #383838;
  padding: 30px 40px;
  border-radius: 12px;
  border: 1px solid #4D4D4D;

  h2 {
    font-size: 28px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #FFFFFF;
  }

  p {
    font-size: 16px;
    color: #CFCFCF;
  }
`;

// Loading indicator
const LoadingIndicator = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #26D4C8;
  font-size: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  
  & svg {
    animation: rotate 1s linear infinite;
    margin-bottom: 10px;
    width: 40px;
    height: 40px;
  }
  
  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }
`;

// Loading spinner SVG
const LoadingSpinner = () => (
  <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
    <circle 
      cx="25" 
      cy="25" 
      r="20" 
      fill="none" 
      stroke="#26D4C8" 
      strokeWidth="4"
      strokeDasharray="60 20"
    />
  </svg>
);

// Replace the ProcessingOverlay styled component with a more detailed version
const ProcessingOverlay = styled.div<{ visible: boolean; step: 'analyzing' | 'recreating' | 'rendering' | null }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(56, 56, 56, 0.95);
  display: ${props => props.visible ? 'flex' : 'none'};
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  color: #FFFFFF;
  font-size: 16px;
  line-height: 1.5;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
  
  h3 {
    margin-top: 15px;
    margin-bottom: 5px;
    font-weight: 600;
    color: #26D4C8;
  }
  
  p {
    margin: 5px 0 15px;
    max-width: 300px;
    opacity: 0.8;
    font-size: 14px;
    color: #CFCFCF;
  }
  
  svg {
    animation: rotate 1.5s ease-in-out infinite;
    width: 40px;
    height: 40px;
  }
  
  .analysis-list {
    margin: 5px 0;
    padding: 0;
    list-style: none;
    text-align: left;
    display: ${props => props.step === 'analyzing' ? 'flex' : 'none'};
    flex-direction: column;
    gap: 5px;
    margin-bottom: 10px;
    
    li {
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
      
      svg {
        width: 14px;
        height: 14px;
        animation: none;
      }
      
      &.active svg {
        animation: pulse 1.5s ease-in-out infinite;
        
        @keyframes pulse {
          0% { opacity: 0.5; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.5; transform: scale(0.95); }
        }
      }
      
      &.completed {
        color: #4caf50;
      }
      
      &.pending {
        color: #9e9e9e;
      }
      
      &.active {
        color: #4f46e5;
        font-weight: 500;
      }
    }
  }
  
  .progress-bar {
    width: 80%;
    height: 4px;
    background-color: #eee;
    border-radius: 4px;
    margin: 10px 0;
    overflow: hidden;
    
    .progress {
      height: 100%;
      background-color: #4f46e5;
      border-radius: 4px;
      transition: width 0.5s ease-in-out;
      width: ${props => {
        switch (props.step) {
          case 'analyzing': return '33%';
          case 'recreating': return '66%';
          case 'rendering': return '90%';
          default: return '0%';
        }
      }};
    }
  }
  
  .step-description {
    font-size: 12px;
    color: #666;
    margin-top: 5px;
    opacity: 0.8;
  }
`;

// Add a custom spinner component
const Spinner = () => (
  <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
    <circle 
      cx="25" 
      cy="25" 
      r="20" 
      fill="none" 
      stroke="#26D4C8" 
      strokeWidth="5"
      strokeDasharray="80 50" 
    />
  </svg>
);

// Add component for the processing steps renderings
const ProcessingSteps = ({ step }: { step: 'analyzing' | 'recreating' | 'rendering' | null }) => {
  return (
    <ul className="analysis-list">
      <li className={step === 'analyzing' ? 'active' : (step === 'recreating' || step === 'rendering' ? 'completed' : 'pending')}>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          {step === 'analyzing' ? (
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          ) : (step === 'recreating' || step === 'rendering') ? (
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="currentColor" />
          ) : (
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.5" />
          )}
        </svg>
        Analyzing visual hierarchy, contrast, and components
      </li>
      <li className={step === 'recreating' ? 'active' : (step === 'rendering' ? 'completed' : 'pending')}>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          {step === 'recreating' ? (
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          ) : step === 'rendering' ? (
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="currentColor" />
          ) : (
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.5" />
          )}
        </svg>
        Generating improved design based on analysis
      </li>
      <li className={step === 'rendering' ? 'active' : 'pending'}>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          {step === 'rendering' ? (
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          ) : (
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.5" />
          )}
        </svg>
        Finalizing and rendering improved UI
      </li>
    </ul>
  );
};

// Enhance the AnalysisPanel to better display changes
const AnalysisPanel = styled.div<{ visible: boolean }>`
  position: absolute;
  top: 20px;
  right: 20px;
  width: 380px;
  max-height: calc(100% - 40px);
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: ${props => props.visible ? 'flex' : 'none'};
  flex-direction: column;
  z-index: 1000;
  overflow: hidden;
  transition: transform 0.3s ease, opacity 0.3s ease;
  transform: ${props => props.visible ? 'translateX(0)' : 'translateX(400px)'};
  opacity: ${props => props.visible ? '1' : '0'};
`;

// Improved panel header with tabs
const AnalysisPanelHeader = styled.div`
  padding: 15px 20px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }
  
  button {
    background: none;
    border: none;
    cursor: pointer;
    color: #666;
    padding: 5px;
    
    &:hover {
      color: #333;
    }
  }
`;

// Add tabs for different analysis sections
const TabContainer = styled.div`
  display: flex;
  padding: 0 15px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #eee;
`;

const Tab = styled.button<{ active: boolean }>`
  padding: 10px 15px;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: ${props => props.active ? '600' : '400'};
  color: ${props => props.active ? '#333' : '#666'};
  border-bottom: 2px solid ${props => props.active ? '#26D4C8' : 'transparent'};
  cursor: pointer;
  
  &:hover {
    color: ${props => props.active ? '#333' : '#444'};
  }
`;

// Enhanced content area
const AnalysisPanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  
  h4 {
    margin-top: 20px;
    margin-bottom: 10px;
    font-weight: 600;
    color: #333;
    display: flex;
    align-items: center;
    gap: 6px;
    
    svg {
      flex-shrink: 0;
    }
  }
  
  h5 {
    margin-top: 12px;
    margin-bottom: 8px;
    font-weight: 500;
    color: #555;
    font-size: 14px;
  }
  
  ul {
    margin: 0;
    padding-left: 20px;
    
    li {
      margin-bottom: 6px;
      line-height: 1.5;
    }
  }
  
  .comparison-container {
    background-color: #f8f9fa;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 20px;
    
    .comparison-title {
      font-weight: 600;
      margin-bottom: 10px;
    }
    
    .comparison-view {
      display: flex;
      gap: 15px;
      
      .comparison-half {
        flex: 1;
        
        .comparison-label {
          font-size: 12px;
          margin-bottom: 6px;
          color: #666;
          text-align: center;
        }
      }
    }
  }
  
  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
    gap: 10px;
    margin: 10px 0 20px;
    
    .color-swatch {
      height: 70px;
      border-radius: 4px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 5px;
      position: relative;
      overflow: hidden;
      
      span {
        font-size: 10px;
        color: white;
        text-shadow: 0 0 2px rgba(0,0,0,0.8);
        background: rgba(0,0,0,0.2);
        padding: 2px 4px;
        border-radius: 2px;
      }
    }
  }
  
  .analysis-section {
    display: flex;
    flex-direction: column;
    margin-bottom: 20px;
    
    .analysis-subsection {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      
      h5 {
        margin-top: 0;
        display: flex;
        align-items: center;
        gap: 5px;
        font-weight: 600;
        color: #333;
        
        &:before {
          content: '';
          display: block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #26D4C8;
        }
      }
      
      ul {
        margin: 10px 0 0;
      }
    }
  }
  
  .changes-list {
    li {
      background-color: #f8f9fa;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 10px;
      border-left: 3px solid #26D4C8;
    }
  }
`;

// Updated iteration display component
const IterationDisplayContainer = styled.div`
  position: absolute;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 30px;
  z-index: 5;
`;

// Connection line between original and iterated designs
const ConnectionLine = styled.div`
  position: absolute;
  height: 2px;
  background-color: #26D4C8;
  top: 50%;
  z-index: 3;
  transform: translateY(-50%);
  
  &:before, &:after {
    content: '';
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #26D4C8;
    top: 50%;
    transform: translateY(-50%);
  }
  
  &:before {
    left: 0;
  }
  
  &:after {
    right: 0;
  }
`;

// Label for iteration number
const IterationLabel = styled.div<{ scale: number }>`
  position: absolute;
  top: -20px;
  left: 0;
  background-color: #4f46e5;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  z-index: 10;
  transform: scale(${props => 1 / props.scale});
  transform-origin: bottom left;
`;

// Badge for new/improved design
const NewDesignBadge = styled.div<{ scale: number }>`
  position: absolute;
  top: -10px;
  right: -10px;
  background-color: #4f46e5;
  color: white;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: scale(${props => 1 / props.scale});
  transform-origin: bottom right;
`;

// Container for an iteration design
const IterationDesignCard = styled(DesignCard)`
  position: relative;
  background: white;
`;

// Update the Design type in the component to include processing fields
type ExtendedDesign = Design & {
  isProcessing?: boolean;
  processingStep?: 'analyzing' | 'recreating' | 'rendering' | null;
};

// Also extend the DesignIteration type to include processing fields
type ExtendedDesignIteration = DesignIteration & {
  isProcessing?: boolean;
  processingStep?: 'analyzing' | 'recreating' | 'rendering' | null;
};

// Add a debug function to log the designs state
const logDesignsState = (designs: ExtendedDesign[], message: string) => {
  console.log(`${message}: ${designs.length} designs`);
  designs.forEach((design, index) => {
    console.log(`Design ${index}: id=${design.id}, iterations=${design.iterations?.length || 0}`);
  });
};

// Debug button
const DebugButton = styled.button`
  position: fixed;
  bottom: 20px;
  left: 20px;
  background-color: #ff5722;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  z-index: 9999;
  
  &:hover {
    background-color: #e64a19;
  }
`;

// Debug toggle component for development mode
const DebugControls = () => {
  const [debugEnabled, setDebugEnabled] = useState(() => {
    // Initialize from localStorage
    return localStorage.getItem('svg_debug_mode') === 'true';
  });
  
  const toggleDebug = () => {
    const newState = !debugEnabled;
    setDebugEnabled(newState);
    
    // Update localStorage and call the global toggle function if available
    localStorage.setItem('svg_debug_mode', String(newState));
    
    // Call the global SVG debug toggle function if it exists
    if (typeof window.toggleSVGDebug === 'function') {
      window.toggleSVGDebug(newState);
    }
    
    // Also clear log caches when toggling debug mode
    LogManager.clear();
  };
  
  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 20, 
      right: 20, 
      zIndex: 9999, 
      display: 'flex', 
      flexDirection: 'column',
      gap: 8
    }}>
      <button 
        onClick={toggleDebug}
        style={{
          backgroundColor: debugEnabled ? '#4CAF50' : '#9e9e9e',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          padding: '8px 16px',
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        <span style={{ 
          width: 16, 
          height: 16, 
          borderRadius: 8, 
          backgroundColor: debugEnabled ? '#4CAF50' : '#9e9e9e',
          border: '4px solid white',
          display: 'inline-block'
        }} />
        SVG Debug {debugEnabled ? 'ON' : 'OFF'}
      </button>
      
      <button
        onClick={() => {
          // Clear all logs
          console.clear();
          LogManager.clear();
        }}
        style={{
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          padding: '8px 16px',
          fontSize: 14,
          cursor: 'pointer'
        }}
      >
        Clear Console
      </button>
    </div>
  );
};

// Add to the global window object
declare global {
  interface Window {
    toggleSVGDebug?: (enabled: boolean) => void;
  }
}

// Add a styled component for the Figma badge
const FigmaBadge = styled.div<{ scale: number }>`
  position: absolute;
  top: -10px;
  left: -10px;
  background-color: #1E1E1E;
  color: white;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 5;
  transform: scale(${props => 1 / props.scale});
  transform-origin: bottom left;
`;

// Add a styled component for Figma metadata tooltip
const FigmaMetadata = styled.div`
  position: absolute;
  bottom: -40px;
  left: 0;
  background-color: white;
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 11px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
  color: #666;
  display: none;
  
  ${DesignCard}:hover & {
    display: block;
  }
`;

// Create a styled component for the Figma auth prompt
const FigmaAuthPrompt = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.03);
  border: 1px dashed #ccc;
  border-radius: 8px;
  padding: 16px;
  width: 100%;
  height: 100%;
  text-align: center;
`;

const FigmaErrorMessage = styled.div`
  color: #e53935;
  margin-bottom: 12px;
  font-size: 14px;
  text-align: center;
`;

const FigmaAuthButton = styled.button`
  background-color: #1e88e5;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;

  &:hover {
    background-color: #1976d2;
  }
`;

// Debug for image loading
const debugImageLoad = (src: string, success: boolean, error?: string) => {
  console.log(`Image ${success ? 'loaded' : 'failed'}: ${src}${error ? ` (${error})` : ''}`);
};

// Logging utility to prevent duplicate logs
const LogManager = {
  prevLogs: new Map<string, string>(),
  renderedItems: new Set<string>(),
  
  // Log only if the message is different from the previous one with the same key
  log: (key: string, message: string, force: boolean = false) => {
    // If we've already logged this iteration and it's not forced, skip
    if (key.includes('iteration-') && LogManager.renderedItems.has(key.split('-')[1]) && !force) {
      return false;
    }
    
    const prevMessage = LogManager.prevLogs.get(key);
    if (force || prevMessage !== message) {
      console.log(message);
      LogManager.prevLogs.set(key, message);
      
      // If this is an iteration success log, add it to the renderedItems set
      if (key.match(/^iteration-[\w-]+$/) && message.includes('rendered successfully')) {
        const iterationId = key.split('-')[1];
        LogManager.renderedItems.add(iterationId);
      }
      
      return true;
    }
    return false;
  },
  
  // Clear all previous logs
  clear: () => {
    LogManager.prevLogs.clear();
    LogManager.renderedItems.clear();
  }
};

// Add a styled component for the View Analysis button
const ViewAnalysisButton = styled.button`
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #26D4C8;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 20;
  opacity: 0;
  transition: opacity 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  
  &:hover {
    background-color: #1fb9ae;
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

// Add a HoverContainer to handle the hover state
const HoverContainer = styled.div`
  position: relative;
  
  &:hover ${ViewAnalysisButton} {
    opacity: 1;
  }
`;

// Add a styled component that wraps the IterationDesignCard to control hover effects
const IterationCardContainer = styled.div`
  position: relative;
  
  ${IterationButton} {
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.2s ease;
    position: absolute;
    right: -50px;
    top: 50%;
    transform: translateY(-50%);
  }
  
  &:hover ${IterationButton} {
    opacity: 1;
  }
`;

// Add a styled component that wraps the DesignCard to control hover effects for original designs
const DesignCardContainer = styled.div`
  position: relative;
  
  ${IterationButton} {
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.2s ease;
    position: absolute;
    right: -50px;
    top: 50%;
    transform: translateY(-50%);
  }
  
  &:hover ${IterationButton} {
    opacity: 1;
  }
`;

// Container for action buttons
const ActionButtonsContainer = styled.div<{ scale: number; isProcessing?: boolean }>`
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%) scale(${props => 1 / props.scale});
  transform-origin: center bottom;
  display: flex;
  gap: 12px;
  background-color: ${props => props.isProcessing ? 'transparent' : '#383838'};
  padding: ${props => props.isProcessing ? '0' : '8px 16px'};
  border-radius: 8px;
  box-shadow: ${props => props.isProcessing ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.15)'};
  z-index: 20;
  opacity: ${props => props.isProcessing ? 1 : 0};
  transition: opacity 0.2s ease;
  min-width: ${props => props.isProcessing ? 'auto' : '420px'};
  justify-content: ${props => props.isProcessing ? 'center' : 'space-between'};
`;

// Individual action button style
const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background-color: #767676;
  border: 1px solid #4D4D4D;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  width: fit-content;
  white-space: nowrap;
  color: #FFFFFF;
  
  &:hover {
    background-color: #686868;
  }
  
  svg {
    width: 16px;
    height: 16px;
    stroke: #FFFFFF;
  }
  
  &.primary {
    background-color: #26D4C8;
    color: #383838;
    border-color: #26D4C8;
    
    &:hover {
      background-color: #1fb9ae;
    }
    
    svg {
      stroke: #383838;
    }
  }
  
  &.secondary {
    background-color: #4D4D4D;
    border-color: #5D5D5D;
    
    &:hover {
      background-color: #5A5A5A;
    }
  }
  
  &.analysis {
    /* min-width property removed entirely to allow the button to hug content */
  }
  
  &.cancel {
    background-color: #ff4d4d;
    border-color: #ff4d4d;
    color: #FFFFFF;
    
    &:hover {
      background-color: #ff3333;
    }
    
    svg {
      stroke: #FFFFFF;
    }
  }
`;

// New hover container with the action buttons
const DesignWithActionsContainer = styled.div`
  position: relative;
  
  &:hover ${ActionButtonsContainer}:not([isProcessing="true"]) {
    opacity: 1;
  }
`;

// Prompt Dialog for iterations
const PromptDialog = styled.div<{ visible: boolean, position: { x: number, y: number } }>`
  position: absolute;
  top: ${props => props.position.y}px;
  left: ${props => props.position.x}px;
  background-color: #383838;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 16px;
  width: 320px;
  z-index: 100;
  opacity: ${props => props.visible ? 1 : 0};
  pointer-events: ${props => props.visible ? 'all' : 'none'};
  transition: opacity 0.2s ease;
  transform: translateY(-50%);
`;

const PromptInput = styled.input`
  width: 100%;
  padding: 12px;
  border: 1px solid #4D4D4D;
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 12px;
  transition: border-color 0.2s ease;
  background-color: #444444;
  color: #FFFFFF;
  
  &:focus {
    border-color: #26D4C8;
    outline: none;
  }
  
  &::placeholder {
    color: #CFCFCF;
  }
`;

const PromptButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const PromptButton = styled.button`
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  width: fit-content;
  
  &.cancel {
    background-color: #767676;
    border: 1px solid #4D4D4D;
    color: #FFFFFF;
    
    &:hover {
      background-color: #686868;
    }
  }
  
  &.apply {
    background-color: #26D4C8;
    border: 1px solid #26D4C8;
    color: #383838;
    
    &:hover {
      background-color: #1fb9ae;
    }
  }
`;

// Icons for the buttons
const IterateIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M2 8H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const RetryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.65 2.35C12.2 0.9 10.21 0 8 0C3.58 0 0 3.58 0 8C0 12.42 3.58 16 8 16C11.73 16 14.84 13.45 15.74 10H13.65C12.83 12.33 10.61 14 8 14C4.69 14 2 11.31 2 8C2 4.69 4.69 2 8 2C9.66 2 11.14 2.69 12.22 3.78L9 7H16V0L13.65 2.35Z" fill="currentColor"/>
  </svg>
);

const ViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 3C4.5 3 1.5 8 1.5 8C1.5 8 4.5 13 8 13C11.5 13 14.5 8 14.5 8C14.5 8 11.5 3 8 3Z" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

// Drag handle icon for moving designs
const DragHandleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 6C10.1046 6 11 5.10457 11 4C11 2.89543 10.1046 2 9 2C7.89543 2 7 2.89543 7 4C7 5.10457 7.89543 6 9 6Z" fill="white"/>
    <path d="M15 6C16.1046 6 17 5.10457 17 4C17 2.89543 16.1046 2 15 2C13.8954 2 13 2.89543 13 4C13 5.10457 13.8954 6 15 6Z" fill="white"/>
    <path d="M9 13C10.1046 13 11 12.1046 11 11C11 9.89543 10.1046 9 9 9C7.89543 9 7 9.89543 7 11C7 12.1046 7.89543 13 9 13Z" fill="white"/>
    <path d="M15 13C16.1046 13 17 12.1046 17 11C17 9.89543 16.1046 9 15 9C13.8954 9 13 9.89543 13 11C13 12.1046 13.8954 13 15 13Z" fill="white"/>
    <path d="M9 20C10.1046 20 11 19.1046 11 18C11 16.8954 10.1046 16 9 16C7.89543 16 7 16.8954 7 18C7 19.1046 7.89543 20 9 20Z" fill="white"/>
    <path d="M15 20C16.1046 20 17 19.1046 17 18C17 16.8954 16.1046 16 15 16C13.8954 16 13 16.8954 13 18C13 19.1046 13.8954 20 15 20Z" fill="white"/>
  </svg>
);

// DragHandle for moving designs
const DragHandle = styled.button`
  position: absolute;
  top: 10px;
  left: 10px;
  width: 32px;
  height: 32px;
  background-color: #26D4C8;
  color: white;
  border: none;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 30;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: #1fb9ae;
  }
  
  &:active {
    cursor: grabbing;
    background-color: #18a79d;
  }
  
  svg {
    width: 18px;
    height: 18px;
  }
`;

// Add a cancel button component
const CancelButton = styled.button`
  background-color: transparent;
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 15px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
    border-color: white;
  }

  &:active {
    transform: translateY(1px);
  }
`;

// Helper function to get image dimensions
const getImageDimensions = (src: string): Promise<{width: number, height: number}> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    img.onerror = (err) => {
      console.error('Error loading image for dimensions:', err);
      // Default dimensions if we can't get the actual ones
      resolve({
        width: 400,
        height: 320
      });
    };
    img.src = src;
  });
};

export const Canvas: React.FC<{}> = () => {
  const { currentPage, updatePage, loading } = usePageContext();
  
  // Canvas state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Add a state to track if we've overridden loading state for safety
  const [loadingSafetyOverride, setLoadingSafetyOverride] = useState(false);
  
  // Track the last active page ID to prevent position sharing between pages
  const lastActivePageIdRef = useRef<string | null>(null);

  // Reference to track if we've initialized position for this page
  const positionInitializedRef = useRef<{[pageId: string]: boolean}>({});

  // Modified saveCanvasPosition function for more reliable saving
  const saveCanvasPosition = useCallback((pageId: string, pos: { x: number; y: number }, scl: number) => {
    if (!pageId) return;
    
    try {
      const key = `coterate_canvas_position_${pageId}`;
      const positionData = {
        position: pos,
        scale: scl
      };
      localStorage.setItem(key, JSON.stringify(positionData));
      console.log(`Canvas: Saved position for page ${pageId}:`, positionData);
    } catch (error) {
      console.error(`Canvas: Error saving position for page ${pageId}:`, error);
    }
  }, []);

  // Modified loadCanvasPosition function with immediate state updates
  const loadCanvasPosition = useCallback((pageId: string, force: boolean = false) => {
    if (!pageId) return false;
    
    // Only load once per page unless forced
    if (positionInitializedRef.current[pageId] && !force) {
      console.log(`Canvas: Position already initialized for page ${pageId}, skipping load`);
      return true;
    }
    
    try {
      const key = `coterate_canvas_position_${pageId}`;
      const savedData = localStorage.getItem(key);
      
      if (savedData) {
        const data = JSON.parse(savedData);
        console.log(`Canvas: Loading position for page ${pageId}:`, data);
        
        // Directly update the state with saved values
        if (data.position && typeof data.position.x === 'number') {
          setPosition(data.position);
          console.log(`Canvas: Setting saved position x=${data.position.x}, y=${data.position.y}`);
        } else {
          // Set default position if saved position is invalid
          console.log(`Canvas: Invalid position data for page ${pageId}, using default`);
          setPosition({ x: 0, y: 0 });
        }
        
        if (typeof data.scale === 'number') {
          setScale(data.scale);
          console.log(`Canvas: Setting saved scale: ${data.scale}`);
        } else {
          // Set default scale if saved scale is invalid
          console.log(`Canvas: Invalid scale data for page ${pageId}, using default`);
          setScale(1);
        }
        
        // Mark this page as initialized
        positionInitializedRef.current[pageId] = true;
        return true;
      } else {
        // No saved data found, set defaults for this page
        console.log(`Canvas: No saved position found for page ${pageId}, using defaults`);
        setPosition({ x: 0, y: 0 });
        setScale(1);
        
        // Also save these defaults to localStorage
        saveCanvasPosition(pageId, { x: 0, y: 0 }, 1);
      }
    } catch (error) {
      console.error(`Canvas: Error loading position for page ${pageId}:`, error);
      // Set default values in case of error
      setPosition({ x: 0, y: 0 });
      setScale(1);
    }
    
    // Mark as initialized even if no data found to prevent repeated attempts
    positionInitializedRef.current[pageId] = true;
    return false;
  }, []);

  // Effect to handle page changes and load the appropriate position
  useEffect(() => {
    if (!currentPage?.id) return;
    
    const pageId = currentPage.id;
    console.log(`Canvas: Current page changed to ${pageId}`);
    
    // Check if this is a new page (different from the last active page)
    if (lastActivePageIdRef.current !== pageId) {
      console.log(`Canvas: Page changed from ${lastActivePageIdRef.current || 'none'} to ${pageId}`);
      
      // Save position for the previous page before switching
      if (lastActivePageIdRef.current) {
        saveCanvasPosition(lastActivePageIdRef.current, position, scale);
      }
      
      // Always force load position when switching pages
      loadCanvasPosition(pageId, true);
      
      // Update the ref with the current page ID
      lastActivePageIdRef.current = pageId;
    }
  }, [currentPage?.id, loadCanvasPosition, saveCanvasPosition]);

  // User interaction tracking - add this below position related refs
  const userInteractingRef = useRef(false);

  // Remove the following effect as it's causing issues with position loading
  // Modified effect to save canvas position and scale to localStorage when they change
  useEffect(() => {
    if (!currentPage?.id || !userInteractingRef.current) return;
    
    const timeoutId = setTimeout(() => {
      if (currentPage?.id) {
        saveCanvasPosition(currentPage.id, position, scale);
      }
    }, 300); // Reduced debounce time for faster response
    
    return () => clearTimeout(timeoutId);
  }, [position, scale, currentPage?.id, saveCanvasPosition, userInteractingRef]);

  // State for multiple designs
  const [designs, setDesigns] = useState<ExtendedDesign[]>([]);

  // Track design initialization
  const [designsInitialized, setDesignsInitialized] = useState(false);
  
  // Selected design state
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [isDesignDragging, setIsDesignDragging] = useState(false);
  const [designDragStart, setDesignDragStart] = useState({ x: 0, y: 0 });
  const [designInitialPosition, setDesignInitialPosition] = useState({ x: 0, y: 0 });
  
  // Analysis panel state
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<DesignIteration | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const designRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const htmlRendererRef = useRef<HtmlDesignRendererHandle>(null);
  
  // Ref to track which iterations have been logged to avoid repeated console logs
  const renderedIterationsRef = useRef<Set<string>>(new Set());

  // Debounced update function to avoid too many database calls
  const debouncedUpdateRef = useRef<NodeJS.Timeout | null>(null);
  
  // Debugging: Check localStorage on component mount
  useEffect(() => {
    console.log('Canvas: Component mounted');
    // Log all coterate position keys in localStorage
    const positionKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('coterate_canvas_position_')
    );
    
    console.log('Canvas: Found position keys in localStorage:', positionKeys);
    
    // Check current page ID
    console.log('Canvas: Current page ID:', currentPage?.id);
    
    // If we have a current page, check if its position data exists
    if (currentPage?.id) {
      const key = `coterate_canvas_position_${currentPage.id}`;
      const savedData = localStorage.getItem(key);
      
      if (savedData) {
        console.log(`Canvas: Found saved position data for current page:`, JSON.parse(savedData));
      } else {
        console.log(`Canvas: No saved position data found for current page (${key})`);
      }
    }
  }, []);

  // Function to manually save canvas position for debugging
  const debugSavePosition = () => {
    if (currentPage?.id) {
      try {
        const data = {
          position,
          scale
        };
        const key = `coterate_canvas_position_${currentPage.id}`;
        localStorage.setItem(key, JSON.stringify(data));
        console.log('DEBUG: Manually saved position to localStorage:', key, data);
        
        // Verify it was saved
        const savedData = localStorage.getItem(key);
        if (savedData) {
          console.log('DEBUG: Verification - data in localStorage:', JSON.parse(savedData));
        }
      } catch (error) {
        console.error('DEBUG: Error saving position:', error);
      }
    }
  };

  // Save designs to page whenever they change
  useEffect(() => {
    // Skip during initial load or when no designs
    if (!currentPage || !designsInitialized) {
      return;
    }

    // Cancel any pending update
    if (debouncedUpdateRef.current) {
      clearTimeout(debouncedUpdateRef.current);
    }

    // Debounce updates to avoid too many database calls
    debouncedUpdateRef.current = setTimeout(() => {
      LogManager.log('designs-saved', `Canvas: Saving designs to page: ${designs.length} designs`);
      
      // Deep clone the designs array to avoid reference issues
      const designsToSave = JSON.parse(JSON.stringify(designs));
      
      updatePage(currentPage.id, { 
        designs: designsToSave,
        // Clear baseImage if we have designs (migration from old format)
        baseImage: designs.length > 0 ? undefined : currentPage.baseImage
      });
    }, 500);

    // Cleanup timeout
    return () => {
      if (debouncedUpdateRef.current) {
        clearTimeout(debouncedUpdateRef.current);
      }
    };
  }, [designs, currentPage?.id, designsInitialized, updatePage]);

  // Reset canvas position and scale
  const resetCanvas = () => {
    LogManager.log('canvas-reset', 'Canvas: Resetting canvas to default position and scale', true);
    const newPosition = { x: 0, y: 0 };
    const newScale = 1;
    
    setScale(newScale);
    setPosition(newPosition);
    
    // Save the reset position
    if (currentPage?.id) {
      saveCanvasPosition(currentPage.id, newPosition, newScale);
    }
  };
  
  // Find the selected design
  const selectedDesign = designs.find(d => d.id === selectedDesignId);
  
  // Helper to get a specific design reference
  const getDesignRef = (id: string) => {
    return designRefs.current[id];
  };
  
  // Handle wheel with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const zoomSensitivity = 0.1;
    const minScale = 0.1;
    const maxScale = 4;
    const scrollSensitivity = 1;
    
    // Command (Mac) or Control (Windows) key for zooming
    if (e.metaKey || e.ctrlKey) {
      // Calculate new scale
      let newScale = scale;
      
      if (e.deltaY < 0) {
        // Zoom in
        newScale = Math.min(scale * (1 + zoomSensitivity), maxScale);
      } else {
        // Zoom out
        newScale = Math.max(scale * (1 - zoomSensitivity), minScale);
      }
      
      // Get canvas element and its rectangle
      const canvasElement = canvasRef.current;
      if (!canvasElement) return;
      
      const rect = canvasElement.getBoundingClientRect();
      
      // Get cursor position relative to canvas
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate the point on the original content where the cursor is
      const originX = mouseX / scale - position.x / scale;
      const originY = mouseY / scale - position.y / scale;
      
      // Calculate the new position to keep cursor point fixed
      const newPositionX = mouseX - originX * newScale;
      const newPositionY = mouseY - originY * newScale;
      
      // Update state
      setScale(newScale);
      setPosition({ x: newPositionX, y: newPositionY });
      
      // Save position immediately after zooming
      if (currentPage?.id) {
        saveCanvasPosition(currentPage.id, { x: newPositionX, y: newPositionY }, newScale);
      }
    } else {
      // Regular scrolling (horizontal and vertical)
      const newPosition = {
        x: position.x - e.deltaX * scrollSensitivity,
        y: position.y - e.deltaY * scrollSensitivity,
      };
      
      setPosition(newPosition);
      
      // Save position after scrolling
      if (currentPage?.id) {
        saveCanvasPosition(currentPage.id, newPosition, scale);
      }
    }
  };
  
  // Add back the handleCanvasMouseDown function for canvas panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Start tracking user interaction
    userInteractingRef.current = true;
    
    // Check if clicking on any design
    const clickedDesignId = designs.find(design => {
      const designRef = getDesignRef(design.id);
      if (!designRef) return false;
      
      // Check if clicking on the design or any of its children
      return designRef.contains(e.target as Node);
    })?.id;
    
    if (clickedDesignId) {
      // Handled by the design's own mouse handler
      return;
    }
    
    // Deselect designs when clicking on empty canvas
    setSelectedDesignId(null);
    
    // Handle canvas panning
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };
  
  // Handle mouse move for panning and design dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDesignDragging && selectedDesignId) {
      // Calculate the delta in screen coordinates
      const deltaX = e.clientX - designDragStart.x;
      const deltaY = e.clientY - designDragStart.y;
      
      // Convert the delta to canvas coordinates by dividing by the scale
      const deltaCanvasX = deltaX / scale;
      const deltaCanvasY = deltaY / scale;

      // Determine if the selected item is a design or an iteration
      const isIteration = designs.some(design => 
        design.iterations?.some(iteration => iteration.id === selectedDesignId)
      );
      
      if (isIteration) {
        // Update iteration position with immutable state update
        setDesigns(prevDesigns => 
          prevDesigns.map(design => {
            if (!design.iterations) return design;
            
            const updatedIterations = design.iterations.map(iteration => 
              iteration.id === selectedDesignId
                ? {
                    ...iteration,
                    position: {
                      x: designInitialPosition.x + deltaCanvasX,
                      y: designInitialPosition.y + deltaCanvasY
                    }
                  }
                : iteration
            );
            
            // Only return a new design object if one of its iterations changed
            if (updatedIterations.some((it, idx) => it !== design.iterations![idx])) {
              return {
                ...design,
                iterations: updatedIterations
              };
            }
            
            return design;
          })
        );
      } else {
        // Update design position
        setDesigns(prevDesigns => 
          prevDesigns.map(design => 
            design.id === selectedDesignId
              ? {
                  ...design,
                  position: {
                    x: designInitialPosition.x + deltaCanvasX,
                    y: designInitialPosition.y + deltaCanvasY
                  }
                }
              : design
          )
        );
      }
      return;
    }
    
    if (isDragging) {
      const newPosition = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      };
      setPosition(newPosition);
    }
  };
  
  // Handle click on a design
  const handleDesignClick = (e: React.MouseEvent, designId: string) => {
    e.stopPropagation();
    
    // Set the selected design ID
    setSelectedDesignId(designId);
    
    // Note: We no longer automatically open the analysis panel for iterations
    // as we've moved that functionality to the View Analysis button
  };
  
  // Add the handleDesignMouseDown function back
  const handleDesignMouseDown = (e: React.MouseEvent, designId: string) => {
    // If we already have a design selected, just focus on this one
    if (selectedDesignId) {
      setSelectedDesignId(designId);
      
      // If this is a left-click, start dragging the design
      if (e.button === 0) {
        e.stopPropagation(); // Stop event propagation
        setIsDesignDragging(true);
        setDesignDragStart({
          x: e.clientX,
          y: e.clientY
        });
        
        // Find the initial position of the selected design
        const isIteration = designs.some(design => 
          design.iterations?.some(iteration => iteration.id === designId)
        );
        
        if (isIteration) {
          // Find the iteration's position
          for (const design of designs) {
            if (!design.iterations) continue;
            
            const iteration = design.iterations.find(it => it.id === designId);
            if (iteration && iteration.position) {
              setDesignInitialPosition(iteration.position);
              break;
            }
          }
        } else {
          // Find the design's position
          const design = designs.find(d => d.id === designId);
          if (design && design.position) {
            setDesignInitialPosition(design.position);
          }
        }
      }
    } else {
      // Otherwise just select it (this will also trigger the analysis panel if needed)
      handleDesignClick(e, designId);
    }
  };
  
  // State for prompt dialog
  const [promptDialogVisible, setPromptDialogVisible] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [promptDialogPosition, setPromptDialogPosition] = useState({ x: 0, y: 0 });
  const [designIdForPrompt, setDesignIdForPrompt] = useState<string | null>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);
  
  // Reference to track design processing status
  const processingDesignsRef = useRef<Set<string>>(new Set());
  
  // Function to open the prompt dialog when the user clicks the Iterate button
  const openPromptDialog = (e: React.MouseEvent, designId: string) => {
    // Get the position of the clicked button to position the dialog
    const buttonRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const canvasRect = canvasRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    
    // Calculate position relative to the canvas
    const posX = buttonRect.right + 20 - canvasRect.left; // Add some margin
    const posY = buttonRect.top + buttonRect.height / 2 - canvasRect.top;
    
    // Set the dialog position and make it visible
    setPromptDialogPosition({ x: posX, y: posY });
    setDesignIdForPrompt(designId);
    setPromptValue('');
    setPromptDialogVisible(true);
    
    // Focus the input field after the dialog is visible
    setTimeout(() => {
      promptInputRef.current?.focus();
    }, 100);
  };
  
  // Function to close the prompt dialog
  const closePromptDialog = () => {
    setPromptDialogVisible(false);
    setDesignIdForPrompt(null);
  };
  
  // Handle the prompt submission
  const handlePromptSubmit = async () => {
    if (!designIdForPrompt) return;
    
    // Close the dialog
    setPromptDialogVisible(false);
    
    // Process the iteration with the prompt
    await processIteration(designIdForPrompt, promptValue);
  };
  
  // Handle keydown in the prompt input field
  const handlePromptKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePromptSubmit();
    } else if (e.key === 'Escape') {
      closePromptDialog();
    }
  };
  
  // Add a ref to track abort controllers for each design
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Function to process the actual iteration based on the design ID and prompt
  const processIteration = async (designId: string, prompt: string) => {
    console.log(`Starting iteration process for design: ${designId} with prompt: ${prompt || 'none'}`);
    
    // Add design to processing set
    processingDesignsRef.current.add(designId);
    
    // Create a new AbortController for this iteration
    const controller = new AbortController();
    abortControllersRef.current[designId] = controller;
    const signal = controller.signal;

    // Determine if the target is a base design or an iteration
    const isIteration = designs.some(design => 
      design.iterations?.some(iteration => iteration.id === designId)
    );
    
    let designToIterate: Design | DesignIteration | undefined;
    let parentDesign: Design | undefined;
    
    if (isIteration) {
      // Find the parent design and the iteration
      for (const design of designs) {
        if (!design.iterations) continue;
        
        const iteration = design.iterations.find(it => it.id === designId);
        if (iteration) {
          designToIterate = iteration;
          parentDesign = design;
          break;
        }
      }
    } else {
      // It's a base design
      designToIterate = designs.find(d => d.id === designId);
    }
    
    if (!designToIterate) {
      console.error(`Could not find design with ID: ${designId}`);
      processingDesignsRef.current.delete(designId);
      return;
    }
    
    // Check if OpenAI API key is available
    if (!openAIService.hasApiKey()) {
      alert('OpenAI API key is not configured. Please set it in your environment variables.');
      processingDesignsRef.current.delete(designId);
      return;
    }
    
    // Set processing state for this specific design or iteration
    setDesigns(prevDesigns => 
      prevDesigns.map(design => {
        if (design.id === designId) {
          // If it's a base design
          return { ...design, isProcessing: true, processingStep: 'analyzing' };
        } else if (design.iterations) {
          // Check if the designId matches any of this design's iterations
          const updatedIterations = design.iterations.map(iteration => 
            iteration.id === designId
              ? { ...iteration, isProcessing: true, processingStep: 'analyzing' }
              : iteration
          );
          
          // Only return a new design object if one of its iterations changed
          if (updatedIterations.some((it, idx) => it !== design.iterations![idx])) {
            return { ...design, iterations: updatedIterations };
          }
        }
        return design;
      })
    );
    
    try {
      // Check if the process has been aborted
      if (signal.aborted) {
        console.log('Iteration process was aborted before analysis started');
        processingDesignsRef.current.delete(designId);
        return;
      }

      // Get the source image URL and dimensions
      let sourceImageUrl: string;
      let originalDimensions;
      
      if (isIteration) {
        // For iterations, use dimensions from the iteration
        originalDimensions = (designToIterate as DesignIteration).dimensions || 
          { width: 400, height: 320 };
        
        // Use parent design's image URL
        if (parentDesign && parentDesign.imageUrl) {
          sourceImageUrl = parentDesign.imageUrl;
        } else {
          throw new Error('Cannot find parent design for iteration');
        }
      } else {
        // For base designs, use direct imageUrl
        sourceImageUrl = (designToIterate as Design).imageUrl;
        originalDimensions = await getImageDimensions(sourceImageUrl);
        console.log(`Original image dimensions: ${originalDimensions.width}x${originalDimensions.height}`);
      }
      
      // Check if the process has been aborted
      if (signal.aborted) {
        console.log('Iteration process was aborted during dimension calculation');
        processingDesignsRef.current.delete(designId);
        return;
      }

      // Step 1: AI Analysis - Call OpenAI service to analyze the design (PRD 2.4.2)
      console.log("Starting AI analysis of design using OpenAI");
      
      // Update processing state to show analyzing
      setDesigns(prevDesigns => 
        prevDesigns.map(design => {
          if (design.id === designId) {
            return { ...design, processingStep: 'analyzing' };
          } else if (design.iterations) {
            const updatedIterations = design.iterations.map(iteration => 
              iteration.id === designId
                ? { ...iteration, processingStep: 'analyzing' }
                : iteration
            );
            
            if (updatedIterations.some((it, idx) => it !== design.iterations![idx])) {
              return { ...design, iterations: updatedIterations };
            }
          }
          return design;
        })
      );
      
      // Wait a moment to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let result;
      try {
        // Call OpenAI service - this is the core of PRD 2.4.2
        // Including the optional user prompt if provided (PRD 2.4.3)
        result = await openAIService.analyzeDesignAndGenerateHTML(sourceImageUrl, prompt || '');

        // Check if the process has been aborted during analysis
        if (signal.aborted) {
          console.log('Iteration process was aborted during AI analysis');
          processingDesignsRef.current.delete(designId);
          return;
        }

        // Update to the recreating step
        setDesigns(prevDesigns => 
          prevDesigns.map(design => {
            if (design.id === designId) {
              return { ...design, processingStep: 'recreating' };
            } else if (design.iterations) {
              const updatedIterations = design.iterations.map(iteration => 
                iteration.id === designId
                  ? { ...iteration, processingStep: 'recreating' }
                  : iteration
              );
              
              if (updatedIterations.some((it, idx) => it !== design.iterations![idx])) {
                return { ...design, iterations: updatedIterations };
              }
            }
            return design;
          })
        );
        
        // Short delay to show the recreating step
        if (!signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Update to the rendering step
        setDesigns(prevDesigns => 
          prevDesigns.map(design => {
            if (design.id === designId) {
              return { ...design, processingStep: 'rendering' };
            } else if (design.iterations) {
              const updatedIterations = design.iterations.map(iteration => 
                iteration.id === designId
                  ? { ...iteration, processingStep: 'rendering' }
                  : iteration
              );
              
              if (updatedIterations.some((it, idx) => it !== design.iterations![idx])) {
                return { ...design, iterations: updatedIterations };
              }
            }
            return design;
          })
        );
        
        // Another short delay to show the rendering step
        if (!signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Check if process aborted
        if (signal.aborted) {
          console.log('Iteration process was aborted during rendering step');
          processingDesignsRef.current.delete(designId);
          return;
        }
      } catch (error) {
        if (signal.aborted) {
          console.log('AI analysis was aborted');
          processingDesignsRef.current.delete(designId);
          return;
        }
        console.error('Error analyzing design:', error);
        throw new Error(`Failed to analyze design: ${(error as Error).message}`);
      }
      
      // Calculate position for the new iteration (to the right of the original)
      const iterationPosition = {
        x: designToIterate.position.x + (designToIterate.dimensions?.width || 400) + 50,
        y: designToIterate.position.y
      };
      
      // Create the new iteration with a unique ID - this implements PRD 2.4.4
      const newIteration: DesignIteration = {
        id: `iteration-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        parentId: isIteration ? (designToIterate as DesignIteration).parentId : designId,
        position: iterationPosition,
        svgContent: result.svgContent, // Store SVG content instead of HTML/CSS
        analysis: {
          strengths: result.analysis.strengths,
          weaknesses: result.analysis.weaknesses,
          improvementAreas: result.analysis.improvementAreas,
          specificChanges: result.analysis.specificChanges || [],
          visualHierarchy: {
            issues: result.analysis.visualHierarchy.issues,
            improvements: result.analysis.visualHierarchy.improvements
          },
          colorContrast: {
            issues: result.analysis.colorContrast.issues,
            improvements: result.analysis.colorContrast.improvements
          },
          componentSelection: {
            issues: result.analysis.componentSelection.issues,
            improvements: result.analysis.componentSelection.improvements
          },
          textLegibility: {
            issues: result.analysis.textLegibility.issues,
            improvements: result.analysis.textLegibility.improvements
          },
          usability: {
            issues: result.analysis.usability.issues,
            improvements: result.analysis.usability.improvements
          },
          accessibility: {
            issues: result.analysis.accessibility.issues,
            improvements: result.analysis.accessibility.improvements
          },
          metadata: {
            colors: result.metadata.colors,
            fonts: result.metadata.fonts,
            components: result.metadata.components
          }
        },
        dimensions: originalDimensions,
        created_at: new Date().toISOString()
      };
      
      // Log info about the generated SVG content
      console.log(`Generated iteration ${newIteration.id} with SVG content length: ${newIteration.svgContent?.length || 0}`);
      if (!newIteration.svgContent || newIteration.svgContent.length === 0) {
        console.error(`Error: Empty SVG content for iteration ${newIteration.id}`);
      }
      
      // Check if the process has been aborted
      if (signal.aborted) {
        console.log('Iteration process was aborted after creating the new iteration object');
        processingDesignsRef.current.delete(designId);
        return;
      }

      // Clear the abort controller
      delete abortControllersRef.current[designId];
      
      // Update designs with the new iteration
      setDesigns(prevDesigns => {
        return prevDesigns.map(design => {
          if (isIteration) {
            // If we're iterating on an iteration, add to its parent
            if (design.iterations?.some(it => it.id === designId)) {
              // Create or append to iterations array
              const existingIterations = design.iterations || [];
              
              // Reset the processing state on the original iteration
              const updatedExistingIterations = existingIterations.map(it => 
                it.id === designId 
                  ? { ...it, isProcessing: false, processingStep: null } 
                  : it
              );
              
              // Add the new iteration to the array
              const updatedIterations = [...updatedExistingIterations, newIteration];
              
              // Return the updated design
              return {
                ...design,
                iterations: updatedIterations
              };
            }
          } else if (design.id === designId) {
            // If iterating on a base design
            const existingIterations = design.iterations || [];
            const updatedIterations = [...existingIterations, newIteration];
            
            // Return updated design with new iteration and reset processing flags
            return {
              ...design,
              iterations: updatedIterations,
              isProcessing: false,
              processingStep: null
            };
          }
          return design;
        });
      });
      
      // Set the current analysis to show in the analysis panel
      setCurrentAnalysis(newIteration);
      setAnalysisVisible(true);
      
      // Remove design from processing set
      processingDesignsRef.current.delete(designId);
      
    } catch (error) {
      console.error('Error generating iteration:', error);
      
      // Clean up the abort controller
      delete abortControllersRef.current[designId];
      
      // Reset the processing state on error
      setDesigns(prevDesigns => 
        prevDesigns.map(design => {
          if (design.id === designId) {
            return { ...design, isProcessing: false, processingStep: null };
          } else if (design.iterations) {
            const updatedIterations = design.iterations.map(iteration => 
              iteration.id === designId
                ? { ...iteration, isProcessing: false, processingStep: null }
                : iteration
            );
            
            if (updatedIterations.some((it, idx) => it !== design.iterations![idx])) {
              return { ...design, iterations: updatedIterations };
            }
          }
          return design;
        })
      );
      
      // Show error message
      alert('Error generating iteration: ' + (error as Error).message);
      
      // Remove design from processing set
      processingDesignsRef.current.delete(designId);
    }
  };

  // Handler for when the user clicks the iteration button (PRD 2.4.1 & 2.4.3)
  const handleIterationClick = (e: React.MouseEvent, designId: string) => {
    e.stopPropagation(); // Prevent propagation to avoid selecting/deselecting
    
    // Check if design is already being processed
    if (processingDesignsRef.current.has(designId)) {
      console.log('Design is already being processed, ignoring iteration request');
      return;
    }
    
    // Open prompt dialog for user-guided iteration (PRD 2.4.3)
    openPromptDialog(e, designId);
  };

  // Toggle analysis panel visibility
  const toggleAnalysisPanel = () => {
    setAnalysisVisible((prev: boolean) => !prev);
    // Don't clear currentAnalysis when closing the panel so it's preserved when reopening
  };
  
  // Select an iteration for viewing in the analysis panel
  const selectIterationForAnalysis = (iteration: DesignIteration) => {
    // Just show the analysis panel without changing selection
    setCurrentAnalysis(iteration);
    setAnalysisVisible(true);
  };
  
  // Add a state for storing a pending Figma link that requires authentication
  const [pendingFigmaLink, setPendingFigmaLink] = useState<FigmaLinkData | null>(null);

  // Add a state for error message
  const [figmaAuthError, setFigmaAuthError] = useState<string | null>(null);

  // Handle Figma authentication
  const handleFigmaAuth = async () => {
    try {
      console.log('Initiating Figma authentication');
      setFigmaAuthError(null);
      
      // Clear any existing invalid tokens first
      supabaseService.clearInvalidFigmaToken();
      
      // Start the Figma OAuth flow
      await supabaseService.signInWithFigma();
      
      console.log('Figma authentication initiated successfully');
      
      // After authentication, check if we have a pending Figma link to process
      if (pendingFigmaLink) {
        console.log('Processing pending Figma link after authentication', pendingFigmaLink);
        const { fileKey, nodeId } = pendingFigmaLink;
        
        // Fetch the Figma node with the newly obtained auth
        fetchFigmaNode(fileKey, nodeId);
      }
    } catch (error: any) {
      console.error('Error authenticating with Figma:', error);
      setFigmaAuthError(error.message || 'Failed to authenticate with Figma');
    }
  };

  // Handle image pasting
  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      // Get clipboard text content
      const clipboardText = event.clipboardData?.getData('text') || '';
      
      console.log('Paste event detected!', {
        textLength: clipboardText.length,
        text: clipboardText.substring(0, 50) + (clipboardText.length > 50 ? '...' : ''),
        containsFigma: clipboardText.includes('figma.com'),
        isFigmaLink: isFigmaSelectionLink(clipboardText),
        isDesignLink: clipboardText.includes('figma.com/design/')
      });
      
      // Check if it's a Figma selection link (use our utility function)
      if (isFigmaSelectionLink(clipboardText)) {
        console.log('Figma selection link detected!', clipboardText);
        
        // Parse the Figma selection link to get file key and node ID
        const linkData = parseFigmaSelectionLink(clipboardText);
        console.log('Parsed Figma link data:', linkData);

        // First, check if we have a valid file key
        if (!linkData.fileKey) {
          console.error('No file key found in the Figma link');
          return; // Don't do anything if we can't get a file key
        }
        
        // For all links, whether design or file format, we need a valid node ID
        if (!linkData.nodeId || linkData.nodeId === '0:1') {
          alert('Please select a specific component in Figma and copy its selection link.\n\nTo get a selection link in Figma:\n1. Select a specific frame or component\n2. Right-click > Copy/Paste > Copy link to selection');
          return;
        }
        
        // If we have a valid file key and node ID, try to import
        if (linkData.fileKey && linkData.nodeId) {
          // First make sure Figma is authenticated
          if (!supabaseService.isAuthenticatedWithFigma()) {
            console.log('Not authenticated with Figma, showing auth prompt');
            setPendingFigmaLink(linkData);
            return;
          }
          
          // Prevent the default paste behavior
          event.preventDefault();
          
          // If already authenticated, try to fetch the Figma node
          console.log('Fetching Figma node:', linkData);
          setPendingFigmaLink(linkData);
          fetchFigmaNode(linkData.fileKey, linkData.nodeId);
        } else {
          console.error('Failed to parse Figma selection link:', clipboardText);
        }
      }
    }
    
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, []);
  
  async function fetchFigmaNode(fileKey: string, nodeId: string) {
    try {
      console.log(`Fetching Figma node - File: ${fileKey}, Node: ${nodeId}`);
      setFigmaAuthError(null);
      
      // Check authentication status for Figma
      const isAuth = await supabaseService.isAuthenticatedWithFigma();
      
      console.log('Figma authentication status:', isAuth);
      
      if (!isAuth) {
        console.log('Not authenticated with Figma, showing auth prompt');
        
        // Create a design with auth prompt
        const authDesign: Design & { needsFigmaAuth: boolean } = {
          id: crypto.randomUUID(), // Use a proper UUID for database compatibility
          imageUrl: '/figma-placeholder.svg', // Use a Figma placeholder 
          position: { x: 100, y: 100 },
          isFromFigma: true,
          figmaFileKey: fileKey,
          figmaNodeId: nodeId,
          needsFigmaAuth: true // This will trigger the auth prompt
        };
        
        // Add the auth design to the canvas and save the pending link
        setDesigns(prev => [...prev, authDesign]);
        setPendingFigmaLink({ fileKey, nodeId, isValid: true });
        return;
      }

      // Generate a unique ID for this design
      const designId = crypto.randomUUID();
      
      // Add a placeholder design while loading
      const placeholderDesign: Design = {
        id: designId,
        imageUrl: '/loading-placeholder.svg', // Use a loading placeholder
        position: { x: 100, y: 100 },
        isFromFigma: true,
        figmaFileKey: fileKey,
        figmaNodeId: nodeId
      };
      
      setDesigns(prev => [...prev, placeholderDesign]);
      
      console.log('Added placeholder design, calling importFigmaDesign with:', {fileKey, nodeId});
      
      // Use the importFigmaDesign method to get the image
      const importResult = await supabaseService.importFigmaDesign(fileKey, nodeId);
      
      console.log('Import result:', importResult);
      
      if (!importResult || !importResult.imageUrl) {
        console.error('Failed to import Figma design');
        setFigmaAuthError('Failed to import Figma design. Please try again.');
        
        // Remove the placeholder design
        setDesigns(prev => prev.filter(d => d.id !== designId));
        return;
      }
      
      console.log('Successfully imported Figma design:', importResult);
      
      // Update the placeholder design with the actual image in local state
      setDesigns(prev => prev.map(design => 
        design.id === designId
          ? {
              ...design,
              imageUrl: importResult.imageUrl,
              name: importResult.name,
              dimensions: { width: 400, height: 320 } // Reduced from 500x400
            }
          : design
      ));
      
      // Clear pending link since we've processed it
      setPendingFigmaLink(null);
      
      // We no longer need to store in Supabase database - only in local state
      console.log('Design stored in local state only, skipping database operations');
      
    } catch (error: any) {
      console.error('Error fetching Figma node:', error);
      setFigmaAuthError(error.message || 'Failed to fetch Figma design.');
      
      // Check if the error is related to authentication
      if (error.status === 401 || (error.message && error.message.includes('unauthorized'))) {
        console.log('Unauthorized Figma API access, clearing token and showing auth prompt');
        supabaseService.clearInvalidFigmaToken();
        
        // Create a design with auth prompt
        const authDesign: Design & { needsFigmaAuth: boolean } = {
          id: crypto.randomUUID(), // Use a proper UUID for database compatibility
          imageUrl: '/figma-placeholder.svg', // Use a Figma placeholder 
          position: { x: 100, y: 100 },
          isFromFigma: true,
          figmaFileKey: fileKey,
          figmaNodeId: nodeId,
          needsFigmaAuth: true // This will trigger the auth prompt
        };
        
        // Add the auth design to the canvas
        setDesigns(prev => [...prev, authDesign]);
        setPendingFigmaLink({ fileKey, nodeId, isValid: true });
      }
    }
  }
  
  // Handle wheel event for zooming via useEffect (as a backup)
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    // This is a backup handler in case the React onWheel doesn't work
    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      
      const zoomSensitivity = 0.1;
      const minScale = 0.1;
      const maxScale = 4;
      const scrollSensitivity = 1;
      
      // Command (Mac) or Control (Windows) key for zooming
      if (e.metaKey || e.ctrlKey) {
        // Calculate new scale
        let newScale = scale;
        
        if (e.deltaY < 0) {
          // Zoom in
          newScale = Math.min(scale * (1 + zoomSensitivity), maxScale);
        } else {
          // Zoom out
          newScale = Math.max(scale * (1 - zoomSensitivity), minScale);
        }
        
        // Get cursor position relative to canvas
        const rect = canvasElement.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate the point on the original content where the cursor is
        const originX = mouseX / scale - position.x / scale;
        const originY = mouseY / scale - position.y / scale;
        
        // Calculate the new position to keep cursor point fixed
        const newPositionX = mouseX - originX * newScale;
        const newPositionY = mouseY - originY * newScale;
        
        // Apply the new scale and position
        setScale(newScale);
        setPosition({ x: newPositionX, y: newPositionY });
        
        // Save position immediately after wheel zoom
        if (currentPage?.id) {
          saveCanvasPosition(currentPage.id, { x: newPositionX, y: newPositionY }, newScale);
        }
      } else {
        // Regular scrolling (horizontal and vertical)
        const newPosition = {
          x: position.x - e.deltaX * scrollSensitivity,
          y: position.y - e.deltaY * scrollSensitivity,
        };
        
        setPosition(newPosition);
        
        // Save position after scrolling
        if (currentPage?.id) {
          saveCanvasPosition(currentPage.id, newPosition, scale);
        }
      }
    };

    canvasElement.addEventListener('wheel', handleWheelEvent, { passive: false });
    
    return () => {
      canvasElement.removeEventListener('wheel', handleWheelEvent);
    };
  }, [scale, position, currentPage?.id, saveCanvasPosition]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+0: Reset zoom
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        resetCanvas();
      }
      
      // Ctrl+Plus: Zoom in
      if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        setScale((prev: number) => Math.min(prev * 1.1, 4));
      }
      
      // Ctrl+Minus: Zoom out
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        setScale((prev: number) => Math.max(prev * 0.9, 0.1));
      }
      
      // Delete/Backspace: Remove selected design
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDesignId) {
        setDesigns(prevDesigns => prevDesigns.filter(d => d.id !== selectedDesignId));
        setSelectedDesignId(null);
      }
      
      // Escape: Deselect design
      if (e.key === 'Escape' && selectedDesignId) {
        setSelectedDesignId(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedDesignId]);
  
  // Add state for active tab
  const [activeTab, setActiveTab] = useState<'changes' | 'analysis' | 'uxanalysis' | 'colors'>('changes');
  
  // Function to cancel an in-progress iteration
  const cancelIteration = (designId: string) => {
    // Abort any in-progress fetch requests
    if (abortControllersRef.current[designId]) {
      abortControllersRef.current[designId].abort();
      // Remove the abort controller from the ref
      delete abortControllersRef.current[designId];
    }

    // Reset the processing state for the specified design or iteration
    setDesigns(prevDesigns => 
      prevDesigns.map(design => {
        if (design.id === designId) {
          // Reset if it's a base design
          return { ...design, isProcessing: false, processingStep: null };
        } else if (design.iterations) {
          // Check if the designId matches any of this design's iterations
          const updatedIterations = design.iterations.map(iteration => 
            iteration.id === designId
              ? { ...iteration, isProcessing: false, processingStep: null }
              : iteration
          );
          
          // Only return a new design object if one of its iterations changed
          if (updatedIterations.some((it, idx) => it !== design.iterations![idx])) {
            return { ...design, iterations: updatedIterations };
          }
        }
        return design;
      })
    );
    
    // Remove the design from the processing set
    processingDesignsRef.current.delete(designId);
    
    console.log('Iteration canceled for design:', designId);
  };
  
  // Update the render part to include the processing overlay with steps
  const renderDesign = (design: ExtendedDesign) => {
    return (
      <DesignWithActionsContainer key={design.id}>
        <DesignCard 
          isSelected={selectedDesignId === design.id}
          onClick={(e) => handleDesignClick(e, design.id)}
          onMouseDown={(e) => handleDesignMouseDown(e, design.id)}
          style={{ position: 'relative' }}
        >
          {design.imageUrl && (
            <>
              <DesignImage 
                src={design.imageUrl}
                alt="Design"
                onLoad={() => debugImageLoad(design.imageUrl, true)}
                onError={(e) => debugImageLoad(design.imageUrl, false, e.toString())}
              />
              <ProcessingOverlay 
                visible={!!design.isProcessing} 
                step={design.processingStep || null}
              >
                <Spinner />
                <h3>
                  {design.processingStep === 'analyzing' && 'Analyzing Design'}
                  {design.processingStep === 'recreating' && 'Generating Improved Design'}
                  {design.processingStep === 'rendering' && 'Finalizing Design'}
                </h3>
                <p>
                  {design.processingStep === 'analyzing' && 'AI is analyzing your design for visual hierarchy, contrast, and usability...'}
                  {design.processingStep === 'recreating' && 'Creating an improved version based on analysis...'}
                  {design.processingStep === 'rendering' && 'Preparing to display your improved design...'}
                </p>
                <ProcessingSteps step={design.processingStep || null} />
                <div className="progress-bar">
                  <div className="progress"></div>
                </div>
                <div className="step-description">
                  {design.processingStep === 'analyzing' && 'Identifying areas for improvement in your design...'}
                  {design.processingStep === 'recreating' && 'Applying improvements to visual hierarchy, contrast, and components...'}
                  {design.processingStep === 'rendering' && 'Final touches and optimizations...'}
                </div>
              </ProcessingOverlay>
            </>
          )}
        </DesignCard>
        
        {/* New action buttons component */}
        <ActionButtonsContainer scale={scale} isProcessing={design.isProcessing}>
          {/* Show only Cancel button when processing */}
          {design.isProcessing ? (
            <ActionButton 
              className="cancel"
              onClick={() => cancelIteration(design.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Cancel
            </ActionButton>
          ) : (
            <>
              <ActionButton className="secondary" onMouseDown={(e) => {
                e.stopPropagation();
                // Select the design if not already selected
                if (selectedDesignId !== design.id) {
                  setSelectedDesignId(design.id);
                }
                
                // Start dragging the design
                setIsDesignDragging(true);
                setDesignDragStart({
                  x: e.clientX,
                  y: e.clientY
                });
                
                // Store the initial position for calculation during dragging
                setDesignInitialPosition(design.position);
              }}>
                <DragHandleIcon />
                Drag
              </ActionButton>
              <ActionButton className="analysis" onClick={(e) => {
                e.stopPropagation();
                // Create a compatible object that matches the DesignIteration type
                const analysisData = {
                  id: design.id,
                  parentId: '', // No parent for original design
                  htmlContent: design.htmlContent || '',
                  cssContent: design.cssContent || '',
                  analysis: {
                    strengths: [],
                    weaknesses: [],
                    improvementAreas: []
                  }, // Default empty analysis if not available
                  position: design.position,
                  dimensions: design.dimensions,
                  imageUrl: design.imageUrl
                } as DesignIteration;
                
                setCurrentAnalysis(analysisData);
                setAnalysisVisible(true);
              }}>
                <ViewIcon />
                Analysis
              </ActionButton>
              <ActionButton>
                <RetryIcon />
                Retry
              </ActionButton>
              <ActionButton className="primary" onClick={(e) => handleIterationClick(e, design.id)}>
                <IterateIcon />
                Iterate
              </ActionButton>
            </>
          )}
        </ActionButtonsContainer>
      </DesignWithActionsContainer>
    );
  };

  // Render an iteration separate from the original design
  const renderIteration = (iteration: ExtendedDesignIteration, index: number, parentDesign: Design) => {
    return (
      <DesignContainer 
        key={`iteration-container-${iteration.id}`}
        x={iteration.position.x}
        y={iteration.position.y}
      >
        <DesignWithActionsContainer>
          <div style={{ position: 'relative' }}>
            {/* The iteration design itself */}
            <IterationDesignCard 
              isSelected={selectedDesignId === iteration.id}
              onClick={(e) => handleDesignClick(e, iteration.id)}
              onMouseDown={(e) => handleDesignMouseDown(e, iteration.id)}
              style={{ cursor: selectedDesignId === iteration.id ? 'move' : 'pointer' }}
            >
              {iteration.svgContent ? (
                // Use SVGDesignRenderer for iterations with SVG content
                <SVGDesignRenderer
                  ref={(el: SVGDesignRendererHandle | null) => {
                    if (el) {
                      designRefs.current[iteration.id] = el as any;
                    }
                  }}
                  svgContent={iteration.svgContent}
                  width={iteration.dimensions?.width} 
                  height={iteration.dimensions?.height}
                  onRender={(success) => {
                    // Only log the first successful render to avoid console clutter
                    if (renderedIterationsRef.current.has(iteration.id)) {
                      return;
                    }
                    
                    if (success) {
                      LogManager.log(`iteration-${iteration.id}`, `Iteration ${iteration.id} rendered successfully`);
                      renderedIterationsRef.current.add(iteration.id);
                    } else {
                      // Enhanced error logging for SVG rendering failures
                      const svgLength = iteration.svgContent?.length || 0;
                      LogManager.log(`iteration-${iteration.id}-error`, 
                        `Iteration ${iteration.id} SVG render failed. SVG content length: ${svgLength}`, true);
                      
                      if (!iteration.svgContent || svgLength < 100) {
                        LogManager.log(`iteration-${iteration.id}-svg-issue`, 
                          `SVG content appears invalid or too short. Content: ${iteration.svgContent?.substring(0, 100) || 'empty'}`, true);
                      } else {
                        const svgPreview = iteration.svgContent.substring(0, 300).replace(/\n/g, ' ');
                        LogManager.log(`iteration-${iteration.id}-svg-debug`, 
                          `SVG content preview: ${svgPreview}...`, true);
                        
                        // Try to diagnose common issues
                        if (!iteration.svgContent.includes('xmlns=')) {
                          LogManager.log(`iteration-${iteration.id}-svg-xmlns`, 
                            `SVG missing xmlns attribute`, true);
                        }
                        
                        if (iteration.svgContent.includes('<style>') && !iteration.svgContent.includes('CDATA')) {
                          LogManager.log(`iteration-${iteration.id}-svg-cdata`, 
                            `SVG has style tag without CDATA section`, true);
                        }
                        
                        if (iteration.svgContent.includes('<rect') && !iteration.svgContent.includes('</rect>') && !iteration.svgContent.includes('/>')) {
                          LogManager.log(`iteration-${iteration.id}-svg-unclosed`, 
                            `SVG has unclosed rect tags`, true);
                        }
                      }
                    }
                  }}
                />
              ) : iteration.htmlContent && iteration.cssContent ? (
                // Fallback to HtmlDesignRenderer for legacy iterations
                <HtmlDesignRenderer
                  ref={(el: HtmlDesignRendererHandle | null) => {
                    if (el) {
                      designRefs.current[iteration.id] = el as any;
                    }
                  }}
                  htmlContent={iteration.htmlContent} 
                  cssContent={iteration.cssContent}
                  width={iteration.dimensions?.width} 
                  height={iteration.dimensions?.height}
                  onRender={(success) => {
                    // Only log the first successful render to avoid console clutter
                    if (renderedIterationsRef.current.has(iteration.id)) {
                      return;
                    }
                    
                    if (success) {
                      LogManager.log(`iteration-${iteration.id}`, `Iteration ${iteration.id} rendered successfully`);
                      renderedIterationsRef.current.add(iteration.id);
                    } else {
                      // Log failure with more detail
                      LogManager.log(`iteration-${iteration.id}-error`, 
                        `Iteration ${iteration.id} render failed. HTML length: ${iteration.htmlContent?.length || 0}, CSS length: ${iteration.cssContent?.length || 0}`);
                      
                      // Add additional debug for failed render
                      if (!iteration.cssContent || iteration.cssContent.length < 10) {
                        LogManager.log(`iteration-${iteration.id}-css-issue`, 
                          `CSS content appears invalid. CSS: ${iteration.cssContent?.substring(0, 100) || 'empty'}`);
                      } else {
                        // Log CSS content sample for debugging
                        LogManager.log(`iteration-${iteration.id}-css-debug`, 
                          `CSS content sample: ${iteration.cssContent?.substring(0, 200)}...`);
                      }
                      
                      // Log HTML content sample as well
                      if (iteration.htmlContent) {
                        LogManager.log(`iteration-${iteration.id}-html-debug`, 
                          `HTML content sample: ${iteration.htmlContent?.substring(0, 200)}...`);
                      }
                    }
                  }}
                />
              ) : (
                // Error fallback for missing content
                <div style={{ 
                  padding: '20px', 
                  color: '#e53e3e', 
                  fontSize: '14px', 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  textAlign: 'center',
                  background: '#f8f9fa' 
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>No Renderable Content</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    The design iteration could not be displayed due to missing content.
                    <br />
                    Try generating a new iteration.
                  </div>
                </div>
              )}
              
              {/* Add processing overlay for iterations */}
              <ProcessingOverlay 
                visible={!!iteration.isProcessing} 
                step={iteration.processingStep || null}
              >
                <Spinner />
                <h3>
                  {iteration.processingStep === 'analyzing' && 'Analyzing Design'}
                  {iteration.processingStep === 'recreating' && 'Generating Improved Design'}
                  {iteration.processingStep === 'rendering' && 'Finalizing Design'}
                </h3>
                <p>
                  {iteration.processingStep === 'analyzing' && 'AI is analyzing your design for visual hierarchy, contrast, and usability...'}
                  {iteration.processingStep === 'recreating' && 'Creating an improved version based on analysis...'}
                  {iteration.processingStep === 'rendering' && 'Preparing to display your improved design...'}
                </p>
                <ProcessingSteps step={iteration.processingStep || null} />
                <div className="progress-bar">
                  <div className="progress"></div>
                </div>
                <div className="step-description">
                  {iteration.processingStep === 'analyzing' && 'Identifying areas for improvement in your design...'}
                  {iteration.processingStep === 'recreating' && 'Applying improvements to visual hierarchy, contrast, and components...'}
                  {iteration.processingStep === 'rendering' && 'Final touches and optimizations...'}
                </div>
              </ProcessingOverlay>
            </IterationDesignCard>
          </div>
          
          <ActionButtonsContainer scale={scale} isProcessing={iteration.isProcessing}>
            {/* Show only Cancel button when processing */}
            {iteration.isProcessing ? (
              <ActionButton 
                className="cancel"
                onClick={() => cancelIteration(iteration.id)}
              >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                  <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Cancel
              </ActionButton>
            ) : (
              <>
                <ActionButton className="secondary" onMouseDown={(e) => {
                  e.stopPropagation();
                  // Select the design if not already selected
                  if (selectedDesignId !== iteration.id) {
                    setSelectedDesignId(iteration.id);
                  }
                  
                  // Start dragging the design
                  setIsDesignDragging(true);
                  setDesignDragStart({
                    x: e.clientX,
                    y: e.clientY
                  });
                  
                  // Store the initial position for calculation during dragging
                  setDesignInitialPosition(iteration.position);
                }}>
                  <DragHandleIcon />
                  Drag
                </ActionButton>
                <ActionButton className="analysis" onClick={(e) => {
                  e.stopPropagation();
                  setCurrentAnalysis(iteration);
                  setAnalysisVisible(true);
                }}>
                  <ViewIcon />
                  Analysis
                </ActionButton>
                <ActionButton>
                  <RetryIcon />
                  Retry
                </ActionButton>
                <ActionButton className="primary" onClick={(e) => handleIterationClick(e, iteration.id)}>
                  <IterateIcon />
                  Iterate
                </ActionButton>
              </>
            )}
          </ActionButtonsContainer>
        </DesignWithActionsContainer>
      </DesignContainer>
    );
  };

  // Add effect to clear log manager cache when unmounting
  useEffect(() => {
    return () => {
      // Clear logs when component unmounts
      LogManager.clear();
    };
  }, []);

  // Also clear the log manager cache when page changes
  useEffect(() => {
    if (currentPage?.id) {
      // Clear log cache on page change to avoid stale logs
      LogManager.clear();
    }
  }, [currentPage?.id]);

  // Safety timeout to prevent infinite loading state
  useEffect(() => {
    // If loading is true for too long, we'll override it
    if (loading) {
      const safetyTimeout = setTimeout(() => {
        LogManager.log('safety-override', 'Canvas: Loading taking too long, applying safety override', true);
        setLoadingSafetyOverride(true);
        
        // Try to load designs from localStorage
        try {
          const storedPages = localStorage.getItem('coterate_pages');
          if (storedPages) {
            const parsedPages = JSON.parse(storedPages) as Page[];
            LogManager.log('local-pages', `Canvas: Found ${parsedPages.length} pages in localStorage`, true);
            
            // Find the current page ID from localStorage
            const lastActivePageId = localStorage.getItem('coterate_last_active_page');
            if (lastActivePageId) {
              const localPage = parsedPages.find(page => page.id === lastActivePageId);
              if (localPage && localPage.designs && localPage.designs.length > 0) {
                LogManager.log('local-designs', `Canvas: Loading ${localPage.designs.length} designs from localStorage`, true);
                setDesigns(localPage.designs);
                setDesignsInitialized(true);
              }
            }
          }
        } catch (error) {
          console.error('Canvas: Error loading from localStorage in safety override:', error);
        }
      }, 5000); // 5 seconds
      
      return () => clearTimeout(safetyTimeout);
    }
  }, [loading]);

  // Modified handleMouseUp to save position and track end of user interaction
  const handleMouseUp = () => {
    // Check if we were dragging the canvas (panning)
    if (isDragging && currentPage?.id) {
      saveCanvasPosition(currentPage.id, position, scale);
    }
    
    // Check if we were dragging a design and save its new position
    if (isDesignDragging && selectedDesignId) {
      // Position is already saved in the designs state, no extra save needed
      console.log(`Design dragging ended for design: ${selectedDesignId}`);
    }
    
    setIsDragging(false);
    setIsDesignDragging(false);
    
    // Reset user interaction flag
    userInteractingRef.current = false;
  };

  // Effect to load designs from page data - only runs once per page change
  useEffect(() => {
    if (currentPage) {
      LogManager.log('page-changed', `Canvas: Current page changed: ${currentPage.id} Page ${currentPage.name || 1}`);
      
      if (currentPage.designs && Array.isArray(currentPage.designs) && currentPage.designs.length > 0) {
        // If the page already has designs array, use it
        LogManager.log('designs-loaded', `Canvas: Loading designs from page: ${currentPage.designs.length} designs`);
        setDesigns(currentPage.designs);
      } else if (currentPage.baseImage && !designsInitialized) {
        // If the page has a baseImage (legacy format), convert it to our new designs array
        LogManager.log('designs-legacy', 'Canvas: Converting legacy baseImage to design');
        setDesigns([{
          id: 'legacy-design',
          imageUrl: currentPage.baseImage,
          position: { x: 0, y: 0 }
        }]);
      } else {
        LogManager.log('designs-empty', 'Canvas: No designs found in current page');
        setDesigns([]);
      }

      setDesignsInitialized(true);
    } else {
      LogManager.log('page-none', 'Canvas: No current page available');
    }
  }, [currentPage]);

  // One-time effect to initialize position when component mounts
  useEffect(() => {
    if (!currentPage?.id) return;
    
    console.log('Canvas: Component mounted, initializing position', true);
    
    // Set the last active page ID ref
    lastActivePageIdRef.current = currentPage.id;
    
    // Try to load the saved position
    loadCanvasPosition(currentPage.id);
  }, []); // Empty dependency array = only run once on mount

  return (
    <>
      <GlobalStyle />
      <CanvasContainer ref={containerRef}>
        {loading && !loadingSafetyOverride ? (
          <LoadingIndicator>
            <LoadingSpinner />
            <span>Loading designs...</span>
          </LoadingIndicator>
        ) : (
          <InfiniteCanvas
            ref={canvasRef}
            scale={scale}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <CanvasContent
              x={position.x}
              y={position.y}
              scale={scale}
            >
              {designs.length > 0 ? (
                <>
                  {/* Render all original designs */}
                  {designs.map((design) => (
                    <DesignContainer 
                      key={`container-${design.id}`}
                      x={design.position.x}
                      y={design.position.y}
                    >
                      {renderDesign(design)}
                    </DesignContainer>
                  ))}
                  
                  {/* Render all iterations separately */}
                  {designs.flatMap((design) => 
                    (design.iterations || []).map((iteration, index) => 
                      renderIteration(iteration as ExtendedDesignIteration, index, design)
                    )
                  )}
                </>
              ) : (
                <EmptyCanvasMessage>
                  <h2>Paste a Figma frame selection</h2>
                  <p>Go to your Figma file, select a frame, press Cmd+L on your keyboard, and paste here</p>
                </EmptyCanvasMessage>
              )}
            </CanvasContent>
          </InfiniteCanvas>
        )}
        
        {/* Debug Controls - only in development mode */}
        {process.env.NODE_ENV === 'development' && (
          <DebugButton onClick={debugSavePosition}>
            Save Position (Debug)
          </DebugButton>
        )}
        
        {/* Enhanced Analysis Panel */}
        <AnalysisPanel visible={analysisVisible}>
          <AnalysisPanelHeader>
            <h3>Design Analysis</h3>
            <button onClick={toggleAnalysisPanel}>×</button>
          </AnalysisPanelHeader>
          
          {/* Add tabs for different analysis views */}
          <TabContainer>
            <Tab 
              active={activeTab === 'changes'} 
              onClick={() => setActiveTab('changes')}
            >
              Changes Made
            </Tab>
            <Tab 
              active={activeTab === 'analysis'} 
              onClick={() => setActiveTab('analysis')}
            >
              Analysis
            </Tab>
            <Tab 
              active={activeTab === 'uxanalysis'} 
              onClick={() => setActiveTab('uxanalysis')}
            >
              UX Analysis
            </Tab>
            <Tab 
              active={activeTab === 'colors'} 
              onClick={() => setActiveTab('colors')}
            >
              Design System
            </Tab>
          </TabContainer>
          
          <AnalysisPanelContent>
            {currentAnalysis ? (
              <>
                {/* Changes Tab */}
                {activeTab === 'changes' && currentAnalysis && (
                  <>
                    {/* Before/After Comparison */}
                    <div className="comparison-container">
                      <div className="comparison-title">Before & After Comparison</div>
                      <div className="comparison-view">
                        <div className="comparison-half">
                          <div className="comparison-label">Original</div>
                          {/* This would be a thumbnail of the original design */}
                          <img 
                            src={designs.find(d => d.id === currentAnalysis.parentId)?.imageUrl} 
                            alt="Original design" 
                            style={{ width: '100%', height: 'auto', maxHeight: '150px', objectFit: 'contain' }}
                          />
                        </div>
                        <div className="comparison-half">
                          <div className="comparison-label">Improved</div>
                          {/* Use SVGDesignRenderer or HtmlDesignRenderer depending on what's available */}
                          {currentAnalysis.svgContent ? (
                            <SVGDesignRenderer
                              svgContent={currentAnalysis.svgContent}
                              width={150}
                              height={150}
                              showBorder={false}
                            />
                          ) : currentAnalysis.htmlContent && currentAnalysis.cssContent ? (
                            <HtmlDesignRenderer
                              htmlContent={currentAnalysis.htmlContent}
                              cssContent={currentAnalysis.cssContent}
                              width={150}
                              height={150}
                              showBorder={false}
                            />
                          ) : (
                            <div style={{ background: '#f0f0f0', width: '150px', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              No preview available
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14.06 9L15 9.94L5.92 19H5v-0.92L14.06 9M17.66 3c-0.25 0-0.51 0.1-0.7 0.29l-1.83 1.83 3.75 3.75 1.83-1.83c0.39-0.39 0.39-1.02 0-1.41l-2.34-2.34c-0.2-0.2-0.45-0.29-0.71-0.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z" fill="#26D4C8"/>
                      </svg>
                      Specific Changes Made
                    </h4>
                    <ul className="changes-list">
                      {currentAnalysis.analysis?.specificChanges?.map((change, i) => (
                        <li key={i}>{change}</li>
                      )) || (
                        currentAnalysis.analysis?.improvementAreas?.map((area, i) => (
                          <li key={i}>{area}</li>
                        ))
                      )}
                    </ul>
                  </>
                )}
                
                {/* Analysis Tab */}
                {activeTab === 'analysis' && currentAnalysis && (
                  <>
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="#4CAF50"/>
                      </svg>
                      Strengths
                    </h4>
                    <ul>
                      {currentAnalysis.analysis?.strengths.map((strength, i) => (
                        <li key={i}>{strength}</li>
                      ))}
                    </ul>
                    
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="#F44336"/>
                      </svg>
                      Weaknesses
                    </h4>
                    <ul>
                      {currentAnalysis.analysis?.weaknesses.map((weakness, i) => (
                        <li key={i}>{weakness}</li>
                      ))}
                    </ul>
                    
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#FF9800"/>
                      </svg>
                      Improvement Areas
                    </h4>
                    <ul>
                      {currentAnalysis.analysis?.improvementAreas.map((area, i) => (
                        <li key={i}>{area}</li>
                      ))}
                    </ul>
                  </>
                )}
                
                {/* UX Analysis Tab */}
                {activeTab === 'uxanalysis' && currentAnalysis && (
                  <>
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14l-6-6z" fill="#26D4C8"/>
                      </svg>
                      Visual Hierarchy
                    </h4>
                    <div className="analysis-section">
                      <div className="analysis-subsection">
                        <h5>Issues</h5>
                        <ul>
                          {currentAnalysis.analysis?.visualHierarchy?.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="analysis-subsection">
                        <h5>Improvements</h5>
                        <ul>
                          {currentAnalysis.analysis?.visualHierarchy?.improvements.map((improvement, i) => (
                            <li key={i}>{improvement}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z" fill="#FF9800"/>
                        <path d="M12 17c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5z" fill="#FF9800"/>
                      </svg>
                      Color Contrast & Accessibility
                    </h4>
                    <div className="analysis-section">
                      <div className="analysis-subsection">
                        <h5>Issues</h5>
                        <ul>
                          {currentAnalysis.analysis?.colorContrast?.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="analysis-subsection">
                        <h5>Improvements</h5>
                        <ul>
                          {currentAnalysis.analysis?.colorContrast?.improvements.map((improvement, i) => (
                            <li key={i}>{improvement}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z" fill="#4CAF50"/>
                      </svg>
                      Component Selection & Placement
                    </h4>
                    <div className="analysis-section">
                      <div className="analysis-subsection">
                        <h5>Issues</h5>
                        <ul>
                          {currentAnalysis.analysis?.componentSelection?.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="analysis-subsection">
                        <h5>Improvements</h5>
                        <ul>
                          {currentAnalysis.analysis?.componentSelection?.improvements.map((improvement, i) => (
                            <li key={i}>{improvement}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z" fill="#03A9F4"/>
                      </svg>
                      Text Legibility
                    </h4>
                    <div className="analysis-section">
                      <div className="analysis-subsection">
                        <h5>Issues</h5>
                        <ul>
                          {currentAnalysis.analysis?.textLegibility?.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="analysis-subsection">
                        <h5>Improvements</h5>
                        <ul>
                          {currentAnalysis.analysis?.textLegibility?.improvements.map((improvement, i) => (
                            <li key={i}>{improvement}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42 2.89 2.87L15 21h6v-6zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#9C27B0"/>
                      </svg>
                      Overall Usability
                    </h4>
                    <div className="analysis-section">
                      <div className="analysis-subsection">
                        <h5>Issues</h5>
                        <ul>
                          {currentAnalysis.analysis?.usability?.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="analysis-subsection">
                        <h5>Improvements</h5>
                        <ul>
                          {currentAnalysis.analysis?.usability?.improvements.map((improvement, i) => (
                            <li key={i}>{improvement}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#607D8B"/>
                      </svg>
                      Accessibility Considerations
                    </h4>
                    <div className="analysis-section">
                      <div className="analysis-subsection">
                        <h5>Issues</h5>
                        <ul>
                          {currentAnalysis.analysis?.accessibility?.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="analysis-subsection">
                        <h5>Improvements</h5>
                        <ul>
                          {currentAnalysis.analysis?.accessibility?.improvements.map((improvement, i) => (
                            <li key={i}>{improvement}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Colors & Typography Tab */}
                {activeTab === 'colors' && currentAnalysis && (
                  <>
                    <h4>Color Palette</h4>
                    <div className="color-grid">
                      {currentAnalysis.analysis?.metadata?.colors?.primary?.map((color, i) => (
                        <div key={`p-${i}`} className="color-swatch" style={{ backgroundColor: color }}>
                          <span>{color}</span>
                        </div>
                      ))}
                      {currentAnalysis.analysis?.metadata?.colors?.secondary?.map((color, i) => (
                        <div key={`s-${i}`} className="color-swatch" style={{ backgroundColor: color }}>
                          <span>{color}</span>
                        </div>
                      ))}
                      {currentAnalysis.analysis?.metadata?.colors?.background?.map((color, i) => (
                        <div key={`b-${i}`} className="color-swatch" style={{ backgroundColor: color }}>
                          <span>{color}</span>
                        </div>
                      ))}
                    </div>
                    
                    <h4>Typography</h4>
                    <ul>
                      {currentAnalysis.analysis?.metadata?.fonts?.map((font, i) => (
                        <li key={i}>{font}</li>
                      ))}
                    </ul>
                    
                    <h4>Components</h4>
                    <ul>
                      {currentAnalysis.analysis?.metadata?.components?.map((component, i) => (
                        <li key={i}>{component}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <p>Select a design iteration to view analysis</p>
            )}
          </AnalysisPanelContent>
        </AnalysisPanel>
      </CanvasContainer>
      
      {/* Add the Prompt Dialog component */}
      <PromptDialog 
        visible={promptDialogVisible} 
        position={promptDialogPosition}
      >
        <PromptInput
          ref={promptInputRef}
          placeholder="How would you like to improve this design?"
          value={promptValue}
          onChange={(e) => setPromptValue(e.target.value)}
          onKeyDown={handlePromptKeyDown}
        />
        <PromptButtonContainer>
          <PromptButton className="cancel" onClick={closePromptDialog}>
            Cancel
          </PromptButton>
          <PromptButton className="apply" onClick={handlePromptSubmit}>
            Apply
          </PromptButton>
        </PromptButtonContainer>
      </PromptDialog>
      
      {/* Debug Controls - only in development mode */}
      {process.env.NODE_ENV === 'development' && <DebugControls />}
    </>
  );
}; 
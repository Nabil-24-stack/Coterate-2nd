import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { usePageContext } from '../contexts/PageContext';
import { useCursorContext } from '../contexts/CursorContext';
import { Design, DesignIteration, Page } from '../types';
import supabaseService from '../services/SupabaseService';
import openAIService from '../services/OpenAIService';
import HtmlDesignRenderer, { HtmlDesignRendererHandle } from './HtmlDesignRenderer';
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
const InfiniteCanvas = styled.div<{ scale: number; cursorMode: string }>`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: #767676;
  cursor: ${props => props.cursorMode === 'hand' ? 'grab' : 'default'};
  
  &:active {
    cursor: ${props => props.cursorMode === 'hand' ? 'grabbing' : 'default'};
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

// Marquee selection box
const MarqueeSelection = styled.div<{ 
  x: number; 
  y: number; 
  width: number; 
  height: number; 
  visible: boolean 
}>`
  position: absolute;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  width: ${props => props.width}px;
  height: ${props => props.height}px;
  border: 1px solid #26D4C8;
  background-color: rgba(38, 212, 200, 0.1);
  pointer-events: none;
  display: ${props => props.visible ? 'block' : 'none'};
  z-index: 1000;
`;


const SharedActionButtons = styled.div`
  position: absolute;
  display: flex;
  gap: 12px;
  background-color: #383838;
  padding: 8px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  justify-content: center;
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
const DesignCard = styled.div<{ isSelected: boolean; cursorMode: string }>`
  position: relative;
  border-radius: 8px;
  overflow: visible;
  box-shadow: ${props => props.isSelected 
    ? '0 0 0 2px #26D4C8, 0 4px 12px rgba(0, 0, 0, 0.15)' 
    : '0 4px 12px rgba(0, 0, 0, 0.08)'};
  background: white;
  cursor: ${props => {
    if (props.cursorMode === 'hand') return 'grab';
    return props.isSelected ? 'move' : 'pointer';
  }};
  
  &:hover {
    box-shadow: ${props => props.isSelected 
      ? '0 0 0 2px #26D4C8, 0 6px 16px rgba(0, 0, 0, 0.18)' 
      : '0 6px 16px rgba(0, 0, 0, 0.12)'};
  }
  
  &:active {
    cursor: ${props => {
      if (props.cursorMode === 'hand') return 'grabbing';
      return props.isSelected ? 'move' : 'pointer';
    }};
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
const ProcessingOverlay = styled.div<{ visible: boolean; step: 'analyzing' | 'recreating' | 'rendering' | 'reloading' | null }>`
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
          case 'reloading': return '50%';
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
const ProcessingSteps = ({ step }: { step: 'analyzing' | 'recreating' | 'rendering' | 'reloading' | null }) => {
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
  position: fixed;
  right: 0;
  top: 0;
  width: 400px;
  height: 100vh;
  background-color: #fff;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  z-index: 1002;
  transform: translateX(${props => props.visible ? 0 : '100%'});
  transition: transform 0.3s ease-in-out;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const AnalysisPanelHeader = styled.div`
  padding: 15px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
  
  button {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #555;
    padding: 0;
    margin: 0;
  }
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #eee;
`;

const Tab = styled.div<{ active: boolean }>`
  padding: 10px 15px;
  cursor: pointer;
  font-size: 14px;
  font-weight: ${props => props.active ? 600 : 400};
  color: ${props => props.active ? '#000' : '#666'};
  border-bottom: 2px solid ${props => props.active ? '#000' : 'transparent'};
  background-color: ${props => props.active ? 'rgba(0, 0, 0, 0.03)' : 'transparent'};
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
`;

const AnalysisPanelContent = styled.div`
  padding: 15px;
  overflow-y: auto;
  flex: 1;
  
  h4 {
    display: flex;
    align-items: center;
    font-size: 15px;
    margin-top: 20px;
    margin-bottom: 10px;
    font-weight: 600;
    
    svg {
      margin-right: 8px;
    }
  }
  
  ul {
    margin: 0;
    padding-left: 20px;
    
    li {
      margin-bottom: 8px;
      font-size: 14px;
      line-height: 1.5;
    }
  }
  
  .analysis-section {
    display: flex;
    flex-direction: column;
    margin-bottom: 20px;
    
    .analysis-subsection {
      flex: 1;
      margin-right: 10px;
      
      h5 {
        font-size: 14px;
        margin-top: 10px;
        margin-bottom: 5px;
        font-weight: 600;
      }
    }
  }
  
  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 10px;
    margin-bottom: 20px;
  }
  
  .color-swatch {
    width: 60px;
    height: 60px;
    border-radius: 4px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    position: relative;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    
    span {
      font-size: 10px;
      padding: 2px 4px;
      background-color: rgba(255, 255, 255, 0.8);
      border-radius: 2px;
      position: absolute;
      bottom: 4px;
    }
  }
  
  .comparison-container {
    margin-bottom: 20px;
    
    .comparison-title {
      font-weight: 600;
      margin-bottom: 10px;
      font-size: 15px;
    }
    
    .comparison-view {
      display: flex;
      gap: 15px;
      
      .comparison-half {
        flex: 1;
        
        .comparison-label {
          font-size: 12px;
          color: #666;
          margin-bottom: 5px;
        }
      }
    }
  }
  
  .prompt-container {
    margin-bottom: 20px;
    
    .user-prompt {
      background-color: #f9f9f9;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #eaeaea;
      
      p {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
        white-space: pre-wrap;
      }
    }
    
    .no-prompt {
      padding: 15px;
      color: #888;
      background-color: #f5f5f5;
      border-radius: 8px;
      text-align: center;
      
      p {
        margin: 0;
        font-size: 14px;
      }
    }
  }
  
  .result-container {
    margin-bottom: 20px;
    
    .result-actions {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 10px;
    }
    
    .reload-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background-color: #26D4C8;
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      color: #383838;
      transition: background-color 0.2s ease;
      
      &:hover {
        background-color: #1fb9ae;
      }
      
      &:active {
        background-color: #18a79d;
      }
      
      svg {
        width: 16px;
        height: 16px;
      }
    }
    
    .raw-response {
      background-color: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #eaeaea;
      white-space: pre-wrap;
      font-family: monospace;
      font-size: 13px;
      line-height: 1.6;
      max-height: calc(100vh - 150px);
      overflow-y: auto;
      word-break: break-word;
      color: #333;
      overflow-x: hidden;
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
  isReloading?: boolean;
  _reloadTimestamp?: number;
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
  
  // Log only if the message is different from the previous one with the same key
  log: (key: string, message: string, force: boolean = false) => {
    const prevMessage = LogManager.prevLogs.get(key);
    if (force || prevMessage !== message) {
      console.log(message);
      LogManager.prevLogs.set(key, message);
      return true;
    }
    return false;
  },
  
  // Clear all previous logs
  clear: () => {
    LogManager.prevLogs.clear();
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
const ActionButtonsContainer = styled.div<{ scale: number }>`
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%) scale(${props => 1 / props.scale});
  transform-origin: center bottom;
  display: flex;
  gap: 12px;
  background-color: #383838;
  padding: 8px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 20;
  opacity: 0;
  transition: opacity 0.2s ease;
  justify-content: center;
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
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
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
    // Removed min-width property
  }
`;

// New hover container with the action buttons
const DesignWithActionsContainer = styled.div`
  position: relative;
  
  &:hover ${ActionButtonsContainer} {
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
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
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

export const Canvas: React.FC = () => {
  const { currentPage, updatePage, loading } = usePageContext();
  const { effectiveCursorMode } = useCursorContext();
  
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
  
  // Selected design state - now supports multiple selections
  const [selectedDesignIds, setSelectedDesignIds] = useState<string[]>([]);
  const [isDesignDragging, setIsDesignDragging] = useState(false);
  const [designDragStart, setDesignDragStart] = useState({ x: 0, y: 0 });
  const [designInitialPosition, setDesignInitialPosition] = useState({ x: 0, y: 0 });

  // Helper functions for selection management
  const isDesignSelected = (designId: string) => selectedDesignIds.includes(designId);
  const selectDesign = (designId: string, multiSelect = false) => {
    if (multiSelect) {
      setSelectedDesignIds(prev => 
        prev.includes(designId) 
          ? prev.filter(id => id !== designId)
          : [...prev, designId]
      );
    } else {
      setSelectedDesignIds([designId]);
    }
  };
  const clearSelection = () => setSelectedDesignIds([]);
  const getSelectedDesign = () => {
    if (selectedDesignIds.length === 1) {
      return designs.find(d => d.id === selectedDesignIds[0]);
    }
    return null;
  };

  // Calculate position for shared action buttons
  const getSharedActionButtonsPosition = () => {
    if (selectedDesignIds.length === 0) return null;
    
    const selectedElements: HTMLElement[] = [];
    selectedDesignIds.forEach(id => {
      const element = getDesignRef(id);
      // Make sure element exists and is actually a DOM element with getBoundingClientRect
      if (element && typeof element.getBoundingClientRect === 'function') {
        selectedElements.push(element);
      }
    });
    
    if (selectedElements.length === 0) return null;
    
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return null;
    
    // Find the bounding box of all selected designs
    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;
    
    selectedElements.forEach(element => {
      try {
        const rect = element.getBoundingClientRect();
        const relativeRect = {
          left: rect.left - canvasRect.left,
          top: rect.top - canvasRect.top,
          right: rect.right - canvasRect.left,
          bottom: rect.bottom - canvasRect.top
        };
        
        minLeft = Math.min(minLeft, relativeRect.left);
        minTop = Math.min(minTop, relativeRect.top);
        maxRight = Math.max(maxRight, relativeRect.right);
        maxBottom = Math.max(maxBottom, relativeRect.bottom);
      } catch (error) {
        console.warn('Error getting bounding rect for element:', element, error);
      }
    });
    
    // Position the action buttons above the selection
    const centerX = (minLeft + maxRight) / 2;
    const topY = minTop - 50; // Position 50px above the top of the selection
    
    return {
      left: centerX - 60, // Center the buttons (assuming ~120px width)
      top: Math.max(10, topY) // Don't go above the canvas
    };
  };
  
  // Marquee selection state
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 });
  const [marqueeEnd, setMarqueeEnd] = useState({ x: 0, y: 0 });
  
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
  
  // Find the selected design (only works with single selection)
  const selectedDesign = getSelectedDesign();
  
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
    const panSensitivity = 1.5; // Adjust sensitivity of panning
    
    // Allow zooming if (Cmd+Ctrl) or (pinch gesture: ctrlKey only)
    const isZoomGesture = (e.metaKey && e.ctrlKey) || (e.ctrlKey && !e.metaKey);
    if (isZoomGesture) {
      // ZOOMING BEHAVIOR
      let newScale = scale;
      
      if (e.deltaY < 0) {
        newScale = Math.min(scale * (1 + zoomSensitivity), maxScale);
      } else {
        newScale = Math.max(scale * (1 - zoomSensitivity), minScale);
      }
      
      const canvasElement = canvasRef.current;
      if (!canvasElement) return;
      const rect = canvasElement.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const originX = mouseX / scale - position.x / scale;
      const originY = mouseY / scale - position.y / scale;
      const newPositionX = mouseX - originX * newScale;
      const newPositionY = mouseY - originY * newScale;
      setScale(newScale);
      setPosition({ x: newPositionX, y: newPositionY });
      if (currentPage?.id) {
        saveCanvasPosition(currentPage.id, { x: newPositionX, y: newPositionY }, newScale);
      }
    } else {
      // SCROLLING/PANNING BEHAVIOR
      const deltaX = e.deltaX * panSensitivity;
      const deltaY = e.deltaY * panSensitivity;
      const newPosition = {
        x: position.x - deltaX,
        y: position.y - deltaY,
      };
      setPosition(newPosition);
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
    
    // Deselect designs when clicking on empty canvas (only for left clicks)
    if (e.button === 0) {
      clearSelection();
    }
    
    // Handle canvas panning in hand mode OR when middle mouse button is pressed
    if (effectiveCursorMode === 'hand' || e.button === 1) {
      e.preventDefault(); // Prevent default middle-click behavior
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
    // Handle marquee selection in pointer mode with left click
    else if (effectiveCursorMode === 'pointer' && e.button === 0) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (canvasRect) {
        const startX = e.clientX - canvasRect.left;
        const startY = e.clientY - canvasRect.top;
        
        setIsMarqueeSelecting(true);
        setMarqueeStart({ x: startX, y: startY });
        setMarqueeEnd({ x: startX, y: startY });
      }
    }
  };
  
  // Handle mouse move for panning and design dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    // Only allow dragging if exactly one design is selected
    if (isDesignDragging && selectedDesignIds.length === 1) {
      const draggedDesignId = selectedDesignIds[0];
      // Calculate the delta in screen coordinates
      const deltaX = e.clientX - designDragStart.x;
      const deltaY = e.clientY - designDragStart.y;
      
      // Convert the delta to canvas coordinates by dividing by the scale
      const deltaCanvasX = deltaX / scale;
      const deltaCanvasY = deltaY / scale;

      // Determine if the selected item is a design or an iteration
      const isIteration = designs.some(design => 
        design.iterations?.some(iteration => iteration.id === draggedDesignId)
      );
      
      if (isIteration) {
        // Update iteration position with immutable state update
        setDesigns(prevDesigns => 
          prevDesigns.map(design => {
            if (!design.iterations) return design;
            
            const updatedIterations = design.iterations.map(iteration => 
              iteration.id === draggedDesignId
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
            design.id === draggedDesignId
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
    
    // Handle marquee selection dragging
    if (isMarqueeSelecting) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (canvasRect) {
        const currentX = e.clientX - canvasRect.left;
        const currentY = e.clientY - canvasRect.top;
        
        setMarqueeEnd({ x: currentX, y: currentY });
      }
    }
  };
  
  // Handle click on a design
  const handleDesignClick = (e: React.MouseEvent, designId: string) => {
    e.stopPropagation();
    
    // Set the selected design ID
    selectDesign(designId);
    
    // Note: We no longer automatically open the analysis panel for iterations
    // as we've moved that functionality to the View Analysis button
  };
  
  // Add the handleDesignMouseDown function back
  const handleDesignMouseDown = (e: React.MouseEvent, designId: string) => {
    // Handle middle mouse button for canvas panning even on designs
    if (e.button === 1) {
      e.preventDefault(); // Prevent default middle-click behavior
      e.stopPropagation(); // Stop propagation to allow canvas panning
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
      return;
    }
    
    // In hand mode, prioritize canvas panning over design interaction
    if (effectiveCursorMode === 'hand') {
      // Only select the design but don't prevent canvas panning
      selectDesign(designId);
      return;
    }
    
    // In pointer mode, handle design selection and dragging
    if (effectiveCursorMode === 'pointer') {
      // If we already have a design selected, just focus on this one
      if (selectedDesignIds.length > 0) {
        selectDesign(designId);
        
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
    }
  };
  
  // State for prompt dialog
  const [promptDialogVisible, setPromptDialogVisible] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [promptDialogPosition, setPromptDialogPosition] = useState({ x: 0, y: 0 });
  const [designIdForPrompt, setDesignIdForPrompt] = useState<string | null>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);
  
  // Function to open the prompt dialog
  const openPromptDialog = (e: React.MouseEvent, designId: string) => {
    e.stopPropagation(); // Prevent propagation to avoid selecting/deselecting
    
    // Get the position of the clicked button to position the dialog next to it
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
  
  // Function to process the actual iteration based on the design ID and prompt
  const processIteration = async (designId: string, prompt: string) => {
    LogManager.log('iteration-request', `Iteration requested for design: ${designId} with prompt: ${prompt || 'none'}`, true);
    
    // First determine if the selected ID is for a base design or an iteration
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
      return;
    }
    
    // Check if OpenAI API key is available
    if (!openAIService.hasApiKey()) {
      alert('OpenAI API key is not configured. Please set it in your environment variables.');
      return;
    }

    // Get research notes from localStorage for the current page
    const getResearchNotes = () => {
      if (!currentPage) return '';
      const notesKey = `coterate_notes_${currentPage.id}`;
      return localStorage.getItem(notesKey) || '';
    };

    // Format research notes as linkedInsights for the AI
    const formatResearchInsights = (notes: string) => {
      if (!notes.trim()) return [];
      
      return [{
        type: 'research_notes',
        content: notes,
        summary: notes.length > 200 ? notes.substring(0, 200) + '...' : notes,
        priority: 'high' // Research notes should have high priority
      }];
    };

    const researchNotes = getResearchNotes();
    const linkedInsights = formatResearchInsights(researchNotes);
    
    if (linkedInsights.length > 0) {
      LogManager.log('research-integration', `Found research notes for page ${currentPage?.id}: ${researchNotes.substring(0, 100)}...`, true);
    } else {
      LogManager.log('research-integration', `No research notes found for page ${currentPage?.id}`, true);
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
      // Get the original dimensions depending on whether we have an original or iteration
      let originalDimensions;
      let sourceImageUrl: string;
      
      if (isIteration) {
        // For iterations, we use the dimensions from the iteration
        originalDimensions = (designToIterate as DesignIteration).dimensions || 
          { width: 400, height: 320 }; // Reduced from 500x400
        
        // For an iteration, we need to use the parent design's image URL
        if (parentDesign && parentDesign.imageUrl) {
          sourceImageUrl = parentDesign.imageUrl;
        } else {
          throw new Error('Cannot find parent design for iteration');
        }
      } else {
        // For base designs, we use the imageUrl
        sourceImageUrl = (designToIterate as Design).imageUrl;
        originalDimensions = await getImageDimensions(sourceImageUrl);
        LogManager.log('image-dimensions', `Original image dimensions: ${originalDimensions.width}x${originalDimensions.height}`);
      }
      
      // Update the processing step to show "AI Analyzing Design"
      setDesigns(prevDesigns => 
        prevDesigns.map(design => {
          if (design.id === designId) {
            // If it's a base design
            return { ...design, processingStep: 'analyzing' };
          } else if (design.iterations) {
            // Check if the designId matches any of this design's iterations
            const updatedIterations = design.iterations.map(iteration => 
              iteration.id === designId
                ? { ...iteration, processingStep: 'analyzing' }
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
      
      // Step 1: AI Analysis - Call OpenAI service to analyze the design according to PRD 2.4.2
      let result;
      if (isIteration) {
        // For iterations, we need to call a specialized method that can analyze HTML/CSS
        // For now, we'll use the same method with the parent's image URL
        // This is a temporary solution until we implement proper HTML/CSS analysis
        result = await openAIService.analyzeDesignAndGenerateHTML(sourceImageUrl, prompt, linkedInsights);
      } else {
        // For base designs, we use the existing method with the image URL
        result = await openAIService.analyzeDesignAndGenerateHTML(sourceImageUrl, prompt, linkedInsights);
      }
      
      // Update the processing step to "Generating Improved Design"
      setDesigns(prevDesigns => 
        prevDesigns.map(design => {
          if (design.id === designId) {
            // If it's a base design
            return { ...design, processingStep: 'recreating' };
          } else if (design.iterations) {
            // Check if the designId matches any of this design's iterations
            const updatedIterations = design.iterations.map(iteration => 
              iteration.id === designId
                ? { ...iteration, processingStep: 'recreating' }
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
      
      // Generate a unique ID for the iteration
      const iterationId = crypto.randomUUID();
      
      // Calculate the position for the new iteration (positioned to the right of the original)
      const xOffset = originalDimensions?.width || 400;
      const marginBetween = 50;
      
      // Get the position of the design we're iterating on
      const designPosition = isIteration
        ? (designToIterate as DesignIteration).position
        : (designToIterate as Design).position;
      
      const iterationPosition = {
        x: designPosition.x + xOffset + marginBetween,
        y: designPosition.y
      };
      
      // Create the new iteration with enhanced analysis data according to PRD 2.4.4
      const newIteration: DesignIteration = {
        id: iterationId,
        parentId: isIteration ? (designToIterate as DesignIteration).parentId : designId,
        htmlContent: result.htmlCode,
        cssContent: result.cssCode,
        position: iterationPosition, // Store absolute position instead of relative
        analysis: {
          strengths: result.analysis.strengths,
          weaknesses: result.analysis.weaknesses,
          improvementAreas: result.analysis.improvementAreas,
          specificChanges: result.analysis.specificChanges,
          // Add the enhanced UX analysis categories
          visualHierarchy: {
            issues: result.analysis.visualHierarchy?.issues || [],
            improvements: result.analysis.visualHierarchy?.improvements || []
          },
          colorContrast: {
            issues: result.analysis.colorContrast?.issues || [],
            improvements: result.analysis.colorContrast?.improvements || []
          },
          componentSelection: {
            issues: result.analysis.componentSelection?.issues || [],
            improvements: result.analysis.componentSelection?.improvements || []
          },
          textLegibility: {
            issues: result.analysis.textLegibility?.issues || [],
            improvements: result.analysis.textLegibility?.improvements || []
          },
          usability: {
            issues: result.analysis.usability?.issues || [],
            improvements: result.analysis.usability?.improvements || []
          },
          accessibility: {
            issues: result.analysis.accessibility?.issues || [],
            improvements: result.analysis.accessibility?.improvements || []
          },
          metadata: {
            colors: result.metadata.colors,
            fonts: result.metadata.fonts,
            components: result.metadata.components
          },
          rawResponse: result.analysis.rawResponse, // Store the raw GPT-4.1 response
          userPrompt: prompt, // Store the user's prompt input
          researchInsightsApplied: linkedInsights.length > 0 ? linkedInsights.map(insight => insight.content || insight.summary) : undefined // Track which research insights were used
        },
        dimensions: originalDimensions, // Add the original dimensions to the iteration
        created_at: new Date().toISOString()
      };
      
      // Update the processing step
      setDesigns(prevDesigns => 
        prevDesigns.map(design => {
          if (design.id === designId) {
            // If it's a base design
            return { ...design, processingStep: 'rendering' };
          } else if (design.iterations) {
            // Check if the designId matches any of this design's iterations
            const updatedIterations = design.iterations.map(iteration => 
              iteration.id === designId
                ? { ...iteration, processingStep: 'rendering' }
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
      
      // Short delay to show the rendering step
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update designs with a properly immutable state update
      setDesigns(prevDesigns => {
        return prevDesigns.map(design => {
          if (isIteration) {
            // If we're iterating on an iteration, add the new iteration to its parent
            if (design.iterations?.some(it => it.id === designId)) {
              // Create or append to iterations array
              const existingIterations = design.iterations || [];
              
              // Reset the processing state on the iteration that was clicked
              const updatedExistingIterations = existingIterations.map(it => 
                it.id === designId 
                  ? { ...it, isProcessing: false, processingStep: null } 
                  : it
              );
              
              const updatedIterations = [...updatedExistingIterations, newIteration];
              
              // Return the updated design with a new iterations array
              return {
                ...design,
                iterations: updatedIterations
              };
            }
          } else if (design.id === designId) {
            // If we're iterating on a base design
            // Create or append to iterations array
            const existingIterations = design.iterations || [];
            const updatedIterations = [...existingIterations, newIteration];
            
            // Return the updated design with a new iterations array and reset the processing flag
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
      
      // In a simple localStorage-only version, we don't need to persist to any database
      // as the state changes will trigger our effect that saves to localStorage
      console.log('Iteration stored in local state only, will be saved to localStorage');
      
      // Set the current analysis to show the analysis panel
      setCurrentAnalysis(newIteration);
      setAnalysisVisible(true);
    } catch (error) {
      console.error('Error generating iteration:', error);
      
      // Reset the processing state on error
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
      
      // Show an error message
      alert('Error generating iteration: ' + (error as Error).message);
    }
  };

  // Modify the handleIterationClick function to use the prompt dialog
  const handleIterationClick = (e: React.MouseEvent, designId: string) => {
    openPromptDialog(e, designId);
  };

  // Add a helper function to get image dimensions
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
        reject(err);
      };
      img.src = src;
    });
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

  // Function to handle image paste
  const handleImagePaste = async (file: File) => {
    try {
      console.log('Image paste detected:', file.type, file.size);
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please paste a valid image file.');
        return;
      }
      
      // Check file size (limit to 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert('Image file is too large. Please use an image smaller than 10MB.');
        return;
      }
      
      // Convert file to data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result && typeof e.target.result === 'string') {
            resolve(e.target.result);
          } else {
            reject(new Error('Failed to read file as data URL'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      
      // Get image dimensions
      const dimensions = await getImageDimensions(dataUrl);
      
      // Calculate display dimensions (scale down if too large)
      const maxDisplayWidth = 600;
      const maxDisplayHeight = 600;
      let displayWidth = dimensions.width;
      let displayHeight = dimensions.height;
      
      if (displayWidth > maxDisplayWidth || displayHeight > maxDisplayHeight) {
        const widthRatio = maxDisplayWidth / displayWidth;
        const heightRatio = maxDisplayHeight / displayHeight;
        const ratio = Math.min(widthRatio, heightRatio);
        
        displayWidth = Math.round(displayWidth * ratio);
        displayHeight = Math.round(displayHeight * ratio);
      }
      
      // Create a new design object from the pasted image
      const designId = crypto.randomUUID();
      const newDesign: Design = {
        id: designId,
        imageUrl: dataUrl,
        position: { x: 0, y: 0 }, // Center position
        dimensions: { width: displayWidth, height: displayHeight },
        isFromFigma: false, // Mark as not from Figma
      };
      
      // Add the design to the canvas
      setDesigns(prev => [...prev, newDesign]);
      
      // Select the newly added design
      selectDesign(designId);
      
      console.log('Image design created:', newDesign);
      
    } catch (error) {
      console.error('Error handling image paste:', error);
      alert('Failed to paste image. Please try again.');
    }
  };
  
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
      const panSensitivity = 1.5; // Adjust sensitivity of panning
      
      // Allow zooming if (Cmd+Ctrl) or (pinch gesture: ctrlKey only)
      const isZoomGesture = (e.metaKey && e.ctrlKey) || (e.ctrlKey && !e.metaKey);
      if (isZoomGesture) {
        // ZOOMING BEHAVIOR
        let newScale = scale;
        if (e.deltaY < 0) {
          newScale = Math.min(scale * (1 + zoomSensitivity), maxScale);
        } else {
          newScale = Math.max(scale * (1 - zoomSensitivity), minScale);
        }
        const rect = canvasElement.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const originX = mouseX / scale - position.x / scale;
        const originY = mouseY / scale - position.y / scale;
        const newPositionX = mouseX - originX * newScale;
        const newPositionY = mouseY - originY * newScale;
        setScale(newScale);
        setPosition({ x: newPositionX, y: newPositionY });
        if (currentPage?.id) {
          saveCanvasPosition(currentPage.id, { x: newPositionX, y: newPositionY }, newScale);
        }
      } else {
        // SCROLLING/PANNING BEHAVIOR
        const deltaX = e.deltaX * panSensitivity;
        const deltaY = e.deltaY * panSensitivity;
        const newPosition = {
          x: position.x - deltaX,
          y: position.y - deltaY,
        };
        setPosition(newPosition);
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
      
      // Delete/Backspace: Remove selected designs
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDesignIds.length > 0) {
        setDesigns(prevDesigns => prevDesigns.filter(d => !selectedDesignIds.includes(d.id)));
        clearSelection();
      }
      
      // Escape: Deselect designs
      if (e.key === 'Escape' && selectedDesignIds.length > 0) {
        clearSelection();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedDesignIds]);
  
  // Add state for active tab
  const [activeTab, setActiveTab] = useState<'prompt' | 'result'>('prompt');
  
  // Update the render part to include the processing overlay with steps
  const renderDesign = (design: ExtendedDesign) => {
    return (
      <DesignWithActionsContainer key={design.id}>
        <DesignCard 
          ref={(el: HTMLDivElement | null) => {
            if (el) {
              designRefs.current[design.id] = el;
            }
          }}
          isSelected={isDesignSelected(design.id)}
          cursorMode={effectiveCursorMode}
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
        <ActionButtonsContainer scale={scale}>
          <ActionButton className="secondary" onMouseDown={(e) => {
            e.stopPropagation();
            // Select the design if not already selected
            if (!isDesignSelected(design.id)) {
              selectDesign(design.id);
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
            View Analysis
          </ActionButton>
          <ActionButton>
            <RetryIcon />
            Retry
          </ActionButton>
          <ActionButton className="primary" onClick={(e) => handleIterationClick(e, design.id)}>
            <IterateIcon />
            Iterate
          </ActionButton>
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
              isSelected={isDesignSelected(iteration.id)}
              cursorMode={effectiveCursorMode}
              onClick={(e) => handleDesignClick(e, iteration.id)}
              onMouseDown={(e) => handleDesignMouseDown(e, iteration.id)}
              style={{ cursor: isDesignSelected(iteration.id) ? 'move' : 'pointer' }}
            >
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
                  if (success && !renderedIterationsRef.current.has(iteration.id)) {
                    LogManager.log(`iteration-${iteration.id}`, `Iteration ${iteration.id} rendered successfully: ${success}`);
                    renderedIterationsRef.current.add(iteration.id);
                  }
                }}
                key={iteration._reloadTimestamp || iteration.id} // Force re-mount on reload
              />
              
              {/* Add processing overlay for iterations */}
              <ProcessingOverlay 
                visible={!!iteration.isProcessing || !!iteration.isReloading} 
                step={iteration.isReloading ? 'reloading' : iteration.processingStep || null}
              >
                <Spinner />
                <h3>
                  {iteration.processingStep === 'analyzing' && 'Analyzing Design'}
                  {iteration.processingStep === 'recreating' && 'Generating Improved Design'}
                  {iteration.processingStep === 'rendering' && 'Finalizing Design'}
                  {iteration.isReloading && 'Rebuilding Design'}
                </h3>
                <p>
                  {iteration.processingStep === 'analyzing' && 'AI is analyzing your design for visual hierarchy, contrast, and usability...'}
                  {iteration.processingStep === 'recreating' && 'Creating an improved version based on analysis...'}
                  {iteration.processingStep === 'rendering' && 'Preparing to display your improved design...'}
                  {iteration.isReloading && 'Rebuilding design from raw response data...'}
                </p>
                {!iteration.isReloading && <ProcessingSteps step={iteration.processingStep || null} />}
                <div className="progress-bar">
                  <div className="progress"></div>
                </div>
                <div className="step-description">
                  {iteration.processingStep === 'analyzing' && 'Identifying areas for improvement in your design...'}
                  {iteration.processingStep === 'recreating' && 'Applying improvements to visual hierarchy, contrast, and components...'}
                  {iteration.processingStep === 'rendering' && 'Final touches and optimizations...'}
                  {iteration.isReloading && 'Extracting and applying HTML and CSS from raw response...'}
                </div>
              </ProcessingOverlay>
            </IterationDesignCard>
          </div>
          
          {/* New action buttons component */}
          <ActionButtonsContainer scale={scale}>
            <ActionButton className="secondary" onMouseDown={(e) => {
              e.stopPropagation();
              // Select the design if not already selected
              if (!isDesignSelected(iteration.id)) {
                selectDesign(iteration.id);
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
              View Analysis
            </ActionButton>
            <ActionButton>
              <RetryIcon />
              Retry
            </ActionButton>
            <ActionButton className="primary" onClick={(e) => handleIterationClick(e, iteration.id)}>
              <IterateIcon />
              Iterate
            </ActionButton>
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
    if (isDesignDragging && selectedDesignIds.length === 1) {
      // Position is already saved in the designs state, no extra save needed
      console.log(`Design dragging ended for design: ${selectedDesignIds[0]}`);
    }
    
    // End marquee selection
    if (isMarqueeSelecting) {
      setIsMarqueeSelecting(false);
      
      // Find designs within the marquee selection area
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (canvasRect) {
        const marqueeRect = {
          left: Math.min(marqueeStart.x, marqueeEnd.x),
          top: Math.min(marqueeStart.y, marqueeEnd.y),
          right: Math.max(marqueeStart.x, marqueeEnd.x),
          bottom: Math.max(marqueeStart.y, marqueeEnd.y)
        };
        
        const selectedIds: string[] = [];
        
        // Check all designs and their iterations
        designs.forEach(design => {
          // Check the main design
          const designElement = getDesignRef(design.id);
          if (designElement && typeof designElement.getBoundingClientRect === 'function') {
            try {
              const designRect = designElement.getBoundingClientRect();
              const relativeRect = {
                left: designRect.left - canvasRect.left,
                top: designRect.top - canvasRect.top,
                right: designRect.right - canvasRect.left,
                bottom: designRect.bottom - canvasRect.top
              };
              
              // Check if design intersects with marquee
              if (relativeRect.left < marqueeRect.right && relativeRect.right > marqueeRect.left &&
                  relativeRect.top < marqueeRect.bottom && relativeRect.bottom > marqueeRect.top) {
                selectedIds.push(design.id);
              }
            } catch (error) {
              console.warn('Error getting bounding rect for design:', design.id, error);
            }
          }
          
          // Check iterations
          if (design.iterations) {
            design.iterations.forEach(iteration => {
              const iterationElement = getDesignRef(iteration.id);
              if (iterationElement && typeof iterationElement.getBoundingClientRect === 'function') {
                try {
                  const iterationRect = iterationElement.getBoundingClientRect();
                  const relativeRect = {
                    left: iterationRect.left - canvasRect.left,
                    top: iterationRect.top - canvasRect.top,
                    right: iterationRect.right - canvasRect.left,
                    bottom: iterationRect.bottom - canvasRect.top
                  };
                  
                  // Check if iteration intersects with marquee
                  if (relativeRect.left < marqueeRect.right && relativeRect.right > marqueeRect.left &&
                      relativeRect.top < marqueeRect.bottom && relativeRect.bottom > marqueeRect.top) {
                    selectedIds.push(iteration.id);
                  }
                } catch (error) {
                  console.warn('Error getting bounding rect for iteration:', iteration.id, error);
                }
              }
            });
          }
        });
        
        setSelectedDesignIds(selectedIds);
      }
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

  // Function to handle reloading a design from the raw response
  const handleReloadFromRawResponse = async (iteration: DesignIteration) => {
    if (!iteration.analysis?.rawResponse) {
      alert('No raw response data available to reload from.');
      return;
    }
    
    try {
      // Set loading state for this specific iteration
      setDesigns(prevDesigns => 
        prevDesigns.map(design => {
          if (!design.iterations) return design;
          
          const updatedIterations = design.iterations.map(it => 
            it.id === iteration.id
              ? { ...it, isReloading: true }
              : it
          );
          
          if (updatedIterations.some((it, idx) => it !== design.iterations![idx])) {
            return { ...design, iterations: updatedIterations };
          }
          return design;
        })
      );
      
      // Close the analysis panel to show the loading state
      setAnalysisVisible(false);
      
      // Parse the raw response to extract HTML and CSS
      console.log('Parsing raw response for reload...');
      const parsedResponse = openAIService.parseRawResponse(iteration.analysis.rawResponse);
      
      if (!parsedResponse.htmlCode && !parsedResponse.cssCode) {
        alert('Could not extract valid HTML or CSS from the raw response.');
        // Reset loading state
        setDesigns(prevDesigns => 
          prevDesigns.map(design => {
            if (!design.iterations) return design;
            
            const updatedIterations = design.iterations.map(it => 
              it.id === iteration.id
                ? { ...it, isReloading: false }
                : it
            );
            
            if (updatedIterations.some((it, idx) => it !== design.iterations![idx])) {
              return { ...design, iterations: updatedIterations };
            }
            return design;
          })
        );
        return;
      }

      console.log('Extracted HTML and CSS:', {
        htmlLength: parsedResponse.htmlCode.length,
        cssLength: parsedResponse.cssCode.length
      });
      
      // Add a slight delay to ensure loading state is visible
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update the designs state with the newly parsed HTML/CSS
      setDesigns(prevDesigns => 
        prevDesigns.map(design => {
          if (!design.iterations) return design;
          
          const updatedIterations = design.iterations.map(it => 
            it.id === iteration.id
              ? {
                  ...it,
                  htmlContent: parsedResponse.htmlCode,
                  cssContent: parsedResponse.cssCode,
                  isReloaded: true,
                  isReloading: false,
                  // Force a re-render by adding a timestamp
                  _reloadTimestamp: Date.now()
                }
              : it
          );
          
          // Only return a new design if any iterations were updated
          if (updatedIterations.some((it, idx) => it !== design.iterations![idx])) {
            return { ...design, iterations: updatedIterations };
          }
          
          return design;
        })
      );
      
      // Find the HTML renderer for this iteration and completely rebuild it
      const designRef = getDesignRef(iteration.id);
      if (designRef && 'refreshContent' in designRef) {
        console.log('Refreshing HTML content in iframe...');
        // Force a complete refresh of the iframe content
        setTimeout(() => {
          (designRef as any).refreshContent();
          
          // After the component refreshes, show success message
          setTimeout(() => {
            alert('Design has been reloaded from the raw response.');
          }, 500);
        }, 100); // Small delay to ensure state update completes
      } else {
        console.warn('Could not find HTML renderer reference for iteration:', iteration.id);
        alert('Design has been reloaded from the raw response.');
      }
    } catch (error) {
      console.error('Error reloading from raw response:', error);
      alert(`Failed to reload design: ${(error as Error).message}`);
      
      // Reset loading state on error
      setDesigns(prevDesigns => 
        prevDesigns.map(design => {
          if (!design.iterations) return design;
          
          const updatedIterations = design.iterations.map(it => 
            it.id === iteration.id
              ? { ...it, isReloading: false }
              : it
          );
          
          if (updatedIterations.some((it, idx) => it !== design.iterations![idx])) {
            return { ...design, iterations: updatedIterations };
          }
          return design;
        })
      );
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
      
      // Check if there are files (images) in the clipboard
      const clipboardItems = event.clipboardData?.items;
      let hasImage = false;
      
      if (clipboardItems) {
        for (let i = 0; i < clipboardItems.length; i++) {
          const item = clipboardItems[i];
          if (item.type.indexOf('image') !== -1) {
            hasImage = true;
            // Handle image paste
            const file = item.getAsFile();
            if (file) {
              handleImagePaste(file);
              event.preventDefault();
              return;
            }
          }
        }
      }
      
      // If no image found, proceed with existing Figma link logic
      if (!hasImage && isFigmaSelectionLink(clipboardText)) {
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
            cursorMode={effectiveCursorMode}
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
                  <h2>Paste a UI for iteration</h2>
                  <p>Copy a Figma frame selection (Command+L) or paste any UI image</p>
                </EmptyCanvasMessage>
              )}
            </CanvasContent>
          </InfiniteCanvas>
        )}
        
        {/* Marquee Selection Box */}
        <MarqueeSelection
          x={Math.min(marqueeStart.x, marqueeEnd.x)}
          y={Math.min(marqueeStart.y, marqueeEnd.y)}
          width={Math.abs(marqueeEnd.x - marqueeStart.x)}
          height={Math.abs(marqueeEnd.y - marqueeStart.y)}
          visible={isMarqueeSelecting}
        />
        
        {/* Shared Action Buttons for Multiple Selected Designs */}
        {selectedDesignIds.length > 0 && (() => {
          const buttonPosition = getSharedActionButtonsPosition();
          return buttonPosition ? (
            <SharedActionButtons
              style={{
                left: buttonPosition.left,
                top: buttonPosition.top
              }}
            >
              <ActionButton
                className="secondary"
                onMouseDown={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  // Start dragging (only works if exactly one is selected)
                  if (selectedDesignIds.length === 1) {
                    const designId = selectedDesignIds[0];
                    setIsDesignDragging(true);
                    setDesignDragStart({
                      x: e.clientX,
                      y: e.clientY
                    });
                    
                    // Find the design/iteration to get its initial position
                    let initialPosition = { x: 0, y: 0 };
                    const design = designs.find(d => d.id === designId);
                    if (design) {
                      initialPosition = design.position;
                    } else {
                      // Check if it's an iteration
                      for (const d of designs) {
                        if (d.iterations) {
                          const iteration = d.iterations.find(it => it.id === designId);
                          if (iteration) {
                            initialPosition = iteration.position;
                            break;
                          }
                        }
                      }
                    }
                    setDesignInitialPosition(initialPosition);
                  }
                }}
                title={selectedDesignIds.length === 1 ? "Drag" : "Drag (only available for single selection)"}
                style={{ 
                  opacity: selectedDesignIds.length === 1 ? 1 : 0.5,
                  cursor: selectedDesignIds.length === 1 ? 'pointer' : 'not-allowed'
                }}
              >
                <DragHandleIcon />
                Drag
              </ActionButton>

              <ActionButton
                className="analysis"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  // View analysis for the first selected design
                  if (selectedDesignIds.length > 0) {
                    const firstDesignId = selectedDesignIds[0];
                    let analysisData: DesignIteration | null = null;
                    
                    // Check if it's a main design
                    const design = designs.find(d => d.id === firstDesignId);
                    if (design) {
                      analysisData = {
                        id: design.id,
                        parentId: '',
                        htmlContent: design.htmlContent || '',
                        cssContent: design.cssContent || '',
                        analysis: {
                          strengths: [],
                          weaknesses: [],
                          improvementAreas: []
                        },
                        position: design.position,
                        dimensions: design.dimensions,
                        imageUrl: design.imageUrl
                      } as DesignIteration;
                    } else {
                      // Check if it's an iteration
                      for (const d of designs) {
                        if (d.iterations) {
                          const iteration = d.iterations.find(it => it.id === firstDesignId);
                          if (iteration) {
                            analysisData = iteration;
                            break;
                          }
                        }
                      }
                    }
                    
                    if (analysisData) {
                      setCurrentAnalysis(analysisData);
                      setAnalysisVisible(true);
                    }
                  }
                }}
                title={selectedDesignIds.length === 1 ? "View Analysis" : `View Analysis (${selectedDesignIds.length} selected, showing first)`}
              >
                <ViewIcon />
                View Analysis
              </ActionButton>

              <ActionButton
                className="secondary"
                onClick={() => {
                  // Retry functionality - could be adapted for multiple designs
                  console.log('Retry action for selected designs:', selectedDesignIds);
                  // Add retry logic here when implemented
                }}
                title="Retry"
              >
                <RetryIcon />
                Retry
              </ActionButton>
              
              <ActionButton
                className="primary"
                onClick={() => {
                  // Iterate all selected designs
                  selectedDesignIds.forEach(id => {
                    const e = { stopPropagation: () => {} } as React.MouseEvent;
                    openPromptDialog(e, id);
                  });
                }}
                title="Iterate"
              >
                <IterateIcon />
                Iterate
              </ActionButton>
            </SharedActionButtons>
          ) : null;
        })()}
        
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
              active={activeTab === 'prompt'} 
              onClick={() => setActiveTab('prompt')}
            >
              Prompt
            </Tab>
            <Tab 
              active={activeTab === 'result'} 
              onClick={() => setActiveTab('result')}
            >
              Result
            </Tab>
          </TabContainer>
          
          <AnalysisPanelContent>
            {currentAnalysis ? (
              <>
                {/* Prompt Tab */}
                {activeTab === 'prompt' && currentAnalysis && (
                  <>
                    <div className="prompt-container">
                      {currentAnalysis.analysis?.userPrompt ? (
                        <div className="user-prompt">
                          <p>{currentAnalysis.analysis.userPrompt}</p>
                        </div>
                      ) : (
                        <div className="no-prompt">
                          <p>No prompt</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                {/* Result Tab */}
                {activeTab === 'result' && currentAnalysis && (
                  <>
                    <div className="result-container">
                      <div className="result-actions">
                        <button 
                          className="reload-button" 
                          onClick={() => handleReloadFromRawResponse(currentAnalysis)}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13.65 2.35C12.2 0.9 10.21 0 8 0C3.58 0 0 3.58 0 8C0 12.42 3.58 16 8 16C11.73 16 14.84 13.45 15.74 10H13.65C12.83 12.33 10.61 14 8 14C4.69 14 2 11.31 2 8C2 4.69 4.69 2 8 2C9.66 2 11.14 2.69 12.22 3.78L9 7H16V0L13.65 2.35Z" fill="currentColor"/>
                          </svg>
                          Reload Design
                        </button>
                      </div>
                      {currentAnalysis.analysis?.rawResponse ? (
                        <pre className="raw-response">
                          {currentAnalysis.analysis.rawResponse}
                        </pre>
                      ) : (
                        <p>No response data available</p>
                      )}
                    </div>
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
    </>
  );
}; 
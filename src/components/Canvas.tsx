import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { usePageContext } from '../contexts/PageContext';
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
  background-color: #DBDBDB;
  overflow: hidden;
`;

// The infinite canvas with grid background
const InfiniteCanvas = styled.div<{ scale: number }>`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: #DBDBDB;
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
    ? '0 0 0 2px #4f46e5, 0 4px 12px rgba(0, 0, 0, 0.15)' 
    : '0 4px 12px rgba(0, 0, 0, 0.08)'};
  background: white;
  transition: box-shadow 0.2s ease-in-out;
  cursor: ${props => props.isSelected ? 'move' : 'pointer'};
  
  &:hover {
    box-shadow: ${props => props.isSelected 
      ? '0 0 0 2px #4f46e5, 0 6px 16px rgba(0, 0, 0, 0.18)' 
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
  background-color: #007bff;
  color: white;
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
    background-color: #0069d9;
    transform: translateY(-50%) scale(1.05);
  }
  
  &:active {
    background-color: #0062cc;
    transform: translateY(-50%) scale(0.95);
  }
`;

// SVG Plus icon for perfect centering
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2V14" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <path d="M2 8H14" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Empty state message
const EmptyCanvasMessage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #888;
  text-align: center;
  max-width: 500px;
  line-height: 1.5;
  background-color: white;
  padding: 30px 40px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);

  h2 {
    font-size: 28px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #333;
  }

  p {
    font-size: 16px;
    color: #666;
  }
`;

// Loading indicator
const LoadingIndicator = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #007bff;
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
      stroke="#007bff" 
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
  background-color: rgba(255, 255, 255, 0.95);
  display: ${props => props.visible ? 'flex' : 'none'};
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  color: #333;
  font-size: 16px;
  line-height: 1.5;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
  
  h3 {
    margin-top: 15px;
    margin-bottom: 5px;
    font-weight: 600;
    color: #4f46e5;
  }
  
  p {
    margin: 5px 0 15px;
    max-width: 300px;
    opacity: 0.8;
    font-size: 14px;
  }
  
  svg {
    animation: rotate 1.5s ease-in-out infinite;
    width: 40px;
    height: 40px;
    
    @keyframes rotate {
      100% {
        transform: rotate(360deg);
      }
    }
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
      stroke="#4f46e5" 
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
  border-bottom: 2px solid ${props => props.active ? '#4f46e5' : 'transparent'};
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
  
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
          background-color: #4f46e5;
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
      border-left: 3px solid #4f46e5;
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
  background-color: #4f46e5;
  top: 50%;
  z-index: 3;
  transform: translateY(-50%);
  
  &:before, &:after {
    content: '';
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #4f46e5;
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
const IterationLabel = styled.div`
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
`;

// Badge for new/improved design
const NewDesignBadge = styled.div`
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

// Add a styled component for the Figma badge
const FigmaBadge = styled.div`
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
  background-color: #4f46e5;
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
    background-color: #4338ca;
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

// New Action Buttons container that appears on hover
const ActionButtonsContainer = styled.div`
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  background-color: white;
  padding: 8px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 20;
  opacity: 0;
  transition: opacity 0.2s ease;
`;

// Individual action button style
const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: #f5f5f5;
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
  
  &.primary {
    background-color: #4f46e5;
    color: white;
    border-color: #4f46e5;
    
    &:hover {
      background-color: #4338ca;
    }
  }
`;

// New hover container with the action buttons
const DesignWithActionsContainer = styled.div`
  position: relative;
  
  &:hover ${ActionButtonsContainer} {
    opacity: 1;
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
    <path d="M1.333 8C1.333 4.32 4.32 1.333 8 1.333C11.68 1.333 14.666 4.32 14.666 8C14.666 11.68 11.68 14.667 8 14.667C6.12 14.667 4.44 13.853 3.293 12.56" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M1.333 8L3.999 10.667L6.666 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 3C4.5 3 1.5 8 1.5 8C1.5 8 4.5 13 8 13C11.5 13 14.5 8 14.5 8C14.5 8 11.5 3 8 3Z" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const Canvas: React.FC = () => {
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
    e.stopPropagation();
    
    // Check if this is an iteration
    const isIteration = designs.some(design => 
      design.iterations?.some(iteration => iteration.id === designId)
    );
    
    // If this design is already selected, start dragging
    if (selectedDesignId === designId) {
      setIsDesignDragging(true);
      
      // Find the position based on whether it's a design or iteration
      let position;
      if (isIteration) {
        // Find the iteration position
        for (const design of designs) {
          if (!design.iterations) continue;
          
          const foundIteration = design.iterations.find(it => it.id === designId);
          if (foundIteration) {
            position = foundIteration.position;
            break;
          }
        }
      } else {
        // Find the design position
        const design = designs.find(d => d.id === designId);
        if (design) {
          position = design.position;
        }
      }
      
      if (position) {
        setDesignDragStart({
          x: e.clientX,
          y: e.clientY
        });
        setDesignInitialPosition({
          x: position.x,
          y: position.y
        });
      }
    } else {
      // Otherwise just select it (this will also trigger the analysis panel if needed)
      handleDesignClick(e, designId);
    }
  };
  
  // Modify the handleIterationClick function to handle both original designs and iterations
  const handleIterationClick = async (e: React.MouseEvent, designId: string) => {
    e.stopPropagation(); // Prevent propagation to avoid selecting/deselecting
    LogManager.log('iteration-request', `Iteration requested for design: ${designId}`, true);
    
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
          { width: 500, height: 400 }; // Default dimensions
        
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
        result = await openAIService.analyzeDesignAndGenerateHTML(sourceImageUrl);
      } else {
        // For base designs, we use the existing method with the image URL
        result = await openAIService.analyzeDesignAndGenerateHTML(sourceImageUrl);
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
          }
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
              dimensions: { width: 500, height: 400 } // Default dimensions
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
        <ActionButtonsContainer>
          <ActionButton className="primary" onClick={(e) => handleIterationClick(e, design.id)}>
            <IterateIcon />
            Iterate
          </ActionButton>
          <ActionButton>
            <RetryIcon />
            Retry
          </ActionButton>
          <ActionButton onClick={(e) => {
            e.stopPropagation();
            // We can't directly set the design as the currentAnalysis due to type differences
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
            {/* The iteration badge */}
            <IterationLabel>Iteration {index + 1}</IterationLabel>
            
            {/* The improved design badge */}
            <NewDesignBadge>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="white"/>
              </svg>
              Improved
            </NewDesignBadge>
            
            {/* The iteration design itself */}
            <IterationDesignCard 
              isSelected={selectedDesignId === iteration.id}
              onClick={(e) => handleDesignClick(e, iteration.id)}
              onMouseDown={(e) => handleDesignMouseDown(e, iteration.id)}
              style={{ cursor: selectedDesignId === iteration.id ? 'move' : 'pointer' }}
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
              />
              
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
          
          {/* New action buttons component */}
          <ActionButtonsContainer>
            <ActionButton className="primary" onClick={(e) => handleIterationClick(e, iteration.id)}>
              <IterateIcon />
              Iterate
            </ActionButton>
            <ActionButton>
              <RetryIcon />
              Retry
            </ActionButton>
            <ActionButton onClick={(e) => {
              e.stopPropagation();
              setCurrentAnalysis(iteration);
              setAnalysisVisible(true);
            }}>
              <ViewIcon />
              View Analysis
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
                  <h2>Paste a Figma frame</h2>
                  <p>Select a frame and press Command+L on your keyboard</p>
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
                          {/* This would be a thumbnail of the iteration */}
                          <HtmlDesignRenderer
                            htmlContent={currentAnalysis.htmlContent}
                            cssContent={currentAnalysis.cssContent}
                            width={150}
                            height={150}
                            showBorder={false}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <h4>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14.06 9L15 9.94L5.92 19H5v-0.92L14.06 9M17.66 3c-0.25 0-0.51 0.1-0.7 0.29l-1.83 1.83 3.75 3.75 1.83-1.83c0.39-0.39 0.39-1.02 0-1.41l-2.34-2.34c-0.2-0.2-0.45-0.29-0.71-0.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z" fill="#4f46e5"/>
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
                        <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14l-6-6z" fill="#4f46e5"/>
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
    </>
  );
}; 
import React from 'react';
import styled from 'styled-components';
import { useCursorContext, CursorMode } from '../contexts/CursorContext';

const ToolbarContainer = styled.div`
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #2A2A2A;
  border: 1px solid #4D4D4D;
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  z-index: 1000;
`;

const ToolbarButton = styled.button<{ active: boolean }>`
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  background-color: ${props => props.active ? '#26D4C8' : 'transparent'};
  color: ${props => props.active ? '#2A2A2A' : '#FFFFFF'};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${props => props.active ? '#1fb9ae' : '#3A3A3A'};
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  svg {
    width: 20px;
    height: 20px;
  }
`;

const PointerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M3 3L10.5 12.5L7 16L13 22L15 20L11 14L20.5 11.5L3 3Z" 
      fill="currentColor"
    />
  </svg>
);

const HandIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M13 6V10H15C16.1 10 17 10.9 17 12V16C17 17.1 16.1 18 15 18H9C7.9 18 7 17.1 7 16V12C7 10.9 7.9 10 9 10H11V6C11 4.9 11.9 4 13 4C14.1 4 15 4.9 15 6H13Z" 
      fill="currentColor"
    />
    <path 
      d="M9 10V8C9 6.9 9.9 6 11 6V4C9.9 4 9 4.9 9 6V8C8.45 8 8 8.45 8 9V10H9Z" 
      fill="currentColor"
    />
    <circle cx="6" cy="8" r="2" fill="currentColor"/>
    <circle cx="18" cy="8" r="2" fill="currentColor"/>
  </svg>
);

const BottomToolbar: React.FC = () => {
  const { cursorMode, setCursorMode } = useCursorContext();

  const handleCursorModeChange = (mode: CursorMode) => {
    setCursorMode(mode);
  };

  return (
    <ToolbarContainer>
      <ToolbarButton
        active={cursorMode === 'pointer'}
        onClick={() => handleCursorModeChange('pointer')}
        title="Pointer Tool - Click and interact with designs"
      >
        <PointerIcon />
      </ToolbarButton>
      <ToolbarButton
        active={cursorMode === 'hand'}
        onClick={() => handleCursorModeChange('hand')}
        title="Hand Tool - Drag to pan the canvas"
      >
        <HandIcon />
      </ToolbarButton>
    </ToolbarContainer>
  );
};

export default BottomToolbar; 
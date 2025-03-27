import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { usePageContext } from '../contexts/PageContext';

// Global style to remove focus outlines and borders
const GlobalStyle = createGlobalStyle`
  * {
    outline: none !important;
    &:focus, &:focus-visible, &:focus-within {
      outline: none !important;
      border-color: transparent !important;
      box-shadow: none !important;
    }
  }
  
  img {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
  }
  
  /* Additional reset for all elements */
  div, img, canvas, section, article, figure {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
  }
  
  /* Override browser default focus styles */
  :focus {
    outline: none !important;
  }
  
  ::-moz-focus-inner {
    border: 0 !important;
  }
  
  button, h1, h2, h3, h4, h5, h6, p, span, div {
    font-family: 'Plus Jakarta Sans', sans-serif;
  }
`;

// Logo component
const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 28px;
  color: #333;
  font-family: 'Plus Jakarta Sans', sans-serif;
`;

const LogoImage = styled.img`
  width: 36px;
  height: 36px;
  object-fit: contain;
`;

// Redesigned Canvas Container
const CanvasContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background-color: #f5f5f5;
  z-index: 1; /* Lower z-index to ensure borders are visible */
`;

// Canvas header with tabs
const CanvasHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 20px;
  height: 60px;
  background-color: white;
  border-bottom: 1px solid #E3E6EA;
  z-index: 100;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); /* Enhanced shadow for better visibility */
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
  justify-self: end;
`;

const ActionButton = styled.button`
  padding: 8px 16px;
  background-color: white;
  color: #333;
  border-radius: 8px;
  font-weight: 600;
  border: 1px solid #E3E6EA;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  font-family: 'Plus Jakarta Sans', sans-serif;
  
  &:hover {
    background-color: #f5f5f5;
  }
`;

// Infinite Canvas
const InfiniteCanvas = styled.div<{ scale: number }>`
  position: relative;
  width: 100%;
  height: calc(100vh - 60px);
  margin-top: 60px; /* Add margin to account for fixed header */
  overflow: hidden;
  background-color: #f5f5f5;
  background-image: 
    linear-gradient(rgba(150, 150, 150, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(150, 150, 150, 0.1) 1px, transparent 1px);
  background-size: ${props => 20 * props.scale}px ${props => 20 * props.scale}px;
  cursor: grab;
  border: none !important;
  outline: none !important;
  z-index: 1; /* Lower z-index to ensure borders are visible */
  margin-left: 1px; /* Add margin to prevent overlap with sidebar border */
  
  &:active {
    cursor: grabbing;
  }
  
  &:focus, &:focus-visible, &:focus-within {
    outline: none !important;
    border: none !important;
    box-shadow: none !important;
  }
  
  * {
    border: none !important;
    outline: none !important;
  }
`;

const CanvasContent = styled.div<{ x: number; y: number; scale: number }>`
  position: absolute;
  transform: translate(${props => props.x}px, ${props => props.y}px) scale(${props => props.scale});
  transform-origin: 0 0;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 100%;
  min-height: 100%;
  border: none !important;
  outline: none !important;
  z-index: 1; /* Lower z-index to ensure borders are visible */
  
  &:focus, &:focus-visible, &:focus-within {
    outline: none !important;
    border: none !important;
    box-shadow: none !important;
  }
  
  * {
    border: none !important;
    outline: none !important;
  }
`;

// Design elements
const DesignContainer = styled.div`
  position: relative;
  min-width: 100%;
  min-height: 100%;
  padding: 100px;
`;

const DesignCard = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 16px;
  max-width: 100%;
  border: 2px solid transparent;
  outline: none;
  z-index: 10;
  cursor: pointer;
`;

const DesignImage = styled.img`
  max-width: 100%;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
`;

// Add the EmptyCanvas component
const EmptyCanvasMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: 18px;
  margin-top: 100px;
  text-align: center;
  max-width: 500px;
  line-height: 1.5;
`;

export const Canvas: React.FC = () => {
  const { currentPage, updatePage } = usePageContext();
  
  // Canvas state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Reset canvas position and scale
  const resetCanvas = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  
  // Handle canvas mouse interactions
  const handleCanvasMouseDown = (e: MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('#canvas-content')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };
  
  const handleCanvasMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };
  
  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };
  
  // Handle canvas wheel event manually instead of using onWheel prop
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const handleWheel = (e: WheelEvent) => {
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
      
      // Get the position of the cursor relative to the canvas
      const rect = canvasElement.getBoundingClientRect();
      
      // Calculate cursor position relative to the transformed content
      // This is the key part we need to fix:
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate the point on the original content where the cursor is
      const originX = mouseX / scale - position.x / scale;
      const originY = mouseY / scale - position.y / scale;
      
      // Calculate the new position to keep the cursor point fixed
      const newPositionX = mouseX - originX * newScale;
      const newPositionY = mouseY - originY * newScale;
      
      setScale(newScale);
      setPosition({ x: newPositionX, y: newPositionY });
    };

    canvasElement.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      canvasElement.removeEventListener('wheel', handleWheel);
    };
  }, [scale, position]);
  
  // Handle image pasting
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!currentPage) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (!blob) continue;
          
          const reader = new FileReader();
          reader.onload = (event) => {
            const imageUrl = event.target?.result as string;
            if (imageUrl && currentPage) {
              updatePage(currentPage.id, { baseImage: imageUrl });
            }
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [currentPage, updatePage]);
  
  return (
    <>
      <GlobalStyle />
      <CanvasContainer>
        <CanvasHeader>
          <Logo>
            <LogoImage src="/Coterate logo.png" alt="Coterate Logo" />
            Coterate UI
          </Logo>
          
          <div />
          
          <HeaderActions>
            <ActionButton onClick={resetCanvas}>
              Reset View
            </ActionButton>
          </HeaderActions>
        </CanvasHeader>
        
        <InfiniteCanvas
          ref={canvasRef}
          scale={scale}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          <CanvasContent
            id="canvas-content"
            x={position.x}
            y={position.y}
            scale={scale}
          >
            <DesignContainer>
              {currentPage && currentPage.baseImage ? (
                <DesignCard>
                  <DesignImage 
                    src={currentPage.baseImage} 
                    alt={currentPage.name}
                  />
                </DesignCard>
              ) : (
                <EmptyCanvasMessage>
                  Copy a UI design to your clipboard and press Ctrl+V (or Cmd+V) to paste it here
                </EmptyCanvasMessage>
              )}
            </DesignContainer>
          </CanvasContent>
        </InfiniteCanvas>
      </CanvasContainer>
    </>
  );
}; 
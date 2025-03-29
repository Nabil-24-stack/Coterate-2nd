import React, { useState, useEffect, useRef } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { usePageContext } from '../contexts/PageContext';

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
const DesignContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  justify-content: center;
  align-items: center;
`;

// Design card that holds the image, now with isSelected prop
const DesignCard = styled.div<{ isSelected: boolean }>`
  position: relative;
  background-color: white;
  border-radius: 0;
  padding: 0;
  max-width: calc(100vw - 280px);
  cursor: ${props => props.isSelected ? 'move' : 'pointer'};
  border: none;
  box-shadow: none;
  overflow: visible;
  line-height: 0;
  
  &::before {
    content: '';
    position: absolute;
    top: -3px;
    left: -3px;
    right: -3px;
    bottom: -3px;
    pointer-events: none;
    z-index: 10;
    border: ${props => props.isSelected ? '3px solid #007bff' : '0px solid transparent'};
    box-shadow: ${props => props.isSelected ? '0 0 8px rgba(0, 123, 255, 0.5)' : 'none'};
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
  }
`;

// The image itself
const DesignImage = styled.img`
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 0;
  pointer-events: none; /* Prevent image from interfering with drag */
  margin: 0;
  border: none;
`;

// Empty state message
const EmptyCanvasMessage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #888;
  font-size: 16px;
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
  
  // State for dragging design
  const [isDesignDragging, setIsDesignDragging] = useState(false);
  const [designPosition, setDesignPosition] = useState({ x: 0, y: 0 });
  const [designDragStart, setDesignDragStart] = useState({ x: 0, y: 0 });
  const [designInitialPosition, setDesignInitialPosition] = useState({ x: 0, y: 0 });
  
  // New state for design selection
  const [isDesignSelected, setIsDesignSelected] = useState(false);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const designRef = useRef<HTMLDivElement>(null);
  
  // Reset canvas position and scale
  const resetCanvas = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setDesignPosition({ x: 0, y: 0 });
  };
  
  // Handle canvas mouse down for panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // If clicking on the design card, handle design dragging
    if (designRef.current && designRef.current.contains(e.target as Node)) {
      setIsDesignDragging(true);
      setIsDesignSelected(true); // Select the design when clicked
      setDesignDragStart({
        x: e.clientX,
        y: e.clientY
      });
      setDesignInitialPosition({
        x: designPosition.x,
        y: designPosition.y
      });
      return;
    }
    
    // Deselect the design when clicking on the canvas
    setIsDesignSelected(false);
    
    // Otherwise handle canvas panning
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };
  
  // Handle mouse move for panning and design dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDesignDragging) {
      // Calculate the delta in screen coordinates
      const deltaX = e.clientX - designDragStart.x;
      const deltaY = e.clientY - designDragStart.y;
      
      // Convert the delta to canvas coordinates by dividing by the scale
      const deltaCanvasX = deltaX / scale;
      const deltaCanvasY = deltaY / scale;
      
      // Update design position based on initial position plus scaled delta
      setDesignPosition({
        x: designInitialPosition.x + deltaCanvasX,
        y: designInitialPosition.y + deltaCanvasY
      });
      return;
    }
    
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };
  
  // Handle mouse up to stop dragging
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsDesignDragging(false);
  };
  
  // Handle click on the design to toggle selection
  const handleDesignClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDesignSelected(true);
  };
  
  // Handle wheel event for zooming
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
              
              // Reset positions after pasting new image
              resetCanvas();
              
              // Auto-select newly pasted image
              setIsDesignSelected(true);
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
        setScale(prev => Math.min(prev * 1.1, 4));
      }
      
      // Ctrl+Minus: Zoom out
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        setScale(prev => Math.max(prev * 0.9, 0.1));
      }
      
      // Delete/Backspace: Remove selected design
      if ((e.key === 'Delete' || e.key === 'Backspace') && currentPage?.baseImage && isDesignSelected) {
        updatePage(currentPage.id, { baseImage: undefined });
        setIsDesignSelected(false);
      }
      
      // Escape: Deselect design
      if (e.key === 'Escape' && isDesignSelected) {
        setIsDesignSelected(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentPage, updatePage, isDesignSelected]);
  
  return (
    <>
      <GlobalStyle />
      <CanvasContainer>
        <InfiniteCanvas
          ref={canvasRef}
          scale={scale}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <CanvasContent
            x={position.x}
            y={position.y}
            scale={scale}
          >
            {currentPage && currentPage.baseImage ? (
              <DesignContainer style={{ transform: `translate(calc(-50% + ${designPosition.x}px), calc(-50% + ${designPosition.y}px))` }}>
                <DesignCard 
                  ref={designRef}
                  isSelected={isDesignSelected}
                  onClick={handleDesignClick}
                >
                  <DesignImage 
                    src={currentPage.baseImage} 
                    alt={currentPage.name}
                  />
                </DesignCard>
              </DesignContainer>
            ) : (
              <EmptyCanvasMessage>
                Copy a UI design to your clipboard and press Ctrl+V (or Cmd+V) to paste it here
              </EmptyCanvasMessage>
            )}
          </CanvasContent>
        </InfiniteCanvas>
      </CanvasContainer>
    </>
  );
}; 
import React, { useState, useEffect, useRef } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { usePageContext } from '../contexts/PageContext';
import { Design } from '../types';
import supabaseService from '../services/SupabaseService';

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
  font-size: 16px;
  text-align: center;
  max-width: 500px;
  line-height: 1.5;
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

export const Canvas: React.FC = () => {
  const { currentPage, updatePage, loading } = usePageContext();
  
  // Canvas state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // State for multiple designs
  const [designs, setDesigns] = useState<Design[]>([]);

  // Track design initialization
  const [designsInitialized, setDesignsInitialized] = useState(false);
  
  // Selected design state
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [isDesignDragging, setIsDesignDragging] = useState(false);
  const [designDragStart, setDesignDragStart] = useState({ x: 0, y: 0 });
  const [designInitialPosition, setDesignInitialPosition] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const designRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Debounced update function to avoid too many database calls
  const debouncedUpdateRef = useRef<NodeJS.Timeout | null>(null);
  
  // Effect to load designs from page data - only runs once per page change
  useEffect(() => {
    if (currentPage) {
      console.log('Canvas: Current page changed:', currentPage.id, currentPage.name);
      console.log('Canvas: Current page designs:', currentPage.designs);
      
      if (currentPage.designs && Array.isArray(currentPage.designs) && currentPage.designs.length > 0) {
        // If the page already has designs array, use it
        console.log('Canvas: Loading designs from page:', currentPage.designs.length, 'designs');
        setDesigns(currentPage.designs);
      } else if (currentPage.baseImage && !designsInitialized) {
        // If the page has a baseImage (legacy format), convert it to our new designs array
        console.log('Canvas: Converting legacy baseImage to design');
        setDesigns([{
          id: 'legacy-design',
          imageUrl: currentPage.baseImage,
          position: { x: 0, y: 0 }
        }]);
      } else {
        console.log('Canvas: No designs found in current page');
        setDesigns([]);
      }

      setDesignsInitialized(true);
    } else {
      console.log('Canvas: No current page available');
    }
  }, [currentPage]);
  
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
      console.log('Canvas: Saving designs to page:', designs.length, 'designs');
      
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
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  
  // Find the selected design
  const selectedDesign = designs.find(d => d.id === selectedDesignId);
  
  // Helper to get a specific design reference
  const getDesignRef = (id: string) => {
    return designRefs.current[id];
  };
  
  // Handle zoom with mouse wheel
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
    
    setScale(newScale);
    setPosition({ x: newPositionX, y: newPositionY });
  };
  
  // Handle canvas mouse down for panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Check if clicking on any design
    const clickedDesignId = designs.find(design => {
      const designRef = getDesignRef(design.id);
      return designRef && designRef.contains(e.target as Node);
    })?.id;
    
    if (clickedDesignId) {
      // Clicked on a design
      setSelectedDesignId(clickedDesignId);
      setIsDesignDragging(true);
      
      const clickedDesign = designs.find(d => d.id === clickedDesignId);
      if (clickedDesign) {
        setDesignDragStart({
          x: e.clientX,
          y: e.clientY
        });
        setDesignInitialPosition({
          x: clickedDesign.position.x,
          y: clickedDesign.position.y
        });
      }
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
  
  // Handle click on a design
  const handleDesignClick = (e: React.MouseEvent, designId: string) => {
    e.stopPropagation();
    setSelectedDesignId(designId);
  };
  
  // Handle iteration button click
  const handleIterationClick = (e: React.MouseEvent, designId: string) => {
    e.stopPropagation(); // Prevent propagation to avoid selecting/deselecting
    console.log(`Iteration requested for design: ${designId}`);
    // This will later trigger the AI analysis and iteration flow (section 2.3.2-2.3.5)
    // For now we just log to confirm the button works
  };
  
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
      
      setScale(newScale);
      setPosition({ x: newPositionX, y: newPositionY });
    };

    canvasElement.addEventListener('wheel', handleWheelEvent, { passive: false });
    
    return () => {
      canvasElement.removeEventListener('wheel', handleWheelEvent);
    };
  }, [scale, position]);
  
  // Handle image pasting
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!currentPage) {
        console.log('Canvas: No current page available for paste');
        return;
      }
      
      const items = e.clipboardData?.items;
      if (!items) {
        console.log('Canvas: No clipboard data items available');
        return;
      }
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        if (item.type.indexOf('image') !== -1) {
          console.log('Canvas: Found image in clipboard');
          const blob = item.getAsFile();
          if (!blob) {
            console.log('Canvas: Could not get file from clipboard item');
            continue;
          }
          
          try {
            // Generate a unique filename for the pasted image
            const timestamp = new Date().getTime();
            const filename = `pasted-image-${timestamp}.${blob.type.split('/')[1] || 'png'}`;
            
            // Upload the image to Supabase Storage or convert to data URL
            console.log('Canvas: Uploading pasted image to storage');
            const imageUrl = await supabaseService.uploadImageToStorage(blob, filename);
            
            if (!imageUrl) {
              console.error('Canvas: Failed to upload image to storage');
              continue;
            }
            
            // Add the image to designs
            const newDesign = {
              id: `design-${timestamp}`,
              imageUrl,
              position: { x: 0, y: 0 }
            };
            
            console.log('Canvas: Adding new design with image URL:', imageUrl);
            setDesigns(prev => [...prev, newDesign]);
            setDesignsInitialized(true);
          } catch (error) {
            console.error('Canvas: Error handling pasted image:', error);
          }
        }
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [currentPage]);
  
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
  
  return (
    <>
      <GlobalStyle />
      <CanvasContainer ref={containerRef}>
        {loading ? (
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
                designs.map((design) => (
                  <DesignContainer 
                    key={design.id}
                    x={design.position.x}
                    y={design.position.y}
                  >
                    <DesignCard 
                      ref={el => designRefs.current[design.id] = el}
                      isSelected={selectedDesignId === design.id}
                      onClick={(e) => handleDesignClick(e, design.id)}
                    >
                      <DesignImage 
                        src={design.imageUrl} 
                        alt={`Design ${design.id}`}
                      />
                      {selectedDesignId === design.id && (
                        <IterationButton
                          onClick={(e) => handleIterationClick(e, design.id)}
                          title="Create Iteration"
                        >
                          <PlusIcon />
                        </IterationButton>
                      )}
                    </DesignCard>
                  </DesignContainer>
                ))
              ) : (
                <EmptyCanvasMessage>
                  Copy a UI design to your clipboard and press Ctrl+V (or Cmd+V) to paste it here
                </EmptyCanvasMessage>
              )}
            </CanvasContent>
          </InfiniteCanvas>
        )}
      </CanvasContainer>
    </>
  );
}; 
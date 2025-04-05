import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { usePageContext } from '../contexts/PageContext';
import { Design, DesignIteration } from '../types';
import supabaseService from '../services/SupabaseService';
import openAIService from '../services/OpenAIService';
import HtmlDesignRenderer, { HtmlDesignRendererHandle } from './HtmlDesignRenderer';

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

// Replace the AIProcessingOverlay styled component with a more targeted version
const ProcessingOverlay = styled.div<{ visible: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: ${props => props.visible ? 'flex' : 'none'};
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  border-radius: 8px;
`;

const ProcessingContainer = styled.div`
  background-color: white;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 300px;
`;

const ProcessingTitle = styled.div`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #333;
`;

const StepIndicator = styled.div`
  display: flex;
  align-items: center;
  margin: 8px 0;
  color: #666;
  font-size: 14px;
  gap: 8px;
`;

const CheckIcon = styled.span`
  color: #10b981;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LoadingIcon = styled.span`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #e0e0e0;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingSpinnerCircle = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid #e0e0e0;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 24px;
`;

// Iteration container to group parent design and its iterations
const IterationContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 40px;
`;

// Analysis panel to show strengths and weaknesses
const AnalysisPanel = styled.div<{ visible: boolean }>`
  position: fixed;
  top: 70px;
  right: ${props => props.visible ? '0' : '-350px'};
  width: 350px;
  height: calc(100vh - 70px);
  background-color: white;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow-y: auto;
  transition: right 0.3s ease;
  padding: 20px;
  
  h3 {
    margin-top: 0;
    margin-bottom: 12px;
    font-size: 18px;
    font-weight: 600;
  }
  
  h4 {
    margin-top: 16px;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #666;
  }
  
  ul {
    margin: 0 0 16px 0;
    padding-left: 20px;
  }
  
  li {
    margin-bottom: 8px;
    font-size: 14px;
  }
`;

const AnalysisToggleButton = styled.button`
  position: fixed;
  top: 75px;
  right: ${props => props.theme.analysisVisible ? '360px' : '10px'};
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
  z-index: 101;
  transition: right 0.3s ease;
  
  &:hover {
    background-color: #f5f5f5;
  }
`;

// Update the Design type in the component to include processing fields
type ExtendedDesign = Design & {
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

// Debounce helper function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>): void => {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

export const Canvas: React.FC = () => {
  const { currentPage, updatePage, loading } = usePageContext();
  
  // Use simple defaults initially
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [designs, setDesigns] = useState<ExtendedDesign[]>([]);
  const [designsInitialized, setDesignsInitialized] = useState(false);
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [isDesignDragging, setIsDesignDragging] = useState(false);
  const [designDragStart, setDesignDragStart] = useState({ x: 0, y: 0 });
  const [designInitialPosition, setDesignInitialPosition] = useState({ x: 0, y: 0 });
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<DesignIteration | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const designRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const htmlRendererRef = useRef<HtmlDesignRendererHandle>(null);
  const debouncedUpdateRef = useRef<NodeJS.Timeout | null>(null);

  // --- Position Persistence Logic --- 

  // Function to get the storage key for a page
  const getStorageKey = (pageId: string) => `coterate_canvas_position_${pageId}`;

  // Effect to LOAD position when currentPage changes
  useEffect(() => {
    if (currentPage?.id) {
      const pageId = currentPage.id;
      console.log(`Canvas: Page changed to ${pageId}. Loading position.`);
      const key = getStorageKey(pageId);
      try {
        const savedData = localStorage.getItem(key);
        if (savedData) {
          const { position: savedPosition, scale: savedScale } = JSON.parse(savedData);
          console.log(`Canvas: Found saved position for ${pageId}:`, { savedPosition, savedScale });
          setPosition(savedPosition);
          setScale(savedScale);
        } else {
          console.log(`Canvas: No saved position for ${pageId}. Resetting to default.`);
          // Reset to default if no saved state for this specific page
          setPosition({ x: 0, y: 0 });
          setScale(1);
        }
      } catch (error) {
        console.error(`Canvas: Error loading position for ${pageId}:`, error);
        // Reset to default on error
        setPosition({ x: 0, y: 0 });
        setScale(1);
      }
    } else {
      // No current page, reset to default
      console.log('Canvas: No current page. Resetting position to default.');
      setPosition({ x: 0, y: 0 });
      setScale(1);
    }
  // IMPORTANT: This effect should ONLY run when the page ID changes. 
  // Do NOT add position or scale to dependencies.
  }, [currentPage?.id]); 

  // Debounced function to SAVE position
  const debouncedSavePosition = useCallback(
    debounce((pageId: string, pos: {x: number, y: number}, scl: number) => {
      if (!pageId) return;
      console.log(`Canvas: Debounced save for page ${pageId}`);
      const key = getStorageKey(pageId);
      try {
        const data = { position: pos, scale: scl };
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`Canvas: Saved position for ${pageId}:`, data);
      } catch (error) {
        console.error(`Canvas: Error saving position for ${pageId}:`, error);
      }
    }, 300), // Debounce saves by 300ms
    [] // No dependencies, function is stable
  );

  // Effect to SAVE position when position or scale changes
  useEffect(() => {
    if (currentPage?.id) {
      // Call the debounced save function
      debouncedSavePosition(currentPage.id, position, scale);
    }
  // This effect runs whenever position or scale changes for the current page
  }, [position, scale, currentPage?.id, debouncedSavePosition]);

  // --- End Position Persistence Logic --- 

  // Effect to load designs (remains the same)
  useEffect(() => {
    if (currentPage) {
      console.log('Canvas: Current page designs:', currentPage.designs);
      if (currentPage.designs && Array.isArray(currentPage.designs)) {
        setDesigns(currentPage.designs);
      } else {
        setDesigns([]);
      }
      setDesignsInitialized(true);
    } else {
      setDesignsInitialized(false);
      setDesigns([]);
    }
  }, [currentPage]); // Only depends on currentPage

  // Effect to save designs (remains the same)
  useEffect(() => {
    if (!currentPage || !designsInitialized) return;
    if (debouncedUpdateRef.current) clearTimeout(debouncedUpdateRef.current);
    debouncedUpdateRef.current = setTimeout(() => {
      const designsToSave = JSON.parse(JSON.stringify(designs));
      updatePage(currentPage.id, { designs: designsToSave });
    }, 500);
    return () => {
      if (debouncedUpdateRef.current) clearTimeout(debouncedUpdateRef.current);
    };
  }, [designs, currentPage?.id, designsInitialized, updatePage]);

  // Reset canvas position and scale
  const resetCanvas = () => {
    console.log('Canvas: Resetting canvas to default position and scale');
    const newPosition = { x: 0, y: 0 };
    const newScale = 1;
    setPosition(newPosition);
    setScale(newScale);
    // Save the reset position immediately (uses debouncedSavePosition)
    if (currentPage?.id) {
      debouncedSavePosition(currentPage.id, newPosition, newScale);
    }
  };
  
  // Handle zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSensitivity = 0.1;
    const minScale = 0.1;
    const maxScale = 4;
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
    // Position saving is handled by the useEffect hook
  };

  // Handle mouse move for panning and design dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDesignDragging && selectedDesignId) {
      const deltaX = e.clientX - designDragStart.x;
      const deltaY = e.clientY - designDragStart.y;
      const deltaCanvasX = deltaX / scale;
      const deltaCanvasY = deltaY / scale;
      setDesigns(prevDesigns => 
        prevDesigns.map(design => 
          design.id === selectedDesignId ? { ...design, position: { x: designInitialPosition.x + deltaCanvasX, y: designInitialPosition.y + deltaCanvasY }} : design
        )
      );
      return;
    }
    if (isDragging) {
      const newPosition = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
      setPosition(newPosition);
      // Position saving is handled by the useEffect hook
    }
  };
  
  // Handle mouse up to stop dragging
  const handleMouseUp = () => {
    // No need to save explicitly here, the useEffect for position/scale change handles it
    setIsDragging(false);
    setIsDesignDragging(false);
  };
  
  // Find the selected design
  const selectedDesign = designs.find(d => d.id === selectedDesignId);
  
  // Helper to get a specific design reference
  const getDesignRef = (id: string) => {
    return designRefs.current[id];
  };
  
  // Handle click on a design
  const handleDesignClick = (e: React.MouseEvent, designId: string) => {
    e.stopPropagation();
    setSelectedDesignId(designId);
  };
  
  // Update the handleIterationClick method to preserve the original design when adding an iteration
  const handleIterationClick = async (e: React.MouseEvent, designId: string) => {
    e.stopPropagation(); // Prevent propagation to avoid selecting/deselecting
    console.log(`Iteration requested for design: ${designId}`);
    
    // Find the design to iterate on
    const designToIterate = designs.find(d => d.id === designId);
    if (!designToIterate) {
      console.error(`Could not find design with ID: ${designId}`);
      return;
    }
    
    // Check if OpenAI API key is available
    if (!openAIService.hasApiKey()) {
      alert('OpenAI API key is not configured. Please set it in your environment variables.');
      return;
    }
    
    // Set processing state for this specific design
    setDesigns(prevDesigns => 
      prevDesigns.map(design => 
        design.id === designId
          ? { ...design, isProcessing: true, processingStep: 'analyzing' }
          : design
      )
    );
    
    try {
      // Get the original image dimensions before proceeding
      const originalDimensions = await getImageDimensions(designToIterate.imageUrl);
      console.log('Original image dimensions:', originalDimensions);
      
      // Call OpenAI service to analyze the image and generate HTML
      const result = await openAIService.analyzeDesignAndGenerateHTML(designToIterate.imageUrl);
      
      // Update the processing step
      setDesigns(prevDesigns => 
        prevDesigns.map(design => 
          design.id === designId
            ? { ...design, processingStep: 'recreating' }
            : design
        )
      );
      
      // Generate a unique ID for the iteration
      const iterationId = `iteration-${Date.now()}`;
      
      // Create the new iteration
      const newIteration: DesignIteration = {
        id: iterationId,
        parentId: designId,
        htmlContent: result.htmlCode,
        cssContent: result.cssCode,
        position: {
          // Position to the right of the original design
          x: designToIterate.position.x + 400, 
          y: designToIterate.position.y
        },
        analysis: {
          strengths: result.analysis.strengths,
          weaknesses: result.analysis.weaknesses,
          improvementAreas: result.analysis.improvementAreas,
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
        prevDesigns.map(design => 
          design.id === designId
            ? { ...design, processingStep: 'rendering' }
            : design
        )
      );
      
      // Short delay to show the rendering step
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update designs with a properly immutable state update
      setDesigns(prevDesigns => {
        return prevDesigns.map(design => {
          if (design.id === designId) {
            // Create a new object for the design being updated
            return {
              ...design,
              // Make sure to preserve the original design properties
              imageUrl: design.imageUrl,
              position: design.position,
              // Add the iteration to iterations array (or create a new array)
              iterations: [...(design.iterations || []), newIteration],
              // Clear processing state
              isProcessing: false,
              processingStep: null
            };
          }
          return design;
        });
      });
      
      // Log the state for debugging
      console.log('Successfully added iteration to design:', designId);
      
      // Set the newly created iteration for analysis panel
      setCurrentAnalysis(newIteration);
      setAnalysisVisible(true);
      
      // Success message
      console.log('Successfully created iteration:', newIteration);
    } catch (error) {
      console.error('Error creating iteration:', error);
      alert(`Failed to create iteration: ${error}`);
      
      // Clear processing state
      setDesigns(prevDesigns => 
        prevDesigns.map(design => 
          design.id === designId
            ? { ...design, isProcessing: false, processingStep: null }
            : design
        )
      );
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
  };
  
  // Select an iteration for viewing in the analysis panel
  const selectIterationForAnalysis = (iteration: DesignIteration) => {
    setCurrentAnalysis(iteration);
    setAnalysisVisible(true);
  };
  
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
        debouncedSavePosition(currentPage.id, { x: newPositionX, y: newPositionY }, newScale);
      }
    };

    canvasElement.addEventListener('wheel', handleWheelEvent, { passive: false });
    
    return () => {
      canvasElement.removeEventListener('wheel', handleWheelEvent);
    };
  }, [scale, position, currentPage?.id, debouncedSavePosition]);
  
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
  
  // Add the handleDesignMouseDown function back
  const handleDesignMouseDown = (e: React.MouseEvent, designId: string) => {
    e.stopPropagation();
    
    // Check if this is an iteration to show in analysis panel
    const isIteration = designs.some(design => 
      design.iterations?.some(iteration => iteration.id === designId)
    );
    
    if (isIteration) {
      // Find the iteration to get its analysis data
      const iteration = designs.flatMap(d => d.iterations || [])
        .find(it => it.id === designId);
      
      if (iteration) {
        // Set for analysis panel
        setCurrentAnalysis(iteration);
        setAnalysisVisible(true);
      }
    }
    
    // If this design is already selected, start dragging
    if (selectedDesignId === designId) {
      setIsDesignDragging(true);
      
      const design = designs.find(d => d.id === designId) || 
        designs.flatMap(d => d.iterations || []).find(i => i.id === designId);
      
      if (design) {
        setDesignDragStart({
          x: e.clientX,
          y: e.clientY
        });
        setDesignInitialPosition({
          x: design.position.x,
          y: design.position.y
        });
      }
    } else {
      // Otherwise just select it
      setSelectedDesignId(designId);
    }
  };
  
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Check if clicking directly on the canvas background, not on a design card
    let targetElement = e.target as HTMLElement;
    let clickedOnDesign = false;
    // Check if the clicked element or any parent up to the canvas itself is a DesignCard
    if (targetElement.closest('[data-design-card="true"]')) {
        clickedOnDesign = true;
    }

    if (clickedOnDesign) {
      // Let handleDesignMouseDown handle clicks on designs
      console.log('Canvas: Click detected on a design element, ignoring for panning.');
      return;
    }

    // Clicked on the canvas background
    console.log('Canvas: Click detected on background. Initiating pan.');
    setSelectedDesignId(null); // Deselect any design
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };
  
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
                  <React.Fragment key={design.id}>
                    <DesignContainer 
                      key={`container-${design.id}`}
                      x={design.position.x}
                      y={design.position.y}
                    >
                      <DesignCard 
                        data-design-card="true"
                        ref={el => designRefs.current[design.id] = el}
                        isSelected={selectedDesignId === design.id}
                        onMouseDown={(e) => handleDesignMouseDown(e, design.id)}
                      >
                        <DesignImage 
                          key={`img-${design.id}`}
                          src={design.imageUrl} 
                          alt={`Design ${design.id}`}
                          draggable={false}
                        />
                        {selectedDesignId === design.id && !design.isProcessing && (
                          <IterationButton
                            onClick={(e) => handleIterationClick(e, design.id)}
                            title="Create Iteration"
                          >
                            <PlusIcon />
                          </IterationButton>
                        )}
                        
                        {/* Processing overlay for this specific design */}
                        {design.isProcessing && (
                          <ProcessingOverlay visible={true}>
                            <ProcessingContainer>
                              <LoadingSpinnerCircle />
                              <ProcessingTitle>Iterating your design...</ProcessingTitle>
                              <StepIndicator>
                                {design.processingStep === 'analyzing' || design.processingStep === 'recreating' || design.processingStep === 'rendering' ? (
                                  <CheckIcon>✓</CheckIcon>
                                ) : (
                                  <LoadingIcon />
                                )}
                                <span>Analysing the UI</span>
                              </StepIndicator>
                              <StepIndicator>
                                {design.processingStep === 'recreating' || design.processingStep === 'rendering' ? (
                                  <CheckIcon>✓</CheckIcon>
                                ) : design.processingStep === 'analyzing' ? (
                                  <LoadingIcon />
                                ) : (
                                  <LoadingIcon style={{ opacity: 0.3 }} />
                                )}
                                <span>Recreating components</span>
                              </StepIndicator>
                              <StepIndicator>
                                {design.processingStep === 'rendering' ? (
                                  <CheckIcon>✓</CheckIcon>
                                ) : design.processingStep === 'recreating' ? (
                                  <LoadingIcon />
                                ) : (
                                  <LoadingIcon style={{ opacity: 0.3 }} />
                                )}
                                <span>Rendering onto canvas</span>
                              </StepIndicator>
                            </ProcessingContainer>
                          </ProcessingOverlay>
                        )}
                      </DesignCard>
                    </DesignContainer>
                    
                    {/* Render iterations for this design */}
                    {design.iterations?.map((iteration) => (
                      <DesignContainer 
                        key={`iteration-container-${iteration.id}`}
                        x={iteration.position.x}
                        y={iteration.position.y}
                      >
                        <DesignCard 
                          data-design-card="true"
                          ref={el => designRefs.current[iteration.id] = el}
                          isSelected={selectedDesignId === iteration.id}
                          onMouseDown={(e) => handleDesignMouseDown(e, iteration.id)}
                        >
                          <HtmlDesignRenderer
                            key={`renderer-${iteration.id}`}
                            ref={htmlRendererRef}
                            htmlContent={iteration.htmlContent}
                            cssContent={iteration.cssContent}
                            width={iteration.dimensions?.width || (design.imageUrl ? designRefs.current[design.id]?.clientWidth || 800 : 800)}
                            height={iteration.dimensions?.height || (design.imageUrl ? designRefs.current[design.id]?.clientHeight || 600 : 600)}
                          />
                          
                          {/* Add a small badge indicating this is an iteration */}
                          <div style={{
                            position: 'absolute',
                            top: '-10px',
                            left: '-10px',
                            background: '#007bff',
                            color: 'white',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            AI
                          </div>
                        </DesignCard>
                      </DesignContainer>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                <EmptyCanvasMessage>
                  Copy a UI design to your clipboard and press Ctrl+V (or Cmd+V) to paste it here
                </EmptyCanvasMessage>
              )}
            </CanvasContent>
          </InfiniteCanvas>
        )}
        
        {/* Debug Controls - only in development mode */}
        {process.env.NODE_ENV === 'development' && (
          <DebugButton onClick={() => {
            if (currentPage?.id) {
              const data = {
                position,
                scale
              };
              const key = getStorageKey(currentPage.id);
              localStorage.setItem(key, JSON.stringify(data));
              console.log('DEBUG: Manually saved position to localStorage:', key, data);
              
              // Verify it was saved
              const savedData = localStorage.getItem(key);
              if (savedData) {
                console.log('DEBUG: Verification - data in localStorage:', JSON.parse(savedData));
              }
            }
          }}>
            Save Position (Debug)
          </DebugButton>
        )}
        
        {/* Analysis Panel */}
        <AnalysisToggleButton 
          onClick={toggleAnalysisPanel}
          theme={{ analysisVisible }}
        >
          {analysisVisible ? 'Hide Analysis' : 'Show Analysis'}
        </AnalysisToggleButton>
        
        <AnalysisPanel visible={analysisVisible}>
          <h3>Design Analysis</h3>
          
          {currentAnalysis ? (
            <>
              <h4>Strengths</h4>
              <ul>
                {currentAnalysis.analysis?.strengths.map((strength, index) => (
                  <li key={`strength-${index}`}>{strength}</li>
                ))}
              </ul>
              
              <h4>Weaknesses</h4>
              <ul>
                {currentAnalysis.analysis?.weaknesses.map((weakness, index) => (
                  <li key={`weakness-${index}`}>{weakness}</li>
                ))}
              </ul>
              
              <h4>Improvements Made</h4>
              <ul>
                {currentAnalysis.analysis?.improvementAreas.map((improvement, index) => (
                  <li key={`improvement-${index}`}>{improvement}</li>
                ))}
              </ul>
              
              <h4>Icons</h4>
              <p style={{ fontSize: '14px', marginBottom: '12px' }}>
                Icons from Font Awesome 6 are used to match the original design where possible.
              </p>
              
              <h4>Images</h4>
              <p style={{ fontSize: '14px', marginBottom: '12px' }}>
                Royalty-free stock photos from Unsplash are used to replace placeholder images in the design.
                Images are dynamically loaded using the Unsplash Random Photo API with relevant keyword tags.
              </p>
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                Note: If an image doesn't appear immediately, it may still be loading from Unsplash.
                Each refresh generates new random images that match the keywords.
              </p>
              
              {currentAnalysis.analysis?.metadata?.colors && (
                <>
                  <h4>Color Palette</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                    {Object.entries(currentAnalysis.analysis.metadata.colors).map(([category, colors]) => 
                      colors?.map((color, index) => (
                        <div 
                          key={`color-${category}-${index}`} 
                          style={{ 
                            width: '24px',
                            height: '24px',
                            background: color,
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            position: 'relative',
                            cursor: 'pointer'
                          }} 
                          data-color-info={`${category}: ${color}`}
                        />
                      ))
                    )}
                  </div>
                </>
              )}
              
              {currentAnalysis.analysis?.metadata?.fonts && currentAnalysis.analysis.metadata.fonts.length > 0 && (
                <>
                  <h4>Fonts</h4>
                  <ul>
                    {currentAnalysis.analysis.metadata.fonts.map((font, index) => (
                      <li key={`font-${index}`}>{font}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <p>Select an iteration to see its analysis</p>
          )}
        </AnalysisPanel>
      </CanvasContainer>
    </>
  );
}; 
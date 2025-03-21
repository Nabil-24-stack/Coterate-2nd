import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { usePageContext } from '../contexts/PageContext';
// Import the logo directly from assets
import logo from '../assets/coterate-logo.svg';
import { UIComponent } from '../types';
import { signInWithFigma, isAuthenticated } from '../services/SupabaseService';
import { parseFigmaUrl } from '../services/FigmaService';

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

  &.primary {
    background-color: #4A90E2;
    color: white;
    
    &:hover {
      background-color: #3A80D2;
    }
  }

  &.secondary {
    background-color: #34C759;
    color: white;
    
    &:hover {
      background-color: #2AB64E;
    }
  }

  &.active {
    background-color: #5C6BC0;
    color: white;
    
    &:hover {
      background-color: #3F51B5;
    }
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    
    &:hover {
      background-color: white;
    }
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

// SVG container for vectorized content
const VectorizedSvgContainer = styled.div`
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  position: relative;
`;

// Container for the original image with component overlays
const AnalysisOverlayContainer = styled.div`
  position: relative;
  max-width: 100%;
  height: auto;
`;

// UI Component Highlight Overlay
const ComponentOverlay = styled.div<{ component: UIComponent }>`
  position: absolute;
  left: ${props => props.component.position.x}px;
  top: ${props => props.component.position.y}px;
  width: ${props => props.component.position.width}px;
  height: ${props => props.component.position.height}px;
  border: 2px dashed #4A90E2;
  background-color: rgba(74, 144, 226, 0.1);
  border-radius: ${props => props.component.style.borderRadius || 0}px;
  z-index: ${props => (props.component.position.zIndex || 0) + 100};
  cursor: pointer;
  pointer-events: all;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: rgba(74, 144, 226, 0.2);
  }
`;

// Analysis Panel
const AnalysisPanel = styled.div`
  position: fixed;
  top: 60px;
  right: 0;
  width: 320px;
  height: calc(100vh - 60px);
  background-color: white;
  border-left: 1px solid #E3E6EA;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.05);
  z-index: 50;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: transform 0.3s;
  transform: translateX(${props => props.hidden ? '100%' : '0'});
`;

const AnalysisPanelTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0 0 16px 0;
`;

const ComponentTypeChip = styled.div<{ type: UIComponent['type'] }>`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  margin-right: 8px;
  color: white;
  background-color: ${props => {
    switch (props.type) {
      case 'button': return '#4A90E2';
      case 'text_field': return '#9C27B0';
      case 'icon': return '#FF9800';
      case 'text': return '#4CAF50';
      case 'container': return '#607D8B';
      case 'image': return '#E91E63';
      default: return '#9E9E9E';
    }
  }};
`;

const SuggestionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
`;

const SuggestionItem = styled.div`
  background-color: #F8F9FA;
  padding: 12px;
  border-radius: 8px;
  border-left: 4px solid #4A90E2;
  font-size: 14px;
  color: #333;
`;

const ComponentDetailSection = styled.div`
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const DetailItem = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  
  .label {
    font-weight: 600;
    color: #666;
  }
  
  .value {
    color: #333;
  }
`;

const ColorSwatch = styled.div<{ color: string }>`
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background-color: ${props => props.color};
  display: inline-block;
  margin-right: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1);
`;

// Toggle Display Mode
const DisplayModeToggle = styled.div`
  display: inline-flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #E3E6EA;
  margin-left: 16px;
`;

const ToggleButton = styled.button<{ active: boolean }>`
  padding: 8px 12px;
  background-color: ${props => props.active ? '#4A90E2' : 'white'};
  color: ${props => props.active ? 'white' : '#333'};
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  
  &:hover {
    background-color: ${props => props.active ? '#3A80D2' : '#f5f5f5'};
  }
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

// Loading indicator
const LoadingIndicator = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #333;
  font-size: 18px;
  font-weight: 600;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 20px 30px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
`;

// Add this for Figma URL input
const FigmaUrlInput = styled.div`
  display: flex;
  gap: 10px;
  margin: 0 auto;
  max-width: 600px;
`;

const UrlInput = styled.input`
  flex: 1;
  padding: 8px 16px;
  font-size: 16px;
  border-radius: 8px;
  border: 1px solid #E3E6EA;
  color: #333;
  font-family: 'Plus Jakarta Sans', sans-serif;
  
  &:focus {
    outline: none;
    border-color: #4A90E2;
  }
`;

export const Canvas: React.FC = () => {
  const { currentPage, updatePage, analyzeAndVectorizeImage, toggleOriginalImage, analyzeFigmaDesign, isLoggedIn } = usePageContext();
  
  // Canvas state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<UIComponent | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Add these state variables
  const [figmaUrl, setFigmaUrl] = useState<string>('');
  const [isValidUrl, setIsValidUrl] = useState<boolean>(true);
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  
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
              updatePage(currentPage.id, { 
                baseImage: imageUrl,
                vectorizedSvg: undefined, // Clear any previous vectorized SVG when a new image is pasted
                uiComponents: undefined,  // Clear any previous UI components
                uiAnalysis: undefined,    // Clear any previous analysis
                showOriginalWithAnalysis: false, // Reset to default view
                isAnalyzing: false // Reset analyzing state
              });
              
              // Close analysis panel when a new image is pasted
              setShowAnalysisPanel(false);
              setSelectedComponent(null);
            }
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
      
      // Check if the pasted content is a Figma URL
      const clipboardText = e.clipboardData?.getData('text');
      if (clipboardText && validateFigmaUrl(clipboardText) && analyzeFigmaDesign) {
        e.preventDefault();
        analyzeFigmaDesign(clipboardText);
        return;
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [currentPage, updatePage, analyzeFigmaDesign]);

  // Add this function to validate Figma URL
  const validateFigmaUrl = (url: string): boolean => {
    if (!url) return false;
    
    try {
      parseFigmaUrl(url);
      return true;
    } catch (error) {
      console.error('Invalid Figma URL:', error);
      return false;
    }
  };
  
  // Add function to handle Figma URL input change
  const handleFigmaUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFigmaUrl(url);
    
    // Only validate if there's a URL entered
    if (url) {
      setIsValidUrl(validateFigmaUrl(url));
    } else {
      setIsValidUrl(true); // Reset validation when empty
    }
  };
  
  // Add function to handle Figma URL submission
  const handleFigmaUrlSubmit = async () => {
    if (!validateFigmaUrl(figmaUrl)) {
      setIsValidUrl(false);
      return;
    }
    
    try {
      // Analyze the Figma design using the context function
      if (analyzeFigmaDesign) {
        await analyzeFigmaDesign(figmaUrl);
        
        // Reset the UI after processing
        setFigmaUrl('');
        setShowUrlInput(false);
      }
    } catch (error) {
      console.error('Error analyzing Figma design:', error);
      alert('Error analyzing Figma design. Please check the URL and try again.');
    }
  };
  
  // Add function to handle Figma login
  const handleFigmaLogin = async () => {
    try {
      await signInWithFigma();
    } catch (error) {
      console.error('Error signing in with Figma:', error);
      alert('Error signing in with Figma. Please try again.');
    }
  };
  
  // Handle analyze and vectorize
  const handleAnalyzeAndVectorize = async () => {
    if (!currentPage?.baseImage && !showUrlInput) {
      // If no image is loaded and URL input isn't showing, show the URL input
      setShowUrlInput(true);
      return;
    }
    
    if (showUrlInput) {
      // If URL input is showing, hide it
      setShowUrlInput(false);
      return;
    }
    
    // Proceed with existing image analysis if available
    if (currentPage?.baseImage && currentPage.analyzeAndVectorizeImage) {
      await currentPage.analyzeAndVectorizeImage();
    }
  };

  // Handle component selection
  const handleComponentClick = (component: UIComponent) => {
    setSelectedComponent(component);
  };

  // Toggle between original image and vectorized view
  const handleToggleView = () => {
    if (!toggleOriginalImage) return;
    toggleOriginalImage();
  };
  
  // Determine if analysis mode is active
  const isAnalysisMode = currentPage?.uiComponents && currentPage.uiComponents.length > 0;
  
  // Modify the render content function to include Figma URL input
  const renderContent = () => {
    // No content to show
    if (!currentPage) {
      return (
        <EmptyCanvasMessage>
          Copy a UI design to your clipboard and press Ctrl+V (or Cmd+V) to paste it here
        </EmptyCanvasMessage>
      );
    }
    
    // Show loading indicator while analyzing
    if (currentPage.isAnalyzing) {
      return (
        <LoadingIndicator>
          Analyzing and vectorizing UI...
        </LoadingIndicator>
      );
    }
    
    // Show original image when no vectorized content or analysis mode with original toggled on
    if (!currentPage.vectorizedSvg || 
        (isAnalysisMode && currentPage.showOriginalWithAnalysis)) {
      
      if (currentPage.baseImage) {
        return (
          <DesignCard>
            <AnalysisOverlayContainer>
              <DesignImage 
                src={currentPage.baseImage} 
                alt={currentPage.name}
              />
              {/* Show component overlays on original image if in analysis mode */}
              {isAnalysisMode && currentPage.uiComponents && 
                currentPage.uiComponents.map(component => (
                  <ComponentOverlay 
                    key={component.id} 
                    component={component}
                    onClick={() => handleComponentClick(component)}
                  />
                ))
              }
            </AnalysisOverlayContainer>
          </DesignCard>
        );
      }
      
      return (
        <EmptyCanvasMessage>
          No image available. Copy a UI design to your clipboard and paste it here.
        </EmptyCanvasMessage>
      );
    }
    
    // Show vectorized SVG (with or without overlays)
    return (
      <DesignCard>
        <VectorizedSvgContainer dangerouslySetInnerHTML={{ __html: currentPage.vectorizedSvg }} />
        {/* Show component overlays if in analysis mode and not showing original */}
        {isAnalysisMode && !currentPage.showOriginalWithAnalysis && 
          currentPage.uiComponents && 
          currentPage.uiComponents.map(component => (
            <ComponentOverlay 
              key={component.id} 
              component={component}
              onClick={() => handleComponentClick(component)}
            />
          ))
        }
      </DesignCard>
    );
  };
  
  // Add this before the return statement
  if (showUrlInput) {
    return (
      <DesignContainer>
        <DesignCard style={{ padding: '20px', minWidth: '600px' }}>
          <h3 style={{ marginBottom: '20px' }}>Import Figma Design</h3>
          <p style={{ marginBottom: '20px' }}>
            Paste a "Copy link to selection" URL from Figma to analyze and improve the design.
          </p>
          <FigmaUrlInput>
            <UrlInput
              type="text"
              placeholder="Paste Figma URL here..."
              value={figmaUrl}
              onChange={handleFigmaUrlChange}
              style={isValidUrl ? {} : { borderColor: '#e74c3c' }}
            />
            <ActionButton
              className="primary"
              onClick={handleFigmaUrlSubmit}
              disabled={!isValidUrl || !figmaUrl}
            >
              Import
            </ActionButton>
          </FigmaUrlInput>
          {!isValidUrl && (
            <p style={{ color: '#e74c3c', marginTop: '10px', fontSize: '14px' }}>
              Please enter a valid Figma URL (Copy link to selection format).
            </p>
          )}
          {!isLoggedIn && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <p style={{ marginBottom: '10px' }}>
                Login with Figma to access your designs:
              </p>
              <ActionButton onClick={handleFigmaLogin}>
                Login with Figma
              </ActionButton>
            </div>
          )}
        </DesignCard>
      </DesignContainer>
    );
  }
  
  return (
    <>
      <GlobalStyle />
      <CanvasContainer>
        <CanvasHeader>
          <Logo>
            <LogoImage src={logo} alt="Coterate Logo" />
            Coterate UI
          </Logo>
          
          <div>
            {isAnalysisMode && (
              <DisplayModeToggle>
                <ToggleButton 
                  active={!currentPage?.showOriginalWithAnalysis} 
                  onClick={handleToggleView}
                >
                  Vectorized
                </ToggleButton>
                <ToggleButton 
                  active={!!currentPage?.showOriginalWithAnalysis} 
                  onClick={handleToggleView}
                >
                  Original
                </ToggleButton>
              </DisplayModeToggle>
            )}
          </div>
          
          <HeaderActions>
            <ActionButton onClick={resetCanvas}>
              Reset View
            </ActionButton>
            <ActionButton 
              className={`primary ${(!currentPage || !currentPage.baseImage || currentPage.isAnalyzing) ? 'disabled' : ''}`}
              onClick={handleAnalyzeAndVectorize}
              disabled={!currentPage || !currentPage.baseImage || currentPage.isAnalyzing}
            >
              {currentPage?.isAnalyzing ? 'Analyzing...' : 'Analyze & Vectorize'}
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
              {renderContent()}
            </DesignContainer>
          </CanvasContent>
        </InfiniteCanvas>
        
        {/* Analysis Panel */}
        <AnalysisPanel hidden={!showAnalysisPanel}>
          <AnalysisPanelTitle>UI Analysis</AnalysisPanelTitle>
          
          {selectedComponent ? (
            <>
              <div>
                <ComponentTypeChip type={selectedComponent.type}>
                  {selectedComponent.type.replace('_', ' ')}
                </ComponentTypeChip>
                {selectedComponent.content && <span>{selectedComponent.content}</span>}
              </div>
              
              <ComponentDetailSection>
                <DetailItem>
                  <span className="label">Position</span>
                  <span className="value">x: {Math.round(selectedComponent.position.x)}, y: {Math.round(selectedComponent.position.y)}</span>
                </DetailItem>
                
                <DetailItem>
                  <span className="label">Size</span>
                  <span className="value">w: {Math.round(selectedComponent.position.width)}, h: {Math.round(selectedComponent.position.height)}</span>
                </DetailItem>
                
                {selectedComponent.style.colors && (
                  <DetailItem>
                    <span className="label">Colors</span>
                    <span className="value">
                      {selectedComponent.style.colors.map((color, i) => (
                        color !== 'none' && <ColorSwatch key={i} color={color} />
                      ))}
                    </span>
                  </DetailItem>
                )}
                
                {selectedComponent.style.borderRadius && (
                  <DetailItem>
                    <span className="label">Border Radius</span>
                    <span className="value">{selectedComponent.style.borderRadius}px</span>
                  </DetailItem>
                )}
                
                {selectedComponent.style.fontSize && (
                  <DetailItem>
                    <span className="label">Font Size</span>
                    <span className="value">{selectedComponent.style.fontSize}px</span>
                  </DetailItem>
                )}
              </ComponentDetailSection>

              {/* Display vectorized version of the individual component if available */}
              {selectedComponent.vectorizedSvg && (
                <div>
                  <h3>Component Vector</h3>
                  <VectorizedSvgContainer 
                    dangerouslySetInnerHTML={{ __html: selectedComponent.vectorizedSvg }} 
                    style={{ maxWidth: '100%', maxHeight: '200px', overflow: 'auto' }}
                  />
                </div>
              )}
              
              <SuggestionsContainer>
                <h3>Improvement Suggestions</h3>
                {currentPage?.uiAnalysis?.improvementSuggestions
                  .find(s => s.component === selectedComponent.id)?.suggestions.map((suggestion, index) => (
                    <SuggestionItem key={index}>
                      {suggestion}
                    </SuggestionItem>
                  ))}
              </SuggestionsContainer>
              
              <ActionButton onClick={() => setSelectedComponent(null)}>
                Back to All Components
              </ActionButton>
            </>
          ) : (
            <>
              <div>
                {currentPage?.uiComponents && (
                  <>{currentPage.uiComponents.length} components detected</>
                )}
              </div>
              
              {currentPage?.uiComponents?.map(component => (
                <div 
                  key={component.id} 
                  style={{ 
                    padding: '12px', 
                    borderRadius: '8px', 
                    backgroundColor: '#F8F9FA',
                    marginBottom: '8px',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleComponentClick(component)}
                >
                  <ComponentTypeChip type={component.type}>
                    {component.type.replace('_', ' ')}
                  </ComponentTypeChip>
                  {component.content ? (
                    <span style={{ fontSize: '14px' }}>{component.content.substring(0, 20)}{component.content.length > 20 ? '...' : ''}</span>
                  ) : (
                    <span style={{ fontSize: '14px' }}>
                      {Math.round(component.position.width)} × {Math.round(component.position.height)}
                    </span>
                  )}
                </div>
              ))}
              
              <ActionButton onClick={() => setShowAnalysisPanel(false)}>
                Close Panel
              </ActionButton>
            </>
          )}
        </AnalysisPanel>
      </CanvasContainer>
    </>
  );
}; 
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type CursorMode = 'pointer' | 'hand';

interface CursorContextType {
  cursorMode: CursorMode;
  effectiveCursorMode: CursorMode; // The actual mode including spacebar/middle mouse override
  setCursorMode: (mode: CursorMode) => void;
  isSpacebarPressed: boolean;
  isMiddleMousePressed: boolean;
}

const CursorContext = createContext<CursorContextType>({
  cursorMode: 'pointer',
  effectiveCursorMode: 'pointer',
  setCursorMode: () => {},
  isSpacebarPressed: false,
  isMiddleMousePressed: false,
});

export const useCursorContext = () => useContext(CursorContext);

interface CursorProviderProps {
  children: ReactNode;
}

export const CursorProvider: React.FC<CursorProviderProps> = ({ children }) => {
  const [cursorMode, setCursorMode] = useState<CursorMode>('pointer');
  const [isSpacebarPressed, setIsSpacebarPressed] = useState(false);
  const [isMiddleMousePressed, setIsMiddleMousePressed] = useState(false);

  // Calculate the effective cursor mode (considering spacebar or middle mouse override)
  const effectiveCursorMode: CursorMode = (isSpacebarPressed || isMiddleMousePressed) ? 'hand' : cursorMode;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if spacebar is pressed and not in an input field
      if (event.code === 'Space' && !isSpacebarPressed) {
        // Prevent spacebar from triggering if user is typing in an input/textarea
        const target = event.target as HTMLElement;
        const isInputField = target.tagName === 'INPUT' || 
                           target.tagName === 'TEXTAREA' || 
                           target.contentEditable === 'true';
        
        if (!isInputField) {
          event.preventDefault(); // Prevent page scroll
          setIsSpacebarPressed(true);
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setIsSpacebarPressed(false);
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      // Check for middle mouse button (button 1)
      if (event.button === 1 && !isMiddleMousePressed) {
        event.preventDefault(); // Prevent default middle-click behavior (auto-scroll)
        setIsMiddleMousePressed(true);
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      // Check for middle mouse button (button 1)
      if (event.button === 1) {
        setIsMiddleMousePressed(false);
      }
    };

    // Handle window blur to reset both spacebar and middle mouse state
    const handleWindowBlur = () => {
      setIsSpacebarPressed(false);
      setIsMiddleMousePressed(false);
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleWindowBlur);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isSpacebarPressed, isMiddleMousePressed]);

  return (
    <CursorContext.Provider value={{ 
      cursorMode, 
      effectiveCursorMode, 
      setCursorMode, 
      isSpacebarPressed,
      isMiddleMousePressed
    }}>
      {children}
    </CursorContext.Provider>
  );
}; 
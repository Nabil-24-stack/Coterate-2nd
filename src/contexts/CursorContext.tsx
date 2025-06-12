import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type CursorMode = 'pointer' | 'hand';

interface CursorContextType {
  cursorMode: CursorMode;
  effectiveCursorMode: CursorMode; // The actual mode including spacebar override
  setCursorMode: (mode: CursorMode) => void;
  isSpacebarPressed: boolean;
}

const CursorContext = createContext<CursorContextType>({
  cursorMode: 'pointer',
  effectiveCursorMode: 'pointer',
  setCursorMode: () => {},
  isSpacebarPressed: false,
});

export const useCursorContext = () => useContext(CursorContext);

interface CursorProviderProps {
  children: ReactNode;
}

export const CursorProvider: React.FC<CursorProviderProps> = ({ children }) => {
  const [cursorMode, setCursorMode] = useState<CursorMode>('pointer');
  const [isSpacebarPressed, setIsSpacebarPressed] = useState(false);

  // Calculate the effective cursor mode (considering spacebar override)
  const effectiveCursorMode: CursorMode = isSpacebarPressed ? 'hand' : cursorMode;

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

    // Handle window blur to reset spacebar state if user switches tabs/windows
    const handleWindowBlur = () => {
      setIsSpacebarPressed(false);
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isSpacebarPressed]);

  return (
    <CursorContext.Provider value={{ 
      cursorMode, 
      effectiveCursorMode, 
      setCursorMode, 
      isSpacebarPressed 
    }}>
      {children}
    </CursorContext.Provider>
  );
}; 
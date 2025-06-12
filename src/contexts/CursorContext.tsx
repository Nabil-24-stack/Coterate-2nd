import React, { createContext, useContext, useState, ReactNode } from 'react';

export type CursorMode = 'pointer' | 'hand';

interface CursorContextType {
  cursorMode: CursorMode;
  setCursorMode: (mode: CursorMode) => void;
}

const CursorContext = createContext<CursorContextType>({
  cursorMode: 'pointer',
  setCursorMode: () => {},
});

export const useCursorContext = () => useContext(CursorContext);

interface CursorProviderProps {
  children: ReactNode;
}

export const CursorProvider: React.FC<CursorProviderProps> = ({ children }) => {
  const [cursorMode, setCursorMode] = useState<CursorMode>('pointer');

  return (
    <CursorContext.Provider value={{ cursorMode, setCursorMode }}>
      {children}
    </CursorContext.Provider>
  );
}; 
import React, { createContext, useContext, useState } from 'react';
import { Page, PageContextType } from '../types';
import { vectorizeImage, isRecraftConfigured } from '../services/RecraftService';

// Simple function to generate a UUID
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Create the context with a default value
const PageContext = createContext<PageContextType>({
  pages: [],
  currentPage: null,
  addPage: () => {},
  updatePage: () => {},
  deletePage: () => {},
  setCurrentPage: () => {},
  renamePage: () => {},
  vectorizeCurrentPage: async () => {}
});

// Custom hook to use the context
export const usePageContext = () => useContext(PageContext);

// Provider component
export const PageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State for pages
  const [pages, setPages] = useState<Page[]>(() => {
    // Initialize with a default page
    const defaultPage: Page = {
      id: generateUUID(),
      name: 'Default Page',
      baseImage: ''
    };
    
    return [defaultPage];
  });
  
  // State for current page
  const [currentPage, setCurrentPage] = useState<Page | null>(() => pages[0]);
  
  // Add a new page
  const addPage = (name: string) => {
    const newPage: Page = {
      id: generateUUID(),
      name: name || `Page ${pages.length + 1}`,
      baseImage: ''
    };
    
    setPages(prevPages => [...prevPages, newPage]);
    setCurrentPage(newPage);
  };
  
  // Update a page
  const updatePage = (id: string, updates: Partial<Page>) => {
    setPages(prevPages => 
      prevPages.map(page => 
        page.id === id ? { ...page, ...updates } : page
      )
    );
    
    // Update current page if it's the one being updated
    if (currentPage && currentPage.id === id) {
      setCurrentPage(prevPage => ({
        ...prevPage!,
        ...updates
      }));
    }
  };
  
  // Delete a page
  const deletePage = (id: string) => {
    // Remove from local state
    const newPages = pages.filter(page => page.id !== id);
    setPages(newPages);
    
    // If the deleted page was the current page, set a new current page
    if (currentPage && currentPage.id === id) {
      if (newPages.length > 0) {
        setCurrentPage(newPages[0]);
      } else {
        setCurrentPage(null);
      }
    }
  };
  
  // Rename a page
  const renamePage = (id: string, newName: string) => {
    updatePage(id, { name: newName });
  };

  // Vectorize the current page's image
  const vectorizeCurrentPage = async () => {
    // Check if API is configured
    if (!isRecraftConfigured()) {
      console.error('Recraft API key not configured');
      return;
    }

    // Check if we have a current page and it has an image
    if (!currentPage || !currentPage.baseImage) {
      console.error('No image available to vectorize');
      return;
    }

    try {
      // Call the Recraft API to vectorize the image
      const svgData = await vectorizeImage(currentPage.baseImage);
      
      // Update the current page with the vectorized SVG
      if (svgData) {
        updatePage(currentPage.id, { vectorizedSvg: svgData });
      }
    } catch (error) {
      console.error('Error vectorizing image:', error);
    }
  };
  
  return (
    <PageContext.Provider
      value={{
        pages,
        currentPage,
        addPage,
        updatePage,
        deletePage,
        setCurrentPage,
        renamePage,
        vectorizeCurrentPage
      }}
    >
      {children}
    </PageContext.Provider>
  );
}; 
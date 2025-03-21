import React, { createContext, useContext, useState } from 'react';
import { Page, PageContextType, UIComponent, UIAnalysis } from '../types';
import { vectorizeImage, vectorizeAllComponents, isRecraftConfigured } from '../services/RecraftService';
import { analyzeImageWithGPT4Vision, generateImprovementSuggestions } from '../services/ImageAnalysisService';

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
  analyzeAndVectorizeImage: async () => {},
  toggleOriginalImage: () => {}
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
      baseImage: '',
      showOriginalWithAnalysis: false,
      isAnalyzing: false
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
      baseImage: '',
      showOriginalWithAnalysis: false,
      isAnalyzing: false
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

  // Toggle between original image and vectorized SVG
  const toggleOriginalImage = () => {
    if (!currentPage) return;
    
    updatePage(currentPage.id, { 
      showOriginalWithAnalysis: !currentPage.showOriginalWithAnalysis 
    });
  };

  // Single function to analyze the image, identify components, and vectorize them
  const analyzeAndVectorizeImage = async () => {
    // Check if we have a current page and it has an image
    if (!currentPage || !currentPage.baseImage) {
      console.error('No image available to analyze');
      return;
    }

    try {
      // Set the analyzing state to show loading
      updatePage(currentPage.id, { isAnalyzing: true });

      // Step 1: Analyze the image with GPT-4o Vision to identify components
      console.log('Analyzing image with GPT-4o Vision...');
      const components = await analyzeImageWithGPT4Vision(currentPage.baseImage);
      
      if (!components || components.length === 0) {
        throw new Error('No components identified in the image');
      }
      
      console.log(`Identified ${components.length} components`);

      // Step 2: Generate improvement suggestions
      console.log('Generating improvement suggestions...');
      const analysis = await generateImprovementSuggestions(components, currentPage.baseImage);
      
      // Step 3: Vectorize all components
      console.log('Vectorizing components...');
      
      // Check if Recraft API is configured
      if (!isRecraftConfigured()) {
        console.error('Recraft API key not configured');
        
        // Still update with the analysis results without vectorization
        updatePage(currentPage.id, {
          uiComponents: components,
          uiAnalysis: analysis,
          showOriginalWithAnalysis: true,
          isAnalyzing: false
        });
        
        return;
      }
      
      // Vectorize all components
      const vectorizedComponents = await vectorizeAllComponents(currentPage.baseImage, components);
      
      // Generate a full vectorized version as well for context
      const fullVectorizedSvg = await vectorizeImage(currentPage.baseImage, true);
      
      // Step 4: Update the page with all the results
      updatePage(currentPage.id, {
        vectorizedSvg: fullVectorizedSvg,
        uiComponents: vectorizedComponents,
        uiAnalysis: analysis,
        showOriginalWithAnalysis: true, // Start with showing original image with overlays
        isAnalyzing: false
      });
    } catch (error) {
      console.error('Error in analyze and vectorize process:', error);
      // Reset the analyzing state
      updatePage(currentPage.id, { isAnalyzing: false });
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
        analyzeAndVectorizeImage,
        toggleOriginalImage
      }}
    >
      {children}
    </PageContext.Provider>
  );
}; 
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Page, PageContextType, UIComponent, UIAnalysis } from '../types';
import { analyzeImageWithGPT4Vision, generateImprovementSuggestions } from '../services/ImageAnalysisService';
import { importFigmaDesign, isFigmaApiConfigured } from '../services/FigmaService';
import { isAuthenticated, getPages, savePage, deletePage as deletePageFromDB } from '../services/SupabaseService';

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
  analyzeFigmaDesign: async () => {},
  analyzeAndVectorizeImage: async () => {},
  toggleOriginalImage: () => {},
  isLoggedIn: false,
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
  
  // State for authentication status
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  
  // Check authentication status and load user's pages on mount
  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      setIsLoggedIn(authenticated);
      
      // If logged in, load pages from Supabase
      if (authenticated) {
        try {
          const userPages = await getPages();
          if (userPages.length > 0) {
            setPages(userPages);
            setCurrentPage(userPages[0]);
          }
        } catch (error) {
          console.error('Error loading pages:', error);
        }
      }
    };
    
    checkAuth();
  }, []);
  
  // Add a new page
  const addPage = async (name: string) => {
    const newPage: Page = {
      id: generateUUID(),
      name: name || `Page ${pages.length + 1}`,
      baseImage: '',
      showOriginalWithAnalysis: false,
      isAnalyzing: false
    };
    
    setPages(prevPages => [...prevPages, newPage]);
    setCurrentPage(newPage);
    
    // Save to Supabase if logged in
    if (isLoggedIn) {
      try {
        await savePage(newPage);
      } catch (error) {
        console.error('Error saving new page:', error);
      }
    }
  };
  
  // Update a page
  const updatePage = async (id: string, updates: Partial<Page>) => {
    let updatedPage: Page | null = null;
    
    setPages(prevPages => {
      const newPages = prevPages.map(page => {
        if (page.id === id) {
          updatedPage = { ...page, ...updates };
          return updatedPage;
        }
        return page;
      });
      return newPages;
    });
    
    // Update current page if it's the one being updated
    if (currentPage && currentPage.id === id) {
      setCurrentPage(prevPage => ({
        ...prevPage!,
        ...updates
      }));
    }
    
    // Save to Supabase if logged in
    if (isLoggedIn && updatedPage) {
      try {
        await savePage(updatedPage);
      } catch (error) {
        console.error('Error updating page:', error);
      }
    }
  };
  
  // Delete a page
  const deletePage = async (id: string) => {
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
    
    // Delete from Supabase if logged in
    if (isLoggedIn) {
      try {
        await deletePageFromDB(id);
      } catch (error) {
        console.error('Error deleting page:', error);
      }
    }
  };
  
  // Rename a page
  const renamePage = async (id: string, newName: string) => {
    await updatePage(id, { name: newName });
  };

  // Toggle between original image and analysis view
  const toggleOriginalImage = () => {
    if (!currentPage) return;
    
    updatePage(currentPage.id, { 
      showOriginalWithAnalysis: !currentPage.showOriginalWithAnalysis 
    });
  };

  // Analyze Figma design
  const analyzeFigmaDesign = async (figmaUrl: string) => {
    if (!currentPage) {
      console.error('No current page to add design to');
      return;
    }

    try {
      // Set the analyzing state to show loading
      updatePage(currentPage.id, { isAnalyzing: true });

      // Step 1: Check if Figma API is configured
      const figmaConfigured = await isFigmaApiConfigured();
      if (!figmaConfigured) {
        throw new Error('Figma API is not configured. Please login with Figma first.');
      }

      // Step 2: Import the Figma design
      console.log('Importing Figma design...');
      const {
        components,
        imageData,
        fileId,
        nodeId,
      } = await importFigmaDesign(figmaUrl);

      // Step 3: Generate improvement suggestions with GPT-4o
      console.log('Generating improvement suggestions...');
      const analysis = await generateImprovementSuggestions(components, imageData);

      // Step 4: Update the page with all the results
      updatePage(currentPage.id, {
        figmaUrl,
        figmaFileId: fileId,
        figmaNodeId: nodeId,
        baseImage: imageData,
        uiComponents: components,
        uiAnalysis: analysis,
        showOriginalWithAnalysis: true,
        isAnalyzing: false
      });

      console.log('Figma design analysis complete!');
    } catch (error) {
      console.error('Error analyzing Figma design:', error);
      // Reset the analyzing state
      updatePage(currentPage.id, { isAnalyzing: false });
    }
  };

  // Keep the legacy image analysis for backward compatibility
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
      
      // Step 3: Update the page with the results (no vectorization)
      updatePage(currentPage.id, {
        uiComponents: components,
        uiAnalysis: analysis,
        showOriginalWithAnalysis: true,
        isAnalyzing: false
      });
    } catch (error) {
      console.error('Error in analyze process:', error);
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
        analyzeFigmaDesign,
        analyzeAndVectorizeImage,
        toggleOriginalImage,
        isLoggedIn,
      }}
    >
      {children}
    </PageContext.Provider>
  );
}; 
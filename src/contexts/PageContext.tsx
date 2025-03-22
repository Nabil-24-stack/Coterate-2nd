import React, { createContext, useContext, useState, useEffect } from 'react';
import { Page, PageContextType, UIComponent, UIAnalysis } from '../types';
import { analyzeImageWithGPT4Vision, generateImprovementSuggestions } from '../services/ImageAnalysisService';
import { importFigmaDesign, isFigmaApiConfigured } from '../services/FigmaService';
import { isAuthenticated, getPages, savePage, deletePage as deletePageFromDB, refreshAuthState } from '../services/SupabaseService';
import { getSupabase } from '../services/SupabaseService';

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
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Check authentication status and load user's pages on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { isLoggedIn, user } = await refreshAuthState();
      
      console.log("Auth state refreshed:", isLoggedIn ? "Logged in" : "Not logged in");
      setIsLoggedIn(isLoggedIn);
      setUserProfile(user);
      
      // If logged in, load pages from Supabase
      if (isLoggedIn) {
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
    
    // Set up auth state change listener
    const supabase = getSupabase();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change event:", event);
        
        if (event === 'SIGNED_IN') {
          console.log("User signed in!");
          
          try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (!error && user) {
              console.log("User data fetched after sign in:", user.email);
              console.log("User metadata:", user.user_metadata);
              
              // Explicitly update the state with the user profile
              setIsLoggedIn(true);
              setUserProfile(user);
              
              // Load user's pages
              try {
                const userPages = await getPages();
                if (userPages.length > 0) {
                  setPages(userPages);
                  setCurrentPage(userPages[0]);
                }
              } catch (error) {
                console.error('Error loading pages after sign in:', error);
              }
            }
          } catch (error) {
            console.error("Error fetching user after sign in:", error);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log("User signed out!");
          setIsLoggedIn(false);
          setUserProfile(null);
          
          // Reset to default page
          const defaultPage: Page = {
            id: generateUUID(),
            name: 'Default Page',
            baseImage: '',
            showOriginalWithAnalysis: false,
            isAnalyzing: false
          };
          setPages([defaultPage]);
          setCurrentPage(defaultPage);
        } else if (event === 'TOKEN_REFRESHED') {
          // When a token is refreshed, update the auth state
          console.log("Auth token refreshed!");
          const { isLoggedIn, user } = await refreshAuthState();
          
          // Update state with refreshed data
          setIsLoggedIn(isLoggedIn);
          if (user) {
            setUserProfile(user);
          }
        } else if (event === 'USER_UPDATED') {
          console.log("User data updated!");
          
          // Get the updated user data
          const { data: { user }, error } = await supabase.auth.getUser();
          if (!error && user) {
            console.log("Updated user data:", user.user_metadata);
            setUserProfile(user);
          }
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
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
      throw new Error('No current page to add design to');
    }

    try {
      // Set the analyzing state to show loading
      updatePage(currentPage.id, { 
        isAnalyzing: true,
        // Clear any previous error state
        error: undefined 
      });

      // Step 1: Check if Figma API is configured
      const figmaConfigured = await isFigmaApiConfigured();
      if (!figmaConfigured) {
        throw new Error('Figma API is not configured. Please login with Figma first.');
      }

      // Step 2: Import the Figma design
      console.log('Importing Figma design...');
      try {
        const {
          components,
          imageData,
          fileId,
          nodeId,
        } = await importFigmaDesign(figmaUrl);
        
        // Step 3: Update the page with the imported design
        console.log('Design imported successfully, updating page...');
        
        // Update the page with the design data
        updatePage(currentPage.id, {
          baseImage: imageData,
          uiComponents: components,
          figmaFileId: fileId,
          figmaNodeId: nodeId,
          figmaUrl: figmaUrl,
          isAnalyzing: false,
        });
      } catch (error: any) {
        console.error('Error importing Figma design:', error);
        // Update the page with the error
        updatePage(currentPage.id, {
          isAnalyzing: false,
          error: error.message || 'Failed to import Figma design.'
        });
        throw error;
      }
    } catch (error: any) {
      console.error('Error analyzing Figma design:', error);
      // Make sure to update the page with the error and stop the analyzing state
      updatePage(currentPage.id, {
        isAnalyzing: false,
        error: error.message || 'Error analyzing Figma design'
      });
      throw error;
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
        userProfile,
      }}
    >
      {children}
    </PageContext.Provider>
  );
}; 
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Page, PageContextType, UIComponent, UIAnalysis } from '../types';
import { analyzeImageWithGPT4Vision, generateImprovementSuggestions } from '../services/ImageAnalysisService';
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
    
    // Return cleanup function
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Add a new page
  const addPage = (name: string) => {
    // Generate a unique ID
    const id = generateUUID();
    
    // Create a new page with default values
    const newPage: Page = {
      id,
      name: name || `Page ${pages.length + 1}`,
      baseImage: '',
      showOriginalWithAnalysis: false,
      isAnalyzing: false
    };
    
    // Update state with the new page
    setPages(prevPages => [...prevPages, newPage]);
    setCurrentPage(newPage);
    
    // Save to Supabase if user is logged in
    if (isLoggedIn) {
      savePage(newPage).catch(error => {
        console.error('Error saving new page:', error);
      });
    }
  };
  
  // Update an existing page
  const updatePage = (id: string, updates: Partial<Page>) => {
    setPages(prevPages => {
      const newPages = prevPages.map(page => 
        page.id === id ? { ...page, ...updates } : page
      );
      return newPages;
    });
    
    // Update current page if it's the one being updated
    if (currentPage && currentPage.id === id) {
      setCurrentPage(prevPage => {
        if (prevPage) {
          return { ...prevPage, ...updates };
        }
        return prevPage;
      });
    }
    
    // Save to Supabase if user is logged in
    if (isLoggedIn) {
      const updatedPage = pages.find(page => page.id === id);
      if (updatedPage) {
        const mergedPage = { ...updatedPage, ...updates };
        savePage(mergedPage).catch(error => {
          console.error('Error updating page:', error);
        });
      }
    }
  };
  
  // Delete a page
  const deletePage = (id: string) => {
    // Check if the page to delete exists
    const pageToDelete = pages.find(page => page.id === id);
    if (!pageToDelete) return;
    
    // Remove the page from state
    const newPages = pages.filter(page => page.id !== id);
    setPages(newPages);
    
    // Update current page if needed
    if (currentPage && currentPage.id === id) {
      // Select a new current page (first available)
      setCurrentPage(newPages.length > 0 ? newPages[0] : null);
    }
    
    // Delete from Supabase if user is logged in
    if (isLoggedIn) {
      deletePageFromDB(id).catch(error => {
        console.error('Error deleting page:', error);
      });
    }
  };
  
  // Rename a page
  const renamePage = (id: string, newName: string) => {
    updatePage(id, { name: newName });
  };
  
  // Toggle between original image and vectorized view
  const toggleOriginalImage = () => {
    if (!currentPage) return;
    
    updatePage(currentPage.id, { 
      showOriginalWithAnalysis: !currentPage.showOriginalWithAnalysis 
    });
  };

  // Handle analyze and vectorize
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
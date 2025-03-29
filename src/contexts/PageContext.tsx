import React, { createContext, useContext, useState, useEffect } from 'react';
import { Page, PageContextType } from '../types';
import supabaseService from '../services/SupabaseService';

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
  loading: false,
});

// Custom hook to use the context
export const usePageContext = () => useContext(PageContext);

// Provider component
export const PageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State for pages
  const [pages, setPages] = useState<Page[]>([]);
  // State for current page
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  // Loading state
  const [loading, setLoading] = useState(true);
  
  // Effect to load pages from Supabase when the component mounts
  useEffect(() => {
    const loadPages = async () => {
      try {
        setLoading(true);
        console.log('PageContext: Loading pages from Supabase');
        // Check if user is authenticated
        const isAuthenticated = await supabaseService.getSession();
        console.log('PageContext: User authentication status:', !!isAuthenticated);
        
        if (isAuthenticated) {
          // Load pages from Supabase
          const pagesFromDB = await supabaseService.getPages();
          console.log('PageContext: Loaded pages from Supabase:', pagesFromDB);
          
          if (pagesFromDB.length > 0) {
            console.log('PageContext: Using existing pages from DB');
            setPages(pagesFromDB);
            setCurrentPage(pagesFromDB[0]);
            console.log('PageContext: First page designs:', pagesFromDB[0].designs);
          } else {
            // Create a default page if no pages exist
            console.log('PageContext: No pages found, creating default page');
            const defaultPage: Page = {
              id: generateUUID(),
              name: 'Default Page',
              baseImage: '',
              designs: []
            };
            
            // Save the default page to Supabase
            const savedPage = await supabaseService.createPage(defaultPage);
            console.log('PageContext: Created new default page in DB:', savedPage);
            setPages([savedPage]);
            setCurrentPage(savedPage);
          }
        } else {
          // If not authenticated, use a local default page
          console.log('PageContext: User not authenticated, using local default page');
          const defaultPage: Page = {
            id: generateUUID(),
            name: 'Default Page',
            baseImage: '',
            designs: []
          };
          
          setPages([defaultPage]);
          setCurrentPage(defaultPage);
        }
      } catch (error) {
        console.error('Error loading pages:', error);
        // Fallback to local default page on error
        console.log('PageContext: Error loading pages, using fallback default page');
        const defaultPage: Page = {
          id: generateUUID(),
          name: 'Default Page',
          baseImage: '',
          designs: []
        };
        
        setPages([defaultPage]);
        setCurrentPage(defaultPage);
      } finally {
        setLoading(false);
      }
    };
    
    loadPages();
  }, []);
  
  // Add a new page
  const addPage = async (name: string, baseImage?: string) => {
    try {
      const newPage: Page = {
        id: generateUUID(),
        name: name || `Page ${pages.length + 1}`,
        baseImage: baseImage || '',
        designs: []
      };
      
      // Check if user is authenticated
      const isAuthenticated = await supabaseService.getSession();
      
      let savedPage = newPage;
      
      if (isAuthenticated) {
        // Save the new page to Supabase
        console.log('PageContext: Creating new page in Supabase:', newPage);
        savedPage = await supabaseService.createPage(newPage);
        console.log('PageContext: Saved new page to Supabase:', savedPage);
      }
      
      setPages(prevPages => [...prevPages, savedPage]);
      setCurrentPage(savedPage);
      
      return savedPage;
    } catch (error) {
      console.error('Error adding page:', error);
      throw error;
    }
  };
  
  // Update a page
  const updatePage = async (id: string, updates: Partial<Page>) => {
    try {
      console.log(`PageContext: Updating page ${id} with:`, updates);
      
      // Update local state first for immediate UI feedback
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
      
      // Check if user is authenticated
      const isAuthenticated = await supabaseService.getSession();
      console.log('PageContext: User authentication status for update:', !!isAuthenticated);
      
      if (isAuthenticated) {
        // Save the updated page to Supabase
        console.log('PageContext: Saving page update to Supabase');
        try {
          const result = await supabaseService.updatePage(id, updates);
          console.log('PageContext: Successfully updated page in Supabase:', result);
        } catch (error) {
          console.error('Error saving page update to Supabase:', error);
        }
      } else {
        console.log('PageContext: User not authenticated, skipping Supabase update');
      }
    } catch (error) {
      console.error('Error updating page:', error);
    }
  };
  
  // Delete a page
  const deletePage = async (id: string) => {
    try {
      // Remove from local state first for immediate UI feedback
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
      
      // Check if user is authenticated
      const isAuthenticated = await supabaseService.getSession();
      
      if (isAuthenticated) {
        // Delete the page from Supabase (async, don't await)
        supabaseService.deletePage(id)
          .catch(error => console.error('Error deleting page from Supabase:', error));
      }
    } catch (error) {
      console.error('Error deleting page:', error);
    }
  };
  
  // Rename a page
  const renamePage = async (id: string, newName: string) => {
    updatePage(id, { name: newName });
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
        loading,
      }}
    >
      {children}
    </PageContext.Provider>
  );
}; 
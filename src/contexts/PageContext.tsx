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
        console.log('PageContext: Loading pages from Supabase or localStorage');
        
        let loadedPages: Page[] = [];
        
        // Try to get pages from Supabase first
        try {
          console.log('PageContext: Attempting to load pages from Supabase');
          const session = await supabaseService.getSession();
          console.log('PageContext: Session available:', !!session);
          
          if (session) {
            console.log('PageContext: User authenticated, loading pages from Supabase');
            const supabasePages = await supabaseService.getPages();
            
            if (supabasePages && supabasePages.length > 0) {
              console.log(`PageContext: Successfully loaded ${supabasePages.length} pages from Supabase`);
              loadedPages = supabasePages;
              
              // Store loaded pages in localStorage as a fallback for offline access
              try {
                localStorage.setItem('coterate_pages', JSON.stringify(loadedPages));
                console.log('PageContext: Stored loaded pages in localStorage');
              } catch (storageError) {
                console.error('PageContext: Error storing pages in localStorage:', storageError);
              }
            } else {
              console.log('PageContext: No pages found in Supabase');
            }
          } else {
            console.log('PageContext: User not authenticated with Supabase');
          }
        } catch (supabaseError) {
          console.error('PageContext: Error loading pages from Supabase:', supabaseError);
        }
        
        // If no pages loaded from Supabase, try localStorage
        if (loadedPages.length === 0) {
          try {
            const storedPages = localStorage.getItem('coterate_pages');
            
            if (storedPages) {
              const parsedPages = JSON.parse(storedPages) as Page[];
              console.log(`PageContext: Loaded ${parsedPages.length} pages from localStorage`);
              loadedPages = parsedPages;
            }
          } catch (localStorageError) {
            console.error('PageContext: Error loading pages from localStorage:', localStorageError);
          }
        }
        
        // If still no pages or localStorage failed, create a default page
        if (loadedPages.length === 0) {
          console.log('PageContext: No pages found, creating default page');
          const defaultPage: Page = {
            id: generateUUID(),
            name: 'Default Page',
            designs: []
          };
          
          loadedPages = [defaultPage];
          
          // Try to save the default page
          const session = await supabaseService.getSession();
          if (session) {
            try {
              await supabaseService.createPage(defaultPage);
              console.log('PageContext: Default page saved to Supabase');
            } catch (error) {
              console.error('PageContext: Error saving default page to Supabase:', error);
              
              // Save to localStorage as fallback
              try {
                localStorage.setItem('coterate_pages', JSON.stringify(loadedPages));
              } catch (storageError) {
                console.error('PageContext: Error storing default page in localStorage:', storageError);
              }
            }
          } else {
            // Save to localStorage only
            try {
              localStorage.setItem('coterate_pages', JSON.stringify(loadedPages));
            } catch (storageError) {
              console.error('PageContext: Error storing default page in localStorage:', storageError);
            }
          }
        }
        
        setPages(loadedPages);
        setCurrentPage(loadedPages[0]);
        console.log('PageContext: Pages loaded successfully');
      } catch (error) {
        console.error('PageContext: Error loading pages:', error);
        
        // Create a fallback page in case of error
        const fallbackPage: Page = {
          id: generateUUID(),
          name: 'Default Page',
          designs: []
        };
        
        setPages([fallbackPage]);
        setCurrentPage(fallbackPage);
      } finally {
        setLoading(false);
      }
    };
    
    loadPages();
  }, []);
  
  // Add a new page
  const addPage = async (name: string, baseImage?: string) => {
    try {
      console.log(`PageContext: Adding new page: ${name}`);
      
      // Create new page data
      const newPage: Page = {
        id: generateUUID(),
        name,
        baseImage,
        designs: []
      };
      
      // Update local state first
      const updatedPages = [...pages, newPage];
      setPages(updatedPages);
      setCurrentPage(newPage);
      
      // Always store in localStorage
      try {
        localStorage.setItem('coterate_pages', JSON.stringify(updatedPages));
        console.log('PageContext: Updated pages in localStorage after adding new page');
      } catch (storageError) {
        console.error('PageContext: Error updating localStorage after adding page:', storageError);
      }
      
      // Check if user is authenticated and save to Supabase if logged in
      const session = await supabaseService.getSession();
      console.log('PageContext: User authentication status for add page:', !!session);
      
      if (session) {
        // Save the new page to Supabase
        console.log('PageContext: Creating page in Supabase');
        try {
          const savedPage = await supabaseService.createPage(newPage);
          console.log('PageContext: Successfully created page in Supabase:', savedPage);
          
          // Update local state with the saved page (which might have additional server-side data)
          if (savedPage) {
            setPages(prevPages => 
              prevPages.map(page => 
                page.id === newPage.id ? savedPage : page
              )
            );
            setCurrentPage(savedPage);
            
            // Update localStorage with the latest data
            try {
              const updatedPagesWithSaved = pages.map(page => 
                page.id === newPage.id ? savedPage : page
              );
              localStorage.setItem('coterate_pages', JSON.stringify(updatedPagesWithSaved));
            } catch (storageError) {
              console.error('PageContext: Error updating localStorage with saved page:', storageError);
            }
          }
        } catch (error) {
          console.error('PageContext: Error creating page in Supabase:', error);
        }
      } else {
        console.log('PageContext: User not authenticated, skipping Supabase creation (page saved to localStorage)');
      }
      
      return newPage;
    } catch (error) {
      console.error('PageContext: Error adding page:', error);
      return null;
    }
  };
  
  // Update a page
  const updatePage = async (id: string, updates: Partial<Page>) => {
    try {
      console.log(`PageContext: Updating page ${id} with:`, updates);
      
      // Update local state first for immediate UI feedback
      const updatedPages = pages.map(page => 
        page.id === id ? { ...page, ...updates } : page
      );
      setPages(updatedPages);
      
      // Update current page if it's the one being updated
      if (currentPage && currentPage.id === id) {
        setCurrentPage(prevPage => ({
          ...prevPage!,
          ...updates
        }));
      }
      
      // Always store updates in localStorage for persistence across refreshes
      try {
        localStorage.setItem('coterate_pages', JSON.stringify(updatedPages));
        console.log('PageContext: Updated pages stored in localStorage');
      } catch (storageError) {
        console.error('PageContext: Error storing updated pages in localStorage:', storageError);
      }
      
      // Check if user is authenticated
      const session = await supabaseService.getSession();
      console.log('PageContext: User authentication status for update:', !!session);
      
      if (session) {
        // Save the updated page to Supabase
        console.log('PageContext: Saving page update to Supabase');
        try {
          const result = await supabaseService.updatePage(id, updates);
          console.log('PageContext: Successfully updated page in Supabase:', result);
        } catch (error) {
          console.error('PageContext: Error saving page update to Supabase:', error);
        }
      } else {
        console.log('PageContext: User not authenticated, skipping Supabase update (changes saved to localStorage)');
      }
    } catch (error) {
      console.error('PageContext: Error updating page:', error);
    }
  };
  
  // Delete a page
  const deletePage = async (id: string) => {
    try {
      console.log(`PageContext: Deleting page ${id}`);
      
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
      
      // Update localStorage to maintain consistency
      try {
        localStorage.setItem('coterate_pages', JSON.stringify(newPages));
        console.log('PageContext: Updated pages in localStorage after deletion');
      } catch (storageError) {
        console.error('PageContext: Error updating localStorage after page deletion:', storageError);
      }
      
      // Check if user is authenticated
      const session = await supabaseService.getSession();
      console.log('PageContext: User authentication status for delete:', !!session);
      
      if (session) {
        // Delete the page from Supabase
        console.log('PageContext: Deleting page from Supabase');
        try {
          await supabaseService.deletePage(id);
          console.log('PageContext: Successfully deleted page from Supabase');
        } catch (error) {
          console.error('PageContext: Error deleting page from Supabase:', error);
        }
      } else {
        console.log('PageContext: User not authenticated, skipping Supabase delete (changes saved to localStorage)');
      }
    } catch (error) {
      console.error('PageContext: Error deleting page:', error);
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
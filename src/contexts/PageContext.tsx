import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
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

// Helper function to throttle console logs
const createLogThrottler = () => {
  const logThrottles: Record<string, number> = {};
  const lastLogs: Record<string, string> = {};
  
  return (key: string, level: 'log' | 'warn' | 'error', message: string, ...args: any[]) => {
    const now = Date.now();
    const lastLog = lastLogs[key];
    
    // If this is a duplicate of the last message and within throttle period, skip it
    if (lastLog === message && logThrottles[key] && now < logThrottles[key]) {
      return;
    }
    
    // Update throttle time (5 seconds for most messages)
    logThrottles[key] = now + 5000;
    lastLogs[key] = message;
    
    // Use the appropriate console method
    if (level === 'error') {
      console.error(message, ...args);
    } else if (level === 'warn') {
      console.warn(message, ...args);
    } else {
      console.log(message, ...args);
    }
  };
};

// Provider component
export const PageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State for pages
  const [pages, setPages] = useState<Page[]>([]);
  // State for current page
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  // Loading state
  const [loading, setLoading] = useState(true);
  
  // Create throttled logger
  const throttledLog = useMemo(() => createLogThrottler(), []);
  
  // Log shortcuts
  const logInfo = useCallback((key: string, message: string, ...args: any[]) => {
    throttledLog(key, 'log', `PageContext: ${message}`, ...args);
  }, [throttledLog]);
  
  const logError = useCallback((key: string, message: string, ...args: any[]) => {
    throttledLog(key, 'error', `PageContext: ${message}`, ...args);
  }, [throttledLog]);
  
  // Effect to load pages from localStorage when the component mounts
  useEffect(() => {
    // Set a safety timeout to prevent infinite loading state
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        logInfo('safety-timeout', 'Safety timeout triggered - forcing loading state to complete');
        setLoading(false);
      }
    }, 5000); // 5 seconds max loading time
    
    const loadPages = async () => {
      try {
        setLoading(true);
        logInfo('loading', 'Loading pages from localStorage');
        
        let loadedPages: Page[] = [];
        
        // Try to load from localStorage
        try {
          const storedPages = localStorage.getItem('coterate_pages');
          
          if (storedPages) {
            const parsedPages = JSON.parse(storedPages) as Page[];
            if (parsedPages && parsedPages.length > 0) {
              logInfo('loaded-local', `Loaded ${parsedPages.length} pages from localStorage`);
              loadedPages = parsedPages;
              
              // Set pages immediately for faster rendering
              setPages(parsedPages);
              
              // Try to load the last active page ID from localStorage
              const lastActivePageId = localStorage.getItem('coterate_last_active_page');
              if (lastActivePageId) {
                const lastActivePage = parsedPages.find(page => page.id === lastActivePageId);
                if (lastActivePage) {
                  logInfo('restore-page', 'Restoring last active page:', lastActivePage.name);
                  setCurrentPage(lastActivePage);
                } else {
                  setCurrentPage(parsedPages[0]);
                }
              } else {
                setCurrentPage(parsedPages[0]);
              }
            }
          }
        } catch (localStorageError) {
          logError('local-store-error', 'Error loading pages from localStorage:', localStorageError);
        }
        
        // If no pages loaded, create a default page
        if (loadedPages.length === 0) {
          logInfo('no-pages-found', 'No pages found, creating default page');
          const defaultPage: Page = {
            id: generateUUID(),
            name: 'Default Page',
            designs: []
          };
          
          loadedPages = [defaultPage];
          
          // Save to localStorage
          try {
            localStorage.setItem('coterate_pages', JSON.stringify(loadedPages));
            localStorage.setItem('coterate_last_active_page', defaultPage.id);
            logInfo('local-stored', 'Default page saved to localStorage');
          } catch (storageError) {
            logError('local-store-error', 'Error storing default page in localStorage:', storageError);
          }
          
          setPages(loadedPages);
          setCurrentPage(defaultPage);
        }
      } catch (error) {
        logError('exception', 'Error loading pages:', error);
        
        // Create a fallback page in case of error
        const fallbackPage: Page = {
          id: generateUUID(),
          name: 'Default Page',
          designs: []
        };
        
        setPages([fallbackPage]);
        setCurrentPage(fallbackPage);
        
        // Save fallback page to localStorage
        try {
          localStorage.setItem('coterate_pages', JSON.stringify([fallbackPage]));
          localStorage.setItem('coterate_last_active_page', fallbackPage.id);
          logInfo('fallback-stored', 'Fallback page saved to localStorage');
        } catch (storageError) {
          logError('fallback-store-error', 'Error storing fallback page in localStorage:', storageError);
        }
      } finally {
        // Ensure loading is set to false
        setLoading(false);
        // Clear the safety timeout
        clearTimeout(safetyTimeout);
      }
    };
    
    loadPages();
    
    // Cleanup function to clear timeout
    return () => clearTimeout(safetyTimeout);
  }, []);
  
  // Add a useEffect to save the current page ID to localStorage when it changes
  useEffect(() => {
    if (currentPage) {
      try {
        localStorage.setItem('coterate_last_active_page', currentPage.id);
        logInfo('current-page-stored', `Saved current page ID to localStorage: ${currentPage.id}`);
      } catch (error) {
        logError('current-page-store-error', 'Error saving current page ID to localStorage:', error);
      }
    }
  }, [currentPage]);
  
  // Add a new page - modified to properly update localStorage
  const addPage = async (name: string, baseImage?: string) => {
    try {
      logInfo('adding', `Adding new page: ${name}`);
      
      // Create a new page object
      const newPage: Page = {
        id: generateUUID(),
        name,
        baseImage,
        designs: []
      };
      
      // First, get the current pages (to ensure we have the latest state)
      let currentPages = [...pages];
      
      // Add the new page to our array
      const updatedPages = [...currentPages, newPage];
      
      // Update React state
      setPages(updatedPages);
      setCurrentPage(newPage);
      
      // Save to localStorage - use the updatedPages array directly to ensure consistency
      try {
        localStorage.setItem('coterate_pages', JSON.stringify(updatedPages));
        localStorage.setItem('coterate_last_active_page', newPage.id);
        logInfo('local-stored', `Pages saved to localStorage: ${updatedPages.length} pages`);
      } catch (error) {
        logError('local-store-error', 'Error saving pages to localStorage:', error);
      }
      
      logInfo('success', `Page added successfully: ${name}`);
    } catch (error) {
      logError('add-page-error', 'Error adding page:', error);
    }
  };
  
  // Update an existing page - modified to properly update localStorage
  const updatePage = async (id: string, updates: Partial<Page>) => {
    try {
      logInfo('updating', `Updating page with ID: ${id}`);
      
      // Find the page in the current state
      const pageIndex = pages.findIndex(p => p.id === id);
      if (pageIndex === -1) {
        logError('page-not-found', `Page ${id} not found for updating`);
        return;
      }
      
      // Create an updated version of the pages array
      const updatedPages = [...pages];
      updatedPages[pageIndex] = {
        ...updatedPages[pageIndex],
        ...updates
      };
      
      // Update state
      setPages(updatedPages);
      
      // If we're updating the current page, also update the currentPage reference
      if (currentPage?.id === id) {
        setCurrentPage({
          ...currentPage,
          ...updates
        });
      }
      
      // Save to localStorage
      try {
        localStorage.setItem('coterate_pages', JSON.stringify(updatedPages));
        logInfo('local-stored', `Updated pages saved to localStorage: ${updatedPages.length} pages`);
      } catch (error) {
        logError('local-store-error', 'Error saving updated pages to localStorage:', error);
      }
    } catch (error) {
      logError('update-page-error', 'Error updating page:', error);
    }
  };
  
  // Delete a page - modified to properly update localStorage
  const deletePage = async (id: string) => {
    try {
      logInfo('deleting', `Deleting page with ID: ${id}`);
      
      // Update state by filtering out the deleted page
      const updatedPages = pages.filter(page => page.id !== id);
      
      // First update state
      setPages(updatedPages);
      
      // If the deleted page was the current page, select another page
      if (currentPage && currentPage.id === id) {
        if (updatedPages.length > 0) {
          const newCurrentPage = updatedPages[0];
          setCurrentPage(newCurrentPage);
          // Also update the last active page in localStorage
          localStorage.setItem('coterate_last_active_page', newCurrentPage.id);
        } else {
          setCurrentPage(null);
          // Clear the last active page if we have no pages left
          localStorage.removeItem('coterate_last_active_page');
        }
      }
      
      // Update localStorage
      try {
        localStorage.setItem('coterate_pages', JSON.stringify(updatedPages));
        logInfo('local-stored', `Updated pages in localStorage: ${updatedPages.length} pages remaining`);
      } catch (error) {
        logError('local-store-error', 'Error updating localStorage after deletion:', error);
      }
      
      logInfo('success', `Page deleted successfully: ${id}`);
    } catch (error) {
      logError('delete-page-error', 'Error deleting page:', error);
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
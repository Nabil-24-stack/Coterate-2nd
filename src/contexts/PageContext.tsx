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
  
  // Effect to load pages from Supabase when the component mounts
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
        logInfo('loading', 'Loading pages from Supabase or localStorage');
        
        let loadedPages: Page[] = [];
        let loadedFromLocalStorage = false;
        
        // First try to load from localStorage for immediate display
        try {
          const storedPages = localStorage.getItem('coterate_pages');
          
          if (storedPages) {
            const parsedPages = JSON.parse(storedPages) as Page[];
            if (parsedPages && parsedPages.length > 0) {
              logInfo('loaded-local-first', `Immediately loaded ${parsedPages.length} pages from localStorage`);
              loadedPages = parsedPages;
              loadedFromLocalStorage = true;
              
              // Set pages immediately for faster rendering
              setPages(parsedPages);
              
              // Try to load the last active page ID from localStorage
              const lastActivePageId = localStorage.getItem('coterate_last_active_page');
              if (lastActivePageId) {
                const lastActivePage = parsedPages.find(page => page.id === lastActivePageId);
                if (lastActivePage) {
                  logInfo('restore-page-immediate', 'Restoring last active page:', lastActivePage.name);
                  setCurrentPage(lastActivePage);
                } else {
                  setCurrentPage(parsedPages[0]);
                }
              } else {
                setCurrentPage(parsedPages[0]);
              }
              
              // Set loading to false to show content immediately
              setLoading(false);
            }
          }
        } catch (localStorageError) {
          logError('local-store-error-initial', 'Error loading pages from localStorage initially:', localStorageError);
        }
        
        // Then try to get pages from Supabase in the background
        try {
          logInfo('attempting', 'Attempting to load pages from Supabase');
          const sessionPromise = supabaseService.getSession();
          
          // Add a timeout to the session fetch
          const sessionWithTimeout = Promise.race([
            sessionPromise,
            new Promise<null>((resolve) => {
              setTimeout(() => {
                logInfo('session-timeout', 'Session fetch timed out');
                resolve(null);
              }, 3000); // 3 second timeout
            })
          ]);
          
          const session = await sessionWithTimeout;
          logInfo('session-available', 'Session available:', !!session);
          
          if (session) {
            logInfo('user-authenticated', 'User authenticated, loading pages from Supabase');
            // Use the new normalized schema method
            const supabasePages = await supabaseService.getPagesWithDesigns();
            
            if (supabasePages && supabasePages.length > 0) {
              logInfo('success', `Successfully loaded ${supabasePages.length} pages from Supabase`);
              
              // Only update if we got valid pages from Supabase
              loadedPages = supabasePages;
              
              // Store loaded pages in localStorage as a fallback for offline access
              try {
                localStorage.setItem('coterate_pages', JSON.stringify(loadedPages));
                logInfo('local-stored', 'Stored loaded pages in localStorage');
              } catch (storageError) {
                logError('local-store-error', 'Error storing pages in localStorage:', storageError);
              }
              
              // Update state with Supabase data
              setPages(loadedPages);
              
              // Update current page if needed
              const lastActivePageId = localStorage.getItem('coterate_last_active_page');
              if (lastActivePageId) {
                const lastActivePage = loadedPages.find(page => page.id === lastActivePageId);
                if (lastActivePage) {
                  setCurrentPage(lastActivePage);
                }
              } else if (!currentPage && loadedPages.length > 0) {
                setCurrentPage(loadedPages[0]);
              }
            } else {
              logInfo('no-pages-found', 'No pages found in Supabase');
            }
          } else {
            logInfo('user-not-authenticated', 'User not authenticated with Supabase');
          }
        } catch (supabaseError) {
          logError('supabase-error', 'Error loading pages from Supabase:', supabaseError);
        }
        
        // If no pages loaded from either source, create a default page
        if (loadedPages.length === 0) {
          logInfo('no-pages-found', 'No pages found, creating default page');
          const defaultPage: Page = {
            id: generateUUID(),
            name: 'Default Page',
            designs: []
          };
          
          loadedPages = [defaultPage];
          
          // Try to save the default page
          try {
            const session = await supabaseService.getSession();
            if (session) {
              try {
                await supabaseService.createPage(defaultPage);
                logInfo('success', 'Default page saved to Supabase');
              } catch (error) {
                logError('error', 'Error saving default page to Supabase:', error);
              }
            }
            
            // Save to localStorage regardless
            try {
              localStorage.setItem('coterate_pages', JSON.stringify(loadedPages));
            } catch (storageError) {
              logError('local-store-error', 'Error storing default page in localStorage:', storageError);
            }
          } catch (error) {
            logError('session-check-error', 'Error checking session for default page:', error);
            
            // Save to localStorage only
            try {
              localStorage.setItem('coterate_pages', JSON.stringify(loadedPages));
            } catch (storageError) {
              logError('local-store-error', 'Error storing default page in localStorage:', storageError);
            }
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
  
  // Effect to save the current page ID to localStorage when it changes
  useEffect(() => {
    if (currentPage?.id) {
      try {
        localStorage.setItem('coterate_last_active_page', currentPage.id);
        logInfo('saved-current-page', `Saved current page ID to localStorage: ${currentPage.id}`);
      } catch (error) {
        logError('save-current-page-error', 'Error saving current page ID to localStorage:', error);
      }
    }
  }, [currentPage?.id]);
  
  // Add a new page - modified to use only localStorage
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
      
      // Update local state
      setPages(prevPages => [...prevPages, newPage]);
      setCurrentPage(newPage);
      
      // Save to localStorage
      try {
        const updatedPages = [...pages, newPage];
        localStorage.setItem('coterate_pages', JSON.stringify(updatedPages));
        logInfo('local-stored', 'Pages saved to localStorage');
      } catch (error) {
        logError('local-store-error', 'Error saving pages to localStorage:', error);
      }
      
      logInfo('success', `Page added successfully: ${name}`);
    } catch (error) {
      logError('add-page-error', 'Error adding page:', error);
    }
  };
  
  // Update an existing page - modified to use only localStorage
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
      
      // Save to localStorage
      try {
        localStorage.setItem('coterate_pages', JSON.stringify(updatedPages));
        logInfo('local-stored', 'Updated pages saved to localStorage');
      } catch (error) {
        logError('local-store-error', 'Error saving updated pages to localStorage:', error);
      }
    } catch (error) {
      logError('update-page-error', 'Error updating page:', error);
    }
  };
  
  // Delete a page - modified to use only localStorage
  const deletePage = async (id: string) => {
    try {
      logInfo('deleting', `Deleting page with ID: ${id}`);
      
      // Update state by filtering out the deleted page
      const updatedPages = pages.filter(page => page.id !== id);
      setPages(updatedPages);
      
      // If the deleted page was the current page, select another page
      if (currentPage && currentPage.id === id) {
        if (updatedPages.length > 0) {
          setCurrentPage(updatedPages[0]);
        } else {
          setCurrentPage(null);
        }
      }
      
      // Update localStorage
      try {
        localStorage.setItem('coterate_pages', JSON.stringify(updatedPages));
        logInfo('local-stored', 'Updated pages in localStorage after deletion');
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
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
  
  // Add a new page
  const addPage = async (name: string, baseImage?: string) => {
    try {
      logInfo('adding', `Adding new page: ${name}`);
      
      const session = await supabaseService.getSession();
      
      if (session) {
        // Use the new normalized schema method
        const newPage = await supabaseService.createPageNormalized({ name });
        
        if (newPage) {
          // Update state with the new page
          setPages(prevPages => [...prevPages, newPage]);
          setCurrentPage(newPage);
          logInfo('success', `Page added successfully: ${name}`);
          return;
        }
      }
      
      // Fallback to local storage if Supabase call fails or there's no session
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
        logInfo('local-stored', 'Page saved to localStorage');
      } catch (error) {
        logError('local-store-error', 'Error saving page to localStorage:', error);
      }
    } catch (error) {
      logError('add-page-error', 'Error adding page:', error);
    }
  };
  
  // Update an existing page
  const updatePage = async (id: string, updates: Partial<Page>) => {
    try {
      logInfo('updating', `Updating page with ID: ${id}`);
      
      // Handle design updates specifically
      if (updates.designs) {
        const pageDesigns = updates.designs;
        
        // Get the current page from state
        const pageToUpdate = pages.find(p => p.id === id);
        if (!pageToUpdate) {
          logError('page-not-found', `Page ${id} not found for updating designs`);
          return;
        }
        
        // Get the session
        const session = await supabaseService.getSession();
        
        if (session) {
          // Process each design individually to use normalized schema
          // We'll need to compare with existing designs to find new, updated, or deleted designs
          const existingDesigns = pageToUpdate.designs || [];
          
          // Handle new designs (designs in updates that don't exist in current page)
          const newDesigns = pageDesigns.filter(
            design => !existingDesigns.some(existing => existing.id === design.id)
          );
          
          // Create each new design
          for (const newDesign of newDesigns) {
            try {
              await supabaseService.createDesign(id, {
                imageUrl: newDesign.imageUrl,
                position: newDesign.position,
                dimensions: newDesign.dimensions,
                figmaFileKey: newDesign.figmaFileKey,
                figmaNodeId: newDesign.figmaNodeId,
                figmaSelectionLink: newDesign.figmaSelectionLink,
                isFromFigma: newDesign.isFromFigma
              });
            } catch (error) {
              logError('create-design-error', `Error creating design for page ${id}:`, error);
            }
          }
          
          // Handle updated designs (designs that exist in both but may have changed)
          const updatedDesigns = pageDesigns.filter(
            design => existingDesigns.some(existing => existing.id === design.id)
          );
          
          // Update each modified design
          for (const updatedDesign of updatedDesigns) {
            try {
              await supabaseService.updateDesign(updatedDesign.id, {
                position: updatedDesign.position,
                dimensions: updatedDesign.dimensions,
                imageUrl: updatedDesign.imageUrl
              });
              
              // Handle iterations for each design
              if (updatedDesign.iterations) {
                const existingDesign = existingDesigns.find(d => d.id === updatedDesign.id);
                const existingIterations = existingDesign?.iterations || [];
                
                // Find new iterations
                const newIterations = updatedDesign.iterations.filter(
                  iteration => !existingIterations.some(existing => existing.id === iteration.id)
                );
                
                // Create each new iteration
                for (const newIteration of newIterations) {
                  try {
                    await supabaseService.createIteration(updatedDesign.id, {
                      htmlContent: newIteration.htmlContent,
                      cssContent: newIteration.cssContent,
                      position: newIteration.position,
                      dimensions: newIteration.dimensions,
                      analysis: newIteration.analysis
                    });
                  } catch (error) {
                    logError('create-iteration-error', `Error creating iteration for design ${updatedDesign.id}:`, error);
                  }
                }
                
                // Find updated iterations
                const updatedIterations = updatedDesign.iterations.filter(
                  iteration => existingIterations.some(existing => existing.id === iteration.id)
                );
                
                // Update each modified iteration
                for (const updatedIteration of updatedIterations) {
                  try {
                    await supabaseService.updateIteration(updatedIteration.id, {
                      position: updatedIteration.position,
                      dimensions: updatedIteration.dimensions
                    });
                  } catch (error) {
                    logError('update-iteration-error', `Error updating iteration ${updatedIteration.id}:`, error);
                  }
                }
              }
            } catch (error) {
              logError('update-design-error', `Error updating design ${updatedDesign.id}:`, error);
            }
          }
          
          // Handle deleted designs (designs in current page that aren't in the updates)
          const deletedDesigns = existingDesigns.filter(
            design => !pageDesigns.some(updated => updated.id === design.id)
          );
          
          // Delete each removed design
          for (const deletedDesign of deletedDesigns) {
            try {
              await supabaseService.deleteDesign(deletedDesign.id);
            } catch (error) {
              logError('delete-design-error', `Error deleting design ${deletedDesign.id}:`, error);
            }
          }
        }
      }
      
      // Update page metadata (name, etc.) and local state
      // These changes need to be kept separate from the design changes to avoid conflicts
      if (updates.name) {
        try {
          // Update in Supabase if session exists
          const session = await supabaseService.getSession();
          if (session) {
            // Only update basic properties, not designs (handled separately above)
            const basicUpdates = { ...updates };
            delete basicUpdates.designs; // Remove designs to avoid overwriting
            
            await supabaseService.updatePage(id, basicUpdates);
          }
        } catch (error) {
          logError('update-page-metadata-error', `Error updating page metadata for ${id}:`, error);
        }
      }
      
      // Update local state regardless of Supabase success
      setPages(prevPages => prevPages.map(page => {
        if (page.id === id) {
          // Merge updates with current page state
          return { ...page, ...updates };
        }
        return page;
      }));
      
      // If we're updating the current page, also update currentPage state
      if (currentPage?.id === id) {
        setCurrentPage(prev => prev ? { ...prev, ...updates } : null);
      }
      
      // Update localStorage
      try {
        const updatedPages = pages.map(page => 
          page.id === id ? { ...page, ...updates } : page
        );
        localStorage.setItem('coterate_pages', JSON.stringify(updatedPages));
        logInfo('local-stored', 'Updated pages in localStorage after page update');
      } catch (error) {
        logError('local-store-error', 'Error updating localStorage after page update:', error);
      }
    } catch (error) {
      logError('update-page-error', 'Error updating page:', error);
    }
  };
  
  // Delete a page
  const deletePage = async (id: string) => {
    try {
      logInfo('deleting', `Deleting page with ID: ${id}`);
      
      const session = await supabaseService.getSession();
      
      if (session) {
        // Use the new normalized schema method
        const success = await supabaseService.deletePageNormalized(id);
        
        if (success) {
          // Update state
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
          
          logInfo('success', `Page deleted successfully: ${id}`);
          return;
        }
      }
      
      // Fallback to localStorage if Supabase call fails or there's no session
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
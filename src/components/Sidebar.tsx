import React, { useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { usePageContext } from '../contexts/PageContext';
import { Page } from '../types';
import FigmaFileSelector from './FigmaFileSelector';
import supabaseService from '../services/SupabaseService';

const SidebarContainer = styled.div`
  width: 230px;
  height: calc(100% - 60px);
  margin-top: 60px; /* Start below the header */
  border-right: 1px solid #4D4D4D;
  background-color: #383838;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 100; /* Lower z-index than header */
  overflow: hidden; /* Ensure the pseudo-element doesn't overflow */
  
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    opacity: 0.6;
    pointer-events: none;
    z-index: -1;
    background-color: transparent;
    background-size: 200px;
    filter: url(#noise);
    mix-blend-mode: overlay;
    width: 100%;
    height: 100%;
  }
`;

const SectionTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: #FFFFFF;
  margin: 16px 16px 8px 16px;
  position: relative;
  z-index: 2;
`;

const Header = styled.div`
  padding: 16px;
  height: 60px;
  display: flex;
  align-items: center;
  position: relative;
  z-index: 2;
`;

const Title = styled.h1`
  font-size: 18px;
  font-weight: 600;
  color: #FFFFFF;
  position: relative;
  z-index: 2;
`;

const ButtonsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 16px 8px;
  position: relative;
  z-index: 2;
`;

const NewPageButton = styled.button`
  padding: 10px 15px;
  background-color: #767676;
  color: #FFFFFF;
  border-radius: 8px;
  font-weight: 600;
  transition: background-color 0.2s;
  width: 100%;
  text-align: center;
  border: 1px solid #4D4D4D;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  font-family: 'Plus Jakarta Sans', sans-serif;
  
  &:hover {
    background-color: #686868;
  }
`;

const FigmaImportButton = styled(NewPageButton)`
  background-color: #383838;
  color: #FFFFFF;
  border: 1px solid #26D4C8;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover {
    background-color: #303030;
  }
`;

const FigmaIcon = styled.span`
  font-size: 16px;
`;

const PageList = styled.div`
  flex: 1;
  overflow-y: auto;
  margin-top: 0;
  position: relative;
  z-index: 2;
`;

const MoreButtonContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const MoreButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: #FFFFFF;
  padding: 2px 8px;
  opacity: 0;
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  transition: opacity 0.2s ease;
  
  &:hover {
    opacity: 1;
  }
`;

const PageItem = styled.div<{ isActive: boolean }>`
  padding: 12px 16px;
  cursor: pointer;
  background-color: ${props => props.isActive ? '#505050' : 'transparent'};
  position: relative;
  height: 44px;
  display: flex;
  align-items: center;
  
  &:hover {
    background-color: ${props => props.isActive ? '#505050' : '#444444'};
  }
  
  /* Show the MoreButton on hover with opacity */
  &:hover ${MoreButton} {
    opacity: 0.5;
  }
`;

const PageName = styled.div`
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  color: #FFFFFF;
  font-size: 14px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  width: 100%;
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  background-color: #383838;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  z-index: 10;
  min-width: 150px;
  margin-top: 5px;
  border: 1px solid #4D4D4D;
`;

const MenuItem = styled.button`
  display: block;
  width: 100%;
  padding: 8px 16px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 400;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #FFFFFF;
  
  &:hover {
    background-color: #505050;
  }
  
  &.delete {
    color: #ff6b6b;
    
    &:hover {
      background-color: #5a3030;
    }
  }
`;

// Inline edit input
const EditInput = styled.input`
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #26D4C8;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  background-color: #444444;
  color: #FFFFFF;
  font-family: 'Plus Jakarta Sans', sans-serif;
  
  &:focus {
    outline: none;
  }
`;

// Add new styled components for the user profile section
const UserProfileSection = styled.div`
  padding: 16px;
  background-color: #393A3A;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  width: 100%;
  margin: 0;
  position: relative;
  
  &:hover {
    background-color: #444444;
  }
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  font-family: 'Plus Jakarta Sans', sans-serif;
`;

const UserName = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: #FFFFFF;
`;

const UserEmail = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: #CFCFCF;
`;

const ChevronIcon = styled.div`
  color: #FFFFFF;
`;

// Dropdown menu for user profile
const UserDropdownMenu = styled(DropdownMenu)`
  right: 8px;
  top: auto;
  bottom: 100%;
  margin-bottom: 5px;
`;

// Add a new styled component for the bottom section
const BottomSection = styled.div`
  margin-top: auto;
  width: 100%;
  position: relative;
  z-index: 2;
`;

interface DropdownProps {
  pageId: string;
  pageName: string;
  onClose: () => void;
  onRename: (id: string) => void;
}

const Dropdown: React.FC<DropdownProps> = ({ pageId, pageName, onClose, onRename }) => {
  const { deletePage } = usePageContext();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  
  const handleDelete = () => {
    deletePage(pageId);
    onClose();
  };
  
  const handleRename = () => {
    onRename(pageId);
    onClose();
  };
  
  return (
    <DropdownMenu ref={dropdownRef}>
      <MenuItem onClick={handleRename}>
        Rename Page
      </MenuItem>
      <MenuItem className="delete" onClick={handleDelete}>
        Delete Page
      </MenuItem>
    </DropdownMenu>
  );
};

// Modified the existing Dropdown component to be reusable
interface UserDropdownProps {
  onClose: () => void;
  onSignOut: () => void;
}

const UserDropdown: React.FC<UserDropdownProps> = ({ onClose, onSignOut }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  
  const handleSignOut = () => {
    onSignOut();
    onClose();
  };
  
  return (
    <UserDropdownMenu ref={dropdownRef}>
      <MenuItem onClick={handleSignOut}>
        Sign Out
      </MenuItem>
    </UserDropdownMenu>
  );
};

export const Sidebar: React.FC = () => {
  const { pages, addPage, setCurrentPage, currentPage, updatePage, deletePage } = usePageContext();
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState<string>('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showFigmaModal, setShowFigmaModal] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [figmaUser, setFigmaUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userDropdownOpen, setUserDropdownOpen] = useState<boolean>(false);
  
  const editInputRef = useRef<HTMLInputElement>(null);
  const figmaModalRef = useRef<HTMLDivElement>(null);
  
  // Check authentication status and get user data
  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      
      console.log('==== CHECKING FIGMA AUTH STATUS ====');
      
      // Check if authenticated with Figma using our new method
      const isAuth = await supabaseService.isAuthenticatedWithFigma();
      console.log('Figma auth status:', isAuth);
      setIsAuthenticated(isAuth);
      
      if (isAuth) {
        // Try to get user data
        try {
          console.log('Authenticated with Figma, fetching user data...');
          const userData = await supabaseService.getFigmaUserData();
          console.log('Figma user data response:', userData);
          
          if (userData) {
            console.log('Setting Figma user data:', {
              handle: userData.handle,
              email: userData.email
            });
            setFigmaUser(userData);
          } else {
            console.error('Failed to get Figma user data');
          }
        } catch (userError) {
          console.error('Error fetching Figma user data:', userError);
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Call checkAuthStatus on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await supabaseService.signOut();
      setIsAuthenticated(false);
      setFigmaUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  const toggleMenu = (pageId: string) => {
    setActiveDropdown(activeDropdown === pageId ? null : pageId);
  };
  
  const closeMenu = () => {
    setActiveDropdown(null);
  };
  
  const toggleUserDropdown = () => {
    setUserDropdownOpen(!userDropdownOpen);
  };
  
  const closeUserDropdown = () => {
    setUserDropdownOpen(false);
  };
  
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>, page: Page) => {
    if (editingPageId === page.id) return;
    if (e.target instanceof HTMLButtonElement) return;
    
    setCurrentPage(page);
  };
  
  const handleAddPage = () => {
    const newPageName = `Page ${pages.length + 1}`;
    addPage(newPageName);
  };
  
  const startEditing = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    if (page) {
      setEditingPageId(pageId);
      setEditingPageName(page.name);
      
      // Focus the input after it's rendered
      setTimeout(() => {
        if (editInputRef.current) {
          editInputRef.current.focus();
          editInputRef.current.select();
        }
      }, 10);
    }
  };
  
  const savePageName = useCallback(() => {
    if (editingPageId && editingPageName.trim()) {
      updatePage(editingPageId, { name: editingPageName.trim() });
    }
    setEditingPageId(null);
  }, [editingPageId, editingPageName, updatePage]);
  
  const cancelEditing = () => {
    setEditingPageId(null);
  };
  
  const openFigmaModal = async () => {
    try {
      setIsLoading(true);
      
      // Check if user is already authenticated with Figma via Supabase
      const session = await supabaseService.getSession();
      
      // Safely check if session has provider_token property
      if (session && typeof session === 'object' && 'provider_token' in session) {
        console.log('User already authenticated, showing file selector');
        // User is already authenticated, show the file selector
        setShowFigmaModal(true);
      } else {
        console.log('User needs to authenticate, starting OAuth flow');
        // User needs to authenticate, start the OAuth flow
        await supabaseService.signInWithFigma();
        // The page will redirect to Figma for authentication
      }
    } catch (error) {
      console.error('Error starting Figma authentication:', error);
      alert('Failed to authenticate with Figma. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const closeFigmaModal = () => {
    setShowFigmaModal(false);
  };
  
  // Handle clicks outside the edit input
  useEffect(() => {
    if (!editingPageId) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (editInputRef.current && !editInputRef.current.contains(event.target as Node)) {
        savePageName();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingPageId, savePageName]);
  
  return (
    <SidebarContainer>
      <ButtonsContainer>
        <NewPageButton onClick={handleAddPage}>
          + New Page
        </NewPageButton>
        
        {!isAuthenticated && (
          <FigmaImportButton onClick={openFigmaModal} disabled={isLoading}>
            <FigmaIcon>
              <svg width="16" height="16" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 28.5C19 25.9804 20.0009 23.5641 21.7825 21.7825C23.5641 20.0009 25.9804 19 28.5 19C31.0196 19 33.4359 20.0009 35.2175 21.7825C36.9991 23.5641 38 25.9804 38 28.5C38 31.0196 36.9991 33.4359 35.2175 35.2175C33.4359 36.9991 31.0196 38 28.5 38C25.9804 38 23.5641 36.9991 21.7825 35.2175C20.0009 33.4359 19 31.0196 19 28.5Z" fill="white"/>
                <path d="M0 47.5C0 44.9804 1.00089 42.5641 2.78249 40.7825C4.56408 39.0009 6.98044 38 9.5 38H19V47.5C19 50.0196 17.9991 52.4359 16.2175 54.2175C14.4359 55.9991 12.0196 57 9.5 57C6.98044 57 4.56408 55.9991 2.78249 54.2175C1.00089 52.4359 0 50.0196 0 47.5Z" fill="white"/>
                <path d="M19 0V19H28.5C31.0196 19 33.4359 17.9991 35.2175 16.2175C36.9991 14.4359 38 12.0196 38 9.5C38 6.98044 36.9991 4.56408 35.2175 2.78249C33.4359 1.00089 31.0196 0 28.5 0H19Z" fill="white"/>
                <path d="M0 9.5C0 12.0196 1.00089 14.4359 2.78249 16.2175C4.56408 17.9991 6.98044 19 9.5 19H19V0H9.5C6.98044 0 4.56408 1.00089 2.78249 2.78249C1.00089 4.56408 0 6.98044 0 9.5Z" fill="white"/>
                <path d="M0 28.5C0 31.0196 1.00089 33.4359 2.78249 35.2175C4.56408 36.9991 6.98044 38 9.5 38H19V19H9.5C6.98044 19 4.56408 20.0009 2.78249 21.7825C1.00089 23.5641 0 25.9804 0 28.5Z" fill="white"/>
              </svg>
            </FigmaIcon>
            {isLoading ? 'Loading...' : 'Sign In with Figma'}
          </FigmaImportButton>
        )}
      </ButtonsContainer>
      
      <PageList>
        {pages.map(page => (
          <PageItem 
            key={page.id}
            isActive={currentPage?.id === page.id}
            onClick={(e) => handlePageClick(e, page)}
          >
            <PageName>
              {editingPageId === page.id ? (
                <EditInput 
                  ref={editInputRef}
                  value={editingPageName} 
                  onChange={(e) => setEditingPageName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') savePageName();
                    if (e.key === 'Escape') cancelEditing();
                  }}
                />
              ) : page.name}
              
              {editingPageId !== page.id && (
                <MoreButtonContainer>
                  <MoreButton 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMenu(page.id);
                    }}
                  >
                    •••
                  </MoreButton>
                  
                  {activeDropdown === page.id && (
                    <Dropdown 
                      pageId={page.id}
                      pageName={page.name}
                      onClose={closeMenu}
                      onRename={startEditing}
                    />
                  )}
                </MoreButtonContainer>
              )}
            </PageName>
          </PageItem>
        ))}
      </PageList>
      
      {/* Add the user profile section at the bottom */}
      {isAuthenticated && (
        <BottomSection>
          <UserProfileSection onClick={toggleUserDropdown}>
            <UserInfo>
              {figmaUser ? (
                <>
                  <UserName>{figmaUser.handle || 'Figma User'}</UserName>
                  <UserEmail>{figmaUser.email || ''}</UserEmail>
                </>
              ) : (
                <UserName>Authenticated with Figma</UserName>
              )}
            </UserInfo>
            <ChevronIcon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 15L12 9L18 15" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </ChevronIcon>
            {userDropdownOpen && (
              <UserDropdown onClose={closeUserDropdown} onSignOut={handleSignOut} />
            )}
          </UserProfileSection>
        </BottomSection>
      )}
      
      {/* Figma File Selector Modal */}
      <FigmaFileSelector 
        isOpen={showFigmaModal} 
        onClose={closeFigmaModal}
      />
    </SidebarContainer>
  );
}; 
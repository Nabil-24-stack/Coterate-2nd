import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { usePageContext } from '../contexts/PageContext';
import { Page } from '../types';
import { signInWithFigma, signOut, getCurrentUser } from '../services/SupabaseService';

// Logo component
const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 18px;
  color: #333;
  font-family: 'Plus Jakarta Sans', sans-serif;
`;

const LogoImage = styled.img`
  width: 24px;
  height: 24px;
  object-fit: contain;
`;

const SidebarContainer = styled.div`
  width: 230px;
  height: calc(100% - 60px);
  margin-top: 60px; /* Start below the header */
  border-right: 1px solid #E3E6EA;
  border-top: 2px solid #E3E6EA; /* Increased border width for visibility */
  background-color: #F8F8F8;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 10;
  box-shadow: inset 0 1px 0 #E3E6EA; /* Add inset shadow to reinforce top border */
`;

const Header = styled.div`
  padding: 16px;
  height: 60px;
  display: flex;
  align-items: center;
`;

const SectionTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 16px 16px 8px 16px;
`;

const Title = styled.h1`
  font-size: 18px;
  font-weight: 600;
  color: #333;
`;

const NewPageButton = styled.button`
  margin: 16px;
  padding: 10px 15px;
  background-color: white;
  color: #333;
  border-radius: 8px;
  font-weight: 600;
  transition: background-color 0.2s;
  width: calc(100% - 32px);
  text-align: center;
  border: 1px solid #E3E6EA;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  font-family: 'Plus Jakarta Sans', sans-serif;
  
  &:hover {
    background-color: #f5f5f5;
  }
`;

const PageList = styled.div`
  flex: 1;
  overflow-y: auto;
  margin-top: 8px;
`;

const PageItem = styled.div<{ isActive: boolean }>`
  padding: 12px 16px;
  cursor: pointer;
  background-color: ${props => props.isActive ? '#EFEFEF' : 'transparent'};
  position: relative;
  
  &:hover {
    background-color: ${props => props.isActive ? '#EFEFEF' : 'rgba(0, 0, 0, 0.03)'};
  }
`;

const PageName = styled.div`
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  color: #333;
  font-size: 14px;
  font-family: 'Plus Jakarta Sans', sans-serif;
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
  color: #666;
  padding: 2px 8px;
  opacity: 0.5;
  
  &:hover {
    opacity: 1;
  }
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  z-index: 10;
  min-width: 150px;
  margin-top: 5px;
  border: 1px solid #E3E6EA;
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
  
  &:hover {
    background-color: #f5f5f5;
  }
  
  &.delete {
    color: #e53935;
    
    &:hover {
      background-color: #ffebee;
    }
  }
`;

// Inline edit input
const EditInput = styled.input`
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #4A90E2;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  background-color: white;
  font-family: 'Plus Jakarta Sans', sans-serif;
  
  &:focus {
    outline: none;
  }
`;

// Enhanced user section styling
const UserSection = styled.div`
  padding: 16px;
  border-top: 1px solid #E3E6EA;
  margin-top: auto;
`;

const UserProfileButton = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: white;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid #E3E6EA;
  position: relative;
  transition: all 0.2s;
  
  &:hover {
    background-color: #f5f5f5;
  }
`;

const ProfileInfo = styled.div`
  flex: 1;
  margin-left: 12px;
  overflow: hidden;
`;

const ProfileName = styled.div`
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ProfileEmail = styled.div`
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FigmaIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background-color: #000;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
`;

const Avatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 16px;
  background-color: #4A90E2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: white;
  font-size: 14px;
`;

const UserDropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
`;

const UserDropdownItem = styled.div`
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  
  &:hover {
    background-color: #f5f5f5;
  }
  
  &.danger {
    color: #e53935;
    
    &:hover {
      background-color: #ffebee;
    }
  }
`;

const SignInButton = styled.button`
  width: 100%;
  padding: 10px 0;
  background-color: #4A90E2;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #3A80D2;
  }
  
  svg {
    width: 18px;
    height: 18px;
  }
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

// Debug component to help diagnose authentication issues
const FigmaDebugSection = () => {
  const [tokenInput, setTokenInput] = useState('');
  const [debugVisible, setDebugVisible] = useState(false);
  
  // Only show in development mode
  const isDevelopment = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1';
  
  if (!isDevelopment) return null;
  
  const handleSetToken = () => {
    if (!tokenInput) return;
    
    try {
      // Import dynamically to avoid circular dependencies
      const FigmaService = require('../services/FigmaService');
      FigmaService.setFigmaTokenDirectly(tokenInput);
      setTokenInput('');
    } catch (error) {
      console.error('Error setting token:', error);
    }
  };
  
  return (
    <div style={{ 
      marginTop: '20px', 
      padding: '10px', 
      background: '#f5f5f5', 
      borderRadius: '4px',
      display: debugVisible ? 'block' : 'none'
    }}>
      <div style={{ marginBottom: '10px', fontWeight: 'bold', cursor: 'pointer' }} 
           onClick={() => setDebugVisible(!debugVisible)}>
        🔧 Debug Tools
      </div>
      
      {debugVisible && (
        <>
          <div style={{ fontSize: '12px', marginBottom: '5px' }}>Direct Figma Token (for testing):</div>
          <div style={{ display: 'flex', marginBottom: '10px' }}>
            <input 
              type="text" 
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste Figma token here"
              style={{ 
                flex: 1, 
                padding: '4px 8px', 
                fontSize: '12px',
                border: '1px solid #ddd'
              }}
            />
            <button 
              onClick={handleSetToken}
              style={{
                background: '#4A90E2',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                marginLeft: '5px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Set
            </button>
          </div>
          
          <div style={{ fontSize: '12px', marginBottom: '5px' }}>
            Current localStorage token: {localStorage.getItem('figma_provider_token') ? '✅ Present' : '❌ Missing'}
          </div>
        </>
      )}
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { pages, currentPage, setCurrentPage, addPage, renamePage, isLoggedIn, userProfile } = usePageContext();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState('');
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  
  // Check login status and update user info
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        // Check for a stored Figma token as additional verification
        const figmaToken = localStorage.getItem('figma_provider_token');
        
        if (isLoggedIn && userProfile) {
          // Extract user info from profile
          const name = userProfile.user_metadata?.full_name || 'User';
          const email = userProfile.email || '';
          
          console.log('Rendering user section, isLoggedIn:', isLoggedIn);
          console.log('User profile available:', !!userProfile);
          console.log(`User: ${name} (${email})`);
          
          if (figmaToken) {
            console.log('Figma token is available - user is fully authenticated');
          }
          
          setUserName(name);
          setUserEmail(email);
        } else {
          // Reset user info when logged out
          console.log('Not logged in or no user profile, clearing user display');
          setUserName('');
          setUserEmail('');
        }
      } catch (error) {
        console.error('Error handling user profile in sidebar:', error);
      }
    };
    
    checkLoginStatus();
  }, [isLoggedIn, userProfile]);
  
  // Handle click outside user dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userDropdownRef.current && 
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const toggleMenu = (pageId: string) => {
    setOpenMenuId(openMenuId === pageId ? null : pageId);
  };
  
  const closeMenu = () => {
    setOpenMenuId(null);
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
  
  const savePageName = () => {
    if (editingPageId && editingPageName.trim()) {
      renamePage(editingPageId, editingPageName.trim());
    }
    setEditingPageId(null);
  };
  
  const cancelEditing = () => {
    setEditingPageId(null);
  };
  
  // Handle keyboard events for the edit input
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      savePageName();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
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
  }, [editingPageId, editingPageName, savePageName]);
  
  // Toggle user dropdown
  const toggleUserDropdown = () => {
    setShowUserDropdown(!showUserDropdown);
  };
  
  // Handle Figma login
  const handleFigmaLogin = async () => {
    try {
      // Clear any existing tokens first to ensure fresh authentication
      localStorage.removeItem('figma_provider_token');
      console.log('Initiating Figma sign-in process...');
      await signInWithFigma();
    } catch (error) {
      console.error('Error signing in with Figma:', error);
    }
  };
  
  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
      setShowUserDropdown(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  // Render the user section
  const renderUserSection = () => {
    console.log('Rendering user section, isLoggedIn:', isLoggedIn);
    console.log('User profile available:', Boolean(userProfile));
    
    if (isLoggedIn && userProfile) {
      return (
        <UserSection>
          <UserProfileButton onClick={toggleUserDropdown}>
            <FigmaIcon>F</FigmaIcon>
            <ProfileInfo>
              <ProfileName>{userName || 'Figma User'}</ProfileName>
              {userEmail && <ProfileEmail>{userEmail}</ProfileEmail>}
            </ProfileInfo>
          </UserProfileButton>
          
          {showUserDropdown && (
            <UserDropdownMenu ref={userDropdownRef}>
              <UserDropdownItem className="danger" onClick={handleSignOut}>
                Sign Out
              </UserDropdownItem>
            </UserDropdownMenu>
          )}
        </UserSection>
      );
    }
    
    return (
      <UserSection>
        <SignInButton onClick={handleFigmaLogin}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
          Sign In with Figma
        </SignInButton>
      </UserSection>
    );
  };
  
  return (
    <SidebarContainer>
      <Header>
        <Logo>
          <LogoImage src={`${process.env.PUBLIC_URL}/logo192.png`} alt="Coterate Logo" />
          Coterate
        </Logo>
      </Header>
      
      <NewPageButton onClick={() => addPage('')}>+ New Page</NewPageButton>
      
      <SectionTitle>Pages</SectionTitle>
      
      <PageList>
        {pages.map((page) => (
          <PageItem
            key={page.id}
            isActive={currentPage?.id === page.id}
            onClick={(e) => handlePageClick(e, page)}
          >
            {editingPageId === page.id ? (
              <EditInput
                ref={editInputRef}
                value={editingPageName}
                onChange={(e) => setEditingPageName(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={savePageName}
                autoFocus
              />
            ) : (
              <PageName>
                {page.name}
                <MoreButtonContainer>
                  <MoreButton onClick={() => toggleMenu(page.id)}>•••</MoreButton>
                  {openMenuId === page.id && (
                    <Dropdown
                      pageId={page.id}
                      pageName={page.name}
                      onClose={closeMenu}
                      onRename={startEditing}
                    />
                  )}
                </MoreButtonContainer>
              </PageName>
            )}
          </PageItem>
        ))}
      </PageList>
      
      {renderUserSection()}
      
      <FigmaDebugSection />
    </SidebarContainer>
  );
}; 
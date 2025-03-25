import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { usePageContext } from '../contexts/PageContext';
import { Page } from '../types';
import FigmaFileSelector from './FigmaFileSelector';
import FigmaService from '../services/FigmaService';

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

const ButtonsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 16px;
`;

const NewPageButton = styled.button`
  padding: 10px 15px;
  background-color: white;
  color: #333;
  border-radius: 8px;
  font-weight: 600;
  transition: background-color 0.2s;
  width: 100%;
  text-align: center;
  border: 1px solid #E3E6EA;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  font-family: 'Plus Jakarta Sans', sans-serif;
  
  &:hover {
    background-color: #f5f5f5;
  }
`;

const FigmaImportButton = styled(NewPageButton)`
  background-color: #1E1E1E;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover {
    background-color: #000;
  }
`;

const FigmaIcon = styled.span`
  font-size: 16px;
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

export const Sidebar: React.FC = () => {
  const { pages, currentPage, setCurrentPage, addPage, renamePage } = usePageContext();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState('');
  const [isFigmaModalOpen, setIsFigmaModalOpen] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  
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
  
  const openFigmaModal = () => {
    setIsFigmaModalOpen(true);
  };
  
  const closeFigmaModal = () => {
    setIsFigmaModalOpen(false);
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
  
  // Check if user is already authenticated with Figma
  const isFigmaAuthenticated = FigmaService.isAuthenticated();
  
  return (
    <SidebarContainer>
      <SectionTitle>Pages</SectionTitle>
      
      <ButtonsContainer>
        <NewPageButton onClick={handleAddPage}>
          + New Page
        </NewPageButton>
        
        <FigmaImportButton onClick={openFigmaModal}>
          <FigmaIcon>
            <svg width="16" height="16" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 28.5C19 25.9804 20.0009 23.5641 21.7825 21.7825C23.5641 20.0009 25.9804 19 28.5 19C31.0196 19 33.4359 20.0009 35.2175 21.7825C36.9991 23.5641 38 25.9804 38 28.5C38 31.0196 36.9991 33.4359 35.2175 35.2175C33.4359 36.9991 31.0196 38 28.5 38C25.9804 38 23.5641 36.9991 21.7825 35.2175C20.0009 33.4359 19 31.0196 19 28.5Z" fill="white"/>
              <path d="M0 47.5C0 44.9804 1.00089 42.5641 2.78249 40.7825C4.56408 39.0009 6.98044 38 9.5 38H19V47.5C19 50.0196 17.9991 52.4359 16.2175 54.2175C14.4359 55.9991 12.0196 57 9.5 57C6.98044 57 4.56408 55.9991 2.78249 54.2175C1.00089 52.4359 0 50.0196 0 47.5Z" fill="white"/>
              <path d="M19 0V19H28.5C31.0196 19 33.4359 17.9991 35.2175 16.2175C36.9991 14.4359 38 12.0196 38 9.5C38 6.98044 36.9991 4.56408 35.2175 2.78249C33.4359 1.00089 31.0196 0 28.5 0H19Z" fill="white"/>
              <path d="M0 9.5C0 12.0196 1.00089 14.4359 2.78249 16.2175C4.56408 17.9991 6.98044 19 9.5 19H19V0H9.5C6.98044 0 4.56408 1.00089 2.78249 2.78249C1.00089 4.56408 0 6.98044 0 9.5Z" fill="white"/>
              <path d="M0 28.5C0 31.0196 1.00089 33.4359 2.78249 35.2175C4.56408 36.9991 6.98044 38 9.5 38H19V19H9.5C6.98044 19 4.56408 20.0009 2.78249 21.7825C1.00089 23.5641 0 25.9804 0 28.5Z" fill="white"/>
            </svg>
          </FigmaIcon>
          Import with Figma
        </FigmaImportButton>
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
                  
                  {openMenuId === page.id && (
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
      
      {/* Figma File Selector Modal */}
      <FigmaFileSelector 
        isOpen={isFigmaModalOpen} 
        onClose={closeFigmaModal}
      />
    </SidebarContainer>
  );
}; 
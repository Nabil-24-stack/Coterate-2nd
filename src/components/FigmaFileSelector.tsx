import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { FigmaFile, FigmaNode } from '../services/FigmaService';
import { usePageContext } from '../contexts/PageContext';
import supabaseService from '../services/SupabaseService';

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 80%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #E3E6EA;
`;

const ModalTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
  
  &:hover {
    color: #333;
  }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const Tabs = styled.div`
  display: flex;
  border-bottom: 1px solid #E3E6EA;
  margin-bottom: 24px;
`;

const Tab = styled.button<{ active?: boolean }>`
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 3px solid ${props => props.active ? '#4A90E2' : 'transparent'};
  color: ${props => props.active ? '#4A90E2' : '#666'};
  font-weight: ${props => props.active ? '600' : '400'};
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    color: #4A90E2;
  }
`;

const FilesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
`;

const FileCard = styled.div`
  border: 1px solid #E3E6EA;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
`;

const FileThumb = styled.img`
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-bottom: 1px solid #E3E6EA;
`;

const FileInfo = styled.div`
  padding: 12px;
`;

const FileName = styled.h3`
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FileDate = styled.p`
  font-size: 12px;
  color: #888;
  margin: 0;
`;

const NodesList = styled.div`
  border: 1px solid #E3E6EA;
  border-radius: 8px;
  overflow: hidden;
`;

const NodeItem = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid #E3E6EA;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background-color: #f5f5f5;
  }
  
  display: flex;
  align-items: center;
`;

const NodeName = styled.span`
  font-size: 14px;
  font-weight: 500;
  margin-left: 8px;
`;

const NodeType = styled.span`
  font-size: 12px;
  color: #888;
  background-color: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: auto;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px 24px;
  color: #888;
`;

const AuthButton = styled.button`
  background-color: #1E1E1E;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  margin-top: 16px;
  cursor: pointer;
  
  &:hover {
    background-color: #000;
  }
`;

const LoadingIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
  color: #666;
  flex-direction: column;
`;

const Spinner = styled.div`
  border: 3px solid #f3f3f3;
  border-top: 3px solid #4A90E2;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const BackButton = styled.button`
  background: none;
  border: none;
  display: flex;
  align-items: center;
  color: #4A90E2;
  cursor: pointer;
  padding: 0;
  margin-bottom: 16px;
  font-size: 14px;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ButtonWithIcon = styled.div`
  display: inline-flex;
  align-items: center;
  margin-right: 8px;
`;

interface FigmaFileSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

const FigmaFileSelector: React.FC<FigmaFileSelectorProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'recent' | 'all'>('recent');
  const [loading, setLoading] = useState<boolean>(false);
  const [files, setFiles] = useState<FigmaFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<FigmaFile | null>(null);
  const [frameNodes, setFrameNodes] = useState<FigmaNode[]>([]);
  const [importingNode, setImportingNode] = useState<string | null>(null);
  
  const { addPage } = usePageContext();
  
  // Load user's Figma files when opened
  useEffect(() => {
    if (isOpen) {
      fetchUserFiles();
    }
  }, [isOpen]);
  
  // Fetch user's Figma files using Supabase service
  const fetchUserFiles = async () => {
    setLoading(true);
    try {
      const userFiles = await supabaseService.getFigmaFiles();
      setFiles(userFiles);
    } catch (error) {
      console.error('Error fetching Figma files:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle file selection
  const handleFileSelect = async (file: FigmaFile) => {
    setSelectedFile(file);
    setLoading(true);
    
    try {
      // Get file data to extract frames
      const fileData = await supabaseService.getFigmaFile(file.key);
      
      // Extract frame nodes
      const frames: FigmaNode[] = [];
      
      const extractFrames = (node: any) => {
        if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
          frames.push({
            id: node.id,
            name: node.name,
            type: node.type,
            absoluteBoundingBox: node.absoluteBoundingBox
          });
        }
        
        if (node.children) {
          node.children.forEach(extractFrames);
        }
      };
      
      extractFrames(fileData.document);
      setFrameNodes(frames);
    } catch (error) {
      console.error('Error fetching file data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle node selection
  const handleNodeSelect = async (nodeId: string) => {
    setImportingNode(nodeId);
    
    try {
      if (!selectedFile) return;
      
      // Import the frame as a page
      const newPage = await supabaseService.importFrameAsPage(selectedFile.key, nodeId);
      
      // Add the page to the app with image URL
      addPage(newPage.name, newPage.baseImage);
      
      // Close the modal after a short delay
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Error importing frame:', error);
    } finally {
      setImportingNode(null);
    }
  };
  
  // Go back to file selection
  const handleBack = () => {
    setSelectedFile(null);
    setFrameNodes([]);
  };
  
  if (!isOpen) return null;
  
  return (
    <Modal onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Import from Figma</ModalTitle>
          <CloseButton onClick={onClose}>×</CloseButton>
        </ModalHeader>
        
        <ModalBody>
          {selectedFile ? (
            <>
              <BackButton onClick={handleBack}>
                <ButtonWithIcon>←</ButtonWithIcon> Back to files
              </BackButton>
              
              <ModalTitle style={{ marginBottom: '16px' }}>
                Select a frame from "{selectedFile.name}"
              </ModalTitle>
              
              {loading ? (
                <LoadingIndicator>
                  <Spinner />
                  <p>Loading frames...</p>
                </LoadingIndicator>
              ) : frameNodes.length === 0 ? (
                <EmptyState>
                  <p>No frames found in this file</p>
                </EmptyState>
              ) : (
                <NodesList>
                  {frameNodes.map(node => (
                    <NodeItem 
                      key={node.id} 
                      onClick={() => handleNodeSelect(node.id)}
                      style={{ opacity: importingNode === node.id ? 0.5 : 1 }}
                    >
                      {importingNode === node.id ? (
                        <Spinner style={{ width: '16px', height: '16px' }} />
                      ) : (
                        <span>🖼️</span>
                      )}
                      <NodeName>{node.name}</NodeName>
                      <NodeType>{node.type}</NodeType>
                    </NodeItem>
                  ))}
                </NodesList>
              )}
            </>
          ) : (
            <>
              <Tabs>
                <Tab 
                  active={activeTab === 'recent'} 
                  onClick={() => setActiveTab('recent')}
                >
                  Recent Files
                </Tab>
                <Tab 
                  active={activeTab === 'all'} 
                  onClick={() => setActiveTab('all')}
                >
                  All Files
                </Tab>
              </Tabs>
              
              {loading ? (
                <LoadingIndicator>
                  <Spinner />
                  <p>Loading files...</p>
                </LoadingIndicator>
              ) : files.length === 0 ? (
                <EmptyState>
                  <p>No Figma files found</p>
                </EmptyState>
              ) : (
                <FilesGrid>
                  {files.map(file => (
                    <FileCard key={file.key} onClick={() => handleFileSelect(file)}>
                      <FileThumb src={file.thumbnail_url} alt={file.name} />
                      <FileInfo>
                        <FileName>{file.name}</FileName>
                        <FileDate>
                          {new Date(file.last_modified).toLocaleDateString()}
                        </FileDate>
                      </FileInfo>
                    </FileCard>
                  ))}
                </FilesGrid>
              )}
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default FigmaFileSelector; 
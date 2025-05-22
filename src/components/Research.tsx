import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { usePageContext } from '../contexts/PageContext';

// Create an SVG noise filter
const noiseSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">
  <filter id="noise">
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
    <feColorMatrix type="matrix" values="2.5 0 0 0 0 0 2.5 0 0 0 0 0 2.5 0 0 0 0 0 1 0" />
  </filter>
</svg>
`;

const NoiseContainer = styled.div`
  display: none;
`;

const ResearchContainer = styled.div`
  position: absolute;
  top: 60px; /* Header height */
  right: 0;
  bottom: 0;
  left: 230px; /* Sidebar width */
  background-color: #767676;
  display: flex;
  flex-direction: row;
`;

const ResearchContent = styled.div`
  flex: 1;
  background-color: #393A3A;
  display: flex;
  flex-direction: row;
  gap: 32px;
  padding: 24px;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
`;

const SectionTitleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SectionTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: #FFFFFF;
  font-family: 'Plus Jakarta Sans', sans-serif;
  margin: 0;
`;

const SaveStatus = styled.span<{ isSaving: boolean; isSaved: boolean }>`
  font-size: 12px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: ${props => 
    props.isSaving ? '#CFCFCF' : 
    props.isSaved ? '#26D4C8' : 'transparent'};
  display: flex;
  align-items: center;
  gap: 4px;
  transition: color 0.3s ease;
`;

const SavedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 13L9 17L19 7" stroke="#26D4C8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LoadingIcon = styled.div`
  width: 14px;
  height: 14px;
  border: 2px solid #CFCFCF;
  border-top: 2px solid transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const Card = styled.div`
  background-color: #444444;
  border: 1px solid #5F5F5F;
  border-radius: 8px;
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
`;

const Notes = styled.textarea`
  background-color: transparent;
  border: none;
  color: #CFCFCF;
  font-size: 16px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 600;
  resize: none;
  flex: 1;
  outline: none;
  
  &::placeholder {
    color: #CFCFCF;
  }
`;

const UploadContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  height: 100%;
  padding-top: 20px;
`;

const UploadButton = styled.div`
  border: 1px dashed #26D4C8;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 28px;
  cursor: pointer;
  width: 100%;
  
  &:hover {
    background-color: rgba(38, 212, 200, 0.05);
  }
`;

const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 12H18" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 18V6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const UploadText = styled.p`
  font-size: 16px;
  font-weight: 600;
  color: #FFFFFF;
  margin-top: 10px;
  font-family: 'Plus Jakarta Sans', sans-serif;
`;

const Research: React.FC = () => {
  const { currentPage } = usePageContext();
  const [notesContent, setNotesContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Load saved notes from localStorage when component mounts
  useEffect(() => {
    const savedNotes = localStorage.getItem('coterate_notes');
    if (savedNotes) {
      setNotesContent(savedNotes);
    }
  }, []);
  
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setNotesContent(newValue);
    setIsSaving(true);
    setIsSaved(false);
    
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set a new timeout for saving
    saveTimeoutRef.current = setTimeout(() => {
      saveNotes(newValue);
    }, 1000); // 1 second debounce
  };
  
  const saveNotes = (content: string) => {
    // Save notes to localStorage
    localStorage.setItem('coterate_notes', content);
    
    // Show saved status
    setIsSaving(false);
    setIsSaved(true);
    
    // Clear saved indicator after 3 seconds
    setTimeout(() => {
      setIsSaved(false);
    }, 3000);
  };
  
  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);
  
  return (
    <>
      <NoiseContainer dangerouslySetInnerHTML={{ __html: noiseSvg }} />
      <ResearchContainer>
        <ResearchContent>
          <Section>
            <SectionTitleContainer>
              <SectionTitle>Notes</SectionTitle>
              <SaveStatus isSaving={isSaving} isSaved={isSaved}>
                {isSaving ? (
                  <>
                    <LoadingIcon />
                    Saving...
                  </>
                ) : isSaved ? (
                  <>
                    <SavedIcon />
                    Saved
                  </>
                ) : null}
              </SaveStatus>
            </SectionTitleContainer>
            <Card>
              <Notes 
                placeholder="Write any ad-hoc notes here..." 
                value={notesContent}
                onChange={handleNotesChange}
              />
            </Card>
          </Section>
          
          <Section>
            <SectionTitle>Videos</SectionTitle>
            <Card>
              <UploadContainer>
                <UploadButton>
                  <UploadIcon />
                  <UploadText>Upload</UploadText>
                </UploadButton>
              </UploadContainer>
            </Card>
          </Section>
          
          <Section>
            <SectionTitle>Docs</SectionTitle>
            <Card>
              <UploadContainer>
                <UploadButton>
                  <UploadIcon />
                  <UploadText>Upload</UploadText>
                </UploadButton>
              </UploadContainer>
            </Card>
          </Section>
        </ResearchContent>
      </ResearchContainer>
    </>
  );
};

export default Research; 
import React from 'react';
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

const SectionTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: #FFFFFF;
  font-family: 'Plus Jakarta Sans', sans-serif;
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
  justify-content: center;
  height: 100%;
`;

const UploadButton = styled.div`
  border: 1px dashed #26D4C8;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 61px 28px;
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
  
  return (
    <>
      <NoiseContainer dangerouslySetInnerHTML={{ __html: noiseSvg }} />
      <ResearchContainer>
        <ResearchContent>
          <Section>
            <SectionTitle>Notes</SectionTitle>
            <Card>
              <Notes placeholder="Write any had-hoc notes here..." />
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
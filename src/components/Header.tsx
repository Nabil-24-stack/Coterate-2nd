import React from 'react';
import styled from 'styled-components';

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

const HeaderContainer = styled.header`
  height: 60px;
  background-color: #383838;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  border-bottom: 1px solid #4D4D4D;
  display: flex;
  align-items: center;
  padding: 0 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  
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

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const LogoImage = styled.img`
  width: 36px;
  height: 36px;
  object-fit: contain;
`;

const LogoText = styled.span`
  font-size: 24px;
  font-weight: 600;
  color: #FFFFFF;
  font-family: 'Plus Jakarta Sans', sans-serif;
`;

const Header: React.FC = () => {
  return (
    <>
      <NoiseContainer dangerouslySetInnerHTML={{ __html: noiseSvg }} />
      <HeaderContainer>
        <Logo>
          <LogoImage src="/Logo.png" alt="Coterate Logo" />
          <LogoText>Coterate</LogoText>
        </Logo>
      </HeaderContainer>
    </>
  );
};

export default Header; 
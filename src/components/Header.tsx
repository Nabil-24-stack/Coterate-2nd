import React from 'react';
import styled from 'styled-components';

const HeaderContainer = styled.header`
  height: 60px;
  background-color: #fff;
  border-bottom: 1px solid #e5e5e5;
  display: flex;
  align-items: center;
  padding: 0 16px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const LogoImage = styled.img`
  width: 24px;
  height: 24px;
  object-fit: contain;
`;

const LogoText = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: #333;
  font-family: 'Plus Jakarta Sans', sans-serif;
`;

const Header: React.FC = () => {
  return (
    <HeaderContainer>
      <Logo>
        <LogoImage src="/Coterate logo.png" alt="Coterate Logo" />
        <LogoText>Coterate UI</LogoText>
      </Logo>
    </HeaderContainer>
  );
};

export default Header; 
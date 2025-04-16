import React from 'react';
import styled from 'styled-components';

const HeaderContainer = styled.header`
  height: 60px;
  background-color: #383838;
  background-image: url('/Cot-bg.png');
  background-repeat: repeat;
  background-size: 100px;
  background-position: center;
  background-blend-mode: soft-light;
  border-bottom: 1px solid #4D4D4D;
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
    <HeaderContainer>
      <Logo>
        <LogoImage src="/Logo.png" alt="Coterate Logo" />
        <LogoText>Coterate</LogoText>
      </Logo>
    </HeaderContainer>
  );
};

export default Header; 
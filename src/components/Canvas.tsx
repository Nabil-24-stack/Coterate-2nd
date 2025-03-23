import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { usePageContext } from '../contexts/PageContext';
// Import the logo directly from assets
import logo from '../assets/coterate-logo.svg';
import { UIComponent } from '../types';
import { isAuthenticated } from '../services/SupabaseService';
import { parseFigmaUrl } from '../services/FigmaService';

// Global style to remove focus outlines and borders
const GlobalStyle = createGlobalStyle`
  * {
    outline: none !important;
    &:focus, &:focus-visible, &:focus-within {
      outline: none !important;
      border-color: transparent !important;
      box-shadow: none !important;
    }
  }
  
  img {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
  }
  
  /* Additional reset for all elements */
  div, img, canvas, section, article, figure {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
  }
  
  /* Override browser default focus styles */
  :focus {
    outline: none !important;
  }
  
  ::-moz-focus-inner {
    border: 0 !important;
  }
  
  button, h1, h2, h3, h4, h5, h6, p, span, div {
    font-family: 'Plus Jakarta Sans', sans-serif;
  }
`;

// Export a placeholder component until we can properly update the full file
export const Canvas: React.FC = () => {
  const { currentPage, updatePage, analyzeAndVectorizeImage, toggleOriginalImage, isLoggedIn, userProfile } = usePageContext();
  
  return (
    <div>Loading Canvas...</div>
  );
};

export default Canvas;
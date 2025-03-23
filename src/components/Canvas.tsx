import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { usePageContext } from '../contexts/PageContext';
// Import the logo directly from assets
import logo from '../assets/coterate-logo.svg';
import { UIComponent } from '../types';
import { isAuthenticated } from '../services/SupabaseService';
import { parseFigmaUrl } from '../services/FigmaService';

// Global style to remove focus outlines and borders
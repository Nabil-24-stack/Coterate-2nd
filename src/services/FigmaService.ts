/**
 * DEPRECATED: FigmaService.ts
 * This service has been disabled in favor of a simpler authentication approach.
 * This file remains as a placeholder to prevent import errors in other files.
 */

import { UIComponent } from '../types';

// Constants for design processing
const DUMMY_RESPONSE = {
  components: [],
  imageData: '',
  fileId: '',
  nodeId: '',
  figmaUrl: '',
};

/**
 * Placeholder function that would normally check if Figma API is configured
 * @returns Always returns false since Figma integration is disabled
 */
export const isFigmaApiConfigured = async (): Promise<boolean> => {
  console.warn('Figma integration is disabled');
  return false;
};

/**
 * Placeholder function for importing Figma designs
 * @param figmaUrl - Unused parameter
 * @returns Promise that resolves to an empty response
 */
export const importFigmaDesign = async (figmaUrl: string) => {
  console.warn('Figma integration is disabled. Using local image processing instead.');
  return DUMMY_RESPONSE;
};

/**
 * Parse a Figma URL (legacy function, now a no-op)
 * @param figmaUrl - Figma URL (no longer used)
 * @returns Empty fileId and nodeId
 */
export const parseFigmaUrl = (figmaUrl: string): { fileId: string; nodeId: string } => {
  console.warn('Figma URL parsing is disabled');
  return { fileId: '', nodeId: '' };
};

/**
 * Set a token directly (legacy function, now a no-op)
 * @param token - The token (no longer used)
 */
export const setFigmaTokenDirectly = (token: string): void => {
  console.warn('Figma integration is disabled, token will not be used');
};

/**
 * Legacy function to get client credentials (now returns null values)
 */
export const getFigmaClientCredentials = (): { clientId: string | null; clientSecret: string | null } => {
  return { clientId: null, clientSecret: null };
};

/**
 * Legacy function to reset Figma authentication (now a no-op)
 */
export const resetFigmaAuth = async (): Promise<void> => {
  console.warn('Figma integration is disabled');
}; 
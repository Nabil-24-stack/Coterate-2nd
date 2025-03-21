/**
 * RecraftService.ts
 * Service for interacting with the Recraft API to vectorize images
 */

import axios from 'axios';
import { UIComponent } from '../types';

// API constants
// According to Recraft docs, the correct vectorize endpoint is:
const RECRAFT_API_URL = 'https://external.api.recraft.ai/v1/images/vectorize';

// This should be stored in environment variables for security
// For development, you can use process.env.REACT_APP_RECRAFT_API_KEY
// In production with Vercel, set this in the Vercel environment variables
const getApiKey = () => {
  return process.env.REACT_APP_RECRAFT_API_KEY || '';
};

/**
 * Vectorizes an image using the Recraft API
 * @param imageData - Base64 encoded image data
 * @param highFidelity - Whether to use high fidelity settings for UI preservation
 * @returns Promise with the vectorized SVG data
 */
export const vectorizeImage = async (imageData: string, highFidelity: boolean = true): Promise<string> => {
  try {
    const apiKey = getApiKey();
    console.log('API Key exists:', !!apiKey); // Log if key exists, not the actual key

    // Extract the base64 part if it's a data URL
    let base64Data = imageData;
    if (imageData.startsWith('data:')) {
      base64Data = imageData.split(',')[1];
    }

    // Create a proper FormData object for file upload
    const formData = new FormData();
    
    // Convert base64 to Blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    
    // Append the blob as a file
    formData.append('file', blob, 'image.png');
    formData.append('response_format', 'b64_json');
    
    // Add parameters for high fidelity if requested
    // These parameters may vary based on what the Recraft API actually supports
    if (highFidelity) {
      formData.append('detail_level', 'high');  // Request high level of detail
      formData.append('text_detection', 'true'); // Ensure text is properly detected
      formData.append('preserve_colors', 'true'); // Preserve original colors
      formData.append('fidelity', 'high');      // High fidelity vectorization
    }

    // Following Recraft's documentation - they use Bearer token authentication
    const response = await axios.post(
      RECRAFT_API_URL,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          // Content-Type is automatically set when using FormData
        }
      }
    );

    // According to Recraft docs, the response contains the SVG
    if (response.data && response.data.image && response.data.image.b64_json) {
      // Convert the base64 back to SVG string
      return atob(response.data.image.b64_json);
    } else {
      throw new Error('Invalid response format from Recraft API');
    }
  } catch (error) {
    console.error('Error vectorizing image:', error);
    throw error;
  }
};

/**
 * Extracts a component from an image and vectorizes it
 * This simulates cropping and vectorizing a single component
 * @param imageData - The full image data
 * @param component - The component to extract and vectorize
 * @returns Promise with the vectorized SVG for the component
 */
export const vectorizeComponent = async (imageData: string, component: UIComponent): Promise<string> => {
  try {
    // In a real implementation, you'd extract the component region from the image
    // For now, we'll use the full image and let Recraft handle it
    // A more advanced implementation would crop the image based on component coordinates
    
    const svg = await vectorizeImage(imageData, true);
    
    // In a real implementation, you'd manipulate the SVG to only include the component area
    // by adjusting the viewBox and filtering elements based on their position
    
    return svg;
  } catch (error) {
    console.error(`Error vectorizing component ${component.id}:`, error);
    throw error;
  }
};

/**
 * Vectorizes all components in an array
 * @param imageData - The full image data
 * @param components - Array of components to vectorize
 * @returns Promise with components updated with their vectorized SVGs
 */
export const vectorizeAllComponents = async (imageData: string, components: UIComponent[]): Promise<UIComponent[]> => {
  try {
    // First, create a full vectorized SVG
    const fullSvg = await vectorizeImage(imageData, true);
    
    // Update all components with the same SVG for now
    // In a more advanced implementation, you would extract the specific part of the SVG 
    // that corresponds to each component
    const updatedComponents = components.map(component => ({
      ...component,
      vectorizedSvg: fullSvg
    }));
    
    return updatedComponents;
  } catch (error) {
    console.error('Error vectorizing all components:', error);
    throw error;
  }
};

/**
 * Check if the Recraft API key is configured
 * @returns boolean indicating if the API key is available
 */
export const isRecraftConfigured = (): boolean => {
  return !!getApiKey();
}; 